import { NextResponse } from "next/server";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/db";
import { sendReminder } from "@/lib/mailer";
import { addDays, istDate, slotMs } from "@/lib/slots";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 60;

const SOON_MS = 3 * 3600 * 1000; // "soon" reminder for slots starting within the next 3 h (hourly runner => 2–3 h before)

/**
 * Reminder emails to customers.
 *   mode=soon (default) — slots starting in the next 3 h. Called every hour by .github/workflows/reminders.yml.
 *   mode=morning        — every slot of today (IST). Called once a day by the Vercel cron in vercel.json.
 * Each booking gets each reminder at most once (claimed in a transaction before sending).
 * Auth: "Authorization: Bearer <CRON_SECRET>" (Vercel cron sends this header automatically).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const mode = new URL(req.url).searchParams.get("mode") === "morning" ? "morning" : "soon";
  const flag = mode === "morning" ? "morningReminderAt" : "soonReminderAt";
  const now = Date.now(), today = istDate(now);

  const snap = await db.collection("bookings")
    .where(FieldPath.documentId(), ">=", today)
    .where(FieldPath.documentId(), "<=", addDays(today, 1) + "~").get();
  const due = snap.docs.filter((d) => {
    const b = d.data(), [date, time] = d.id.split("T"), start = time ? slotMs(date, time) : 0;
    if (b.status !== "confirmed" || !b.email || b[flag] || start <= now) return false;
    return mode === "morning" ? date === today : start - now <= SOON_MS;
  });

  const out: string[] = [];
  for (const d of due) {
    const claimed = await db.runTransaction(async (tx) => {
      const s = await tx.get(d.ref);
      if (s.data()?.[flag]) return false;
      tx.update(d.ref, { [flag]: Date.now() });
      return true;
    });
    if (!claimed) continue;
    const b = d.data(), [date, time] = d.id.split("T");
    try {
      await sendReminder({ name: b.name, email: b.email, bid: b.bid, date, time, meetLink: b.meetLink || null, kind: mode });
      out.push(`${d.id} ✓`);
    } catch (e: any) { // release the claim so the next run retries
      await d.ref.update({ [flag]: FieldValue.delete(), reminderErr: String(e?.message || e).slice(0, 300) });
      out.push(`${d.id} ✗ ${String(e?.message || e).slice(0, 120)}`);
    }
  }
  return NextResponse.json({ mode, checked: snap.size, sent: out });
}
