import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { editUntil } from "@/lib/formEdit";
import { COOKIE, cookieOpts, openEdit, originOf, sealBid } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// Opens the "edit your form" link from the customer's email on any device: sets the booking cookie, opens /form in edit mode.
export async function GET(req: Request) {
  const origin = originOf(req), bid = openEdit(new URL(req.url).searchParams.get("t") || "");
  const s = bid ? await db.doc(`orders/${bid}`).get() : null, d = s?.data();
  if (!bid || !d?.formDone || editUntil(d.formAt, d.slot) < Date.now()) return NextResponse.redirect(`${origin}/form#edit-expired`, 303);
  const res = NextResponse.redirect(`${origin}/form#edit`, 303);
  res.cookies.set(COOKIE, sealBid(bid), cookieOpts(req));
  return res;
}
