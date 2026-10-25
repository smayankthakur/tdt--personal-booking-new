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
export function usePay(tier: "standard" | "urgent", onNoSlots?: () => void) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function go(email: string) {
    setErr(""); setBusy(true);
    try {
      const j = await (await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier, email }) })).json();
      if (j.url) { save(email); window.location.href = j.url; return; }
      setErr(j.error || "Kuch galat hua. Dobara try karein.");
      if (j.code === "no_slots") onNoSlots?.();
    } catch { setErr("Network error. Dobara try karein."); }
    setBusy(false);
  }
  const modal = open ? <EmailModal busy={busy} err={err} onClose={() => { if (!busy) { setOpen(false); setErr(""); } }} onSubmit={go} urgent={tier === "urgent"} /> : null;
  return { start: () => { setErr(""); setOpen(true); }, busy, modal };
}

function EmailModal({ busy, err, onClose, onSubmit, urgent }: { busy: boolean; err: string; onClose: () => void; onSubmit: (email: string) => void; urgent: boolean }) {
  const [email, setEmail] = useState(load), [local, setLocal] = useState(""), [sugg, setSugg] = useState(""), [asTyped, setAsTyped] = useState("");
  const input = useRef<HTMLInputElement>(null);
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
    onSubmit(v);
  }
  // Portal to <body> so a parent's transform/opacity/animation can't make the dialog see-through or mis-placed.
  return createPortal(
    <div className="pg-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="pg-card" onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="pg-title">
        <button type="button" className="pg-x" onClick={onClose} aria-label="Close">×</button>
        <h3 id="pg-title">{urgent ? "⚡ Urgent Reading" : "Personal Reading"} — aapki email</h3>
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
        {(local || err) && <p className="rf-err">{local || err}</p>}
        <button className="btn gold" disabled={busy} style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>{busy ? "Payment page khul raha hai…" : "Continue to Payment →"}</button>
        <p className="pg-note">🔒 Payment Razorpay par secure hota hai. Email sirf booking ke liye use hoti hai — <a href="https://thedivinetarotonline.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Privacy Policy</a></p>
      </form>
    </div>, document.body);
}
