"use client";
import { useEffect, useState } from "react";
import { MAIL_LABEL, type MailKind } from "@/lib/mailKinds";
import { type Api, fmtTime } from "./ui";

/** Re-send buttons + every mail recorded for one booking (Firestore mailLog). */
export default function MailLog({ api, bid, form, slotAhead, hasEvent, onNote }: {
  api: Api; bid: string; form: boolean; slotAhead: boolean; hasEvent: boolean; onNote: (m: string) => void;
}) {
  const [logs, setLogs] = useState<any[] | null>(null), [busy, setBusy] = useState("");
  const load = () => api(`/api/admin/mail?bid=${encodeURIComponent(bid)}`).then((j) => setLogs(j.logs || []));
  useEffect(() => { load(); }, [bid]);
  const resend = async (kind: string) => {
    setBusy(kind);
    const j = await api("/api/admin/mail", "POST", { bid, kind });
    onNote(j.result || j.error || "Kuch galat hua"); setBusy(""); load();
  };
  const B = ({ k, l, show = true }: { k: string; l: string; show?: boolean }) => !show ? null :
    <button className="wpa-btn" disabled={!!busy} onClick={() => resend(k)}>{busy === k ? "Bhej rahe hain…" : l}</button>;
  return (
    <div className="wpa-maillog">
      <h4>📧 Emails</h4>
      <div className="wpa-inline-form">
        <B k="formReminder" l="Form reminder bhejo" show={!form} />
        <B k="confirm" l="Confirmation dobara bhejo" show={form} />
        <B k="invite" l="Calendar invite dobara" show={form && hasEvent && slotAhead} />
        <B k="reminder" l="Reminder abhi bhejo" show={form && slotAhead} />
      </div>
      {logs === null ? <p className="wpa-muted">Load ho raha hai…</p> : !logs.length
        ? <p className="wpa-muted">Is booking ka koi mail record nahi hai (yeh feature aane se pehle ke mails yahan nahi dikhte).</p>
        : <table className="wpa-table compact"><thead><tr><th>Mail</th><th>Kisko</th><th>Status</th><th>Kab</th><th>Kisne</th></tr></thead><tbody>
          {logs.map((l) => <tr key={l.id}>
            <td>{MAIL_LABEL[l.kind as MailKind] || l.kind}</td><td>{l.to}</td>
            <td>{l.ok ? <span className="wpa-status ok">Gaya ✓</span> : <span className="wpa-status err" title={l.err}>Fail</span>}{!l.ok && <div className="wpa-muted" style={{ fontSize: 12 }}>{l.err}</div>}</td>
            <td>{fmtTime(l.at)}</td><td className="wpa-muted">{l.by === "system" ? "Auto" : l.by}</td></tr>)}
        </tbody></table>}
    </div>);
}
