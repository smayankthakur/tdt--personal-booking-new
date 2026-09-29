"use client";
import { useState } from "react";
import { slotMs, type Cfg } from "@/lib/slots";
const td = { padding: "3px 14px 3px 0", opacity: 0.7, verticalAlign: "top", whiteSpace: "nowrap" } as const;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Admin() {
  const [token, setToken] = useState(""), [cfg, setCfg] = useState<Cfg | null>(null), [rows, setRows] = useState<any[]>([]), [pending, setPending] = useState<any[]>([]), [msg, setMsg] = useState(""), [openId, setOpenId] = useState("");
  const load = async () => {
    const r = await fetch("/api/admin", { headers: { "x-admin-token": token } });
    if (!r.ok) return setMsg("Galat password");
    const j = await r.json(); setCfg(j.cfg); setRows(j.bookings); setPending(j.pending || []); setMsg("");
  };
  const save = async () => {
    const r = await fetch("/api/admin", { method: "PUT", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
    setMsg(r.ok ? "Saved ✓ — naye slots turant live" : "Save nahi hua");
  };
  const day = (i: number) => cfg!.days[i] || { on: false, start: "12:00", end: "18:00" };
  const setDay = (i: number, p: object) => setCfg({ ...cfg!, days: { ...cfg!.days, [i]: { ...day(i), ...p } } });
  const box = { padding: 6, borderRadius: 6, border: "1px solid #888", background: "transparent", color: "inherit" } as const;

  if (!cfg) return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: 20 }}>
      <h2>Booking Admin</h2>
      <input type="password" placeholder="Admin password" value={token} onChange={(e) => setToken(e.target.value)} style={{ ...box, width: "100%" }} />
      <button className="btn gold" onClick={load} style={{ marginTop: 12 }}>Open</button> <p>{msg}</p>
    </div>);
  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
      <h2>Slots settings (India time)</h2>
      {DAYS.map((n, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", margin: "8px 0" }}>
          <label style={{ width: 130 }}><input type="checkbox" checked={day(i).on} onChange={(e) => setDay(i, { on: e.target.checked })} /> {n}</label>
          <input type="time" value={day(i).start} onChange={(e) => setDay(i, { start: e.target.value })} style={box} /> to
          <input type="time" value={day(i).end} onChange={(e) => setDay(i, { end: e.target.value })} style={box} />
        </div>))}
      <p>Call length (min): <input type="number" value={cfg.duration} onChange={(e) => setCfg({ ...cfg, duration: +e.target.value })} style={{ ...box, width: 70 }} />
        &nbsp; Slot gap (min): <input type="number" value={cfg.step} onChange={(e) => setCfg({ ...cfg, step: +e.target.value })} style={{ ...box, width: 70 }} />
        &nbsp; Kitne din aage tak: <input type="number" value={cfg.advanceDays} onChange={(e) => setCfg({ ...cfg, advanceDays: +e.target.value })} style={{ ...box, width: 70 }} /></p>
      <p>Band karne wali dates (YYYY-MM-DD, comma se alag):<br />
        <input value={cfg.blocked.join(",")} onChange={(e) => setCfg({ ...cfg, blocked: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} style={{ ...box, width: "100%" }} /></p>
      <button className="btn gold" onClick={save}>Save</button> <span>{msg}</span>
      {pending.length > 0 && (<>
        <h3 style={{ marginTop: 32 }}>Paid, form baaki ({pending.length})</h3>
        {pending.map((o) => (
          <div key={o.bid} style={{ borderTop: "1px solid #555", padding: "8px 0", fontSize: 14, color: "#e8a33d" }}>
            ID {o.bid} · {o.email || "-"} · {o.phone || "-"} · paid {new Date(o.paidAt).toLocaleString("en-IN")}
          </div>))}
      </>)}
      <h3 style={{ marginTop: 32 }}>Confirmed bookings ({rows.length})</h3>
      {rows.map((b) => {
        const [d, t] = b.slot.split("T"), past = slotMs(d, t) < Date.now(), open = openId === b.slot, a: Record<string, string> = b.answers || {};
        return (
          <div key={b.slot} style={{ borderTop: "1px solid #555", padding: "10px 0", fontSize: 14, opacity: past ? 0.55 : 1 }}>
            <div onClick={() => setOpenId(open ? "" : b.slot)} style={{ cursor: "pointer", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <span>{open ? "▼" : "▶"}</span><b>{d} · {t}</b><span>{b.name}</span><span>{b.phone}</span>
              {a["Concern"] && <span style={{ color: "#c9a227" }}>· {a["Concern"]}</span>}
              {b.calendarOk === false && <span style={{ color: "#f66" }}>⚠ Meet link nahi bana</span>}
              {b.clientMailOk === false && <span style={{ color: "#f66" }}>⚠ client mail fail</span>}
            </div>
            {open && (
              <div style={{ margin: "10px 0 4px 22px", padding: 14, border: "1px solid #555", borderRadius: 10 }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}><tbody>
                  {b.meetLink && <tr><td style={td}>Meet link</td><td><a href={b.meetLink} target="_blank" rel="noopener noreferrer" style={{ color: "#9b8cff" }}>{b.meetLink}</a></td></tr>}
                  <tr><td style={td}>Email</td><td>{b.email}</td></tr>
                  {Object.entries(a).filter(([k, v]) => v && k !== "Email (payment)" && k !== "Slot").map(([k, v]) => (
                    <tr key={k}><td style={td}>{k}</td><td style={{ whiteSpace: "pre-wrap" }}>{v}</td></tr>))}
                  <tr><td style={td}>Booking / Payment</td><td>{b.bid} · {b.paymentId || "-"}</td></tr>
                </tbody></table>
                {!b.answers && <p style={{ color: "#e8a33d" }}>Is booking ka form data nahi mila (purani booking).</p>}
                <p style={{ fontSize: 12, opacity: 0.7, margin: "10px 0 0" }}>Photos sirf email (OWNER_EMAIL) mein attach hoti hain, yahan nahi.</p>
              </div>)}
          </div>);
      })}
    </div>);
}
