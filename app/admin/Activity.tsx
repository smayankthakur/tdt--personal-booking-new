"use client";
import { useEffect, useState } from "react";
import { type Api, fmtTime } from "./ui";

/** Who changed what in the admin panel (newest first). */
export default function Activity({ api }: { api: Api }) {
  const [items, setItems] = useState<any[] | null>(null), [who, setWho] = useState(""), [q, setQ] = useState(""), [more, setMore] = useState(true);
  const load = async (before?: number) => {
    const j = await api(`/api/admin/activity${before ? `?before=${before}` : ""}`);
    const got = j.items || [];
    setItems((cur) => (before && cur ? [...cur, ...got] : got)); setMore(got.length === 200);
  };
  useEffect(() => { load(); }, []);
  if (!items) return <p>Load ho raha hai…</p>;
  const admins = Array.from(new Set(items.map((i) => i.by))).sort();
  const s = q.trim().toLowerCase();
  const list = items.filter((i) => (!who || i.by === who) && (!s || `${i.action} ${i.detail}`.toLowerCase().includes(s)));
  return (<>
    <div className="wpa-tablenav">
      <select value={who} onChange={(e) => setWho(e.target.value)}><option value="">Saare admin</option>{admins.map((a) => <option key={a} value={a}>{a}</option>)}</select>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (jaise coupon, reschedule, naam)…" style={{ minWidth: 240 }} />
      <span style={{ flex: 1 }} /><span className="wpa-muted">{list.length} entries</span>
    </div>
    <table className="wpa-table compact">
      <thead><tr><th style={{ width: 150 }}>Kab</th><th style={{ width: 230 }}>Admin</th><th style={{ width: 230 }}>Kya kiya</th><th>Details</th></tr></thead>
      <tbody>
        {!list.length && <tr><td colSpan={4}>Koi entry nahi.</td></tr>}
        {list.map((i) => <tr key={i.id}><td>{fmtTime(i.at)}</td><td>{i.by}</td><td><b>{i.action}</b></td><td className="wpa-muted" style={{ wordBreak: "break-word" }}>{i.detail}</td></tr>)}
      </tbody>
    </table>
    {more && <p><button className="wpa-btn" onClick={() => load(items[items.length - 1]?.at)}>Aur purani entries</button></p>}
    <p className="description">Yahan har login, price/coupon/slot change, reschedule, cancel, status, notes aur dobara bheje gaye mails record hote hain. Passwords kabhi record nahi hote.</p>
  </>);
}
