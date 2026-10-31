import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminFrom } from "@/lib/adminAuth";
import { logActivity } from "@/lib/activity";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

/** Customer feedback (latest 500) + the Google review link shown to happy (4–5 star) customers. */
export async function GET(req: Request) {
  if (!(await adminFrom(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = await db.collection("feedback").orderBy("at", "desc").limit(500).get();
  const site = (await db.doc("config/site").get()).data();
  return NextResponse.json({ items: s.docs.map((d) => d.data()), reviewUrl: site?.reviewUrl || "" });
}

export async function PUT(req: Request) {
  const who = await adminFrom(req);
  if (!who) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = String((await req.json().catch(() => ({})))?.reviewUrl || "").trim().slice(0, 500);
  if (url && !/^https:\/\/[^\s]+$/.test(url)) return NextResponse.json({ error: "Link https:// se shuru hona chahiye." }, { status: 400 });
  await db.doc("config/site").set({ reviewUrl: url, updatedAt: Date.now() }, { merge: true });
  await logActivity(who, "Google review link badla", url || "(hataya)");
  return NextResponse.json({ ok: true });
}
