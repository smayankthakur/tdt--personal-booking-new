"use client";
import { useMemo, useState } from "react";

const fmtT = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const pad = (n: number) => String(n).padStart(2, "0");
const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Calendly-style picker: month grid on the left (only bookable days are active), time list on the right. */
export default function SlotPicker({ slots, date, time, onDate, onTime }: {
  slots: Record<string, string[]>; date: string; time: string; onDate: (d: string) => void; onTime: (t: string) => void;
}) {
  const days = Object.keys(slots).sort();
  const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10); // India date
  const first = days[0] || today, last = days[days.length - 1] || today;
  const [ym, setYm] = useState(() => { const [y, m] = first.split("-").map(Number); return { y, m: m - 1 }; });

  const cells = useMemo(() => {
    const lead = (new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay() + 6) % 7; // Monday-first
    const n = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
    return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => `${ym.y}-${pad(ym.m + 1)}-${pad(i + 1)}`)];
  }, [ym]);

  const [fy, fm] = first.split("-").map(Number), [ly, lm] = last.split("-").map(Number);
  const canPrev = ym.y * 12 + ym.m > fy * 12 + (fm - 1), canNext = ym.y * 12 + ym.m < ly * 12 + (lm - 1);
  const step = (d: number) => setYm((p) => { const v = p.y * 12 + p.m + d; return { y: Math.floor(v / 12), m: v % 12 }; });
  const title = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const dayLabel = date && new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <div className="cal">
      <div className="cal-left">
        <div className="cal-head">
          <button type="button" onClick={() => step(-1)} disabled={!canPrev} aria-label="Previous month">‹</button>
          <b>{title}</b>
          <button type="button" onClick={() => step(1)} disabled={!canNext} aria-label="Next month">›</button>
        </div>
        <div className="cal-grid">
          {WD.map((w) => <span key={w} className="cal-wd">{w}</span>)}
          {cells.map((d, i) => d === null ? <span key={"e" + i} /> : (
            <button type="button" key={d} disabled={!slots[d]} onClick={() => { onDate(d); onTime(""); }}
              className={`cal-day${slots[d] ? " avail" : ""}${d === date ? " on" : ""}${d === today ? " today" : ""}`}>{Number(d.slice(8))}</button>))}
        </div>
        <p className="cal-tz">🌐 India Standard Time (IST)</p>
      </div>

      <div className="cal-right">
        {!date ? <p className="rf-hint" style={{ marginTop: 40 }}>← Ek available date chunein</p> : (<>
          <div className="cal-daylabel">{dayLabel}</div>
          <div className="cal-times">
            {slots[date].map((t) => (
              <button type="button" key={t} className={t === time ? "on" : ""} onClick={() => onTime(t)}>{fmtT(t)}</button>))}
          </div>
        </>)}
      </div>
      {date && time && <p className="cal-picked">✓ Selected: <b>{dayLabel} · {fmtT(time)} IST</b></p>}
    </div>);
}
