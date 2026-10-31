export type DayCfg = { on: boolean; start: string; end: string };
/**
 * Reading types. All share ONE slot calendar (a slot is never double-booked across types).
 *  standard  = 40-min voice call, unlimited questions, up to 3 people, slot day 7–10
 *  urgent    = same, slot within 48 h (held before payment)
 *  video     = 30-min Google Meet VIDEO call, one person, 3 written questions, slot day 7–10
 *  q3        = 30-min voice call, one person, 3 written questions, slot day 7–10
 *  q3urgent  = same as q3, slot within 48 h (held before payment)
 * Price and on/off of each type are set in /admin (lib/pricing.ts).
 */
export type Tier = "standard" | "urgent" | "video" | "q3" | "q3urgent";
type Info = { mins: number; urgent: boolean; questions: boolean; video: boolean; name: string; label: string; tag: string; badge: string };
export const TIER_INFO: Record<Tier, Info> = {
  standard: { mins: 40, urgent: false, questions: false, video: false, name: "Voice Call (40 min)", label: "Standard", tag: "", badge: "" },
  urgent: { mins: 40, urgent: true, questions: false, video: false, name: "Urgent Voice Call (48 hrs)", label: "URGENT (48 hrs)", tag: "⚡ URGENT ", badge: "⚡ Urgent" },
  video: { mins: 30, urgent: false, questions: true, video: true, name: "Video Call (30 min)", label: "VIDEO CALL (30 min, 3 questions)", tag: "🎥 VIDEO ", badge: "🎥 Video Call (30 min)" },
  q3: { mins: 30, urgent: false, questions: true, video: false, name: "3 Question Voice Call (30 min)", label: "3-QUESTION VOICE CALL (30 min)", tag: "❓ 3Q ", badge: "❓ 3 Sawal · Voice Call (30 min)" },
  q3urgent: { mins: 30, urgent: true, questions: true, video: false, name: "Urgent 3 Question Voice Call (48 hrs)", label: "URGENT 3-QUESTION VOICE CALL (48 hrs, 30 min)", tag: "⚡❓ URGENT 3Q ", badge: "⚡ Urgent · 3 Sawal · Voice Call (30 min)" },
};
export const ALL_TIERS = Object.keys(TIER_INFO) as Tier[];
export const parseTier = (x: unknown): Tier => (ALL_TIERS.includes(x as Tier) ? (x as Tier) : "standard");
export const tierInfo = (t?: unknown) => TIER_INFO[parseTier(t)];
export const isUrgentTier = (t?: unknown) => tierInfo(t).urgent;
export const isQuestionTier = (t?: unknown) => tierInfo(t).questions;
export const callMinutes = (tier?: string) => (parseTier(tier) === "standard" || parseTier(tier) === "urgent" ? Number(process.env.CALL_MINUTES || 40) : tierInfo(tier).mins);
export const tierLabel = (tier?: string) => tierInfo(tier).label;
export const tierTag = (tier?: string) => tierInfo(tier).tag;
export type Cfg = {
  days: Record<string, DayCfg>; duration: number; step: number; advanceDays: number; blocked: string[];
  fromDate: string; toDate: string;                                          // bookings only between these dates (IST, inclusive)
  minDays: number; maxDays: number;                                          // standard: day 7–10 after payment (earliest free first)
  urgentDays: Record<string, DayCfg>; urgentHours: number; urgentLeadHours: number; // urgent: within 48 h of payment
};

const ALL = (start: string, end: string) => Object.fromEntries(Array.from({ length: 7 }, (_, i) => [String(i), { on: true, start, end }]));

// days: 0=Sun … 6=Sat. Times are IST. step = gap between slot starts (60 => 40-min call + 20-min break).
// 12 Oct – 30 Nov 2026: every day (Sat/Sun too), hourly 12 PM … 9 PM (last slot 9:00–9:40 PM). Festival days are blocked.
// Normal: earliest free slot from day 7 after payment (12 PM, 1 PM … 9 PM, then the next day), so it lands on day 7–10;
// only if day 7–10 is completely full does it move to the next free day after that.
// Urgent (higher price): within 48 hours of payment, same days/hours, same date range.
export const DEFAULT_CFG: Cfg = {
  days: ALL("12:00", "22:00"),
  duration: 40, step: 60, advanceDays: 60,
  blocked: [
    "2026-10-20",                                                   // Dussehra
    "2026-10-29",                                                   // Karwa Chauth
    "2026-11-06", "2026-11-07",                                     // Dhanteras, Choti Diwali
    "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11",         // Diwali, (amavasya), Govardhan Puja, Bhai Dooj
    "2026-11-15",                                                   // Chhath Puja
    "2026-11-24",                                                   // Guru Nanak Jayanti
  ],
  fromDate: "2026-10-12", toDate: "2026-11-30",
  minDays: 7, maxDays: 10,                                        // normal: payment ke 7–10 din baad (window full ho toh uske baad ka agla slot)
  urgentDays: ALL("12:00", "22:00"), urgentHours: 48, urgentLeadHours: 6,
};
export const LEAD_MS = 12 * 3600 * 1000; // standard: never closer than 12h
export const HOLD_MS = 35 * 60 * 1000;   // urgent slot held while the customer is on the payment page (link expires in 30 min)

// Prices, seasonal offer and coupons: lib/pricing.ts (editable from /admin).

const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const istNow = () => new Date(Date.now() + 330 * 60000);
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** India calendar date (YYYY-MM-DD) of a timestamp. */
export const istDate = (ms: number) => ymd(new Date(ms + 330 * 60000));
export const addDays = (date: string, n: number) => ymd(new Date(new Date(date + "T00:00:00Z").getTime() + n * 864e5));
export const slotMs = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).getTime();
/** A slot is unavailable when booked, held during an urgent payment, or blocked by the admin (calendar view). */
export const isTaken = (b: any) => b.status === "confirmed" || b.status === "blocked" || (b.status === "held" && b.holdUntil > Date.now());

export function daySlots(cfg: Cfg, date: string, days: Record<string, DayCfg> = cfg.days): string[] {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  const d = days[String(dow)];
  if (!d?.on || cfg.blocked.includes(date)) return [];
  const out: string[] = [];
  for (let t = mins(d.start); t + cfg.duration <= mins(d.end); t += cfg.step)
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  return out;
}

/** Earliest / latest allowed slot start for a booking paid at `paidAt`. Pure, so it can be unit-tested. */
export function windowFor(cfg: Cfg, tier: Tier, paidAt: number, now = Date.now()) {
  const from = cfg.fromDate ? slotMs(cfg.fromDate, "00:00") : 0, to = cfg.toDate ? slotMs(cfg.toDate, "23:59") : Infinity;
  if (isUrgentTier(tier))
    return { lo: Math.max(from, Math.max(now, paidAt) + cfg.urgentLeadHours * 3600e3), hi: Math.min(to, paidAt + cfg.urgentHours * 3600e3), days: cfg.urgentDays };
  const d0 = istDate(paidAt);
  return {
    lo: Math.max(from, slotMs(addDays(d0, cfg.minDays || 0), "00:00"), now + LEAD_MS),
    hi: Math.min(to, slotMs(addDays(d0, Math.max(cfg.advanceDays, cfg.maxDays || 0)), "23:59")),
    days: cfg.days,
  };
}

/** All candidate slot keys ("YYYY-MM-DDTHH:MM", IST) in the window, earliest first, before checking bookings. */
export function candidates(cfg: Cfg, tier: Tier, paidAt: number, now = Date.now()) {
  const { lo, hi, days } = windowFor(cfg, tier, paidAt, now);
  const out: string[] = [];
  if (hi < lo) return out;
  for (let d = istDate(lo); d <= istDate(hi); d = addDays(d, 1))
    for (const t of daySlots(cfg, d, days)) { const ms = slotMs(d, t); if (ms >= lo && ms <= hi) out.push(`${d}T${t}`); }
  return out;
}
