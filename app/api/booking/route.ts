import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAnyWithRazorpay } from "@/lib/payments";
import { bidFrom } from "@/lib/session";
import { editUntil, rawFromAnswers } from "@/lib/formEdit";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// Polled by /form (and the landing page banner) and by the mobile app. The booking comes ONLY from the signed
// cookie set after payment, or the same signed value in the x-tdt-booking header (app).
export async function GET(req: Request) {
  const bid = bidFrom(req);
  if (!bid) return NextResponse.json({ status: "unknown" });
  const ref = db.doc(`orders/${bid}`);
  let s = await ref.get();
  if (!s.exists) return NextResponse.json({ status: "unknown" });
  if (s.data()!.status === "created" && s.data()!.plinkId) { // don't wait for the webhook: ask Razorpay directly
    if (await verifyAnyWithRazorpay(bid, s.data()!.plinkId).catch(() => false)) s = await ref.get();
  }
  const d = s.data()!, done = !!d.formDone;
  let date = null, time = null, meetLink = null;
  if (done && d.slot) { [date, time] = d.slot.split("T"); meetLink = d.meetLink || null; }
  // Form can be edited for a while after submitting: send the saved answers so the form can be prefilled.
  let edit = null;
  const until = done ? editUntil(d.formAt, d.slot) : 0;
  if (until > Date.now() && !req.headers.get("x-tdt-booking")) {
    const b = (await db.doc(`bookings/${d.slot}`).get()).data();
    if (b?.bid === bid) {
      const raw = b.raw || rawFromAnswers(b.answers);
      const em = String(b.email || raw.email || "").toLowerCase();
      edit = { until, raw: { ...raw, email: em }, hadPartner: !!(raw.name2 || "").trim(), emailVerified: !!em && d.verifiedEmail === em };
    }
  }
  return NextResponse.json({ bid, tier: d.tier || "standard", status: d.status, formDone: done, email: d.email || "", phone: d.phone || "", date, time, meetLink, edit });
}
