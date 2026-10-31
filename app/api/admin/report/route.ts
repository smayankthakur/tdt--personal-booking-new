import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminFrom } from "@/lib/adminAuth";
import { addDays, slotMs } from "@/lib/slots";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ist = (ms: number) => new Date(ms + 330 * 60000).toISOString().slice(0, 10);

/**
 * Revenue report over ALL payments (not just the latest 300 the admin page loads): ?from=YYYY-MM-DD&to=YYYY-MM-DD (IST, inclusive).
 * Money counts on the payment date. "Refunded" orders are subtracted; cancelled-without-refund orders still count.
 */
export async function GET(req: Request) {
  if (!(await adminFrom(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams, from = q.get("from") || "", to = q.get("to") || "";
  if (!DAY.test(from) || !DAY.test(to) || to < from || addDays(from, 400) < to) return NextResponse.json({ error: "Dates galat hain." }, { status: 400 });
  const snap = await db.collection("orders").where("paidAt", ">=", slotMs(from, "00:00")).where("paidAt", "<=", slotMs(to, "23:59") + 59999).get();

  const days: Record<string, { amount: number; count: number }> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) days[d] = { amount: 0, count: 0 };
  const tiers: Record<string, { amount: number; count: number }> = {}, coupons: Record<string, { count: number; discount: number; amount: number }> = {};
  let gross = 0, count = 0, refunds = 0, refundCount = 0, discount = 0, offer = 0, offerCount = 0, formPending = 0, cancelledCount = 0;
  for (const doc of snap.docs) {
    const o = doc.data() as any;
    if (o.status !== "paid" && o.status !== "cancelled") continue;
    const amt = Number(o.amount || 0), d = ist(o.paidAt), tier = o.tier || "standard";
    gross += amt; count++;
    if (o.refunded) { refunds += amt; refundCount++; continue; }
    if (o.status === "cancelled") cancelledCount++;
    if (o.status === "paid" && !o.formDone) formPending++;
    (days[d] ||= { amount: 0, count: 0 }).amount += amt; days[d].count++;
    (tiers[tier] ||= { amount: 0, count: 0 }).amount += amt; tiers[tier].count++;
    if (o.coupon) { const c = (coupons[o.coupon] ||= { count: 0, discount: 0, amount: 0 }); c.count++; c.discount += Number(o.discount || 0); c.amount += amt; discount += Number(o.discount || 0); }
    if (o.offerName) { offer += amt; offerCount++; }
  }
  const net = gross - refunds, paidCount = count - refundCount;
  return NextResponse.json({
    from, to, gross, net, refunds, refundCount, count: paidCount, avg: paidCount ? Math.round(net / paidCount) : 0,
    discount, offer, offerCount, formPending, cancelledCount,
    days: Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
    tiers: Object.entries(tiers).map(([tier, v]) => ({ tier, ...v })).sort((a, b) => b.amount - a.amount),
    coupons: Object.entries(coupons).map(([code, v]) => ({ code, ...v })).sort((a, b) => b.count - a.count),
  });
}
