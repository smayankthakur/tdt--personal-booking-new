"use client";
import { useEffect, useRef, useState } from "react";
import DateField from "./form/DateField";
import ClockField from "./form/ClockField";
import FileDrop, { photoStore } from "./form/FileDrop";
import { EmailVerify } from "./form/Verify";
import { CONCERNS, needsPartner } from "@/lib/concerns";

const STEPS = ["Aap", "Wajah", "Doosre log"];
const fmtD = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const gcalLink = (d: string, t: string, meet: string | null) => {
  const s = Date.parse(`${d}T${t}:00+05:30`), u = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const q = new URLSearchParams({ action: "TEMPLATE", text: "Personal Reading — The Divine Tarot", dates: `${u(s)}/${u(s + 40 * 60000)}`,
    details: `Google Meet: ${meet || "link aapki email mein"}\nSirf 5 minute wait kiya jayega — time par join karein.`, location: meet || "Google Meet" });
  return `https://calendar.google.com/calendar/render?${q}`;
};
const fmtT = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

function Field({ label, req, hint, children }: { label: string; req?: boolean; hint?: string; children: React.ReactNode }) {
  return <div className="rf-field"><label className="rf-label">{label}{req && <b> *</b>}</label>{hint && <p className="rf-hint">{hint}</p>}{children}</div>;
}
function Person({ n, on, toggle, req }: { n: "2" | "3"; on: boolean; toggle: () => void; req?: boolean }) {
  const ord = n === "2" ? "Second Person / Partner" : "Third Person / Third Party";
  return (
    <div className={`person${on ? " open" : ""}${req ? " req" : ""}`}>
      <button type="button" className="person-head" onClick={req ? undefined : toggle} aria-disabled={req || undefined}><span className="plus">{on ? "−" : "+"}</span><div><b>{ord}{req && " *"}</b><small>{req ? "Zaroori — aapki wajah partner ke baare mein hai. Partner ka naam aur photo dein." : "Optional — love life ya family ke liye"}</small></div></button>
      {on && (
        <div className="person-body">
          <div className="rf-2">
          <Field label="Naam" req={req}><input className="rf-in" name={"name" + n} /></Field>
          <Field label="Place of Birth"><input className="rf-in" name={"place" + n} placeholder="Jaise Mumbai, Jaipur, Delhi" /></Field>
          <Field label="Date of Birth" hint="Pata ho toh, warna skip."><DateField p={"dob" + n} /></Field>
          <Field label="Birth Time" hint="Pata ho toh, warna skip."><ClockField p={"tob" + n} /></Field>
          </div>
          <Field label="One Clear Photo" req={req}><FileDrop name={"photo" + n} /></Field>
        </div>)}
    </div>);
}

export default function ReadingForm() {
  const [waited, setWaited] = useState(false), [bid, setBid] = useState(""), [bk, setBk] = useState<any>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [shake, setShake] = useState(0), [done, setDone] = useState<any>(null);
  // Slot is auto-assigned (earliest free one). undefined = loading, null = nothing free.
  const [next, setNext] = useState<{ date: string; time: string } | null | undefined>(undefined);
  const [step, setStep] = useState(0), [concern, setConcern] = useState(""), [p2, setP2] = useState(false), [p3, setP3] = useState(false);
  const [photo1, setPhoto1] = useState(false), [emailOk, setEmailOk] = useState(false);
  const partner = needsPartner(concern);
  const formRef = useRef<HTMLFormElement>(null);
  const loadSlots = () => fetch("/api/slots").then((r) => r.json()).then((j) => setNext(j.next ?? null)).catch(() => setNext(null));
  useEffect(() => { if (bk?.status === "paid" && !bk.formDone && next === undefined) loadSlots(); }, [bk]);

  useEffect(() => {
    // The booking comes from a secure cookie set after payment — nothing in the URL.
    if (window.location.search) window.history.replaceState(null, "", "/form");
    let n = 0;
    const check = async () => { try { const j = await (await fetch("/api/booking", { cache: "no-store" })).json(); setBk(j); if (j.bid) setBid(j.bid); return j.status; } catch { return "created"; } };
    check();
    const t = setInterval(async () => { const s = await check(); if (s !== "created") clearInterval(t); else if (++n > 90) { clearInterval(t); setWaited(true); } }, 2000);
    return () => clearInterval(t);
  }, []);

  const val = (n: string) => String((formRef.current?.elements.namedItem(n) as HTMLInputElement | null)?.value || "").trim();
  const bad = (m: string) => { setErr(m); setShake((s) => s + 1); return false; };
  function valid(s: number) {
    setErr("");
    if (!next) return bad("Abhi koi slot khaali nahi hai. WhatsApp karein: +91 88281 16545.");
    if (s === 0) {
      if (!val("name")) return bad("Apna poora naam likhein.");
      if (val("phone").replace(/\D/g, "").length < 10) return bad("Sahi WhatsApp number likhein.");
      if (!emailOk) return bad("Apni email OTP se verify karein.");
      if (!val("place")) return bad("Place of Birth likhein.");
      if (!photo1) return bad("Apni ek clear photo upload karein.");
    }
    if (s === 1 && (!concern || (concern === "Other" && !val("concernOther")))) return bad("Reading ki wajah chunein.");
    if (s === 2 && partner) {
      if (!val("name2")) return bad("Partner ka naam likhein.");
      if (!photoStore.photo2) return bad("Partner ki ek clear photo upload karein.");
    }
    return true;
  }
  const go = (d: number) => { if (d < 0 || valid(step)) { setStep(step + d); window.scrollTo({ top: 0, behavior: "smooth" }); } };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!valid(0) || !valid(1) || !valid(2)) return; setBusy(true);
    const fd = new FormData(e.currentTarget);
    for (const k of ["photo1", "photo2", "photo3"]) if (photoStore[k]) fd.set(k, photoStore[k]);
    try {
      const j = await (await fetch("/api/form", { method: "POST", body: fd })).json();
      if (j.ok) { setDone(j); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else { setErr(j.error || "Kuch galat hua. Dobara try karein."); if (j.code === "no_slots") loadSlots(); if (j.code === "verify_email") setStep(0); }
    } catch { setErr("Network error. Dobara try karein."); }
    setBusy(false);
  }

  if (!bk) return <div className="rf-card"><p>Load ho raha hai…</p></div>;
  if (bk.status === "unknown") return <div className="rf-card"><h1>Pehle payment karein</h1><p>Reading form sirf payment ke baad khulta hai. Agar aapne payment kar diya hai aur form nahi khula, toh WhatsApp karein <b>+91 88281 16545</b> (payment ka screenshot bhejein).</p><a className="btn gold" href="/#book" style={{ marginTop: 14 }}>Booking page par jayein</a></div>;
  if (bk.status === "created" && !waited) return <div className="rf-card"><p>Form load ho raha hai…</p></div>;
  if (bk.status === "created") return <div className="rf-card"><h1>Payment abhi tak nahi mila</h1><p>Agar payment ho chuka hai toh page refresh karein. Nahi hua hai toh dobara payment karein.</p><a className="btn gold" href="/#book" style={{ marginTop: 14 }}>Payment page par jayein</a></div>;
  if (bk.status !== "paid") return <div className="rf-card"><h1>Payment nahi mila</h1><a className="btn gold" href="/#book">Wapas jayein</a></div>;

  if (bk.formDone || done) {
    const dd = done?.date || bk.date, tt = done?.time || bk.time, meet = done?.meetLink || bk.meetLink;
    return (
      <div className="rf-card rf-success">
        <svg className="ok-tick" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M14 27l8 8 16-17" /></svg>
        <h1>Appointment Confirmed</h1>
        {dd && <div className="rf-slot"><span>Aapka slot</span><b>{fmtD(dd)} · {fmtT(tt)} IST</b></div>}
        <p>Aapka form mil gaya hai. <b>Google Meet link aur schedule aapki email par bhej diya gaya hai</b> — spam folder bhi check kar lein.</p>
        {meet && <a className="btn gold" href={meet} target="_blank" rel="noopener noreferrer">Google Meet Link</a>}
        <div className="rf-remind">
          <b>⏰ Please set a reminder in your calendar or clock so you don't miss your consultation.</b>
          <p>Abhi apne phone ke Calendar ya Alarm mein reminder laga lein. <b>Hum alag se koi reminder call ya message nahi karte.</b></p>
          <p><b>Slot time par sirf 5 minute wait kiya jayega.</b> 5 minute ke andar join nahi kiya toh appointment miss maani jayegi — koi refund ya reschedule nahi.</p>
          {dd && <a className="btn ghost" href={gcalLink(dd, tt, meet)} target="_blank" rel="noopener noreferrer">📅 Add to Google Calendar</a>}
        </div>
        <p className="rf-hint" style={{ marginTop: 18 }}>Headphones lagana na bhoolein. 🎧</p>
      </div>);
  }

  const S = (i: number) => `step${step === i ? " active" : ""}`;
  return (
    <form ref={formRef} className="rf-card" onSubmit={submit} noValidate>
      <div className="rf-badge">✓ Payment received{bk.tier === "urgent" ? " · ⚡ Urgent" : ""}{bid ? ` · ID ${bid}` : ""}</div>
      <h1>Personal Reading Form</h1>
      <div className="stepper">
        <div className="stepper-bar"><i style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} /></div>
        {STEPS.map((s, i) => <div key={s} className={`stepper-dot${i <= step ? " on" : ""}`}><span>{i < step ? "✓" : i + 1}</span><small>{s}</small></div>)}
      </div>

      <div className="rf-slot">
        <span>Aapka slot</span>
        {next === undefined ? <b>Slot dhoondh rahe hain…</b>
          : next ? <b>{fmtD(next.date)} · {fmtT(next.time)} IST</b>
          : <b className="rf-err">Abhi koi slot khaali nahi hai. WhatsApp karein: +91 88281 16545 (Booking ID {bid}).</b>}
      </div>
      {next && <p className="rf-hint">{bk.tier === "urgent"
        ? "⚡ Urgent booking: 48 ghante ke andar ka slot aapke liye rakha gaya hai."
        : "Aapka appointment payment ke 7–10 din ke andar ka sabse pehla khaali slot hai."} Form submit karte hi final slot aur Google Meet link email par aa jayega.</p>}

      <div className={S(0)}>
        <h2 className="rf-sec first">Aapki Details</h2>
        <div className="rf-2">
        <Field label="Full Name with Surname" req hint="Pura naam likhein"><input className="rf-in" name="name" defaultValue={bk.name} autoComplete="name" /></Field>
        <Field label="WhatsApp Number" req hint="Reading ke liye contact isi number par hoga."><input className="rf-in" name="phone" type="tel" defaultValue={bk.phone} autoComplete="tel" /></Field>
        <Field label="Email ID" req hint="Google Meet link aur schedule isi email par aayega. Email OTP se verify karein."><EmailVerify defaultValue={/@razorpay\.com$/i.test(bk.email || "") ? "" : bk.email} onChange={setEmailOk} /></Field>
        <Field label="Place of Birth" req hint="Jis shehar mein janm hua."><input className="rf-in" name="place" placeholder="Jaise Mumbai, Jaipur, Delhi" /></Field>
        <Field label="Date of Birth" hint="Pata ho toh chunein, warna skip."><DateField p="dob" /></Field>
        <Field label="Birth Time" hint="Pata ho toh clock se chunein, warna skip."><ClockField p="tob" /></Field>
        </div>
        <Field label="Your One Clear Photo" req hint="Face reading analysis ke liye."><FileDrop name="photo1" onChange={setPhoto1} /></Field>
      </div>

      <div className={S(1)}>
        <h2 className="rf-sec first">Reading Book Karne Ki Wajah <b>*</b></h2>
        <div className="concerns">
          {[...CONCERNS, ["✍️", "Other"] as [string, string]].map(([ic, c]) => (
            <label key={c} className={concern === c ? "on" : ""}><input type="radio" name="concern" value={c} checked={concern === c} onChange={() => { setConcern(c); if (needsPartner(c)) setP2(true); }} /><span>{ic}</span>{c === "Other" ? "Other (khud likhein)" : c}</label>))}
        </div>
        {concern === "Other" && <input className="rf-in" name="concernOther" placeholder="Apni wajah likhein" style={{ marginTop: 10 }} />}
        <Field label="Kuch aur batana chahte hain? (optional)"><textarea className="rf-in" name="notes" rows={3} placeholder="Jaise: date/time ka koi hissa pata nahi, ya kuch aur." /></Field>
      </div>

      <div className={S(2)}>
        <h2 className="rf-sec first">Kisi Aur Ke Baare Mein? <small>{partner ? "(partner zaroori)" : "(optional)"}</small></h2>
        <p className="rf-hint">Sirf unhi logon ki reading hogi jinki details yahan doge. {partner ? "Aapki wajah partner ke baare mein hai, isliye partner ka naam aur photo zaroori hai. Third person optional hai." : "Nahi chahiye toh seedha Submit dabayein."}</p>
        <Person n="2" on={p2 || partner} req={partner} toggle={() => { if (p2) delete photoStore.photo2; setP2(!p2); }} />
        <Person n="3" on={p3} toggle={() => { if (p3) delete photoStore.photo3; setP3(!p3); }} />
      </div>

      {step === STEPS.length - 1 && <p className="rf-hint" style={{ marginTop: 14 }}>Submit karke aap hamari <a href="https://thedivinetarotonline.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Privacy Policy</a> se sahmat hain. Aapki details aur photos sirf reading ke liye use hoti hain.</p>}
      {err && <p className="rf-err" key={shake} style={{ animation: "shake .4s" }}>{err}</p>}
      <div className="rf-nav">
        {step > 0 && <button type="button" className="btn ghost" onClick={() => go(-1)}>← Back</button>}
        {step < STEPS.length - 1
          ? <button type="button" className="btn gold" style={{ marginLeft: "auto" }} onClick={() => go(1)}>Next →</button>
          : <button className="btn gold" disabled={busy || !next} style={{ marginLeft: "auto" }}>{busy ? "Submit ho raha hai…" : "Submit & Confirm ✦"}</button>}
      </div>
    </form>);
}
