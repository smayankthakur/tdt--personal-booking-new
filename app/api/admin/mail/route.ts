import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/db";
import { adminFrom } from "@/lib/adminAuth";
import { sendInvite } from "@/lib/calendar";
import { editUntil } from "@/lib/formEdit";
import { logMail } from "@/lib/mailLog";
import { sendClientConfirmation, sendFormReminder, sendReminder } from "@/lib/mailer";
import { realEmail } from "@/lib/payments";
import { editToken, originOf, resumeToken } from "@/lib/session";
import { slotMs } from "@/lib/slots";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const no = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Email log. ?bid=… → that booking's mails (newest first); otherwise the latest 300 across all bookings. */
export async function GET(req: Request) {
  if (!(await adminFrom(req))) return no("unauthorized", 401);
  const bid = new URL(req.url).searchParams.get("bid");
  const snap = bid
    ? await db.collection("mailLog").where("bid", "==", bid).limit(100).get()
    : await db.collection("mailLog").orderBy("at", "desc").limit(300).get();
  const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.at - a.at);
  return NextResponse.json({ logs });
}

/**
 * Re-send one mail for a booking: { bid, kind }
 *  formReminder → fresh 24 h form link (paid, form not filled yet)
 *  confirm      → booking confirmation with Meet link (+ edit link while the edit window is open)
 *  reminder     → the "reading in ~3 hours" mail (slot still ahead)
 *  invite       → Google Calendar invite again (event must exist)
 */
export async function POST(req: Request) {
  const who = await adminFrom(req);
  if (!who) return no("unauthorized", 401);
  const { bid, kind } = await req.json().catch(() => ({}));
  if (!/^[A-Za-z0-9]{8,20}$/.test(String(bid || ""))) return no("Booking ID galat hai.");
  const oRef = db.doc(`orders/${bid}`), os = await oRef.get();
  if (!os.exists) return no("Order nahi mila.", 404);
  const o = os.data() as any, site = originOf(req);

  try {
    if (kind === "formReminder") {
      if (o.status !== "paid" || o.formDone) return no("Yeh order paid + form-baaki nahi hai.");
      const to = realEmail(o.customerEmail, o.email);
      if (!to) return no("Is order par customer ki email nahi hai — Form link copy karke WhatsApp par bhejein.");
      await sendFormReminder({ email: to, bid, tier: o.tier, formLink: `${site}/api/resume?t=${resumeToken(bid)}`, by: who });
      await oRef.update({ formReminderAt: Date.now(), formReminders: FieldValue.increment(1) });
      return NextResponse.json({ result: `Form reminder bhej diya → ${to} ✓` });
    }

    // the rest need the confirmed booking
    const bRef = o.slot ? db.doc(`bookings/${o.slot}`) : null, bs = bRef ? await bRef.get() : null, b = bs?.data() as any;
    if (!bRef || !b || b.bid !== bid || b.status !== "confirmed") return no("Is order ki confirmed booking nahi mili (form bhara hai?).");
    const [date, time] = String(o.slot).split("T");

    if (kind === "confirm") {
      const until = editUntil(o.formAt, o.slot), open = until > Date.now() + 60e3;
      await sendClientConfirmation({ name: b.name, email: b.email, bid, date, time, meetLink: b.meetLink || null, tier: b.tier, by: who,
        editUntil: until, editLink: open ? `${site}/api/edit?t=${editToken(bid, until)}` : null });
      await bRef.update({ clientMailOk: true, mailErr: "" });
      return NextResponse.json({ result: `Confirmation mail bhej di → ${b.email} ✓` });
    }
    if (kind === "reminder") {
      if (slotMs(date, time) < Date.now()) return no("Slot ka time nikal chuka hai — reminder ka matlab nahi.");
      await sendReminder({ name: b.name, email: b.email, bid, date, time, meetLink: b.meetLink || null, tier: b.tier, by: who });
      await bRef.update({ reminderAt: Date.now() });
      return NextResponse.json({ result: `Reminder bhej diya → ${b.email} ✓` });
    }
    if (kind === "invite") {
      if (!b.eventId) return no("Calendar event nahi bana — pehle 'Meet link + email dobara bhejein' dabayein.");
      try { await sendInvite(b.eventId, { email: b.email, bid, phone: b.phone, tier: b.tier }); }
      catch (e) { await logMail({ kind: "invite", bid, slot: o.slot, by: who }, b.email, false, e); throw e; }
      await logMail({ kind: "invite", bid, slot: o.slot, by: who }, b.email, true);
      await bRef.update({ inviteSentAt: Date.now() });
      return NextResponse.json({ result: `Google Calendar invite dobara bheja → ${b.email} ✓` });
    }
    return no("Yeh mail type nahi pehchana.");
  } catch (e: any) {
    return no(`Mail nahi gaya: ${String(e?.message || e).slice(0, 200)}`, 502);
  }
}
