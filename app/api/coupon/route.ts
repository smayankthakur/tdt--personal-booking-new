import { NextResponse } from "next/server";
import { quote } from "@/lib/pricing";
import { parseTier } from "@/lib/slots";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// POST { code, tier } → the price after the coupon (shown in the email popup before paying). /api/book re-checks it.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const q = await quote(parseTier(b?.tier), b?.code);
  if ("error" in q) return NextResponse.json(q, { status: 400 });
  return NextResponse.json({ ok: true, ...q });
}
