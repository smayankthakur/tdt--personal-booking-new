import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { COOKIE, cookieOpts, openResume, originOf, sealBid } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// Opens a link made by the admin for a PAID customer whose form is still pending.
export async function GET(req: Request) {
  const origin = originOf(req), bid = openResume(new URL(req.url).searchParams.get("t") || "");
  const s = bid ? await db.doc(`orders/${bid}`).get() : null;
  if (!bid || !s?.exists || s.data()!.status !== "paid") return NextResponse.redirect(`${origin}/form`, 303);
  const res = NextResponse.redirect(`${origin}/form`, 303);
  res.cookies.set(COOKIE, sealBid(bid), cookieOpts(req));
  return res;
}
