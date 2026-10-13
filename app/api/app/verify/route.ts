import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { verifyOrderWithRazorpay } from "@/lib/payments";
import { bidFrom } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// Mobile app — step 2: called with the x-tdt-booking header right after Razorpay Checkout succeeds in the app.
// Checks Razorpay's signature (HMAC of "order_id|payment_id" with the key secret) and the payment itself, then marks
// the booking paid (same markPaid as the website, incl. the "payment received" e-mail). Safe to call again.
export async function POST(req: Request) {
  const bid = bidFrom(req);
  if (!bid) return NextResponse.json({ error: "Booking nahi mili." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const orderId = String(b?.razorpay_order_id || ""), paymentId = String(b?.razorpay_payment_id || ""), sig = String(b?.razorpay_signature || "");
  const s = await db.doc(`orders/${bid}`).get();
  if (!s.exists || s.data()!.plinkId !== orderId || !orderId.startsWith("order_")) return NextResponse.json({ error: "Booking nahi mili." }, { status: 404 });
  if (s.data()!.status === "paid") return NextResponse.json({ ok: true, status: "paid" });

  const good = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(`${orderId}|${paymentId}`).digest("hex");
  if (!paymentId || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)))
    return NextResponse.json({ error: "Payment verify nahi hua." }, { status: 400 });
  const ok = await verifyOrderWithRazorpay(bid, orderId, paymentId).catch((e) => { console.error("app verify failed", e); return false; });
  return ok ? NextResponse.json({ ok: true, status: "paid" }) : NextResponse.json({ error: "Payment abhi confirm nahi hua." }, { status: 402 });
}
