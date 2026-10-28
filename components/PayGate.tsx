"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { emailTypo } from "@/lib/emailTypo";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const KEY = "tdt_email";
const load = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
const save = (v: string) => { try { localStorage.setItem(KEY, v); } catch {} };

/**
 * Every "Pay / Book" button goes through this: first ask the customer's email (Razorpay often doesn't collect one),
 * then create the payment link with that email and open Razorpay. The email gets the receipt + personal form link.
 */
export type PayTier = "standard" | "urgent" | "video";
export function usePay(tier: PayTier, onNoSlots?: () => void) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function go(email: string, coupon?: string) {
    setErr(""); setBusy(true);
    try {
      const j = await (await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier, email, coupon: coupon || undefined }) })).json();
      if (j.url) { save(email); window.location.href = j.url; return; }
      setErr(j.error || "Kuch galat hua. Dobara try karein.");
      if (j.code === "no_slots") onNoSlots?.();
    } catch { setErr("Network error. Dobara try karein."); }
    setBusy(false);
  }
  const modal = open ? <EmailModal busy={busy} err={err} onClose={() => { if (!busy) { setOpen(false); setErr(""); } }} onSubmit={go} tier={tier} /> : null;
  return { start: () => { setErr(""); setOpen(true); }, busy, modal };
}

function EmailModal({ busy, err, onClose, onSubmit, tier }: { busy: boolean; err: string; onClose: () => void; onSubmit: (email: string, coupon?: string) => void; tier: PayTier }) {
  const [email, setEmail] = useState(load), [local, setLocal] = useState(""), [sugg, setSugg] = useState(""), [asTyped, setAsTyped] = useState("");
  const input = useRef<HTMLInputElement>(null);
  // Price shown before paying (server-computed: regular / seasonal offer / coupon). The server re-checks it on payment.
  type Q = { regular: number; price: number; offerName: string | null; coupon: string | null; discount: number; final: number };
  const [q, setQ] = useState<Q | null>(null), [code, setCode] = useState(""), [cMsg, setCMsg] = useState(""), [cBusy, setCBusy] = useState(false), [showCode, setShowCode] = useState(false);
  const ask = async (c: string) => { try { const r = await fetch("/api/coupon", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier, code: c }) }); return await r.json(); } catch { return { error: "Network error" }; } };
  useEffect(() => { ask("").then((j) => j.ok && setQ(j)); }, []);
  const apply = async () => {
    setCMsg(""); if (!code.trim()) return; setCBusy(true);
    const j = await ask(code); setCBusy(false);
    if (j.ok) { setQ(j); setCMsg(`✓ ${j.coupon} laga — ₹${j.discount.toLocaleString("en-IN")} ki bachat`); } else setCMsg(j.error || "Coupon nahi laga");
  };
  const removeCoupon = async () => { setCode(""); setCMsg(""); const j = await ask(""); if (j.ok) setQ(j); };
  useEffect(() => {
    input.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, []);
  function submit(e: React.FormEvent) {
    e.preventDefault(); setLocal(""); setSugg("");
    const v = email.trim().toLowerCase(), s = emailTypo(email);
    if (s && asTyped !== v) return setSugg(s); // "did you mean …?" — one click to fix, or keep what they typed
    if (!EMAIL.test(v)) return setLocal("Sahi email likhein, jaise aapka@gmail.com");
    onSubmit(v, q?.coupon || undefined);
  }
  // Portal to <body> so a parent's transform/opacity/animation can't make the dialog see-through or mis-placed.
  return createPortal(
    <div className="pg-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="pg-card" onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="pg-title">
        <button type="button" className="pg-x" onClick={onClose} aria-label="Close">×</button>
        <h3 id="pg-title">{tier === "urgent" ? "⚡ Urgent Reading" : tier === "video" ? "🎥 Video Call Reading" : "Personal Reading"} — aapki email</h3>
        <p>Payment ke baad <b>reading form ka link</b>, aapka <b>slot, Google Meet link</b> aur reminder isi email par aayenge. Dhyan se likhein.</p>
        <input ref={input} className="rf-in" type="email" inputMode="email" autoComplete="email" placeholder="aapka@gmail.com" value={email} onChange={(e) => { setEmail(e.target.value); setSugg(""); }} disabled={busy} />
        {sugg && (
          <div className="pg-sugg">
            Kya aapka matlab <b>{sugg}</b> hai?
            <div>
              <button type="button" className="btn gold" onClick={() => { setEmail(sugg); setSugg(""); onSubmit(sugg); }}>Haan, yahi</button>
              {EMAIL.test(email.trim()) && <button type="button" className="btn ghost" onClick={() => { const v = email.trim().toLowerCase(); setAsTyped(v); setSugg(""); onSubmit(v); }}>Nahi, jo likha wahi sahi</button>}
            </div>
          </div>)}
        {q && (
          <div className="pg-price">
            <span>Payable</span>
            <b>{q.final < q.regular && <s>₹{q.regular.toLocaleString("en-IN")}</s>} ₹{q.final.toLocaleString("en-IN")}</b>
            {q.offerName && <small>🪔 {q.offerName}</small>}
          </div>)}
        {!showCode && !q?.coupon ? <button type="button" className="otp-link" onClick={() => setShowCode(true)}>Coupon code hai?</button> : (
          <div className="pg-coupon">
            <input className="rf-in" placeholder="COUPON CODE" value={q?.coupon || code} readOnly={!!q?.coupon} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCMsg(""); }} disabled={busy} />
            {q?.coupon ? <button type="button" className="btn ghost" onClick={removeCoupon}>Hatayein</button>
              : <button type="button" className="btn ghost" onClick={apply} disabled={cBusy || !code.trim()}>{cBusy ? "…" : "Apply"}</button>}
          </div>)}
        {cMsg && <p className={cMsg.startsWith("✓") ? "rf-hint" : "rf-err"} style={{ color: cMsg.startsWith("✓") ? "#7ee2a8" : undefined }}>{cMsg}</p>}
        {(local || err) && <p className="rf-err">{local || err}</p>}
        <button className="btn gold" disabled={busy} style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>{busy ? "Payment page khul raha hai…" : "Continue to Payment →"}</button>
        <p className="pg-note">🔒 Payment Razorpay par secure hota hai. Email sirf booking ke liye use hoti hai — <a href="https://thedivinetarotonline.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Privacy Policy</a></p>
      </form>
    </div>, document.body);
}
