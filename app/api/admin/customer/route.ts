import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { adminFrom } from "@/lib/adminAuth";
import { logActivity } from "@/lib/activity";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

/** Private admin notes per customer, keyed by email: Firestore customers/{email}.notes = [{ id, text, by, at }]. */
const no = (error: string, status = 400) => NextResponse.json({ error }, { status });
const keyOf = (e: unknown) => { const x = String(e || "").trim().toLowerCase(); return /^[^\s/]+@[^\s/]+\.[^\s/]+$/.test(x) && x.length < 200 ? x : ""; };

export async function GET(req: Request) {
  if (!(await adminFrom(req))) return no("unauthorized", 401);
  const email = keyOf(new URL(req.url).searchParams.get("email"));
  if (!email) return no("Email galat hai.");
  const d = (await db.doc(`customers/${email}`).get()).data();
  return NextResponse.json({ notes: (d?.notes || []).sort((a: any, b: any) => b.at - a.at) });
}

export async function POST(req: Request) {
  const who = await adminFrom(req);
  if (!who) return no("unauthorized", 401);
  const { email: e, text: t } = await req.json().catch(() => ({})), email = keyOf(e), text = String(t || "").trim().slice(0, 2000);
  if (!email || !text) return no("Note khaali hai.");
  const ref = db.doc(`customers/${email}`), note = { id: crypto.randomBytes(6).toString("hex"), text, by: who, at: Date.now() };
  await db.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    tx.set(ref, { email, notes: [...(d?.notes || []), note].slice(-200), updatedAt: Date.now() }, { merge: true });
  });
  await logActivity(who, "Customer note likha", email);
  return NextResponse.json({ ok: true, note });
}

export async function DELETE(req: Request) {
  const who = await adminFrom(req);
  if (!who) return no("unauthorized", 401);
  const q = new URL(req.url).searchParams, email = keyOf(q.get("email")), id = String(q.get("id") || "");
  if (!email || !id) return no("Note nahi mila.");
  const ref = db.doc(`customers/${email}`);
  await db.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    tx.set(ref, { notes: (d?.notes || []).filter((n: any) => n.id !== id), updatedAt: Date.now() }, { merge: true });
  });
  await logActivity(who, "Customer note delete kiya", email);
  return NextResponse.json({ ok: true });
}
