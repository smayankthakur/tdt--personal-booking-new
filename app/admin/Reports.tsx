"use client";
import { useEffect, useState } from "react";
import { TIER_INFO } from "@/lib/slots";
import { type Api, inr, istDay } from "./ui";

const add = (d: string, n: number) => new Date(new Date(d + "T00:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10);
const monthName = (m: string) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const dayName = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function presets(today: string) {
  const m0 = today.slice(0, 8) + "01", lastEnd = add(m0, -1), lastStart = lastEnd.slice(0, 8) + "01";
  return [
    ["Is mahine", m0, today], ["Pichhla mahina", lastStart, lastEnd], ["Pichhle 30 din", add(today, -29), today],
    ["Pichhle 7 din", add(today, -6), today], ["Is saal", today.slice(0, 4) + "-01-01", today],
  ] as const;
}

/** Revenue report: totals, revenue over time (one series), by reading type, coupons. */
export default function Reports({ api }: { api: Api }) {
  const today = istDay(Date.now()), P = presets(today);
  const [from, setFrom] = useState<string>(P[0][1]), [to, setTo] = useState<string>(P[0][2]), [r, setR] = useState<any>(null), [err, setErr] = useState("");
  const [hover, setHover] = useState(-1), [asTable, setAsTable] = useState(false);
  useEffect(() => {
    if (!from || !to || to < from) return;
    setR(null); setErr("");
    api(`/api/admin/report?from=${from}&to=${to}`).then((j) => (j.error ? setErr(j.error) : setR(j)));
  }, [from, to]);

  // more than ~2 months → one bar per month, otherwise one per day
  const byMonth = r && r.days.length > 62;
  const series: { label: string; amount: number; count: number }[] = !r ? [] : byMonth
    ? Object.values(r.days.reduce((a: any, d: any) => { const k = d.date.slice(0, 7); a[k] ||= { label: monthName(k), amount: 0, count: 0 }; a[k].amount += d.amount; a[k].count += d.count; return a; }, {}))
    : r.days.map((d: any) => ({ label: dayName(d.date), amount: d.amount, count: d.count }));
  const max = Math.max(1, ...series.map((s) => s.amount));
  const tmax = Math.max(1, ...(r?.tiers || []).map((t: any) => t.amount));
  const nice = (v: number) => { const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; }, top = nice(max);

  return (<>
    <div className="wpa-tablenav">
      {P.map(([l, f, t]) => <button key={l} className={`wpa-btn${from === f && to === t ? " primary" : ""}`} onClick={() => { setFrom(f); setTo(t); }}>{l}</button>)}
      <span style={{ flex: 1 }} />
      <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /> <span className="wpa-muted">se</span> <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
    </div>
    {err && <div className="wpa-notice error"><p>{err}</p></div>}
    {!r ? !err && <p>Load ho raha hai…</p> : <>
      <div className="wpa-cards">
        <div className="wpa-card"><div className="n">{inr(r.net)}</div><div className="l">Kamaai (refund ke baad)</div><div className="s">{r.count} payments</div></div>
        <div className="wpa-card"><div className="n">{inr(r.avg)}</div><div className="l">Average per booking</div></div>
        <div className="wpa-card"><div className="n">{inr(r.discount)}</div><div className="l">Coupon discount diya</div><div className="s">{r.coupons.reduce((s: number, c: any) => s + c.count, 0)} coupon bookings</div></div>
        <div className="wpa-card"><div className="n">{inr(r.offer)}</div><div className="l">Offer price wali kamaai</div><div className="s">{r.offerCount} bookings</div></div>
        <div className={`wpa-card${r.refundCount ? " warn" : ""}`}><div className="n">{inr(r.refunds)}</div><div className="l">Refund</div><div className="s">{r.refundCount} bookings</div></div>
      </div>

      <div className="wpa-postbox"><h2>Kamaai — {byMonth ? "har mahine" : "har din"} <a style={{ float: "right", fontWeight: 400 }} onClick={() => setAsTable(!asTable)}>{asTable ? "Chart dekhein" : "Table dekhein"}</a></h2><div className="inside">
        {asTable ? <table className="wpa-table compact" style={{ marginTop: 12 }}><thead><tr><th>{byMonth ? "Mahina" : "Din"}</th><th>Payments</th><th>Kamaai</th></tr></thead>
          <tbody>{series.filter((s) => s.count).map((s) => <tr key={s.label}><td>{s.label}</td><td>{s.count}</td><td>{inr(s.amount)}</td></tr>)}</tbody></table>
        : <div className="wpa-chart" onMouseLeave={() => setHover(-1)}>
          <div className="wpa-chart-tip">{hover >= 0 ? <><b>{series[hover].label}</b> · {inr(series[hover].amount)} · {series[hover].count} payments</> : <span className="wpa-muted">Bar par mouse le jaayein</span>}</div>
          <div className="wpa-chart-plot">
            <div className="wpa-chart-axis"><span>{inr(top)}</span><span>{inr(top / 2)}</span><span>₹0</span></div>
            <div className="wpa-chart-bars">
              <div className="grid" style={{ bottom: "50%" }} /><div className="grid" style={{ bottom: "100%" }} />
              {series.map((s, i) => <div key={s.label} className={`col${hover === i ? " on" : ""}`} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                <div className="bar" style={{ height: `${(s.amount / top) * 100}%` }} /></div>)}
            </div>
          </div>
          <div className="wpa-chart-x"><span>{series[0]?.label}</span><span>{series[Math.floor(series.length / 2)]?.label}</span><span>{series[series.length - 1]?.label}</span></div>
        </div>}
      </div></div>

      <div className="wpa-cols">
        <div className="wpa-postbox"><h2>Reading type ke hisaab se</h2><div className="inside">
          {!r.tiers.length ? <p className="wpa-muted">Is range mein koi payment nahi.</p> : r.tiers.map((t: any) => (
            <div key={t.tier} className="wpa-hbar"><div className="lbl"><span>{TIER_INFO[t.tier as keyof typeof TIER_INFO]?.name || t.tier}</span><span><b>{inr(t.amount)}</b> · {t.count}</span></div>
              <div className="track"><div className="fill" style={{ width: `${(t.amount / tmax) * 100}%` }} /></div></div>))}
        </div></div>
        <div className="wpa-postbox"><h2>Coupons</h2><div className="inside">
          {!r.coupons.length ? <p className="wpa-muted">Is range mein koi coupon use nahi hua.</p> :
            <table className="wpa-table compact" style={{ marginTop: 12 }}><thead><tr><th>Code</th><th>Kitni baar</th><th>Discount diya</th><th>Kamaai</th></tr></thead>
              <tbody>{r.coupons.map((c: any) => <tr key={c.code}><td><b>{c.code}</b></td><td>{c.count}</td><td>{inr(c.discount)}</td><td>{inr(c.amount)}</td></tr>)}</tbody></table>}
        </div></div>
      </div>
      <p className="description">Kamaai payment ki date par gini jaati hai. Refunded bookings minus hoti hain; bina refund ke cancel hui bookings ka paisa gina jaata hai. {r.formPending ? `${r.formPending} payment ka form abhi baaki hai.` : ""}</p>
    </>}
  </>);
}
