"use client";
import { useEffect, useRef, useState } from "react";
import { e164 } from "@/lib/concerns";

/** Public Firebase web config ("TDT Web" app). Safe to ship to the browser; used only for phone OTP. */
const FIREBASE = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDNhsRnGWeb8XbkKl9HUDIr_YbFsTso_EY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "the-divine-tarot.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "the-divine-tarot",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:491968377977:web:2603b1a9273163c39050a8",
};

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

const FB_ERR: Record<string, string> = {
  "auth/invalid-phone-number": "Number sahi nahi hai. 10 digit mobile number likhein (India ke bahar ho toh +country code ke saath).",
  "auth/too-many-requests": "Bahut zyada try ho gaye. Thodi der baad try karein.",
  "auth/invalid-verification-code": "Galat OTP. Dobara check karein.",
  "auth/code-expired": "OTP expire ho gaya. Naya OTP bhejein.",
  "auth/quota-exceeded": "Abhi SMS nahi ja pa raha. WhatsApp karein +91 88281 16545.",
  "auth/billing-not-enabled": "Abhi SMS nahi ja pa raha. WhatsApp karein +91 88281 16545.",
  "auth/captcha-check-failed": "Security check fail hua. Page refresh karke dobara try karein.",
  "auth/network-request-failed": "Network error. Dobara try karein.",
};

/** WhatsApp/phone field + SMS OTP via Firebase Authentication (invisible reCAPTCHA). */
export function PhoneVerify({ defaultValue, onChange }: { defaultValue?: string; onChange: (verified: boolean) => void }) {
  const [phone, setPhone] = useState(defaultValue || ""), [sentTo, setSentTo] = useState(""), [code, setCode] = useState("");
  const [ok, setOk] = useState(false), [busy, setBusy] = useState(false), [msg, setMsg] = useState(""), [err, setErr] = useState("");
  const [left, setLeft] = useCountdown();
  const fb = useRef<any>(null), confirm = useRef<any>(null), verifier = useRef<any>(null), box = useRef<HTMLDivElement>(null);
  const set = (v: boolean) => { setOk(v); onChange(v); };
  const fail = (e: any) => setErr(FB_ERR[e?.code] || e?.message || "OTP nahi gaya. Dobara try karein.");

  async function auth() {
    if (!fb.current) {
      const [{ initializeApp, getApps }, A] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
      const app = getApps()[0] || initializeApp(FIREBASE);
      const a = A.getAuth(app); a.useDeviceLanguage();
      // Local automated tests only (Firebase test numbers, no reCAPTCHA). Never active on the live domain.
      if (location.hostname === "localhost" && (window as any).__tdtTestOtp) a.settings.appVerificationDisabledForTesting = true;
      fb.current = { A, a };
    }
    return fb.current as { A: typeof import("firebase/auth"); a: import("firebase/auth").Auth };
  }
  async function send() {
    setErr(""); setMsg("");
    const num = e164(phone);
    if (num.replace(/\D/g, "").length < 11) return setErr("Sahi mobile number likhein (10 digit).");
    setBusy(true);
    try {
      const { A, a } = await auth();
      if (verifier.current) { try { verifier.current.clear(); } catch {} }
      box.current!.innerHTML = "<div></div>";
      verifier.current = new A.RecaptchaVerifier(a, box.current!.firstChild as HTMLElement, { size: "invisible" });
      confirm.current = await A.signInWithPhoneNumber(a, num, verifier.current);
      setSentTo(num); setCode(""); setLeft(45); setMsg(`OTP ${num} par SMS se bheja gaya hai.`);
    } catch (e) { fail(e); }
    setBusy(false);
  }
  async function verify() {
    setErr("");
    if (code.length !== 6) return setErr("6 digit OTP daalein.");
    setBusy(true);
    try {
      const cred = await confirm.current.confirm(code);
      const idToken = await cred.user.getIdToken();
      const j = await post("/api/otp/phone", { idToken, phone: sentTo });
      const { A, a } = await auth(); A.signOut(a).catch(() => {});
      if (j.error) setErr(j.error); else { set(true); setMsg(""); }
    } catch (e) { fail(e); }
    setBusy(false);
  }
  return (
    <Shell ok={ok}>
      <div className="otp-row">
        <input className="rf-in" name="phone" type="tel" value={phone} placeholder="10 digit mobile number" autoComplete="tel"
          onChange={(e) => { setPhone(e.target.value); if (ok || sentTo) { set(false); setSentTo(""); setMsg(""); } }} readOnly={ok} />
        {ok ? <span className="otp-badge">✓ Verified</span>
          : <button type="button" className="btn ghost otp-btn" onClick={send} disabled={busy || left > 0}>{left > 0 ? `${left}s` : sentTo ? "Resend" : "OTP bhejein"}</button>}
      </div>
      {sentTo && !ok && (
        <div className="otp-row">
          <input className="rf-in otp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6 digit OTP" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button type="button" className="btn gold otp-btn" onClick={verify} disabled={busy}>Verify</button>
        </div>)}
      {ok && <button type="button" className="otp-link" onClick={() => { set(false); setSentTo(""); }}>Number badlein</button>}
      <div ref={box} />
      {msg && <p className="rf-hint">{msg}</p>}
      {err && <p className="rf-err">{err}</p>}
    </Shell>);
}
