import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// Step 1 of the flow: payment FIRST. No slot yet — the slot is chosen in the form after payment.
export async function POST(req: Request) {
  // Always return the customer to the domain they are actually on (never a stale SITE_URL env value).
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
  const proto = host.startsWith("localhost") ? "http" : req.headers.get("x-forwarded-proto") || "https";
  const origin = `${proto}://${host}`;

  const bid = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase(), ref = db.doc(`orders/${bid}`);
  await ref.set({ status: "created", origin, createdAt: Date.now() });

  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const r = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Number(process.env.PRICE_INR || 8500) * 100, currency: "INR", accept_partial: false,
      reference_id: bid, description: "Personal Call Reading — The Divine Tarot",
      expire_by: Math.floor(Date.now() / 1000) + 30 * 60, notes: { bid },
      callback_url: `${origin}/form?bid=${bid}`, callback_method: "get",
    }),
  });
  const link = await r.json();
  if (!link.short_url) { await ref.delete(); return NextResponse.json({ error: "Payment link nahi ban paya. Dobara try karein." }, { status: 502 }); }
  await ref.update({ plinkId: link.id });
  return NextResponse.json({ url: link.short_url });
}
