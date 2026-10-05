import { NextResponse } from "next/server";
import { freeSlots } from "@/lib/freeSlots";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

// `next` = the slot the form auto-assigns (earliest free one). `slots` kept for reference.
export async function GET() {
  const free = await freeSlots();
  const slots: Record<string, string[]> = {};
  for (const k of free) { const [d, t] = k.split("T"); (slots[d] ||= []).push(t); }
  const next = free[0] ? { date: free[0].split("T")[0], time: free[0].split("T")[1] } : null;
  return NextResponse.json({ next, slots });
}
