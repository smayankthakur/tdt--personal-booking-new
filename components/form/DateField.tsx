"use client";
import { useMemo, useState } from "react";
const pad = (n: number) => String(n).padStart(2, "0");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["M", "T", "W", "T", "F", "S", "S"];
type V = { d: string; m: string; y: string };

/** Calendar popover for dates of birth. Writes hidden inputs <p>d/<p>m/<p>y. "Nahi pata" switches to manual boxes (11 / 00 allowed). */
export default function DateField({ p, onChange }: { p: string; onChange?: (complete: boolean) => void }) {
  const [v, setV] = useState<V>({ d: "", m: "", y: "" }), [open, setOpen] = useState(false), [manual, setManual] = useState(false), [years, setYears] = useState(false);
  const [view, setView] = useState({ y: 1995, m: 0 });
  const set = (n: V) => { setV(n); onChange?.(!!(n.d && n.m && n.y)); };
  const nowY = new Date().getFullYear();
  const cells = useMemo(() => {
    const lead = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7, n = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    return [...Array(lead).fill(0), ...Array.from({ length: n }, (_, i) => i + 1)];
  }, [view]);
  const shown = v.d && v.m && v.y ? `${v.d} ${MON[+v.m - 1] || v.m} ${v.y}` : "";
  const nav = (d: number) => setView((x) => { const t = x.y * 12 + x.m + d; return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; });

  return (
    <div>
      {["d", "m", "y"].map((k) => <input key={k} type="hidden" name={p + k} value={(v as any)[k]} />)}
      {manual ? (
        <div className="rf-row3">
          <input className="rf-in" inputMode="numeric" maxLength={2} placeholder="DD" value={v.d} onChange={(e) => set({ ...v, d: e.target.value.replace(/\D/g, "") })} />
          <input className="rf-in" inputMode="numeric" maxLength={2} placeholder="MM" value={v.m} onChange={(e) => set({ ...v, m: e.target.value.replace(/\D/g, "") })} />
          <input className="rf-in" inputMode="numeric" maxLength={4} placeholder="YYYY" value={v.y} onChange={(e) => set({ ...v, y: e.target.value.replace(/\D/g, "") })} />
        </div>
      ) : (
        <button type="button" className={`pick-btn${shown ? " has" : ""}`} onClick={() => setOpen(!open)}>
          <span>📅</span>{shown || "Date chunein"}<i>{open ? "▲" : "▼"}</i>
        </button>)}
      <button type="button" className="link-btn" onClick={() => { setManual(!manual); setOpen(false); }}>
        {manual ? "← Calendar se chunein" : "Date, month ya year nahi pata? Manual likhein"}
      </button>
      {open && !manual && (
        <div className="pop">
          <div className="pop-head">
            <button type="button" onClick={() => nav(-1)}>‹</button>
            <button type="button" className="pop-title" onClick={() => setYears(!years)}>{MON[view.m]} {view.y} ▾</button>
            <button type="button" onClick={() => nav(1)}>›</button>
          </div>
          {years ? (
            <div className="pop-years">{Array.from({ length: nowY - 1929 }, (_, i) => nowY - i).map((y) => (
              <button type="button" key={y} className={y === view.y ? "on" : ""} onClick={() => { setView({ ...view, y }); setYears(false); }}>{y}</button>))}</div>
          ) : (<>
            <div className="pop-months">{MON.map((m, i) => <button type="button" key={m} className={i === view.m ? "on" : ""} onClick={() => setView({ ...view, m: i })}>{m}</button>)}</div>
            <div className="cal-grid">
              {WD.map((w, i) => <span key={i} className="cal-wd">{w}</span>)}
              {cells.map((d, i) => d === 0 ? <span key={"e" + i} /> : (
                <button type="button" key={d} className={`cal-day avail${+v.d === d && +v.m === view.m + 1 && +v.y === view.y ? " on" : ""}`}
                  onClick={() => { set({ d: pad(d), m: pad(view.m + 1), y: String(view.y) }); setOpen(false); }}>{d}</button>))}
            </div>
          </>)}
        </div>)}
    </div>);
}
