import { NextResponse } from "next/server";
import { db, getCfg } from "@/lib/db";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const deny = (req: Request) => !process.env.ADMIN_TOKEN || req.headers.get("x-admin-token") !== process.env.ADMIN_TOKEN;

export async function GET(req: Request) {
  if (deny(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const snap = await db.collection("bookings").where("status", "==", "confirmed").get();
  const bookings = snap.docs.map((d) => ({ slot: d.id, ...d.data() })).sort((a, b) => a.slot.localeCompare(b.slot));
  const ps = await db.collection("orders").where("status", "==", "paid").get();
  const pending = ps.docs.map((d) => ({ bid: d.id, ...d.data() })).filter((o: any) => !o.formDone);
  return NextResponse.json({ cfg: await getCfg(), bookings, pending });
}
export async function PUT(req: Request) {
  if (deny(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await db.doc("config/availability").set(await req.json());
  return NextResponse.json({ ok: true });
}
