import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWithRazorpay } from "@/lib/payments";
import { COOKIE, cookieOpts, originOf, razorpayReturnOk, sealBid } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// Razorpay sends the customer here after paying. Only a correctly signed "paid" return unlocks the form.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, origin = originOf(req);
  const bid = q.get("razorpay_payment_link_reference_id") || "", plink = q.get("razorpay_payment_link_id") || "";
  const fail = () => NextResponse.redirect(`${origin}/?payment=failed#book`, 303);
  if (q.get("razorpay_payment_link_status") !== "paid" || !razorpayReturnOk(q)) return fail();
  const s = await db.doc(`orders/${bid}`).get();
  if (!s.exists || s.data()!.plinkId !== plink) return fail();
  await verifyWithRazorpay(bid, plink).catch((e) => console.error("verify on return failed", e)); // don't wait for the webhook
  const res = NextResponse.redirect(`${origin}/form`, 303);
  res.cookies.set(COOKIE, sealBid(bid), cookieOpts(req));
  return res;
}
