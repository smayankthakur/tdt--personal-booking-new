export type DayCfg = { on: boolean; start: string; end: string };
export type Cfg = { days: Record<string, DayCfg>; duration: number; step: number; advanceDays: number; blocked: string[] };

// days: 0=Sun … 6=Sat. Times are IST. step = gap between slot starts (60 => 40-min call + 20-min break)
export const DEFAULT_CFG: Cfg = {
  days: {
    "2": { on: true, start: "13:00", end: "17:00" },
    "4": { on: true, start: "15:00", end: "18:00" },
    "6": { on: true, start: "12:00", end: "20:00" },
    "0": { on: true, start: "12:00", end: "13:00" },
  },
  duration: 40, step: 60, advanceDays: 21, blocked: [],
};
export const LEAD_MS = 12 * 3600 * 1000; // no bookings closer than 12h
export const HOLD_MS = 20 * 60 * 1000;   // slot held while paying

const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const istNow = () => new Date(Date.now() + 330 * 60000);
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const slotMs = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).getTime();
export const isTaken = (b: any) => b.status === "confirmed" || (b.status === "held" && b.holdUntil > Date.now());

export function daySlots(cfg: Cfg, date: string): string[] {
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  const d = cfg.days[String(dow)];
  if (!d?.on || cfg.blocked.includes(date)) return [];
  const out: string[] = [];
  for (let t = mins(d.start); t + cfg.duration <= mins(d.end); t += cfg.step)
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  return out;
}
