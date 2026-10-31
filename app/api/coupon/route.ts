import { NextResponse } from "next/server";
import { liveTier, quote } from "@/lib/pricing";
import { parseTier } from "@/lib/slots";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// POST { code, tier } → the price after the coupon (shown in the email popup before paying). /api/book re-checks it.
// A switched-off tier (old link / page opened earlier) is answered for the most similar tier that is ON: `tier` in
// the reply says which one, so the popup switches to it and shows its price before the customer pays.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const asked = parseTier(b?.tier), tier = await liveTier(asked, true);
  if (!tier) return NextResponse.json({ error: "Abhi koi booking available nahi hai.", code: "all_off" }, { status: 409 });
  const q = await quote(tier, b?.code);
  if ("error" in q) return NextResponse.json({ ...q, tier, ...(tier !== asked ? { from: asked } : {}) }, { status: 400 });
  return NextResponse.json({ ok: true, ...q, tier, ...(tier !== asked ? { from: asked } : {}) });
}
