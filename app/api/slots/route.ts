import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { freeSlots } from "@/lib/freeSlots";
import { bidFrom } from "@/lib/session";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const split = (k?: string) => (k ? { date: k.split("T")[0], time: k.split("T")[1] } : null);

// With the booking cookie: the slot the form will assign to THIS booking.
// Without it (?tier=urgent): only whether an urgent slot is available right now — for the landing page.
export async function GET(req: Request) {
  const bid = bidFrom(req);
  if (bid && !new URL(req.url).searchParams.get("tier")) {
    const s = await db.doc(`orders/${bid}`).get(), o = s.data();
    if (!o || o.status !== "paid") return NextResponse.json({ next: null });
    const free = await freeSlots({ tier: o.tier || "standard", paidAt: o.paidAt, bid, prefer: o.heldSlot || undefined });
    return NextResponse.json({ next: split(free[0]) });
  }
  const free = await freeSlots({ tier: "urgent" });
  return NextResponse.json({ available: free.length > 0, next: split(free[0]) });
}
