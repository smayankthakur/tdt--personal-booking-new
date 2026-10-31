import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminFrom } from "@/lib/adminAuth";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

/** Latest admin activity (Firestore `activity`), newest first. ?before=<ms> pages back. */
export async function GET(req: Request) {
  if (!(await adminFrom(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const before = Number(new URL(req.url).searchParams.get("before")) || Date.now() + 1;
  const s = await db.collection("activity").where("at", "<", before).orderBy("at", "desc").limit(200).get();
  return NextResponse.json({ items: s.docs.map((d) => ({ id: d.id, ...d.data() })) });
}
