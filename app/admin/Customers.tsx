"use client";
import { useState } from "react";
import type { Customer } from "./customers";
import { fmtSlot, inr } from "./ui";

/** All customers (from bookings + payments), most recent first. Click one to see history and notes. */
export default function Customers({ customers, openCustomer }: { customers: Map<string, Customer>; openCustomer: (key: string) => void }) {
  const [q, setQ] = useState(""), [only, setOnly] = useState<"" | "repeat" | "noshow">("");
  const all = Array.from(customers.values()).filter((c) => c.bookings.length || c.orders.length);
  const s = q.trim().toLowerCase();
  const list = all
    .filter((c) => !s || [c.name, c.email, c.phone].join(" ").toLowerCase().includes(s))
    .filter((c) => only === "repeat" ? c.bookings.filter((b) => b._state === "confirmed").length > 1 : only === "noshow" ? c.bookings.some((b) => b.outcome === "noshow") : true)
    .sort((a, b) => (b.last || "").localeCompare(a.last || ""));
  const repeatN = all.filter((c) => c.bookings.filter((b) => b._state === "confirmed").length > 1).length;
  return (<>
    <ul className="wpa-subsubsub">
      <li><a className={only === "" ? "current" : ""} onClick={() => setOnly("")}>Sab</a> ({all.length})</li>
      <li><a className={only === "repeat" ? "current" : ""} onClick={() => setOnly("repeat")}>Repeat customers</a> ({repeatN})</li>
      <li><a className={only === "noshow" ? "current" : ""} onClick={() => setOnly("noshow")}>No-show wale</a></li>
    </ul>
    <div className="wpa-tablenav"><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Naam, email ya phone…" style={{ minWidth: 260 }} /><span style={{ flex: 1 }} /><span className="wpa-muted">{list.length} customers</span></div>
    <table className="wpa-table">
      <thead><tr><th>Customer</th><th style={{ width: 110 }}>Bookings</th><th style={{ width: 140 }}>Kul payment</th><th style={{ width: 200 }}>Last booking</th></tr></thead>
      <tbody>
        {!list.length && <tr><td colSpan={4}>Koi customer nahi mila.</td></tr>}
        {list.map((c) => { const n = c.bookings.filter((b) => b._state === "confirmed").length; return (
          <tr key={c.key}>
            <td><a className="wpa-row-title" onClick={() => openCustomer(c.key)}>{c.name || c.email || c.phone}</a>{n > 1 && <span className="wpa-tag blue">🔁 Repeat</span>}
              <div className="wpa-muted">{c.email || "—"}{c.phone ? ` · ${c.phone}` : ""}</div></td>
            <td>{n}{c.bookings.length > n ? <span className="wpa-muted"> (+{c.bookings.length - n} cancel)</span> : null}</td>
            <td>{inr(c.spent)}</td>
            <td>{c.last ? fmtSlot(c.last) : <span className="wpa-muted">Form baaki</span>}</td>
          </tr>); })}
      </tbody>
    </table>
  </>);
}
