export type DayCfg = { on: boolean; start: string; end: string };
export type Tier = "standard" | "urgent";
export type Cfg = {
  days: Record<string, DayCfg>; duration: number; step: number; advanceDays: number; blocked: string[];
  minDays: number; maxDays: number;                                          // standard: appointment on day 7 … day 10 after payment
  urgentDays: Record<string, DayCfg>; urgentHours: number; urgentLeadHours: number; // urgent: within 48 h of payment
};

const ALL = (start: string, end: string) => Object.fromEntries(Array.from({ length: 7 }, (_, i) => [String(i), { on: true, start, end }]));

// days: 0=Sun … 6=Sat. Times are IST. step = gap between slot starts (60 => 40-min call + 20-min break)
// Standard: Tuesday & Friday hourly 12 PM … 8 PM (last slot 8–9 PM), on day 7–10 after payment.
// Urgent (higher price): every day 12 PM … 8 PM, within 48 hours of payment.
export const DEFAULT_CFG: Cfg = {
  days: {
    "2": { on: true, start: "12:00", end: "21:00" },
    "5": { on: true, start: "12:00", end: "21:00" },
  },
  duration: 40, step: 60, advanceDays: 21, blocked: [],
  minDays: 7, maxDays: 10,
  urgentDays: ALL("12:00", "21:00"), urgentHours: 48, urgentLeadHours: 6,
};
export const LEAD_MS = 12 * 3600 * 1000; // standard: never closer than 12h (always true with the 7-day rule)
export const HOLD_MS = 35 * 60 * 1000;   // urgent slot held while the customer is on the payment page (link expires in 30 min)

export const PRICES: Record<Tier, number> = {
  standard: Number(process.env.PRICE_INR || process.env.NEXT_PUBLIC_PRICE_INR || 8500),
  urgent: Number(process.env.PRICE_URGENT_INR || process.env.NEXT_PUBLIC_PRICE_URGENT_INR || 17000),
};

const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const istNow = () => new Date(Date.now() + 330 * 60000);
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** India calendar date (YYYY-MM-DD) of a timestamp. */
export const istDate = (ms: number) => ymd(new Date(ms + 330 * 60000));
export const addDays = (date: string, n: number) => ymd(new Date(new Date(date + "T00:00:00Z").getTime() + n * 864e5));
export const slotMs = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).getTime();
export const isTaken = (b: any) => b.status === "confirmed" || (b.status === "held" && b.holdUntil > Date.now());

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
  if (tier === "urgent")
    return { lo: Math.max(now, paidAt) + cfg.urgentLeadHours * 3600e3, hi: paidAt + cfg.urgentHours * 3600e3, days: cfg.urgentDays };
  const d0 = istDate(paidAt);
  return {
    lo: Math.max(slotMs(addDays(d0, cfg.minDays), "00:00"), now + LEAD_MS),
    // Day 7–10 is tried first (earliest wins). Only if all of it is full does the search continue after day 10.
    hi: slotMs(addDays(d0, Math.max(cfg.advanceDays, cfg.maxDays)), "23:59"),
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
