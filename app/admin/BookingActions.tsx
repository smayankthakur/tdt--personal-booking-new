"use client";
import { useEffect, useState } from "react";
import { type Api, fmtSlot, keyMs } from "./ui";

export const OUTCOME: Record<string, [string, string]> = { done: ["Done ✓", "ok"], noshow: ["No-show", "err"], refunded: ["Refunded", "warn"] };

/** Reading status (Done / No-show / Refunded), Reschedule and Cancel for one confirmed booking. */
export default function BookingActions({ api, b, onDone }: { api: Api; b: any; onDone: (msg: string, newSlot?: string | null) => void }) {
  const [mode, setMode] = useState<"" | "move" | "cancel">(""), [busy, setBusy] = useState(false);
  const [date, setDate] = useState(b.slot.slice(0, 10)), [time, setTime] = useState(""), [grid, setGrid] = useState<any[] | null>(null);
  const [note, setNote] = useState(""), [notify, setNotify] = useState(true), [refund, setRefund] = useState(false), [sure, setSure] = useState(false);
  const past = keyMs(b.slot) < Date.now();

  useEffect(() => {
    if (mode !== "move" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setGrid(null); setTime("");
    api(`/api/admin/booking?from=${date}&to=${date}&bid=${encodeURIComponent(b.bid || "")}`).then((j) => setGrid(j.days?.[0]?.slots || []));
  }, [mode, date]);

  const act = async (body: object, newSlot?: string | null) => {
    setBusy(true);
    const j = await api("/api/admin/booking", "POST", { slot: b.slot, ...body });
    setBusy(false);
    if (j.error) return onDone(j.error);
    setMode(""); onDone(j.result, newSlot);
  };
  const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

  return (
    <div className="wpa-actions">
      <div className="wpa-inline-form">
        <b>Reading status:</b>
        {Object.entries(OUTCOME).map(([k, [l]]) => (
          <button key={k} className={`wpa-btn${b.outcome === k ? " primary" : ""}`} disabled={busy} onClick={() => act({ action: "outcome", outcome: b.outcome === k ? "" : k })}>{l}</button>))}
        {!past && <span className="wpa-muted">(reading ke baad set karein)</span>}
        <span style={{ flex: 1 }} />
        <button className={`wpa-btn${mode === "move" ? " primary" : ""}`} onClick={() => { setMode(mode === "move" ? "" : "move"); setSure(false); }}>🔁 Reschedule</button>
        <button className="wpa-btn" style={mode === "cancel" ? { borderColor: "#d63638", color: "#d63638" } : undefined} onClick={() => { setMode(mode === "cancel" ? "" : "cancel"); setSure(false); }}>✖ Cancel booking</button>
      </div>

      {mode === "move" && <div className="wpa-panel">
        <p><b>Naya slot chunein</b> — Google Calendar event aur Meet link wahi rahega, sirf time badlega.</p>
        <p>Date <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></p>
        {grid === null ? <p className="wpa-muted">Slots load ho rahe hain…</p> : <div className="wpa-times">
          {!grid.length && <span className="wpa-muted">Is din koi slot set nahi hai — neeche custom time daalein.</span>}
          {grid.map((s) => { const free = s.state === "free" && !s.past; return (
            <button key={s.time} disabled={!free} title={free ? "Khaali" : s.state === "own" ? "Abhi ka slot" : s.state === "booked" ? `Booked: ${s.name}` : s.state === "blocked" ? "Blocked" : s.past ? "Time nikal gaya" : "Paas wali booking se takrata hai"}
              className={`wpa-time ${time === s.time ? "sel" : ""} ${s.state}`} onClick={() => setTime(s.time)}>{s.time}</button>); })}
        </div>}
        <p>Ya custom time <input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></p>
        <p><input className="wide" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Customer ke liye message (optional) — jaise: Bharti ji us din available nahi hain" maxLength={300} /></p>
        <p><label><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Customer ko email bhejo (Google Calendar invite apne aap update hoga)</label></p>
        <p><button className="wpa-btn primary" disabled={busy || !date || !time} onClick={() => act({ action: "reschedule", to: `${date}T${time}`, note, notify }, `${date}T${time}`)}>
          {busy ? "Ho raha hai…" : time ? `${fmtSlot(b.slot)} → ${fmtSlot(`${date}T${time}`)}` : "Time chunein"}</button></p>
      </div>}

      {mode === "cancel" && <div className="wpa-panel danger">
        <p><b>Booking cancel karein</b> — slot free ho jayega, Google Calendar event hat jayega.</p>
        <p><input className="wide" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wajah / customer ke liye message (optional)" maxLength={300} /></p>
        <p><label><input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} /> Refund mark karein — <b>paisa Razorpay dashboard se khud wapas karna hoga</b>, yeh button paisa nahi bhejta</label></p>
        <p><label><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Customer ko cancel email bhejo</label></p>
        <p>{!sure ? <button className="wpa-btn danger" onClick={() => setSure(true)}>Cancel karein…</button>
          : <><button className="wpa-btn danger" disabled={busy} onClick={() => act({ action: "cancel", refund, note, notify }, null)}>{busy ? "Ho raha hai…" : "Haan, pakka cancel karein"}</button> <button className="wpa-btn" onClick={() => setSure(false)}>Nahi</button></>}</p>
      </div>}
    </div>);
}
