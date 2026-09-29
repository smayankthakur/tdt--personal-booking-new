import { NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { db, getCfg } from "@/lib/db";
import { daySlots, istNow, ymd, slotMs, isTaken, LEAD_MS } from "@/lib/slots";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = await getCfg();
  const dates = Array.from({ length: cfg.advanceDays + 1 }, (_, i) => ymd(new Date(istNow().getTime() + i * 864e5)));
  const snap = await db.collection("bookings")
    .where(FieldPath.documentId(), ">=", dates[0])
    .where(FieldPath.documentId(), "<=", dates[dates.length - 1] + "~").get();
  const taken = new Set(snap.docs.filter((d) => isTaken(d.data())).map((d) => d.id));
  const slots: Record<string, string[]> = {};
  for (const d of dates) {
    const free = daySlots(cfg, d).filter((t) => !taken.has(`${d}T${t}`) && slotMs(d, t) > Date.now() + LEAD_MS);
    if (free.length) slots[d] = free;
  }
  return NextResponse.json({ slots });
}
