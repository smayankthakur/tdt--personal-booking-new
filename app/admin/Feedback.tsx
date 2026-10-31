"use client";
import { useEffect, useState } from "react";
import { TIER_INFO } from "@/lib/slots";
import { type Api, fmtSlot, fmtTime } from "./ui";

const Stars = ({ n }: { n: number }) => <span className="wpa-stars" aria-label={`${n} star`}>{"★".repeat(n)}<span>{"★".repeat(5 - n)}</span></span>;

/** Ratings customers gave from the "kaisi lagi reading?" mail, plus the Google review link for happy customers. */
export default function Feedback({ api, onNote }: { api: Api; onNote: (m: string) => void }) {
  const [d, setD] = useState<any>(null), [url, setUrl] = useState(""), [only, setOnly] = useState(0);
  const load = () => api("/api/admin/feedback").then((j) => { setD(j); setUrl(j.reviewUrl || ""); });
  useEffect(() => { load(); }, []);
  if (!d) return <p>Load ho raha hai…</p>;
  const items: any[] = d.items || [], avg = items.length ? items.reduce((s, f) => s + f.rating, 0) / items.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => [n, items.filter((f) => f.rating === n).length] as const);
  const list = only ? items.filter((f) => f.rating === only) : items;
  const save = async () => { const j = await api("/api/admin/feedback", "PUT", { reviewUrl: url }); onNote(j.ok ? "Review link save ho gaya ✓" : j.error || "Save nahi hua"); };
  return (<>
    <div className="wpa-cols">
      <div className="wpa-postbox"><h2>⭐ Rating</h2><div className="inside">
        <p style={{ fontSize: 28, margin: "12px 0 4px", color: "#1d2327" }}>{items.length ? avg.toFixed(1) : "—"} <small className="wpa-muted" style={{ fontSize: 14 }}>/ 5 · {items.length} feedback</small></p>
        {dist.map(([n, c]) => <div key={n} className="wpa-hbar" style={{ margin: "6px 0" }}><div className="lbl"><a onClick={() => setOnly(only === n ? 0 : n)}>{n} ★{only === n ? " (filter on)" : ""}</a><span>{c}</span></div>
          <div className="track"><div className="fill" style={{ width: `${items.length ? (c / items.length) * 100 : 0}%`, background: "#dba617" }} /></div></div>)}
      </div></div>
      <div className="wpa-postbox"><h2>Google review link</h2><div className="inside">
        <p>Jo customer 4 ya 5 star dete hain, unhe thank-you page par &quot;Google par review dein&quot; button dikhta hai. Google Business Profile ka &quot;Get more reviews&quot; link yahan daalein.</p>
        <p><input className="wide" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://g.page/r/…/review" /></p>
        <p><button className="wpa-btn primary" onClick={save}>Save</button> {!url && <span className="wpa-muted">Khaali = button nahi dikhega</span>}</p>
        <p className="description">Reading ke ~1 din baad customer ko feedback mail apne aap jaata hai (No-show aur Refunded walon ko nahi).</p>
      </div></div>
    </div>
    <table className="wpa-table">
      <thead><tr><th style={{ width: 110 }}>Rating</th><th>Customer</th><th>Comment</th><th style={{ width: 180 }}>Reading</th></tr></thead>
      <tbody>
        {!list.length && <tr><td colSpan={4}>Abhi koi feedback nahi.</td></tr>}
        {list.map((f) => <tr key={f.bid}><td><Stars n={f.rating} /></td>
          <td><b>{f.name || "—"}</b><div className="wpa-muted">{f.email}</div></td>
          <td style={{ whiteSpace: "pre-wrap" }}>{f.comment || <span className="wpa-muted">—</span>}<div className="wpa-muted" style={{ fontSize: 12 }}>{fmtTime(f.updatedAt || f.at)}</div></td>
          <td>{fmtSlot(f.slot)}<div className="wpa-muted">{TIER_INFO[f.tier as keyof typeof TIER_INFO]?.name}</div></td></tr>)}
      </tbody>
    </table>
  </>);
}
