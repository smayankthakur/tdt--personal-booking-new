import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWithRazorpay } from "@/lib/payments";
import { bidFrom } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// Polled by /form (and the landing page banner). The booking comes ONLY from the signed cookie set after payment.
export async function GET(req: Request) {
  const bid = bidFrom(req);
  if (!bid) return NextResponse.json({ status: "unknown" });
  const ref = db.doc(`orders/${bid}`);
  let s = await ref.get();
  if (!s.exists) return NextResponse.json({ status: "unknown" });
  if (s.data()!.status === "created" && s.data()!.plinkId) { // don't wait for the webhook: ask Razorpay directly
    if (await verifyWithRazorpay(bid, s.data()!.plinkId).catch(() => false)) s = await ref.get();
  }
  const d = s.data()!, done = !!d.formDone;
  let date = null, time = null, meetLink = null;
  if (done && d.slot) { [date, time] = d.slot.split("T"); meetLink = d.meetLink || null; }
  return NextResponse.json({ bid, tier: d.tier || "standard", status: d.status, formDone: done, email: d.email || "", phone: d.phone || "", date, time, meetLink });
}
