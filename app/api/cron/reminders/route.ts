import { NextResponse } from "next/server";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/db";
import { sendFeedbackRequest, sendFormReminder, sendReminder } from "@/lib/mailer";
import { realEmail } from "@/lib/payments";
import { feedbackToken, resumeToken } from "@/lib/session";
import { addDays, istDate, slotMs } from "@/lib/slots";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 60;

const BEFORE_MS = 3 * 3600 * 1000; // reminder goes out once, ~3 hours before the slot
const FEEDBACK_AFTER_MS = 24 * 3600 * 1000; // feedback mail: one day after the slot
const FORM_AFTER_MS = 12 * 3600 * 1000, FORM_UNTIL_MS = 72 * 3600 * 1000; // paid but no form: one auto reminder 12 h after payment

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
  // Paid but the reading form is still empty: ONE automatic "form baaki hai" mail with a fresh 24 h link,
  // 12 h after payment (only for payments in the last 3 days). Admin can send more from /admin.
  const os = await db.collection("orders").where("paidAt", ">=", now - FORM_UNTIL_MS).get();
  const pending = os.docs.filter((d) => { const o = d.data(); return o.status === "paid" && !o.formDone && !o.autoFormReminderAt && now - o.paidAt >= FORM_AFTER_MS && realEmail(o.customerEmail, o.email); });
  const forms: string[] = [];
  for (const d of pending) {
    const claimed = await db.runTransaction(async (tx) => {
      const s = (await tx.get(d.ref)).data();
      if (!s || s.autoFormReminderAt || s.formDone) return false;
      tx.update(d.ref, { autoFormReminderAt: Date.now() });
      return true;
    });
    if (!claimed) continue;
    const o = d.data(), site = String(o.origin || process.env.SITE_URL || "https://booking.thedivinetarotonline.com").replace(/\/$/, "");
    try {
      await sendFormReminder({ email: realEmail(o.customerEmail, o.email), bid: d.id, tier: o.tier, formLink: `${site}/api/resume?t=${resumeToken(d.id)}` });
      await d.ref.update({ formReminderAt: Date.now(), formReminders: FieldValue.increment(1) });
      forms.push(`${d.id} ✓`);
    } catch (e: any) {
      await d.ref.update({ autoFormReminderAt: FieldValue.delete() }); // retry on the next run
      forms.push(`${d.id} ✗ ${String(e?.message || e).slice(0, 120)}`);
    }
  }
  // ~1 day after the reading: ONE "kaisi lagi reading?" mail (not for no-shows / refunds; only readings of the last 3 days).
  const fsnap = await db.collection("bookings").where(FieldPath.documentId(), ">=", addDays(today, -3)).where(FieldPath.documentId(), "<=", today + "~").get();
  const site = String(process.env.SITE_URL || "https://booking.thedivinetarotonline.com").replace(/\/$/, "");
  const fbs: string[] = [];
  for (const d of fsnap.docs) {
    const b = d.data(), [date, time] = d.id.split("T"), start = time ? slotMs(date, time) : 0;
    if (b.status !== "confirmed" || !b.email || !b.bid || b.feedbackAt || b.outcome === "noshow" || b.outcome === "refunded") continue;
    if (now - start < FEEDBACK_AFTER_MS || now - start > 72 * 3600e3) continue;
    const claimed = await db.runTransaction(async (tx) => {
      const s = (await tx.get(d.ref)).data();
      if (!s || s.feedbackAt) return false;
      tx.update(d.ref, { feedbackAt: Date.now() });
      return true;
    });
    if (!claimed) continue;
    if ((await db.doc(`feedback/${b.bid}`).get()).exists) continue; // already rated
    try { await sendFeedbackRequest({ name: b.name, email: b.email, bid: b.bid, date, time, tier: b.tier, link: `${site}/feedback?t=${feedbackToken(b.bid)}` }); fbs.push(`${d.id} ✓`); }
    catch (e: any) { await d.ref.update({ feedbackAt: FieldValue.delete() }); fbs.push(`${d.id} ✗ ${String(e?.message || e).slice(0, 120)}`); }
  }
  return NextResponse.json({ checked: snap.size, sent: out, formReminders: forms, feedback: fbs });
}
