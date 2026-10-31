import { NextResponse } from "next/server";
import { CFG_DOC, db, getCfg } from "@/lib/db";
import { createMeet, sendInvite } from "@/lib/calendar";
import { slotMs } from "@/lib/slots";
import { sendClientConfirmation, sendEditLink } from "@/lib/mailer";
import { editUntil } from "@/lib/formEdit";
import { editToken, originOf, resumeToken } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const ENV = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "OWNER_EMAIL"];
import { adminFrom } from "@/lib/adminAuth";
import { logMail } from "@/lib/mailLog";
import { logActivity } from "@/lib/activity";
// Email + password login (see lib/adminAuth.ts); the old shared ADMIN_TOKEN is no longer accepted.
const deny = async (req: Request) => !(await adminFrom(req));

export async function GET(req: Request) {
  if (await deny(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const snap = await db.collection("bookings").where("status", "==", "confirmed").get();
  const bookings = snap.docs.map((d) => ({ slot: d.id, ...d.data() })).sort((a, b) => a.slot.localeCompare(b.slot));
  const os = await db.collection("orders").orderBy("createdAt", "desc").limit(300).get();
  const orders = os.docs.map((d) => { const { origin, plinkId, ...o } = d.data() as any; return { bid: d.id, ...o }; });
  const cs = await db.collection("cancelled").orderBy("cancelledAt", "desc").limit(200).get();
  const cancelled = cs.docs.map((d) => ({ ...(d.data() as any) })).map(({ raw, prevAnswers, ...c }) => c);
  return NextResponse.json({ cfg: await getCfg(), bookings, orders, cancelled, missingEnv: ENV.filter((k) => !process.env[k]) });
}
export async function PUT(req: Request) {
  const who = await adminFrom(req);
  if (!who) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cfg = await req.json(), before = await getCfg();
  await db.doc(CFG_DOC).set(cfg);
  const added = (cfg.blocked || []).filter((d: string) => !before.blocked.includes(d)), removed = before.blocked.filter((d) => !(cfg.blocked || []).includes(d));
  await logActivity(who, "Slot settings save kiye", [added.length && `band: ${added.join(", ")}`, removed.length && `khole: ${removed.join(", ")}`, `${cfg.fromDate}–${cfg.toDate}`].filter(Boolean).join(" · "));
  return NextResponse.json({ ok: true });
}

// Re-create the Meet link and re-send the customer email for one booking.
export async function POST(req: Request) {
  const who = await adminFrom(req);
  if (!who) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.resume) { // 24-hour form link for a paid customer who lost the payment page — share on WhatsApp only
    const o = await db.doc(`orders/${body.resume}`).get();
    if (!o.exists || o.data()!.status !== "paid" || o.data()!.formDone) return NextResponse.json({ error: "Yeh order paid + form-baaki nahi hai." }, { status: 400 });
    await logActivity(who, "Form link banaya", String(body.resume));
    return NextResponse.json({ link: `${originOf(req)}/api/resume?t=${resumeToken(body.resume)}` });
  }
  if (body.sendEditLinks) { // customers whose form was submitted in the last 24 h (window still open) get their edit link once
    const now = Date.now(), os = await db.collection("orders").where("formAt", ">=", now - 24 * 3600e3).get(), out: string[] = [];
    for (const d of os.docs) {
      const o = d.data() as any, until = editUntil(o.formAt, o.slot);
      if (!o.formDone || until < now + 30 * 60e3) continue;
      const ref = db.doc(`bookings/${o.slot}`), b = (await ref.get()).data() as any;
      if (!b || b.bid !== d.id || b.status !== "confirmed" || b.editLinkSentAt) continue;
      const [date, time] = String(o.slot).split("T");
      try { await sendEditLink({ bid: d.id, by: who, name: b.name, email: b.email, date, time, tier: o.tier, editUntil: until, editLink: `${originOf(req)}/api/edit?t=${editToken(d.id, until)}` }); await ref.update({ editLinkSentAt: Date.now() }); out.push(`${o.slot.replace("T", " ")} ✓`); }
      catch (e: any) { out.push(`${o.slot.replace("T", " ")} ✗ ${String(e?.message || e).slice(0, 100)}`); }
    }
    await logActivity(who, "Edit links bheje (Tools)", out.join(" · ") || "koi pending nahi");
    return NextResponse.json({ result: out.length ? `Edit link bheja: ${out.join(" · ")}` : "Koi pending customer nahi (pichhle 24 ghante)." });
  }
  if (body.inviteUpcoming) { // Google Calendar invite for upcoming bookings made before invites were switched on
    const snap = await db.collection("bookings").where("status", "==", "confirmed").get();
    const todo = snap.docs.filter((d) => { const [dt, tm] = d.id.split("T"); return tm && slotMs(dt, tm) > Date.now() && d.data().eventId && !d.data().inviteSentAt; });
    const out: string[] = [];
    for (const d of todo) {
      const b = d.data() as any;
      try { await sendInvite(b.eventId, { email: b.email, bid: b.bid, phone: b.phone, tier: b.tier }); await d.ref.update({ inviteSentAt: Date.now() }); await logMail({ kind: "invite", bid: b.bid, slot: d.id, by: who }, b.email, true); out.push(`${d.id.replace("T", " ")} ✓`); }
      catch (e: any) { await logMail({ kind: "invite", bid: b.bid, slot: d.id, by: who }, b.email, false, e); out.push(`${d.id.replace("T", " ")} ✗ ${String(e?.message || e).slice(0, 120)}`); }
    }
    await logActivity(who, "Calendar invites bheje (Tools)", out.join(" · ") || "koi pending nahi");
    return NextResponse.json({ result: out.length ? `Calendar invite bheja: ${out.join(" · ")}` : "Koi pending upcoming booking nahi hai." });
  }
  const { slot } = body, ref = db.doc(`bookings/${slot}`), s = await ref.get();
  if (!s.exists) return NextResponse.json({ error: "booking nahi mili" }, { status: 404 });
  const b = s.data() as any, [date, time] = String(slot).split("T"), out: string[] = [];
  let meetLink: string | null = b.meetLink || null, calendarErr = "", mailErr = "";
  if (!meetLink) {
    try { const m = await createMeet(slot, b); meetLink = m.meetLink || null; await ref.update({ meetLink, eventId: m.eventId || null, calendarOk: true, calendarErr: "" }); await logMail({ kind: "invite", bid: b.bid, slot, by: who }, b.email, true); out.push("Meet link ban gaya ✓"); }
    catch (e: any) { await logMail({ kind: "invite", bid: b.bid, slot, by: who }, b.email, false, e); calendarErr = String(e?.message || e).slice(0, 300); await ref.update({ calendarOk: false, calendarErr }); out.push("Meet link ERROR: " + calendarErr); }
  }
  if (meetLink || !calendarErr) {
    try { await sendClientConfirmation({ name: b.name, email: b.email, bid: b.bid, date, time, meetLink, tier: b.tier, by: who }); await ref.update({ clientMailOk: true, mailErr: "" }); out.push("Customer ko email bhej di ✓"); }
    catch (e: any) { mailErr = String(e?.message || e).slice(0, 300); await ref.update({ clientMailOk: false, mailErr }); out.push("Email ERROR: " + mailErr); }
  }
  await logActivity(who, "Meet link + email retry", `${slot} · ${out.join(" · ")}`);
  return NextResponse.json({ result: out.join(" · "), meetLink });
}
