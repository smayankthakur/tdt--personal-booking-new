import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { markPaid } from "@/lib/payments";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") || "";
  const good = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET as string).update(raw).digest("hex");
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good)))
    return NextResponse.json({ error: "bad signature" }, { status: 401 });

  const ev = JSON.parse(raw);
  if (ev.event !== "payment_link.paid") return NextResponse.json({ ok: true });
  const pl = ev.payload.payment_link.entity, pay = ev.payload.payment?.entity;
  const bid = String(pl.reference_id || "");
  await markPaid(bid, pl.id, pay?.id || null, pay?.email || pl.customer?.email || "", pay?.contact || pl.customer?.contact || "");
  return NextResponse.json({ ok: true });
}
