import { NextResponse } from "next/server";
import { db, getCfg } from "@/lib/db";
import { createMeet } from "@/lib/calendar";
import { sendClientConfirmation } from "@/lib/mailer";
import { originOf, resumeToken } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const ENV = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "OWNER_EMAIL"];
const deny = (req: Request) => !process.env.ADMIN_TOKEN || req.headers.get("x-admin-token") !== process.env.ADMIN_TOKEN;

export async function GET(req: Request) {
  if (deny(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const snap = await db.collection("bookings").where("status", "==", "confirmed").get();
  const bookings = snap.docs.map((d) => ({ slot: d.id, ...d.data() })).sort((a, b) => a.slot.localeCompare(b.slot));
  const os = await db.collection("orders").orderBy("createdAt", "desc").limit(300).get();
  const orders = os.docs.map((d) => { const { origin, plinkId, ...o } = d.data() as any; return { bid: d.id, ...o }; });
  return NextResponse.json({ cfg: await getCfg(), bookings, orders, missingEnv: ENV.filter((k) => !process.env[k]) });
}
export async function PUT(req: Request) {
  if (deny(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await db.doc("config/availability").set(await req.json());
  return NextResponse.json({ ok: true });
}

// Re-create the Meet link and re-send the customer email for one booking.
export async function POST(req: Request) {
  if (deny(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.resume) { // 24-hour form link for a paid customer who lost the payment page — share on WhatsApp only
    const o = await db.doc(`orders/${body.resume}`).get();
    if (!o.exists || o.data()!.status !== "paid" || o.data()!.formDone) return NextResponse.json({ error: "Yeh order paid + form-baaki nahi hai." }, { status: 400 });
    return NextResponse.json({ link: `${originOf(req)}/api/resume?t=${resumeToken(body.resume)}` });
  }
  const { slot } = body, ref = db.doc(`bookings/${slot}`), s = await ref.get();
  if (!s.exists) return NextResponse.json({ error: "booking nahi mili" }, { status: 404 });
  const b = s.data() as any, [date, time] = String(slot).split("T"), out: string[] = [];
  let meetLink: string | null = b.meetLink || null, calendarErr = "", mailErr = "";
  if (!meetLink) {
    try { const m = await createMeet(slot, b); meetLink = m.meetLink || null; await ref.update({ meetLink, eventId: m.eventId || null, calendarOk: true, calendarErr: "" }); out.push("Meet link ban gaya ✓"); }
    catch (e: any) { calendarErr = String(e?.message || e).slice(0, 300); await ref.update({ calendarOk: false, calendarErr }); out.push("Meet link ERROR: " + calendarErr); }
  }
  if (meetLink || !calendarErr) {
    try { await sendClientConfirmation({ name: b.name, email: b.email, bid: b.bid, date, time, meetLink }); await ref.update({ clientMailOk: true, mailErr: "" }); out.push("Customer ko email bhej di ✓"); }
    catch (e: any) { mailErr = String(e?.message || e).slice(0, 300); await ref.update({ clientMailOk: false, mailErr }); out.push("Email ERROR: " + mailErr); }
  }
  return NextResponse.json({ result: out.join(" · "), meetLink });
}
