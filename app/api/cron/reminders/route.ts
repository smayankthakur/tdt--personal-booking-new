import { NextResponse } from "next/server";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/db";
import { sendReminder } from "@/lib/mailer";
import { addDays, istDate, slotMs } from "@/lib/slots";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 60;

const BEFORE_MS = 3 * 3600 * 1000; // reminder goes out once, ~3 hours before the slot

/**
 * ONE reminder email per booking, about 3 hours before the slot (with the Meet link).
 * Called every 15 minutes by .github/workflows/reminders.yml, so it lands 2h45m–3h before the slot.
 * Each booking is claimed in a transaction before sending, so it is never sent twice.
 * Auth: "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = Date.now(), today = istDate(now);

  const snap = await db.collection("bookings")
    .where(FieldPath.documentId(), ">=", today)
    .where(FieldPath.documentId(), "<=", addDays(today, 1) + "~").get();
  const due = snap.docs.filter((d) => {
    const b = d.data(), [date, time] = d.id.split("T"), start = time ? slotMs(date, time) : 0;
    return b.status === "confirmed" && b.email && !b.reminderAt && !b.soonReminderAt && start > now && start - now <= BEFORE_MS;
  });

  const out: string[] = [];
  for (const d of due) {
    const claimed = await db.runTransaction(async (tx) => {
      const s = await tx.get(d.ref);
      if (s.data()?.reminderAt) return false;
      tx.update(d.ref, { reminderAt: Date.now() });
      return true;
    });
    if (!claimed) continue;
    const b = d.data(), [date, time] = d.id.split("T");
    try {
      await sendReminder({ name: b.name, email: b.email, bid: b.bid, date, time, meetLink: b.meetLink || null, tier: b.tier });
      out.push(`${d.id} ✓`);
    } catch (e: any) { // release the claim so the next run (15 min later) retries
      await d.ref.update({ reminderAt: FieldValue.delete(), reminderErr: String(e?.message || e).slice(0, 300) });
      out.push(`${d.id} ✗ ${String(e?.message || e).slice(0, 120)}`);
    }
  }
  return NextResponse.json({ checked: snap.size, sent: out });
}
