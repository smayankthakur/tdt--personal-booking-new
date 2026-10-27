import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { sendOtpEmail } from "@/lib/mailer";
import { bidFrom, same, sign } from "@/lib/session";
import { editUntil } from "@/lib/formEdit";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const TTL = 10 * 60 * 1000, COOLDOWN = 45 * 1000, MAX_SENDS_PER_HOUR = 5, MAX_TRIES = 5;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const hash = (bid: string, email: string, code: string) => sign(`otp:${bid}:${email}:${code}`);

/**
 * Email OTP for the reading form. Only for a PAID booking whose form is still pending (cookie), so it can't be
 * used to send mail to arbitrary people. { action: "send", email } | { action: "verify", email, code }.
 * A correct code stores orders/{bid}.verifiedEmail, which /api/form checks.
 */
export async function POST(req: Request) {
  const bid = bidFrom(req);
  if (!bid) return err("Booking nahi mili. Page refresh karein.", 404);
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || "").trim().toLowerCase().slice(0, 200);
  if (!EMAIL.test(email)) return err("Sahi email likhein.");
  const orderRef = db.doc(`orders/${bid}`), o = await orderRef.get();
  // Open for a paid booking whose form is pending, or submitted but still inside its edit window.
  const od = o.data() || {};
  if (!o.exists || od.status !== "paid" || (od.formDone && editUntil(od.formAt, od.slot) < Date.now())) return err("Yeh booking form ke liye open nahi hai.", 409);
  const ref = db.doc(`otps/${bid}`), now = Date.now();

  if (body?.action === "send") {
    const cur = (await ref.get()).data() || {};
    const sends: number[] = (cur.sends || []).filter((t: number) => now - t < 3600e3);
    if (cur.sentAt && now - cur.sentAt < COOLDOWN) return err(`${Math.ceil((COOLDOWN - (now - cur.sentAt)) / 1000)} second baad dobara bhejein.`, 429);
    if (sends.length >= MAX_SENDS_PER_HOUR) return err("Bahut zyada OTP bhej diye. Thodi der baad try karein ya WhatsApp karein +91 88281 16545.", 429);
    const code = String(randomInt(100000, 1000000));
    await ref.set({ email, hash: hash(bid, email, code), exp: now + TTL, tries: 0, sentAt: now, sends: [...sends, now] });
    try { await sendOtpEmail(email, code); }
    catch (e) { console.error("otp mail failed", e); await ref.update({ sentAt: 0 }); return err("OTP email nahi gaya. Email check karke dobara try karein.", 502); }
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "verify") {
    const code = String(body?.code || "").replace(/\D/g, "");
    const s = await ref.get(), d = s.data();
    if (!d || d.email !== email) return err("Pehle is email par OTP bhejein.");
    if (d.exp < now) return err("OTP expire ho gaya. Naya OTP bhejein.");
    if ((d.tries || 0) >= MAX_TRIES) return err("Bahut galat try ho gaye. Naya OTP bhejein.", 429);
    if (code.length !== 6 || !same(hash(bid, email, code), d.hash)) {
      await ref.update({ tries: (d.tries || 0) + 1 });
      return err("Galat OTP. Dobara check karein.");
    }
    await orderRef.update({ verifiedEmail: email, emailVerifiedAt: now });
    await ref.delete();
    return NextResponse.json({ ok: true, email });
  }
  return err("Invalid request");
}
