"use client";
import type { ReactNode } from "react";
import { TIER_INFO, slotMs } from "@/lib/slots";

/** Calls an /api/admin… route with the admin session header. Resolves to the JSON body (+ `_status`). */
export type Api = (path: string, method?: string, body?: unknown) => Promise<any>;

export const Notice = ({ kind = "info", children }: { kind?: "info" | "success" | "error" | "warning"; children: ReactNode }) =>
  <div className={`wpa-notice ${kind}`}><p>{children}</p></div>;
export const tone = (m: string) =>
  (/✓|ban gaya|delete ho gaya|Saved/.test(m) ? "success" : /ERROR|nahi|galat|error|fail|⚠/i.test(m) ? "error" : "info") as "success" | "error" | "info";

export const TypeTag = ({ t }: { t?: string }) => (t && t !== "standard"
  ? <span className={`wpa-tag ${t === "video" ? "blue" : "gold"}`}>{TIER_INFO[t as keyof typeof TIER_INFO]?.badge || t}</span>
  : <span className="wpa-tag">Voice (40 min)</span>);

export const inr = (n: unknown) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
export const keyMs = (k: string) => { const [d, t] = String(k).split("T"); return t ? slotMs(d, t) : 0; };
/** India date (YYYY-MM-DD) of a timestamp. */
export const istDay = (ms: number) => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
/** "Sat, 31 Oct · 7:00 PM" for a slot key. */
export const fmtSlot = (k: string) => {
  const ms = keyMs(k);
  return ms ? new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : k;
};
export const fmtTime = (ms?: number) => ms ? new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
const span = (diff: number) => {
  const m = Math.round(Math.abs(diff) / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h} ghante${m % 60 ? ` ${m % 60} min` : ""}` : `${Math.floor(h / 24)} din`;
};
export const ago = (ms?: number, now = Date.now()) => (ms ? `${span(now - ms)} pehle` : "—");
export const inTime = (ms: number, now = Date.now()) => (ms > now ? `${span(ms - now)} mein` : `${span(now - ms)} pehle`);
