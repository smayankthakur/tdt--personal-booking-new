"use client";
import { useEffect, useRef, useState } from "react";
import { photoStore } from "./form/FileDrop";
import { StepFields, type FieldCtx } from "./form/Fields";
import { limitWords, wordCount } from "@/lib/words";
import { TIER_INFO, isUrgentTier, isWrittenTier, parseTier } from "@/lib/slots";
import { checkStep, defaultForm, kindOf, limits as limitsOf, partnerConcern, photoFields, visibleSteps, type FormDef, type Reader } from "@/lib/formSchema";

const fmtD = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const gcalLink = (d: string, t: string, meet: string | null) => {
  const s = Date.parse(`${d}T${t}:00+05:30`), u = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const q = new URLSearchParams({ action: "TEMPLATE", text: "Personal Reading — The Divine Tarot", dates: `${u(s)}/${u(s + 40 * 60000)}`,
    details: `Google Meet: ${meet || "link aapki email mein"}\nSirf 5 minute wait kiya jayega — time par join karein.`, location: meet || "Google Meet" });
  return `https://calendar.google.com/calendar/render?${q}`;
};
const fmtT = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

type Raw = Record<string, string>;

export default function ReadingForm() {
  const [waited, setWaited] = useState(false), [bid, setBid] = useState(""), [bk, setBk] = useState<any>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [shake, setShake] = useState(0), [done, setDone] = useState<any>(null);
  // Slot is auto-assigned (earliest free one). undefined = loading, null = nothing free.
  const [next, setNext] = useState<{ date: string; time: string } | null | undefined>(undefined);
  const [step, setStep] = useState(0), [concern, setConcern] = useState(""), [p2, setP2] = useState(false), [p3, setP3] = useState(false);
  const [emailOk, setEmailOk] = useState(false);
  // Edit mode: a submitted form can be changed for 24 h (closes 3 h before the slot); bk.edit carries the saved answers.
  const [editing, setEditing] = useState(false), [note, setNote] = useState("");
  // Form layout from admin → Form Builder (sent with the booking); the built-in default if it didn't come.
  const def: FormDef = bk?.form?.steps?.length ? bk.form : defaultForm(kindOf(bk?.tier));
  const steps = visibleSteps(def), lim = limitsOf(def);
  // Word / character limits from the layout: extra words are cut while typing; long-text fields show a counter.
  const [words, setWords] = useState<Record<string, number>>({});
  const capWords = (e: React.FormEvent<HTMLFormElement>) => {
    const t = e.target as HTMLInputElement, l = lim[t.name];
    if (!l) return;
    if (l.words && wordCount(t.value) > l.words) t.value = limitWords(t.value, l.words);
    setWords((w) => ({ ...w, [t.name]: l.words ? wordCount(t.value) : t.value.length }));
  };
  const raw: Raw = (editing && bk?.edit?.raw) || {};
  const refresh = () => fetch("/api/booking", { cache: "no-store" }).then((r) => r.json()).then((j) => setBk(j)).catch(() => {});
  const startEdit = () => {
    const r: Raw = bk.edit.raw || {};
    for (const { name } of photoFields(def)) delete photoStore[name];
    setConcern(r.concern || ""); setP2(!!r.name2); setP3(!!r.name3); setEmailOk(!!bk.edit.emailVerified);
    setWords(Object.fromEntries(Object.entries(lim).map(([k, l]) => [k, l.words ? wordCount(r[k] || "") : (r[k] || "").length])));
    setStep(0); setErr(""); setDone(null); setEditing(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => { // link from the email: /form#edit
    if (!bk?.formDone) return;
    const h = window.location.hash;
    if (h === "#edit" && bk.edit) startEdit();
    if (h === "#edit-expired" || (h === "#edit" && !bk.edit)) setNote("Form edit karne ka time khatam ho gaya hai.");
    if (h) window.history.replaceState(null, "", "/form");
  }, [bk?.formDone]);
  const STEPS = steps.map((s) => s.title);
  // Written reading (answers by email): no slot / Meet shown, the customer chooses the answer language.
  const written = isWrittenTier(bk?.tier), wWhen = isUrgentTier(bk?.tier) ? "48 ghante" : "7 din";
  const fmtDay = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const partner = partnerConcern(def, concern);
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

  // Reads the form like the server reads FormData, so the same checks (lib/formSchema) run here and in /api/form.
  const reader: Reader = {
    str: (n) => {
      const el = formRef.current?.elements.namedItem(n) as any;
      if (!el) return "";
      if (typeof RadioNodeList !== "undefined" && el instanceof RadioNodeList) return String(el.value || "").trim();
      if (el.type === "checkbox") return el.checked ? "1" : "";
      return String(el.value || "").trim();
    },
    file: (n) => !!photoStore[n],
  };
  const bad = (m: string) => { setErr(m); setShake((s) => s + 1); return false; };
  function valid(s: number) {
    setErr("");
    if (!next && !editing) return bad("Abhi koi slot khaali nahi hai. Aapki booking surakshit hai — hum aapki email par jaankari bhejenge.");
    const e = steps[s] ? checkStep(steps[s], reader, { editing, emailOk, hadPartner: editing && !!bk.edit?.hadPartner }, def) : "";
    return e ? bad(e) : true;
  }
  const go = (d: number) => { if (d < 0 || valid(step)) { setStep(step + d); window.scrollTo({ top: 0, behavior: "smooth" }); } };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    for (let i = 0; i < steps.length; i++) if (!valid(i)) { setStep(i); return; }
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    if (editing) fd.set("mode", "edit");
    for (const { name } of photoFields(def)) if (photoStore[name]) fd.set(name, photoStore[name]);
    try {
      const j = await (await fetch("/api/form", { method: "POST", body: fd })).json();
      if (j.ok) { setDone(j); setEditing(false); refresh(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else { setErr(j.error || "Kuch galat hua. Dobara try karein."); if (j.code === "no_slots") loadSlots(); if (j.code === "verify_email") setStep(0); if (j.code === "edit_closed") { setEditing(false); refresh(); } }
    } catch { setErr("Network error. Dobara try karein."); }
    setBusy(false);
  }

  if (!bk) return <div className="rf-card"><p>Load ho raha hai…</p></div>;
  if (bk.status === "unknown") return <div className="rf-card"><h1>Pehle payment karein</h1><p>Reading form sirf payment ke baad khulta hai. Agar aapne payment kar diya hai, toh payment ke baad aayi email mein diye gaye <b>"Reading Form Bharein"</b> link se form kholein.</p><a className="btn gold" href="/#book" style={{ marginTop: 14 }}>Booking page par jayein</a></div>;
  if (bk.status === "created" && !waited) return <div className="rf-card"><p>Form load ho raha hai…</p></div>;
  if (bk.status === "created") return <div className="rf-card"><h1>Payment abhi tak nahi mila</h1><p>Agar payment ho chuka hai toh page refresh karein. Nahi hua hai toh dobara payment karein.</p><a className="btn gold" href="/#book" style={{ marginTop: 14 }}>Payment page par jayein</a></div>;
  if (bk.status === "cancelled") return <div className="rf-card"><h1>Yeh booking cancel ho chuki hai</h1><p>Is booking ki details aapki email par bheji gayi hain. Nayi reading book karni ho toh neeche button dabayein.</p><a className="btn gold" href="/#book" style={{ marginTop: 14 }}>➕ Nayi booking karein</a></div>;
  if (bk.status !== "paid") return <div className="rf-card"><h1>Payment nahi mila</h1><a className="btn gold" href="/#book">Wapas jayein</a></div>;

  if ((bk.formDone || done) && !editing && written) {
    const by = done?.deliverBy || bk.deliverBy, lang = done?.lang || bk.lang;
    const newBooking = <a className={`btn ${bk.edit ? "ghost" : "gold"}`} href="/#book" style={{ marginTop: 14 }}>➕ Nayi booking karein</a>;
    return (
      <div className="rf-card rf-success">
        <svg className="ok-tick" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M14 27l8 8 16-17" /></svg>
        <h1>{done?.edited ? "Form Update Ho Gaya" : "Booking Confirmed"}</h1>
        {by && <div className="rf-slot"><span>Aapke jawab kab tak</span><b>{fmtDay(by)} tak</b></div>}
        <p>Aapka form mil gaya hai. Bharti Singh aapke <b>3 sawalon ke detailed jawab, guidance ke saath</b>{lang ? <>, <b>{lang}</b> mein,</> : ""} {wWhen} ke andar <b>aapki email par</b> bhejengi.</p>
        <div className="rf-remind">
          <b>📧 Apni email check karte rahein</b>
          <p>Booking confirmation abhi aapki email par bhej di gayi hai. Jawab bhi isi email par aayenge — <b>Spam / Promotions folder</b> bhi zaroor dekhein.</p>
        </div>
        {bk.edit && <div className="rf-edit"><p>Form mein kuch galat bhar diya? <b>{new Date(bk.edit.until).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} tak</b> edit kar sakte hain.</p><button type="button" className="btn ghost" onClick={startEdit}>✏️ Form edit karein</button></div>}
        {note && <p className="rf-err">{note}</p>}
        {!bk.edit && <p className="rf-hint" style={{ marginTop: 14 }}>Is booking ka form submit ho chuka hai. Ek aur reading chahiye toh nayi booking karein.</p>}
        {newBooking}
      </div>);
  }

  if ((bk.formDone || done) && !editing) {
    const dd = done?.date || bk.date, tt = done?.time || bk.time, meet = done?.meetLink || bk.meetLink;
    // One form per payment: once submitted it can only be EDITED inside the edit window. After that this page offers a
    // NEW booking (new payment + new form) — the old booking is never reopened.
    const past = !!dd && Date.parse(`${dd}T${tt}:00+05:30`) + 40 * 60000 < Date.now();
    const newBooking = <a className={`btn ${bk.edit && !past ? "ghost" : "gold"}`} href="/#book" style={{ marginTop: 14 }}>➕ Nayi booking karein</a>;
    if (past) return (
      <div className="rf-card rf-success">
        <h1>Aapki reading ho chuki hai</h1>
        {dd && <div className="rf-slot"><span>Pichhli booking</span><b>{fmtD(dd)} · {fmtT(tt)} IST</b></div>}
        <p>Yeh booking poori ho chuki hai. Ek aur reading ke liye nayi booking karein — naya payment aur naya form.</p>
        {newBooking}
      </div>);
    return (
      <div className="rf-card rf-success">
        <svg className="ok-tick" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M14 27l8 8 16-17" /></svg>
        <h1>{done?.edited ? "Form Update Ho Gaya" : "Appointment Confirmed"}</h1>
        {dd && <div className="rf-slot"><span>Aapka slot</span><b>{fmtD(dd)} · {fmtT(tt)} IST</b></div>}
        <p>Aapka form mil gaya hai. <b>Google Meet link aur schedule aapki email par bhej diya gaya hai</b> — spam folder bhi check kar lein.</p>
        {meet && <a className="btn gold" href={meet} target="_blank" rel="noopener noreferrer">Google Meet Link</a>}
        {bk.edit && <div className="rf-edit"><p>Form mein kuch galat bhar diya? <b>{new Date(bk.edit.until).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} tak</b> edit kar sakte hain. Slot same rahega.</p><button type="button" className="btn ghost" onClick={startEdit}>✏️ Form edit karein</button></div>}
        {note && <p className="rf-err">{note}</p>}
        {!bk.edit && <p className="rf-hint" style={{ marginTop: 14 }}>Is booking ka form submit ho chuka hai. Ek aur reading chahiye toh nayi booking karein.</p>}
        {newBooking}
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
  const fc: FieldCtx = { raw, editing, bk, words, limits: lim, concern, setConcern, p2, p3, setP2, setP3, partner, setEmailOk };
  return (
    <form key={editing ? "edit" : "new"} ref={formRef} className="rf-card" onSubmit={submit} onInput={capWords} noValidate>
      <div className="rf-badge">{editing ? "✏️ Edit mode" : "✓ Payment received"}{bk.tier && bk.tier !== "standard" ? ` · ${TIER_INFO[parseTier(bk.tier)].badge}` : ""}{bid ? ` · ID ${bid}` : ""}</div>
      <h1>{editing ? "Form Edit Karein" : def.title || "Personal Reading Form"}</h1>
      {editing && <p className="rf-hint">Jo badalna hai badlein aur neeche <b>Update</b> dabayein. {written ? "Jawab ki date same rahegi." : "Slot aur Google Meet link same rahenge."} <button type="button" className="otp-link" onClick={() => { setEditing(false); setErr(""); }}>Cancel</button></p>}
      <div className="stepper">
        <div className="stepper-bar"><i style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} /></div>
        {STEPS.map((s, i) => <div key={s} className={`stepper-dot${i <= step ? " on" : ""}`}><span>{i < step ? "✓" : i + 1}</span><small>{s}</small></div>)}
      </div>

      {written ? (
      <div className="rf-slot">
        <span>Aapke jawab</span>
        {editing && bk.deliverBy ? <b>{fmtDay(bk.deliverBy)} tak — aapki email par</b> : next === undefined ? <b>Check ho raha hai…</b>
          : next ? <b>Form submit karne ke {wWhen} ke andar — aapki email par</b>
          : <b className="rf-err">Abhi bookings full hain. Aapki booking (ID {bid}) surakshit hai — hum aapki email par jaankari bhejenge.</b>}
      </div>) : <>
      <div className="rf-slot">
        <span>Aapka slot{editing ? " (same rahega)" : ""}</span>
        {editing && bk.date ? <b>{fmtD(bk.date)} · {fmtT(bk.time)} IST</b> : next === undefined ? <b>Slot dhoondh rahe hain…</b>
          : next ? <b>{fmtD(next.date)} · {fmtT(next.time)} IST</b>
          : <b className="rf-err">Abhi koi slot khaali nahi hai. Aapki booking (ID {bid}) surakshit hai — hum aapki email par jaankari bhejenge.</b>}
      </div>
      {next && !editing && <p className="rf-hint">{isUrgentTier(bk.tier)
        ? "⚡ Urgent booking: 48 ghante ke andar ka slot aapke liye rakha gaya hai."
        : "Aapka appointment payment ke 7–10 din ke andar ka sabse pehla khaali slot hai."} Form submit karte hi final slot aur Google Meet link email par aa jayega.</p>}
      </>}

      {steps.map((st, i) => <div key={st.id} className={S(i)}><StepFields step={st} c={fc} /></div>)}

      {step === STEPS.length - 1 && <p className="rf-hint" style={{ marginTop: 14 }}>Submit karke aap hamari <a href="https://thedivinetarotonline.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Privacy Policy</a> se sahmat hain. Aapki details aur photos sirf reading ke liye use hoti hain.</p>}
      {err && <p className="rf-err" key={shake} style={{ animation: "shake .4s" }}>{err}</p>}
      <div className="rf-nav">
        {step > 0 && <button type="button" className="btn ghost" onClick={() => go(-1)}>← Back</button>}
        {step < STEPS.length - 1
          ? <button key="next" type="button" className="btn gold" style={{ marginLeft: "auto" }} onClick={(e) => { e.preventDefault(); go(1); }}>Next →</button>
          : <button key="submit" type="submit" className="btn gold" disabled={busy || (!next && !editing)} style={{ marginLeft: "auto" }}>{busy ? "Submit ho raha hai…" : editing ? "Update karein ✦" : "Submit & Confirm ✦"}</button>}
      </div>
    </form>);
}
