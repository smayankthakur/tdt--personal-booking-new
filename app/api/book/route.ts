import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { freeSlots } from "@/lib/freeSlots";
import { HOLD_MS, isTaken, priceFor, type Tier } from "@/lib/slots";
import { originOf } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const NO_URGENT = "Agle 48 ghante mein koi urgent slot khaali nahi hai. Normal booking karein ya WhatsApp karein: +91 88281 16545.";
const NO_SLOTS = "Abhi saare slots full hain. WhatsApp karein: +91 88281 16545.";

// Step 1 of the flow: payment FIRST. Nobody can pay unless a slot is actually free.
// Standard: the earliest free slot from day 7 after payment (day 7–10) is assigned when the form is submitted.
// Urgent: an available slot within 48 h is held BEFORE payment, so nobody pays ₹17,000 for a slot that doesn't exist.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tier: Tier = body?.tier === "urgent" ? "urgent" : "standard";
  const origin = originOf(req); // always return the customer to the domain they are actually on

  const bid = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase(), ref = db.doc(`orders/${bid}`);
  let heldSlot: string | null = null;
  if (tier === "standard" && !(await freeSlots({ tier })).length)
    return NextResponse.json({ error: NO_SLOTS, code: "no_slots" }, { status: 409 });
  if (tier === "urgent") {
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
  await ref.set({ status: "created", tier, amount: priceFor(tier), heldSlot, origin, createdAt: Date.now() });

  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const r = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: priceFor(tier) * 100, currency: "INR", accept_partial: false,
      reference_id: bid,
      description: tier === "urgent" ? "Urgent Personal Call Reading (within 48 hrs) — The Divine Tarot" : `Personal Call Reading${priceFor(tier) < Number(process.env.PRICE_INR || 8500) ? " (Diwali Offer)" : ""} — The Divine Tarot`,
      expire_by: Math.floor(Date.now() / 1000) + 30 * 60, notes: { bid, tier },
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
