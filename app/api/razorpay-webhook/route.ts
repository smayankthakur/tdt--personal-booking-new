import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { markPaid, realEmail } from "@/lib/payments";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") || "";
  const good = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET as string).update(raw).digest("hex");
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)))
    return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const ev = JSON.parse(raw);
  // Mobile-app bookings are Razorpay orders (receipt = booking ID, notes.source = "tdt-app-booking"):
  // unlock them here too, so a payment finished after the app was closed is never lost.
  // Needs the "order.paid" event ticked on this webhook in the Razorpay Dashboard.
  if (ev.event === "order.paid") {
    const order = ev.payload?.order?.entity, pay = ev.payload?.payment?.entity;
    if (order?.notes?.source !== "tdt-app-booking" || !order.receipt || pay?.status !== "captured") return NextResponse.json({ ok: true });
    await markPaid(String(order.receipt), order.id, pay.id, pay.email || "", pay.contact || "", pay.created_at ? Number(pay.created_at) * 1000 : Date.now());
    return NextResponse.json({ ok: true });
  }
  if (ev.event !== "payment_link.paid") return NextResponse.json({ ok: true });
  const pl = ev.payload.payment_link.entity, pay = ev.payload.payment?.entity;
  const bid = String(pl.reference_id || "");
  await markPaid(bid, pl.id, pay?.id || null, realEmail(pl.customer?.email, pay?.email) || pay?.email || "", pay?.contact || pl.customer?.contact || "");
  return NextResponse.json({ ok: true });
}
