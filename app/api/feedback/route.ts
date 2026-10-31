import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyAdmins } from "@/lib/push";
import { openFeedback } from "@/lib/session";
import { tierInfo } from "@/lib/slots";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

/** Customer rating from the feedback mail: { t, rating 1–5, comment ≤ 500 }. One per booking (can be updated for 14 days). */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({})), bid = openFeedback(b?.t);
  if (!bid) return NextResponse.json({ error: "Yeh link sahi nahi hai." }, { status: 400 });
  const rating = Math.round(Number(b?.rating)), comment = String(b?.comment || "").trim().slice(0, 500);
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: "1 se 5 star chunein." }, { status: 400 });
  const o = (await db.doc(`orders/${bid}`).get()).data();
  if (!o || !o.formDone || !o.slot) return NextResponse.json({ error: "Booking nahi mili." }, { status: 404 });
  const ref = db.doc(`feedback/${bid}`), old = (await ref.get()).data();
  if (old && Date.now() - old.at > 14 * 864e5) return NextResponse.json({ error: "Feedback pehle hi mil chuka hai. Shukriya!" }, { status: 409 });
  const bk = (await db.doc(`bookings/${o.slot}`).get()).data();
  await ref.set({ bid, rating, comment, name: bk?.name || o.name || "", email: bk?.email || o.email || "", tier: o.tier || "standard", slot: o.slot, at: old?.at || Date.now(), updatedAt: Date.now() });
  if (!old) await notifyAdmins(`${"⭐".repeat(rating)} Naya feedback`, `${bk?.name || o.name || "Customer"} · ${tierInfo(o.tier).name}${comment ? ` — ${comment.slice(0, 80)}` : ""}`, "/admin#feedback");
  const site = (await db.doc("config/site").get()).data();
  return NextResponse.json({ ok: true, reviewUrl: rating >= 4 && /^https:\/\//.test(site?.reviewUrl || "") ? site!.reviewUrl : null });
}
