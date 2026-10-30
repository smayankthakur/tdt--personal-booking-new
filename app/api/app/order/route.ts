import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { freeSlots } from "@/lib/freeSlots";
import { HOLD_MS, TIER_INFO, isTaken, isUrgentTier, type Tier, parseTier } from "@/lib/slots";
import { quote } from "@/lib/pricing";
import { sealBid } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const NO_URGENT = "Agle 48 ghante mein koi urgent slot khaali nahi hai. Normal booking karein ya baad mein dobara dekhein.";
const NO_SLOTS = "Abhi saare slots full hain. Kripya baad mein dobara dekhein.";

// Mobile app (The Divine Tarot app) — step 1: same rules as /api/book, but pays with Razorpay Checkout (an ORDER)
// inside the app instead of a payment link. Returns the booking token the app sends as the x-tdt-booking header;
// the form still only opens once the payment is verified (/api/app/verify, or /api/booking asking Razorpay).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tier: Tier = parseTier(body?.tier);
  // The customer's email, asked in the app before paying (as on the website): the "payment received" mail and the form
  // link go to it, and it prefills Razorpay Checkout. Optional so older app versions keep working.
  const customerEmail = String(body?.email || "").trim().toLowerCase().slice(0, 200);
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerEmail))
    return NextResponse.json({ error: "Sahi email likhein — form ka link isi par aayega.", code: "email" }, { status: 400 });
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
    return NextResponse.json({ error: "Payment abhi available nahi hai." }, { status: 503 });

  const bid = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase(), ref = db.doc(`orders/${bid}`);
  let heldSlot: string | null = null;
  if (!isUrgentTier(tier) && !(await freeSlots({ tier })).length)
    return NextResponse.json({ error: NO_SLOTS, code: "no_slots" }, { status: 409 });
  if (isUrgentTier(tier)) { // urgent readings: a slot within 48 h is held before payment
    const cands = (await freeSlots({ tier })).slice(0, 15);
    if (!cands.length) return NextResponse.json({ error: NO_URGENT, code: "no_slots" }, { status: 409 });
    heldSlot = await db.runTransaction(async (tx) => {
      for (const k of cands) {
        const r = db.doc(`bookings/${k}`), s = await tx.get(r);
        if (s.exists && isTaken(s.data())) continue;
        tx.set(r, { status: "held", tier, bid, holdUntil: Date.now() + HOLD_MS, createdAt: Date.now() });
        return k;
      }
      return null;
    });
    if (!heldSlot) return NextResponse.json({ error: NO_URGENT, code: "no_slots" }, { status: 409 });
  }
  const q = await quote(tier, body?.coupon); // server-side price: regular / seasonal offer / coupon (from /admin)
  if ("error" in q) { if (heldSlot) await db.doc(`bookings/${heldSlot}`).delete().catch(() => {}); return NextResponse.json({ error: q.error, code: "coupon" }, { status: 400 }); }
  const amount = q.final;
  await ref.set({ status: "created", tier, amount, regularPrice: q.regular, offerName: q.offerName, coupon: q.coupon, discount: q.discount, heldSlot, origin: "app", createdAt: Date.now(), ...(customerEmail ? { customerEmail } : {}) });

  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const r = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: amount * 100, currency: "INR", receipt: bid, notes: { bid, tier, source: "tdt-app-booking" } }),
  });
  const order = await r.json().catch(() => ({}));
  if (!order?.id) {
    await ref.delete();
    if (heldSlot) await db.doc(`bookings/${heldSlot}`).delete().catch(() => {});
    return NextResponse.json({ error: "Payment shuru nahi ho paya. Dobara try karein." }, { status: 502 });
  }
  await ref.update({ plinkId: order.id });
  const description = tier === "standard" ? "Personal Call Reading" : TIER_INFO[tier].name;
  const label = `${description}${q.offerName ? ` (${q.offerName})` : ""}${q.coupon ? ` · coupon ${q.coupon}` : ""}`;
  return NextResponse.json({ bid, token: sealBid(bid), orderId: order.id, amount: amount * 100, currency: "INR", keyId: process.env.RAZORPAY_KEY_ID, tier, description: label, regular: q.regular, coupon: q.coupon, discount: q.discount, email: customerEmail || null });
}
