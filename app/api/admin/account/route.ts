import { NextResponse } from "next/server";
import { adminFrom, adminList, changeOwnPassword, removeAdmin, setAdmin } from "@/lib/adminAuth";
import { logActivity } from "@/lib/activity";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const no = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Admin accounts. All admins are full admins (no roles); each has their own password. Passwords are never logged. */
export async function GET(req: Request) {
  const me = await adminFrom(req);
  if (!me) return no("unauthorized", 401);
  return NextResponse.json({ me, admins: await adminList() });
}

/**
 *  { action: "password", current, next }      → change own password (returns a new session token)
 *  { action: "add" | "reset", email, password } → add an admin / set a temporary password for another admin
 *  { action: "remove", email }                 → remove another admin
 */
export async function POST(req: Request) {
  const me = await adminFrom(req);
  if (!me) return no("unauthorized", 401);
  const b = await req.json().catch(() => ({}));
  if (b.action === "password") {
    const r = await changeOwnPassword(me, b.current, b.next);
    if ("error" in r) return no(r.error as string);
    await logActivity(me, "Apna password badla");
    return NextResponse.json({ ok: true, token: r.token });
  }
  if (b.action === "add" || b.action === "reset") {
    const exists = (await adminList()).includes(String(b.email || "").trim().toLowerCase());
    if (b.action === "add" && exists) return no("Yeh admin pehle se hai — 'Password reset' use karein.");
    if (b.action === "reset" && !exists) return no("Yeh admin nahi hai.");
    if (b.action === "reset" && String(b.email).toLowerCase() === me) return no("Apna password upar wale form se badlein.");
    const r = await setAdmin(b.email, b.password);
    if ("error" in r) return no(r.error as string);
    await logActivity(me, b.action === "add" ? "Naya admin joda" : "Admin ka password reset kiya", r.email);
    return NextResponse.json({ ok: true, admins: await adminList() });
  }
  if (b.action === "remove") {
    const r = await removeAdmin(me, b.email);
    if ("error" in r) return no(r.error as string);
    await logActivity(me, "Admin hataya", String(b.email).toLowerCase());
    return NextResponse.json({ ok: true, admins: await adminList() });
  }
  return no("Action nahi pehchana.");
}
