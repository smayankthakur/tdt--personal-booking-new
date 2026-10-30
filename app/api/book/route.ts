import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { freeSlots } from "@/lib/freeSlots";
import { HOLD_MS, TIER_INFO, isTaken, isUrgentTier, type Tier, parseTier } from "@/lib/slots";
import { quote } from "@/lib/pricing";
import { originOf } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const NO_URGENT = "Agle 48 ghante mein koi urgent slot khaali nahi hai. Normal booking karein ya baad mein dobara dekhein.";
const NO_SLOTS = "Abhi saare slots full hain. Kripya baad mein dobara dekhein.";

// Step 1 of the flow: payment FIRST. Nobody can pay unless a slot is actually free.
// Standard: the earliest free slot from day 7 after payment (day 7–10) is assigned when the form is submitted.
// Urgent: an available slot within 48 h is held BEFORE payment, so nobody pays ₹17,000 for a slot that doesn't exist.
const describe = (tier: Tier, offerName: string | null, coupon: string | null) =>
  `${tier === "standard" ? "Personal Call Reading" : TIER_INFO[tier].name}${offerName ? ` (${offerName})` : ""}${coupon ? ` · coupon ${coupon}` : ""}`;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tier: Tier = parseTier(body?.tier);
  // Email asked on the site before payment (Razorpay often stores "void@razorpay.com"): receipt + form link go here.
  const customerEmail = String(body?.email || "").trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerEmail) || /@razorpay\.com$/.test(customerEmail))
    return NextResponse.json({ error: "Sahi email likhein — form ka link isi par aayega.", code: "email" }, { status: 400 });
  const origin = originOf(req); // always return the customer to the domain they are actually on
  // Price (regular / seasonal offer) and any coupon are computed on the server from /admin's settings.
  const q = await quote(tier, body?.coupon);
  if ("error" in q) return NextResponse.json({ error: q.error, code: "coupon" }, { status: 400 });

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
  await ref.set({ status: "created", tier, amount: q.final, regularPrice: q.regular, offerName: q.offerName, coupon: q.coupon, discount: q.discount, heldSlot, origin, customerEmail, createdAt: Date.now() });

  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const r = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: q.final * 100, currency: "INR", accept_partial: false,
      reference_id: bid,
      description: `${describe(tier, q.offerName, q.coupon)} — The Divine Tarot`,
      expire_by: Math.floor(Date.now() / 1000) + 30 * 60, notes: { bid, tier },
      customer: { email: customerEmail }, notify: { email: false, sms: false }, // prefill checkout; we send our own mails
      // No booking ID in our own URL: Razorpay adds its signed parameters and /api/pay-return verifies them.
      callback_url: `${origin}/api/pay-return`, callback_method: "get",
    }),
  });
  const link = await r.json();
  if (!link.short_url) {
    await ref.delete();
    if (heldSlot) await db.doc(`bookings/${heldSlot}`).delete().catch(() => {});
    return NextResponse.json({ error: "Payment link nahi ban paya. Dobara try karein." }, { status: 502 });
  }
  await ref.update({ plinkId: link.id });
  return NextResponse.json({ url: link.short_url });
}
