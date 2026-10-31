"use client";
import { useEffect, useState } from "react";
import { MAIL_LABEL, RESEND_AS, type MailKind } from "@/lib/mailKinds";
import { type Api, TypeTag, ago, fmtSlot, fmtTime, inTime, inr, istDay, keyMs } from "./ui";

/** Home page of /admin: today at a glance, customers who paid but never filled the form, and failed emails. */
export default function Dashboard({ api, rows, orders, onNote, openBooking, resumeLink }: {
  api: Api; rows: any[]; orders: any[]; onNote: (m: string) => void; openBooking: (slot: string) => void; resumeLink: (bid: string) => void;
}) {
  const [now, setNow] = useState(Date.now()), [logs, setLogs] = useState<any[] | null>(null), [busy, setBusy] = useState("");
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const loadLogs = () => api("/api/admin/mail").then((j) => setLogs(j.logs || []));
  useEffect(() => { loadLogs(); }, []);

  const today = istDay(now), tomorrow = istDay(now + 864e5), monthKey = today.slice(0, 7);
  const upcoming = rows.filter((b) => keyMs(b.slot) + 40 * 60000 > now).sort((a, b) => a.slot.localeCompare(b.slot));
  const todays = rows.filter((b) => b.slot.startsWith(today)), week = upcoming.filter((b) => keyMs(b.slot) < now + 7 * 864e5);
  const next = upcoming.find((b) => keyMs(b.slot) > now - 40 * 60000);
  const soon = upcoming.filter((b) => b.slot.startsWith(today) || b.slot.startsWith(tomorrow));
  const paidMonth = orders.filter((o) => o.status === "paid" && o.paidAt && istDay(o.paidAt).startsWith(monthKey));
  const revenue = paidMonth.reduce((s, o) => s + Number(o.amount || 0), 0);
  // paid, form empty — newest first; older than 30 days are almost surely abandoned and only clutter the list
  const pending = orders.filter((o) => o.status === "paid" && !o.formDone && now - (o.paidAt || 0) < 30 * 864e5).sort((a, b) => b.paidAt - a.paidAt);
  const failed = (logs || []).filter((l) => !l.ok && now - l.at < 7 * 864e5);
  // a failure that was followed by a successful mail of the same kind for the same booking is already fixed
  const openFails = failed.filter((f) => !(logs || []).some((l) => l.ok && l.bid === f.bid && l.kind === f.kind && l.at > f.at));

  // Razorpay stores "void@razorpay.com" when the customer skipped email at checkout — that is no email at all
  const mailOf = (o: any) => [o.customerEmail, o.email].find((x) => /^\S+@\S+\.\S+$/.test(String(x || "")) && !/@razorpay\.com$/i.test(x)) || "";
  const send = async (bid: string, kind: string) => {
    setBusy(bid + kind);
    const j = await api("/api/admin/mail", "POST", { bid, kind });
    onNote(j.result || j.error || "Kuch galat hua"); setBusy(""); loadLogs();
  };
  const Card = ({ n, l, sub, warn }: { n: React.ReactNode; l: string; sub?: React.ReactNode; warn?: boolean }) =>
    <div className={`wpa-card${warn ? " warn" : ""}`}><div className="n">{n}</div><div className="l">{l}</div>{sub && <div className="s">{sub}</div>}</div>;

  return (<>
    <div className="wpa-cards">
      <Card n={todays.length} l="Aaj ki readings" sub={`${week.length} agle 7 din mein`} />
      <Card n={next ? inTime(keyMs(next.slot), now) : "—"} l="Agla slot" sub={next ? <>{fmtSlot(next.slot)} · <b>{next.name}</b></> : "Koi upcoming booking nahi"} />
      <Card n={inr(revenue)} l="Is mahine ki kamaai" sub={`${paidMonth.length} payments`} />
      <Card n={pending.length} l="Pay kiya, form baaki" warn={pending.length > 0} sub={pending.length ? "Neeche list dekhein" : "Sab ne form bhar diya ✓"} />
      <Card n={logs ? openFails.length : "…"} l="Email fail (7 din)" warn={openFails.length > 0} sub={!logs ? "Load ho raha hai…" : openFails.length ? "Neeche Resend karein" : "Sab mail gaye ✓"} />
    </div>

    <div className="wpa-postbox"><h2>📅 Aaj aur kal ki readings</h2><div className="inside">
      {!soon.length ? <p className="wpa-muted">Aaj aur kal koi reading nahi hai.</p> :
        <table className="wpa-table compact"><thead><tr><th style={{ width: 170 }}>Slot</th><th>Customer</th><th>Reading</th><th>Meet</th><th>Status</th></tr></thead><tbody>
          {soon.map((b) => <tr key={b.slot}>
            <td><b>{fmtSlot(b.slot)}</b><div className="wpa-muted">{inTime(keyMs(b.slot), now)}</div></td>
            <td><a className="wpa-row-title" onClick={() => openBooking(b.slot)}>{b.name}</a><div className="wpa-muted">{b.phone}</div></td>
            <td><TypeTag t={b.tier} /></td>
            <td>{b.meetLink ? <a href={b.meetLink} target="_blank" rel="noopener noreferrer">Join</a> : <span className="wpa-status err">Link nahi</span>}</td>
            <td>{b.reminderAt ? <span className="wpa-status ok">Reminder gaya</span> : keyMs(b.slot) - now > 3 * 3600e3 ? <span className="wpa-status">Reminder baad mein</span> : <span className="wpa-status warn">Reminder pending</span>}</td>
          </tr>)}
        </tbody></table>}
    </div></div>

    <div className="wpa-postbox"><h2>⏳ Pay kiya, form nahi bhara ({pending.length})</h2><div className="inside">
      <p className="description">Payment ke 12 ghante baad ek reminder email apne aap jaata hai. Yahan se aur bhej sakte hain, ya form link copy karke WhatsApp par bhejein.</p>
      {!pending.length ? <p className="wpa-muted">Koi pending form nahi ✓</p> :
        <table className="wpa-table compact"><thead><tr><th>Customer</th><th>Reading</th><th>Payment</th><th>Reminders</th><th style={{ width: 260 }}></th></tr></thead><tbody>
          {pending.map((o) => <tr key={o.bid}>
            <td><b>{o.name || mailOf(o) || o.phone || "—"}</b><div className="wpa-muted">{mailOf(o) || <span className="wpa-status warn">Email nahi mili</span>}{o.phone ? ` · ${o.phone}` : ""}</div></td>
            <td><TypeTag t={o.tier} /></td>
            <td>{inr(o.amount)}<div className="wpa-muted">{ago(o.paidAt, now)}</div></td>
            <td>{o.formReminders ? <>{o.formReminders}× <div className="wpa-muted">last {ago(o.formReminderAt, now)}</div></> : <span className="wpa-muted">Abhi nahi</span>}</td>
            <td style={{ textAlign: "right" }}>
              <button className="wpa-btn primary" disabled={!!busy || !mailOf(o)} title={mailOf(o) ? "" : "Customer ki email nahi hai — form link WhatsApp par bhejein"} onClick={() => send(o.bid, "formReminder")}>{busy === o.bid + "formReminder" ? "Bhej rahe…" : "Reminder email"}</button>{" "}
              <button className="wpa-btn" onClick={() => resumeLink(o.bid)}>Form link copy</button></td>
          </tr>)}
        </tbody></table>}
    </div></div>

    <div className="wpa-postbox"><h2>⚠️ Email problems (pichhle 7 din)</h2><div className="inside">
      {logs === null ? <p className="wpa-muted">Load ho raha hai…</p> : !openFails.length ? <p className="wpa-muted">Koi fail email nahi ✓</p> :
        <table className="wpa-table compact"><thead><tr><th>Mail</th><th>Kisko</th><th>Error</th><th>Kab</th><th></th></tr></thead><tbody>
          {openFails.map((l) => { const k = RESEND_AS[l.kind as MailKind]; return <tr key={l.id}>
            <td>{MAIL_LABEL[l.kind as MailKind] || l.kind}{l.slot && <div className="wpa-muted">{fmtSlot(l.slot)}</div>}</td>
            <td>{l.to}</td><td className="wpa-muted" style={{ maxWidth: 320 }}>{l.err}</td><td>{fmtTime(l.at)}</td>
            <td style={{ textAlign: "right" }}>{k && l.bid ? <button className="wpa-btn" disabled={!!busy} onClick={() => send(l.bid, k)}>{busy === l.bid + k ? "Bhej rahe…" : "Resend"}</button> : null}</td>
          </tr>; })}
        </tbody></table>}
    </div></div>
  </>);
}
