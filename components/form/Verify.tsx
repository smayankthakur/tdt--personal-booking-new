"use client";
import { useEffect, useState } from "react";

const post = async (url: string, body: object) => {
  try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return await r.json(); }
  catch { return { error: "Network error. Dobara try karein." }; }
};

function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  return [left, setLeft] as const;
}

function Shell({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <div className={`otp${ok ? " ok" : ""}`}>{children}</div>;
}

/** Email field + 6-digit code sent by our server (SMTP). */
export function EmailVerify({ defaultValue, onChange }: { defaultValue?: string; onChange: (verified: boolean) => void }) {
  const [email, setEmail] = useState(defaultValue || ""), [sentTo, setSentTo] = useState(""), [code, setCode] = useState("");
  const [ok, setOk] = useState(false), [busy, setBusy] = useState(false), [msg, setMsg] = useState(""), [err, setErr] = useState("");
  const [left, setLeft] = useCountdown();
  const set = (v: boolean) => { setOk(v); onChange(v); };

  async function send() {
    setErr(""); setMsg("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr("Sahi email likhein.");
    setBusy(true);
    const j = await post("/api/otp/email", { action: "send", email: email.trim() });
    setBusy(false);
    if (j.error) return setErr(j.error);
    setSentTo(email.trim().toLowerCase()); setCode(""); setLeft(45);
    setMsg(`OTP ${email.trim()} par bheja gaya hai (spam folder bhi dekhein).`);
  }
  async function verify() {
    setErr("");
    if (code.replace(/\D/g, "").length !== 6) return setErr("6 digit OTP daalein.");
    setBusy(true);
    const j = await post("/api/otp/email", { action: "verify", email: sentTo, code });
    setBusy(false);
    if (j.error) return setErr(j.error);
    set(true); setMsg("");
  }
  return (
    <Shell ok={ok}>
      <div className="otp-row">
        <input className="rf-in" name="email" type="email" value={email} placeholder="aapka@email.com" autoComplete="email"
          onChange={(e) => { setEmail(e.target.value); if (ok || sentTo) { set(false); setSentTo(""); setMsg(""); } }} readOnly={ok} />
        {ok ? <span className="otp-badge">✓ Verified</span>
          : <button type="button" className="btn ghost otp-btn" onClick={send} disabled={busy || left > 0}>{left > 0 ? `${left}s` : sentTo ? "Resend" : "OTP bhejein"}</button>}
      </div>
      {sentTo && !ok && (
        <div className="otp-row">
          <input className="rf-in otp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 digit OTP" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button type="button" className="btn gold otp-btn" onClick={verify} disabled={busy}>Verify</button>
        </div>)}
      {ok && <button type="button" className="otp-link" onClick={() => { set(false); setSentTo(""); }}>Email badlein</button>}
      {msg && <p className="rf-hint">{msg}</p>}
      {err && <p className="rf-err">{err}</p>}
    </Shell>);
}
