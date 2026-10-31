"use client";
import { useEffect, useState } from "react";
import { OUTCOME } from "./BookingActions";
import type { Customer } from "./customers";
import { type Api, TypeTag, fmtSlot, fmtTime, inr, keyMs } from "./ui";

/** Slide-in panel: everything about one customer — bookings, payments, private notes. */
export default function CustomerPanel({ api, c, onClose, openBooking }: { api: Api; c: Customer; onClose: () => void; openBooking: (slot: string) => void }) {
  const [notes, setNotes] = useState<any[] | null>(null), [text, setText] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const load = () => c.email ? api(`/api/admin/customer?email=${encodeURIComponent(c.email)}`).then((j) => setNotes(j.notes || [])) : setNotes([]);
  useEffect(() => { load(); }, [c.key]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []);
  const add = async () => {
    setBusy(true); setErr("");
    const j = await api("/api/admin/customer", "POST", { email: c.email, text });
    setBusy(false); if (j.error) return setErr(j.error); setText(""); load();
  };
  const del = async (id: string) => { await api(`/api/admin/customer?email=${encodeURIComponent(c.email)}&id=${id}`, "DELETE"); load(); };
  const bookings = [...c.bookings].sort((a, b) => b.slot.localeCompare(a.slot));
  const orders = [...c.orders].sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));

  return (
    <div className="wpa-overlay" onClick={onClose}>
      <aside className="wpa-side" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Customer">
        <div className="wpa-side-head"><h2>{c.name || c.email || c.phone}</h2><button className="wpa-btn" onClick={onClose}>✕ Band karein</button></div>
        <p className="wpa-muted">{c.email || "Email nahi"}{c.phone ? ` · ${c.phone}` : ""}</p>
        <div className="wpa-cards" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="wpa-card"><div className="n">{c.bookings.filter((b) => b._state === "confirmed").length}</div><div className="l">Bookings</div></div>
          <div className="wpa-card"><div className="n">{inr(c.spent)}</div><div className="l">Kul payment</div></div>
          <div className="wpa-card"><div className="n">{c.bookings.filter((b) => b.outcome === "noshow").length}</div><div className="l">No-show</div></div>
        </div>

        <h3>📝 Private notes <small className="wpa-muted">(sirf admin dekh sakte hain)</small></h3>
        {c.email ? <>
          <textarea className="wpa-textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Jaise: reading mein career change bataya, 2 mahine baad follow-up…" maxLength={2000} />
          <p><button className="wpa-btn primary" disabled={busy || !text.trim()} onClick={add}>{busy ? "Save ho raha hai…" : "Note save karein"}</button> {err && <span style={{ color: "#d63638" }}>{err}</span>}</p>
          {notes === null ? <p className="wpa-muted">Load ho raha hai…</p> : !notes.length ? <p className="wpa-muted">Abhi koi note nahi.</p> :
            notes.map((n) => <div key={n.id} className="wpa-note"><div style={{ whiteSpace: "pre-wrap" }}>{n.text}</div>
              <div className="wpa-muted" style={{ fontSize: 12 }}>{fmtTime(n.at)} · {n.by} · <a className="wpa-link-delete" onClick={() => del(n.id)}>Delete</a></div></div>)}
        </> : <p className="wpa-muted">Is customer ki email nahi hai, isliye notes save nahi ho sakte.</p>}

        <h3>📅 Bookings ({bookings.length})</h3>
        <table className="wpa-table compact"><tbody>
          {bookings.map((b) => <tr key={b.bid + b.slot} className={b._state === "cancelled" ? "past" : ""}>
            <td>{b._state === "confirmed" ? <a onClick={() => { onClose(); openBooking(b.slot); }}><b>{fmtSlot(b.slot)}</b></a> : <b>{fmtSlot(b.slot)}</b>}</td>
            <td><TypeTag t={b.tier} /></td>
            <td>{b._state === "cancelled" ? <span className="wpa-status err">Cancelled{b.refunded ? " · refund" : ""}</span>
              : b.outcome ? <span className={`wpa-status ${OUTCOME[b.outcome]?.[1]}`}>{OUTCOME[b.outcome]?.[0]}</span>
              : keyMs(b.slot) > Date.now() ? <span className="wpa-status ok">Upcoming</span> : <span className="wpa-status">Status baaki</span>}</td>
            <td className="wpa-muted">{b.answers?.Concern || ""}</td>
          </tr>)}
        </tbody></table>

        <h3>💳 Payments ({orders.length})</h3>
        <table className="wpa-table compact"><tbody>
          {orders.map((o) => <tr key={o.bid}><td><b>{inr(o.amount)}</b>{o.coupon && <span className="wpa-tag">🎟 {o.coupon}</span>}</td><td><TypeTag t={o.tier} /></td>
            <td>{fmtTime(o.paidAt)}</td><td>{o.refunded ? <span className="wpa-status warn">Refunded</span> : o.status === "cancelled" ? <span className="wpa-status err">Cancelled</span> : o.formDone ? <span className="wpa-status ok">Form bhara</span> : <span className="wpa-status warn">Form baaki</span>}</td></tr>)}
        </tbody></table>
      </aside>
    </div>);
}
