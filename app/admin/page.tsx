"use client";
import { useState } from "react";
import { slotMs, type Cfg } from "@/lib/slots";
const td = { padding: "3px 14px 3px 0", opacity: 0.7, verticalAlign: "top", whiteSpace: "nowrap" } as const;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Admin() {
  const [token, setToken] = useState(""), [cfg, setCfg] = useState<Cfg | null>(null), [rows, setRows] = useState<any[]>([]), [orders, setOrders] = useState<any[]>([]), [tab, setTab] = useState<"book" | "pay" | "slots">("book"), [msg, setMsg] = useState(""), [openId, setOpenId] = useState(""), [missing, setMissing] = useState<string[]>([]), [note, setNote] = useState("");
  const load = async () => {
    const r = await fetch("/api/admin", { headers: { "x-admin-token": token } });
    if (!r.ok) return setMsg("Galat password");
    const j = await r.json(); setCfg(j.cfg); setRows(j.bookings); setOrders(j.orders || []); setMissing(j.missingEnv || []); setMsg("");
  };
  const retry = async (slot: string) => {
    setNote("Try ho raha hai…");
    const r = await fetch("/api/admin", { method: "POST", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify({ slot }) });
    const j = await r.json(); setNote(`${slot.replace("T", " ")}: ${j.result || j.error}`); load();
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
      <div style={{ display: "flex", gap: 8, margin: "0 0 20px", borderBottom: "1px solid #555", flexWrap: "wrap" }}>
        {([["book", `Confirmed bookings (${rows.length})`], ["pay", `Payment status (${orders.length})`], ["slots", "Slots settings"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "10px 16px", background: "transparent", border: 0, borderBottom: tab === k ? "2px solid #c9a227" : "2px solid transparent", color: tab === k ? "#c9a227" : "inherit", font: "inherit", fontWeight: tab === k ? 700 : 400, cursor: "pointer" }}>{l}</button>))}
        <button onClick={load} style={{ marginLeft: "auto", padding: "6px 12px", background: "transparent", border: "1px solid #555", borderRadius: 8, color: "inherit", cursor: "pointer" }}>↻ Refresh</button>
      </div>
      {tab === "slots" && (<div>
      <h3>Slots settings (India time)</h3>
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
      </div>)}
      {tab === "pay" && (<div>
      {(() => {
        const st = (o: any) => o.status !== "paid" ? ["Payment pending", "#9aa0a6"] : o.formDone ? ["Paid · form bhara", "#7ee2a8"] : ["Paid · form baaki", "#e8a33d"];
        const n = (f: (o: any) => boolean) => orders.filter(f).length;
        return (<>
          <p style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 14 }}>
            <span style={{ color: "#7ee2a8" }}>✓ Paid + form: {n((o) => o.status === "paid" && o.formDone)}</span>
            <span style={{ color: "#e8a33d" }}>● Paid, form baaki: {n((o) => o.status === "paid" && !o.formDone)}</span>
            <span style={{ color: "#9aa0a6" }}>○ Unpaid: {n((o) => o.status !== "paid")}</span>
          </p>
          {!orders.length && <p style={{ opacity: 0.7 }}>Abhi koi payment attempt nahi hai.</p>}
          {orders.map((o) => { const [label, col] = st(o); return (
            <div key={o.bid} style={{ borderTop: "1px solid #555", padding: "9px 0", fontSize: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <b style={{ color: col, minWidth: 130 }}>{label}</b>
              <span>{o.name || "-"}</span><span>{o.email || "-"}</span><span>{o.phone || "-"}</span>
              {o.slot && <span>Slot {o.slot.replace("T", " ")}</span>}
              <span style={{ opacity: 0.6 }}>{new Date(o.paidAt || o.createdAt).toLocaleString("en-IN")} · ID {o.bid}{o.paymentId ? ` · ${o.paymentId}` : ""}</span>
            </div>); })}
        </>);
      })()}
      </div>)}
      {tab === "book" && (<div>
      {missing.length > 0 && <p style={{ color: "#f66", border: "1px solid #f66", borderRadius: 8, padding: 10, fontSize: 14 }}>⚠ Vercel mein yeh settings missing hain: <b>{missing.join(", ")}</b> — jab tak yeh set nahi hongi Meet link aur emails nahi jayenge.</p>}
      {note && <p style={{ border: "1px solid #555", borderRadius: 8, padding: 10, fontSize: 14 }}>{note}</p>}
      {!rows.length && <p style={{ opacity: 0.7 }}>Abhi koi confirmed booking nahi hai.</p>}
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
                {(b.calendarOk === false || b.clientMailOk === false) && (
                  <div style={{ margin: "10px 0", padding: 10, border: "1px solid #f66", borderRadius: 8 }}>
                    {b.calendarErr && <div style={{ color: "#f66" }}>Meet error: {b.calendarErr}</div>}
                    {b.mailErr && <div style={{ color: "#f66" }}>Email error: {b.mailErr}</div>}
                    <button className="btn gold" style={{ marginTop: 8, padding: "8px 18px" }} onClick={() => retry(b.slot)}>↻ Meet link + email dobara bhejein</button>
                  </div>)}
                {!b.answers && <p style={{ color: "#e8a33d" }}>Is booking ka form data nahi mila (purani booking).</p>}
                <p style={{ fontSize: 12, opacity: 0.7, margin: "10px 0 0" }}>Photos sirf email (OWNER_EMAIL) mein attach hoti hain, yahan nahi.</p>
              </div>)}
          </div>);
      })}
      </div>)}
    </div>);
}
