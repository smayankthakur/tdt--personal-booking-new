export type DayCfg = { on: boolean; start: string; end: string };
/**
 * Reading types. All share ONE slot calendar (a slot is never double-booked across types).
 *  standard  = 40-min voice call, unlimited questions, up to 3 people, slot day 7–10
 *  urgent    = same, slot within 48 h (held before payment)
 *  video     = 30-min Google Meet VIDEO call, one person, 3 written questions, slot day 7–10
 *  q3        = 30-min voice call, one person, 3 written questions, slot day 7–10
 *  q3urgent  = same as q3, slot within 48 h (held before payment)
 *  written       = WRITTEN reading on email (no call, no Meet): 3 written questions, answers + guidance emailed
 *                  in the customer's language within 7 days of the form. Its "slot" is only Bharti's work plan
 *                  (admin calendar / due list) — the customer is never sent a call time or invite.
 *  writtenurgent = same, answers within 48 hours (plan slot held before payment)
 *  call          = 1-hour Google Meet VIDEO / AUDIO call, up to 3 people (full form), slot within 3 days of payment (Nov 2026)
 *  callurgent    = same 1-hour call within 3 HOURS of payment; can be booked only 12 PM – 6 PM IST (slot held before payment)
 *  f2f           = 1-hour FACE TO FACE meeting at Grand Hyatt Lounge, Mumbai (no Meet), slot within 3 days of payment
 * Price and on/off of each type are set in /admin (lib/pricing.ts).
 */
export type Tier = "standard" | "urgent" | "video" | "q3" | "q3urgent" | "written" | "writtenurgent" | "call" | "callurgent" | "f2f";
type Info = {
  mins: number; urgent: boolean; questions: boolean; video: boolean; written: boolean; deliveryHours: number; name: string; label: string; tag: string; badge: string;
  /** slot window from payment (hours) + minimum notice (hours); these tiers ignore the schedule's from/to dates */
  withinHours?: number; leadHours?: number;
  /** can be booked only between these IST hours (e.g. [12, 18] = 12:00–17:59) */
  bookHours?: [number, number];
  /** in-person meeting place (no Google Meet) */
  place?: string;
};
export const TIER_INFO: Record<Tier, Info> = {
  standard: { mins: 40, urgent: false, questions: false, video: false, written: false, deliveryHours: 0, name: "Voice Call (40 min)", label: "Standard", tag: "", badge: "" },
  urgent: { mins: 40, urgent: true, questions: false, video: false, written: false, deliveryHours: 0, name: "Urgent Voice Call (48 hrs)", label: "URGENT (48 hrs)", tag: "⚡ URGENT ", badge: "⚡ Urgent" },
  video: { mins: 30, urgent: false, questions: true, video: true, written: false, deliveryHours: 0, name: "Video Call (30 min)", label: "VIDEO CALL (30 min, 3 questions)", tag: "🎥 VIDEO ", badge: "🎥 Video Call (30 min)" },
  q3: { mins: 30, urgent: false, questions: true, video: false, written: false, deliveryHours: 0, name: "3 Question Voice Call (30 min)", label: "3-QUESTION VOICE CALL (30 min)", tag: "❓ 3Q ", badge: "❓ 3 Sawal · Voice Call (30 min)" },
  q3urgent: { mins: 30, urgent: true, questions: true, video: false, written: false, deliveryHours: 0, name: "Urgent 3 Question Voice Call (48 hrs)", label: "URGENT 3-QUESTION VOICE CALL (48 hrs, 30 min)", tag: "⚡❓ URGENT 3Q ", badge: "⚡ Urgent · 3 Sawal · Voice Call (30 min)" },
  written: { mins: 0, urgent: false, questions: true, video: false, written: true, deliveryHours: 7 * 24, name: "Personal Reading (3 Questions, answers on email)", label: "WRITTEN READING (3 questions · email · 7 days)", tag: "✍️ WRITTEN ", badge: "✍️ 3 Sawal · Jawab Email Par (7 din)" },
  writtenurgent: { mins: 0, urgent: true, questions: true, video: false, written: true, deliveryHours: 48, name: "Urgent Personal Reading (3 Questions, answers on email in 48 hrs)", label: "URGENT WRITTEN READING (3 questions · email · 48 hrs)", tag: "⚡✍️ URGENT WRITTEN ", badge: "⚡ Urgent · 3 Sawal · Jawab Email Par (48 ghante)" },
  call: { mins: 60, urgent: false, questions: false, video: true, written: false, deliveryHours: 0, withinHours: 72, leadHours: 12, name: "Video / Audio Call (1 hour)", label: "VIDEO / AUDIO CALL (1 hour · within 3 days)", tag: "📞 CALL ", badge: "📞 Video / Audio Call (1 hour)" },
  callurgent: { mins: 60, urgent: true, questions: false, video: true, written: false, deliveryHours: 0, withinHours: 3, leadHours: 1, bookHours: [12, 18], name: "Urgent Video / Audio Call (within 3 hours)", label: "URGENT CALL (1 hour · within 3 hours)", tag: "⚡📞 URGENT CALL ", badge: "⚡ Urgent · Call within 3 hours" },
  f2f: { mins: 60, urgent: false, questions: false, video: false, written: false, deliveryHours: 0, withinHours: 72, leadHours: 24, place: "Grand Hyatt Lounge, Mumbai", name: "Face to Face Meeting — Mumbai (1 hour)", label: "FACE TO FACE MEETING (Mumbai · 1 hour · within 3 days)", tag: "🤝 F2F ", badge: "🤝 Face to Face · Mumbai (1 hour)" },
};
export const ALL_TIERS = Object.keys(TIER_INFO) as Tier[];
export const parseTier = (x: unknown): Tier => (ALL_TIERS.includes(x as Tier) ? (x as Tier) : "standard");
export const tierInfo = (t?: unknown) => TIER_INFO[parseTier(t)];
export const isUrgentTier = (t?: unknown) => tierInfo(t).urgent;
export const isQuestionTier = (t?: unknown) => tierInfo(t).questions;
/** Written readings: answers are emailed (no call, no Google Meet, no calendar invite, no call reminders). */
export const isWrittenTier = (t?: unknown) => tierInfo(t).written;
/** Face-to-face meeting: a place instead of a Google Meet link. */
export const isInPerson = (t?: unknown) => !!tierInfo(t).place;
export const placeOf = (t?: unknown) => tierInfo(t).place || "";
const hrsText = (h: number) => (h % 24 === 0 && h >= 72 ? `${h / 24} din` : `${h} ghante`);
/** "3 din ke andar", "3 ghante ke andar", "48 ghante ke andar", "7 se 10 din ke andar" — when the slot / answers come. */
export function whenText(t?: unknown) {
  const i = tierInfo(t);
  if (i.withinHours) return `${hrsText(i.withinHours)} ke andar`;
  if (i.written) return `${hrsText(i.deliveryHours)} ke andar`;
  return i.urgent ? "48 ghante ke andar" : "7 se 10 din ke andar";
}
/** How the session happens, for mails / pages. */
export function sessionText(t?: unknown) {
  const tier = parseTier(t), i = TIER_INFO[tier];
  if (i.place) return `Face to Face meeting — ${i.place} (1 hour)`;
  if (tier === "call" || tier === "callurgent") return "Google Meet video / audio call (1 hour)";
  if (tier === "video") return "Google Meet VIDEO call (30 min) — camera on rakhein";
  return `Google Meet voice call (${i.mins} min)`;
}
/** Readings that can be booked only at certain hours (urgent 3-hour call: 12 PM – 6 PM IST). "" = open now. */
export function bookingClosed(t: unknown, now = Date.now()) {
  const b = tierInfo(t).bookHours;
  if (!b) return "";
  const h = new Date(now + 330 * 60000).getUTCHours();
  if (h >= b[0] && h < b[1]) return "";
  const f = (x: number) => `${x % 12 || 12} ${x < 12 ? "AM" : "PM"}`;
  return `${tierInfo(t).name} ki booking sirf ${f(b[0])} se ${f(b[1])} (IST) ke beech hoti hai. Kripya ${f(b[0])} ke baad dobara book karein.`;
}
/** Latest time the written answers are promised: form submission + 7 days (urgent: + 48 hours). */
export const deliverByMs = (tier: unknown, formAt: number) => formAt + tierInfo(tier).deliveryHours * 3600e3;
/** Reading languages offered on the form (written readings). */
export const LANGUAGES = ["Hindi", "Hinglish", "English"];
/**
 * Old links / buttons for a reading that is now switched OFF in /admin lead to the closest reading that is ON:
 * same speed first (urgent ↔ urgent), then the same kind of call. Order = preference.
 */
export const SIMILAR: Record<Tier, Tier[]> = {
  standard: ["call", "written", "q3", "video", "urgent", "q3urgent", "writtenurgent", "callurgent", "f2f"],
  urgent: ["callurgent", "writtenurgent", "q3urgent", "call", "written", "standard", "q3", "video", "f2f"],
  video: ["call", "written", "q3", "standard", "q3urgent", "urgent", "writtenurgent", "callurgent", "f2f"],
  q3: ["call", "written", "standard", "video", "q3urgent", "urgent", "writtenurgent", "callurgent", "f2f"],
  q3urgent: ["callurgent", "writtenurgent", "urgent", "call", "written", "q3", "standard", "video", "f2f"],
  written: ["call", "q3", "standard", "video", "writtenurgent", "q3urgent", "urgent", "callurgent", "f2f"],
  writtenurgent: ["callurgent", "q3urgent", "urgent", "call", "written", "q3", "standard", "video", "f2f"],
  call: ["standard", "video", "q3", "written", "callurgent", "urgent", "q3urgent", "writtenurgent", "f2f"],
  callurgent: ["urgent", "q3urgent", "writtenurgent", "call", "standard", "video", "q3", "written", "f2f"],
  f2f: ["call", "standard", "video", "q3", "written", "callurgent", "urgent", "q3urgent", "writtenurgent"],
};
/** The tier itself when it is ON, else the most similar ON tier, else null (everything is OFF). */
export const resolveTier = (t: Tier, enabled: Partial<Record<Tier, boolean>>): Tier | null =>
  enabled[t] !== false ? t : SIMILAR[t].find((x) => enabled[x] !== false) || null;
// Names people may have in old / shared links: ?tier=urgent, ?type=video, #voice, /3-questions …
const ALIASES: [RegExp, Tier][] = [
  [/^(f2f|facetoface|facetofacemeeting|meeting|mumbai|inperson|grandhyatt)$/, "f2f"],
  [/^(urgentcall|callurgent|urgentvideo|urgentaudio|3hours?|3hrs?|within3hours?)$/, "callurgent"],
  [/^(call|onehour|1hour|1hourcall|audiocall|videoaudio|audiovideo|videoaudiocall|session)$/, "call"],
  [/^((written|email|mail|likhit)urgent|urgent(written|email|mail|likhit)(reading)?)$/, "writtenurgent"],
  [/^(written|writtenreading|email|emailreading|mail|mailreading|likhit|writing)$/, "written"],
  [/^((q3|3q|3questions?|3sawal)urgent|urgent(q3|3q|3questions?|3sawal))$/, "q3urgent"],
  [/^(q3|3q|3questions?|questions?|3sawal|teensawal|3questioncall)$/, "q3"],
  [/^(video|videocall|videoreading|meet|googlemeet)$/, "video"],
  [/^(urgent|urgentreading|48|48hours?|48hrs?)$/, "urgent"],
  [/^(standard|voice|voicecall|callreading|normal|personal|personalreading|reading|40min)$/, "standard"],
];
/** Tier named in a link hint (case, spaces, "-" and "_" ignored), or null. */
export function tierFromHint(h?: string | null): Tier | null {
  let raw = String(h || "");
  try { raw = decodeURIComponent(raw); } catch {}
  const s = raw.toLowerCase().replace(/[\s_+-]+/g, "");
  if (!s) return null;
  return ALIASES.find(([re]) => re.test(s))?.[1] || null;
}
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
  if (isWrittenTier(tier)) { // written: plan slot inside the delivery window (7 days / 48 h from now), any configured day
    const base = Math.max(now, paidAt), lead = isUrgentTier(tier) ? cfg.urgentLeadHours * 3600e3 : LEAD_MS;
    return { lo: base + lead, hi: base + tierInfo(tier).deliveryHours * 3600e3, days: isUrgentTier(tier) ? cfg.urgentDays : cfg.days };
  }
  const ti = tierInfo(tier);
  if (ti.withinHours) { // call / callurgent / f2f: within N hours of payment (3 days / 3 hours), from/to dates not used
    const base = Math.max(now, paidAt);
    return { lo: base + (ti.leadHours || 0) * 3600e3, hi: paidAt + ti.withinHours * 3600e3, days: ti.urgent ? cfg.urgentDays : cfg.days };
  }
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
