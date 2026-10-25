import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp, db } from "@/lib/db";
import { e164 } from "@/lib/concerns";
import { bidFrom } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Phone OTP is sent and checked by Firebase Authentication in the browser (SMS + invisible reCAPTCHA).
 * The browser then posts the Firebase ID token here; we verify it server-side and store
 * orders/{bid}.verifiedPhone (E.164), which /api/form checks. { idToken, phone }
 */
export async function POST(req: Request) {
  const bid = bidFrom(req);
  if (!bid) return err("Booking nahi mili. Page refresh karein.", 404);
  const body = await req.json().catch(() => ({}));
  const phone = e164(String(body?.phone || ""));
  const orderRef = db.doc(`orders/${bid}`), o = await orderRef.get();
  if (!o.exists || o.data()!.status !== "paid" || o.data()!.formDone) return err("Yeh booking form ke liye open nahi hai.", 409);
  let tok;
  try { tok = await getAuth(adminApp()).verifyIdToken(String(body?.idToken || "")); }
  catch { return err("Verification fail hua. OTP dobara bhejein."); }
  if (!tok.phone_number || tok.phone_number !== phone) return err("Verified number form wale number se match nahi karta.");
  if (Date.now() / 1000 - (tok.auth_time || 0) > 30 * 60) return err("Verification purana ho gaya. OTP dobara bhejein.");
  await orderRef.update({ verifiedPhone: phone, phoneVerifiedAt: Date.now() });
  getAuth(adminApp()).deleteUser(tok.uid).catch(() => {}); // the Firebase user was only needed for this check
  return NextResponse.json({ ok: true, phone });
}
