"use client";
import { useMemo, useState } from "react";
import { ALL_TIERS, TIER_INFO } from "@/lib/slots";
import BookingActions, { OUTCOME } from "./BookingActions";
import MailLog from "./MailLog";
import { type Customer, custKey } from "./customers";
import { type Api, TypeTag, fmtSlot, fmtTime, inr, keyMs } from "./ui";

const td = { padding: "6px 14px 6px 0", color: "#646970", verticalAlign: "top", whiteSpace: "nowrap" } as const;
type View = "all" | "upcoming" | "past" | "nostatus" | "edited" | "cancelled";

/** CSV download (Excel-friendly: UTF-8 BOM so ₹ and Hindi names show correctly). */
function downloadCsv(name: string, head: string[], lines: (string | number)[][]) {
  const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = "﻿" + [head, ...lines].map((r) => r.map(cell).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function Bookings({ api, rows, orders, cancelled, customers, openId, setOpenId, onNote, reload, retry, openCustomer }: {
  api: Api; rows: any[]; orders: any[]; cancelled: any[]; customers: Map<string, Customer>; openId: string; setOpenId: (s: string) => void;
  onNote: (m: string) => void; reload: () => void; retry: (slot: string) => void; openCustomer: (key: string) => void;
}) {
  const [view, setView] = useState<View>("all"), [q, setQ] = useState(""), [tier, setTier] = useState(""), [from, setFrom] = useState(""), [to, setTo] = useState("");
  const now = Date.now(), order = useMemo(() => new Map(orders.map((o) => [o.bid, o])), [orders]);
  const isPast = (b: any) => keyMs(b.slot) < now;
  const counts = {
    all: rows.length, upcoming: rows.filter((b) => !isPast(b)).length, past: rows.filter(isPast).length,
    nostatus: rows.filter((b) => isPast(b) && !b.outcome).length, edited: rows.filter((b) => b.edits).length, cancelled: cancelled.length,
  };
  const match = (b: any) => {
    if (tier && (b.tier || "standard") !== tier) return false;
    if (from && b.slot.slice(0, 10) < from) return false;
    if (to && b.slot.slice(0, 10) > to) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    const hay = [b.name, b.email, b.phone, b.bid, b.paymentId, b.answers?.Concern, b.slot].join(" ").toLowerCase();
    return s.split(/\s+/).every((w) => hay.includes(w)) || (s.replace(/\D/g, "").length >= 4 && String(b.phone || "").replace(/\D/g, "").includes(s.replace(/\D/g, "")));
  };
  const list = (view === "cancelled" ? cancelled : rows.filter((b) =>
    view === "upcoming" ? !isPast(b) : view === "past" ? isPast(b) : view === "nostatus" ? isPast(b) && !b.outcome : view === "edited" ? !!b.edits : true))
    .filter(match)
    .sort((x, y) => { // upcoming first (soonest on top), then past ones (latest first)
      const px = isPast(x), py = isPast(y);
      return px !== py ? (px ? 1 : -1) : px ? y.slot.localeCompare(x.slot) : x.slot.localeCompare(y.slot);
    });
  const repeat = (b: any) => { const c = customers.get(custKey(b.email, b.phone)); return c ? c.bookings.filter((x) => x._state === "confirmed").length : 0; };

  const exportCsv = () => downloadCsv(`bookings-${view}-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Date", "Time (IST)", "Name", "Email", "Phone", "Reading", "Concern", "Status", "Amount (INR)", "Coupon", "Booking ID", "Payment ID"],
    list.map((b) => { const o = order.get(b.bid) || {}; return [b.slot.slice(0, 10), b.slot.slice(11), b.name, b.email, b.phone, TIER_INFO[(b.tier || "standard") as keyof typeof TIER_INFO]?.name || b.tier,
      b.answers?.Concern || "", view === "cancelled" ? `Cancelled${b.refunded ? " (refund)" : ""}` : b.outcome ? OUTCOME[b.outcome]?.[0] : isPast(b) ? "Status baaki" : "Upcoming",
      o.amount || "", o.coupon || "", b.bid || "", b.paymentId || ""]; }));

  const V = ({ k, l }: { k: View; l: string }) => <li><a className={view === k ? "current" : ""} onClick={() => setView(k)}>{l}</a> ({counts[k]})</li>;
  const filtered = q || tier || from || to;
  return (<>
    <ul className="wpa-subsubsub"><V k="all" l="Sab" /><V k="upcoming" l="Aane wali" /><V k="past" l="Ho chuki" /><V k="nostatus" l="Status baaki" /><V k="edited" l="Edited" /><V k="cancelled" l="Cancelled" /></ul>
    <div className="wpa-tablenav">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Naam, email, phone, booking ID…" style={{ minWidth: 240 }} />
      <select value={tier} onChange={(e) => setTier(e.target.value)}><option value="">Saari readings</option>{ALL_TIERS.map((t) => <option key={t} value={t}>{TIER_INFO[t].name}</option>)}</select>
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Is date se" /> <span className="wpa-muted">se</span>
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Is date tak" />
      {filtered && <button className="wpa-btn" onClick={() => { setQ(""); setTier(""); setFrom(""); setTo(""); }}>Filter hatao</button>}
      <span style={{ flex: 1 }} />
      <span className="wpa-muted">{list.length} bookings</span>
      <button className="wpa-btn" disabled={!list.length} onClick={exportCsv}>⬇ CSV (Excel)</button>
    </div>

    <table className="wpa-table">
      <thead><tr><th style={{ width: 150 }}>Slot</th><th>Customer</th><th style={{ width: 210 }}>Reading</th><th>Concern</th><th style={{ width: 160 }}>Status</th></tr></thead>
      <tbody>
        {!list.length && <tr><td colSpan={5}>{filtered ? "Is filter mein koi booking nahi." : view === "cancelled" ? "Koi cancelled booking nahi." : "Abhi koi booking nahi hai."}</td></tr>}
        {view === "cancelled" ? list.map((b) => (
          <tr key={b.bid + b.slot} className="past">
            <td><b>{b.slot.slice(0, 10)}</b><br />{b.slot.slice(11)} IST</td>
            <td><a className="wpa-row-title" onClick={() => openCustomer(custKey(b.email, b.phone))}>{b.name}</a><div className="wpa-muted">{b.phone} · {b.email}</div></td>
            <td><TypeTag t={b.tier} /></td>
            <td>{b.reason || <span className="wpa-muted">—</span>}<div className="wpa-muted">{fmtTime(b.cancelledAt)} · {b.cancelledBy}</div></td>
            <td><span className="wpa-status err">Cancelled</span>{b.refunded && <span className="wpa-status warn">Refund</span>}</td>
          </tr>)) : list.map((b) => {
          const [d, t] = b.slot.split("T"), past = isPast(b), open = openId === b.slot, a: Record<string, string> = b.answers || {}, n = repeat(b), o = order.get(b.bid);
          return [
            <tr key={b.slot} id={"bk-" + b.slot} className={past ? "past" : ""}>
              <td><b>{d}</b><br />{t} IST{past && <span className="wpa-muted"> · ho gayi</span>}</td>
              <td><a className="wpa-row-title" onClick={() => setOpenId(open ? "" : b.slot)}>{b.name}</a>{n > 1 && <span className="wpa-tag blue" title="Is customer ki itni bookings">🔁 {n} bookings</span>}
                <div className="wpa-muted">{b.phone} · {b.email}</div>
                <div className="wpa-row-actions"><a onClick={() => setOpenId(open ? "" : b.slot)}>{open ? "Band karein" : "Details"}</a> | <a onClick={() => openCustomer(custKey(b.email, b.phone))}>Customer history</a>{b.meetLink && <> | <a href={b.meetLink} target="_blank" rel="noopener noreferrer">Meet link</a></>}</div></td>
              <td><TypeTag t={b.tier} />{o?.amount ? <div className="wpa-muted">{inr(o.amount)}{o.coupon ? ` · 🎟 ${o.coupon}` : ""}</div> : null}</td>
              <td>{a["Concern"] || "—"}</td>
              <td>{b.calendarOk === false ? <span className="wpa-status err">Meet link nahi bana</span> : b.clientMailOk === false ? <span className="wpa-status err">Client mail fail</span>
                : b.outcome ? <span className={`wpa-status ${OUTCOME[b.outcome]?.[1]}`}>{OUTCOME[b.outcome]?.[0]}</span>
                : past ? <span className="wpa-status" title="Details kholkar Done / No-show set karein">Ho gayi · status?</span> : <span className="wpa-status ok">Confirmed</span>}
                {b.rescheduledFrom ? <div><span className="wpa-status edit" title={`Pehle: ${fmtSlot(b.rescheduledFrom)}`}>🔁 Rescheduled</span></div> : null}
                {b.edits ? <div><span className="wpa-status edit">✏️ Edited{b.edits > 1 ? ` ×${b.edits}` : ""}</span></div> : null}</td>
            </tr>,
            open && <tr key={b.slot + "-d"} className="wpa-detail"><td colSpan={5}>
              <BookingActions api={api} b={b} onDone={(m, ns) => { onNote(m); if (ns !== undefined) setOpenId(ns || ""); reload(); }} />
              <table className="wpa-kv"><tbody>
                {b.meetLink && <tr><td style={td}>Meet link</td><td><a href={b.meetLink} target="_blank" rel="noopener noreferrer">{b.meetLink}</a></td></tr>}
                <tr><td style={td}>Email</td><td>{b.email}</td></tr>
                {b.rescheduledFrom && <tr><td style={td}>Pehle ka slot</td><td>{fmtSlot(b.rescheduledFrom)} · badla {fmtTime(b.rescheduledAt)} ({b.rescheduledBy})</td></tr>}
                {Object.entries(a).filter(([k, v]) => v && k !== "Email (payment)" && k !== "Slot").map(([k, v]) => (
                  <tr key={k}><td style={td}>{k}</td><td style={{ whiteSpace: "pre-wrap" }}>{v}</td></tr>))}
                <tr><td style={td}>Booking / Payment</td><td>{b.bid} · {b.paymentId || "-"}</td></tr>
              </tbody></table>
              {(b.calendarOk === false || b.clientMailOk === false) && (
                <div className="wpa-notice error inline">
                  {b.calendarErr && <p>Meet error: {b.calendarErr}</p>}
                  {b.mailErr && <p>Email error: {b.mailErr}</p>}
                  <p><button className="wpa-btn primary" onClick={() => retry(b.slot)}>↻ Meet link + email dobara bhejein</button></p>
                </div>)}
              {!b.answers && <p className="wpa-muted">Is booking ka form data nahi mila (purani booking).</p>}
              {b.bid && <MailLog api={api} bid={b.bid} form slotAhead={!past} hasEvent={!!b.eventId} onNote={onNote} />}
              <p className="wpa-muted" style={{ fontSize: 12 }}>Photos sirf email (OWNER_EMAIL) mein attach hoti hain, yahan nahi.</p>
            </td></tr>,
          ];
        })}
      </tbody>
    </table>
  </>);
}
