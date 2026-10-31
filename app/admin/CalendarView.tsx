"use client";
import { useEffect, useState } from "react";
import type { Cfg } from "@/lib/slots";
import { TIER_INFO } from "@/lib/slots";
import { type Api, istDay } from "./ui";

const add = (d: string, n: number) => new Date(new Date(d + "T00:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10);
const monday = (d: string) => add(d, -((new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7));
const head = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const t12 = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/** Week grid of every slot: booked / held / blocked / free. Free slots can be blocked, and whole days closed. */
export default function CalendarView({ api, cfg, saveCfg, openBooking, onNote }: {
  api: Api; cfg: Cfg; saveCfg: (c: Cfg) => Promise<boolean>; openBooking: (slot: string) => void; onNote: (m: string) => void;
}) {
  const [start, setStart] = useState(monday(istDay(Date.now()))), [days, setDays] = useState<any[] | null>(null), [pick, setPick] = useState(""), [busy, setBusy] = useState(false);
  const load = () => { setDays(null); api(`/api/admin/booking?from=${start}&to=${add(start, 6)}`).then((j) => setDays(j.days || [])); };
  useEffect(() => { load(); setPick(""); }, [start]);
  const today = istDay(Date.now()), now = Date.now();

  const act = async (action: "block" | "unblock", key: string) => {
    setBusy(true);
    const j = await api("/api/admin/booking", "POST", { action, slot: key });
    setBusy(false); setPick(""); onNote(j.result || j.error); load();
  };
  const toggleDay = async (date: string) => {
    const closed = cfg.blocked.includes(date);
    const next = { ...cfg, blocked: closed ? cfg.blocked.filter((d) => d !== date) : [...cfg.blocked, date].sort() };
    setBusy(true);
    const ok = await saveCfg(next);
    setBusy(false);
    onNote(ok ? `${head(date)} ${closed ? "phir se khul gaya — naye customers ko is din slot mil sakta hai" : "poora band — is din koi nayi booking nahi hogi (purani bookings par asar nahi)"} ✓` : "Save nahi hua");
    load();
  };
  const times = days ? Array.from(new Set(days.flatMap((d) => d.slots.map((s: any) => s.time)))).sort() : [];
  const counts: Record<string, number> = {};
  for (const s of days ? days.flatMap((d) => d.slots) : []) counts[s.state] = (counts[s.state] || 0) + 1;

  return (<>
    <div className="wpa-tablenav">
      <button className="wpa-btn" onClick={() => setStart(add(start, -7))}>‹ Pichhla hafta</button>
      <button className="wpa-btn" onClick={() => setStart(monday(today))}>Is hafte</button>
      <button className="wpa-btn" onClick={() => setStart(add(start, 7))}>Agla hafta ›</button>
      <b style={{ marginLeft: 8 }}>{head(start)} – {head(add(start, 6))}</b>
      <span style={{ flex: 1 }} />
      <span className="wpa-legend"><i className="booked" /> Booked ({counts.booked || 0}) <i className="held" /> Payment chal raha <i className="blocked" /> Blocked ({counts.blocked || 0}) <i className="free" /> Khaali ({counts.free || 0})</span>
    </div>
    <p className="description">Khaali slot par click karke use block karein (jaise chhutti ya personal kaam) — us time koi nayi booking nahi hogi. Blocked slot par click karke phir se kholein. Din ke naam par click karke poora din band/chalu karein.</p>
    {days === null ? <p>Load ho raha hai…</p> :
      <div className="wpa-cal-wrap"><table className="wpa-cal">
        <thead><tr><th />{days.map((d) => (
          <th key={d.date} className={`${d.closed ? "closed" : ""} ${d.date === today ? "today" : ""}`}>
            <button className="wpa-cal-day" disabled={busy || d.date < today} onClick={() => setPick(pick === "day:" + d.date ? "" : "day:" + d.date)}
              title={d.closed ? "Band hai — kholne ke liye click karein" : "Poora din band karne ke liye click karein"}>{head(d.date)}{d.closed && <small>Band</small>}</button>
            {pick === "day:" + d.date && <div className="wpa-cal-confirm"><button className={`wpa-btn ${d.closed ? "primary" : "danger"}`} disabled={busy} onClick={() => { setPick(""); toggleDay(d.date); }}>{d.closed ? "Din kholein" : "Poora din band"}</button></div>}</th>))}</tr></thead>
        <tbody>{times.map((t) => <tr key={t}><th>{t12(t)}</th>{days.map((d) => {
          const s = d.slots.find((x: any) => x.time === t), key = `${d.date}T${t}`;
          if (!s) return <td key={key} className="off" />;
          const past = new Date(`${key}:00+05:30`).getTime() < now, open = pick === key;
          if (s.state === "booked") return <td key={key} className={`booked ${past ? "past" : ""}`}><a onClick={() => openBooking(key)} title={TIER_INFO[s.tier as keyof typeof TIER_INFO]?.name}>
            <b>{s.name || "Booked"}</b><span>{TIER_INFO[s.tier as keyof typeof TIER_INFO]?.badge || "Voice"}{s.outcome === "done" ? " · ✓" : s.outcome === "noshow" ? " · No-show" : ""}</span></a></td>;
          if (s.state === "held") return <td key={key} className="held"><span>Payment chal raha…</span></td>;
          if (s.state === "blocked") return <td key={key} className="blocked">{open
            ? <><button className="wpa-btn" disabled={busy} onClick={() => act("unblock", key)}>Kholein</button> <a onClick={() => setPick("")}>✕</a></>
            : <a onClick={() => !past && setPick(key)}>🔒 Blocked</a>}</td>;
          if (d.closed || past || s.state === "busy") return <td key={key} className={d.closed ? "closedcell" : "busy"}>{s.state === "busy" && !past && !d.closed ? <span title="Paas wali booking ki wajah se">—</span> : null}</td>;
          return <td key={key} className="free">{open
            ? <><button className="wpa-btn danger" disabled={busy} onClick={() => act("block", key)}>Block</button> <a onClick={() => setPick("")}>✕</a></>
            : <a onClick={() => setPick(key)}>Khaali</a>}</td>;
        })}</tr>)}</tbody>
      </table></div>}
  </>);
}
