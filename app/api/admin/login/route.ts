import { NextResponse } from "next/server";
import { login } from "@/lib/adminAuth";
import { logActivity } from "@/lib/activity";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// POST { email, password } -> { token, email } (12-hour admin session) — 5 wrong tries lock that email for 15 min.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const r = await login(b?.email, b?.password);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  await logActivity(r.email, "Login", (req.headers.get("user-agent") || "").slice(0, 120));
  return NextResponse.json(r);
}
