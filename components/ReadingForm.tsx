"use client";
import { useEffect, useRef, useState } from "react";
import DateField from "./form/DateField";
import ClockField from "./form/ClockField";
import FileDrop, { photoStore } from "./form/FileDrop";
import { EmailVerify } from "./form/Verify";
import { CONCERNS, VIDEO_MAX_Q, VIDEO_Q_CHARS, VIDEO_TOPICS, needsPartner } from "@/lib/concerns";
import { MAX_WORDS, WORD_FIELDS, limitWords, wordCount } from "@/lib/words";
import { TIER_INFO, isQuestionTier, isUrgentTier, parseTier } from "@/lib/slots";

const VOICE_STEPS = ["Aap", "Wajah", "Doosre log"], VIDEO_STEPS = ["Aap", "Sawal"];
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
type Raw = Record<string, string>;
function Person({ n, on, toggle, req, init, keepPhoto }: { n: "2" | "3"; on: boolean; toggle: () => void; req?: boolean; init?: Raw; keepPhoto?: boolean }) {
  const r = init || {};
  const ord = n === "2" ? "Second Person / Partner" : "Third Person / Third Party";
  return (
    <div className={`person${on ? " open" : ""}${req ? " req" : ""}`}>
      <button type="button" className="person-head" onClick={req ? undefined : toggle} aria-disabled={req || undefined}><span className="plus">{on ? "−" : "+"}</span><div><b>{ord}{req && " *"}</b><small>{req ? "Zaroori — aapki wajah partner ke baare mein hai. Partner ka naam aur photo dein." : "Optional — love life ya family ke liye"}</small></div></button>
      {on && (
        <div className="person-body">
          <div className="rf-2">
          <Field label="Naam" req={req}><input className="rf-in" name={"name" + n} defaultValue={r["name" + n]} /></Field>
          <Field label="Place of Birth"><input className="rf-in" name={"place" + n} defaultValue={r["place" + n]} placeholder="Jaise Mumbai, Jaipur, Delhi" /></Field>
          <Field label="Date of Birth" hint="Pata ho toh, warna skip."><DateField p={"dob" + n} init={{ d: r[`dob${n}d`], m: r[`dob${n}m`], y: r[`dob${n}y`] }} /></Field>
          <Field label="Birth Time" hint="Pata ho toh, warna skip."><ClockField p={"tob" + n} init={{ h: r[`tob${n}h`], min: r[`tob${n}min`], ap: r[`tob${n}ap`] }} /></Field>
          </div>
          <Field label="One Clear Photo" req={req && !keepPhoto} hint={keepPhoto ? "Pehle wali photo rahegi — badalni ho tabhi nayi upload karein." : undefined}><FileDrop name={"photo" + n} /></Field>
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
  // Edit mode: a submitted form can be changed for 24 h (closes 3 h before the slot); bk.edit carries the saved answers.
  const [editing, setEditing] = useState(false), [note, setNote] = useState("");
  // 25-word cap on every free-text answer: extra words are cut while typing; notes / "Other" show a counter.
  const [words, setWords] = useState<Record<string, number>>({});
  const capWords = (e: React.FormEvent<HTMLFormElement>) => {
    const t = e.target as HTMLInputElement;
    if (/^q[1-3]$/.test(t.name)) { setWords((w) => ({ ...w, [t.name]: t.value.length })); return; }
    if (!WORD_FIELDS.includes(t.name)) return;
    if (wordCount(t.value) > MAX_WORDS) t.value = limitWords(t.value);
    setWords((w) => ({ ...w, [t.name]: wordCount(t.value) }));
  };
  const Count = ({ n }: { n: string }) => <p className="rf-hint" style={{ textAlign: "right", margin: "4px 0 0" }}>{words[n] || 0}/{MAX_WORDS} shabd</p>;
  const raw: Raw = (editing && bk?.edit?.raw) || {};
  const refresh = () => fetch("/api/booking", { cache: "no-store" }).then((r) => r.json()).then((j) => setBk(j)).catch(() => {});
  const startEdit = () => {
    const r: Raw = bk.edit.raw || {};
    for (const k of ["photo1", "photo2", "photo3"]) delete photoStore[k];
    setConcern(r.concern || ""); setP2(!!r.name2); setP3(!!r.name3); setEmailOk(!!bk.edit.emailVerified); setPhoto1(false);
    setWords({ notes: wordCount(r.notes || ""), concernOther: wordCount(r.concernOther || ""), q1: (r.q1 || "").length, q2: (r.q2 || "").length, q3: (r.q3 || "").length });
    setStep(0); setErr(""); setDone(null); setEditing(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => { // link from the email: /form#edit
    if (!bk?.formDone) return;
    const h = window.location.hash;
    if (h === "#edit" && bk.edit) startEdit();
    if (h === "#edit-expired" || (h === "#edit" && !bk.edit)) setNote("Form edit karne ka time khatam ho gaya hai.");
    if (h) window.history.replaceState(null, "", "/form");
  }, [bk?.formDone]);
  // Video call reading (bk.tier === "video"): one person, up to 3 written questions — steps Aap → Sawal.
  // (also the two 3-question voice readings q3 / q3urgent — same form)
  const video = isQuestionTier(bk?.tier), STEPS = video ? VIDEO_STEPS : VOICE_STEPS;
  const partner = !video && needsPartner(concern);
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
    if (!next && !editing) return bad("Abhi koi slot khaali nahi hai. Aapki booking surakshit hai — hum aapki email par jaankari bhejenge.");
    if (s === 0) {
      if (!val("name")) return bad("Apna poora naam likhein.");
      if (val("phone").replace(/\D/g, "").length < 10) return bad("Sahi WhatsApp number likhein.");
      if (!emailOk) return bad("Apni email OTP se verify karein.");
      if (!val("place")) return bad("Place of Birth likhein.");
      if (!photo1 && !editing) return bad("Apni ek clear photo upload karein.");
    }
    if (s === 1 && video) {
      const qs = [1, 2, 3].map((i) => ({ i, text: val(`q${i}`), topic: (formRef.current?.querySelector(`input[name=qt${i}]:checked`) as HTMLInputElement | null)?.value || "" }));
      if (!qs.some((q) => q.text)) return bad("Kam se kam ek sawal likhein.");
      const noTopic = qs.find((q) => q.text && !q.topic);
      if (noTopic) return bad(`Sawal ${noTopic.i} ka topic chunein — Love life, Career ya Koi aur issue.`);
      return true;
    }
    if (s === 1 && (!concern || (concern === "Other" && !val("concernOther")))) return bad("Reading ki wajah chunein.");
    if (s === 2 && partner) {
      if (!val("name2")) return bad("Partner ka naam likhein.");
      if (!photoStore.photo2 && !(editing && bk.edit?.hadPartner)) return bad("Partner ki ek clear photo upload karein.");
    }
    return true;
  }
  const go = (d: number) => { if (d < 0 || valid(step)) { setStep(step + d); window.scrollTo({ top: 0, behavior: "smooth" }); } };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!valid(0) || !valid(1) || (!video && !valid(2))) return; setBusy(true);
    const fd = new FormData(e.currentTarget);
    if (editing) fd.set("mode", "edit");
    for (const k of ["photo1", "photo2", "photo3"]) if (photoStore[k]) fd.set(k, photoStore[k]);
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
  return (
    <form key={editing ? "edit" : "new"} ref={formRef} className="rf-card" onSubmit={submit} onInput={capWords} noValidate>
      <div className="rf-badge">{editing ? "✏️ Edit mode" : "✓ Payment received"}{bk.tier && bk.tier !== "standard" ? ` · ${TIER_INFO[parseTier(bk.tier)].badge}` : ""}{bid ? ` · ID ${bid}` : ""}</div>
      <h1>{editing ? "Form Edit Karein" : "Personal Reading Form"}</h1>
      {editing && <p className="rf-hint">Jo badalna hai badlein aur neeche <b>Update</b> dabayein. Slot aur Google Meet link same rahenge. <button type="button" className="otp-link" onClick={() => { setEditing(false); setErr(""); }}>Cancel</button></p>}
      <div className="stepper">
        <div className="stepper-bar"><i style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} /></div>
        {STEPS.map((s, i) => <div key={s} className={`stepper-dot${i <= step ? " on" : ""}`}><span>{i < step ? "✓" : i + 1}</span><small>{s}</small></div>)}
      </div>

      <div className="rf-slot">
        <span>Aapka slot{editing ? " (same rahega)" : ""}</span>
        {editing && bk.date ? <b>{fmtD(bk.date)} · {fmtT(bk.time)} IST</b> : next === undefined ? <b>Slot dhoondh rahe hain…</b>
          : next ? <b>{fmtD(next.date)} · {fmtT(next.time)} IST</b>
          : <b className="rf-err">Abhi koi slot khaali nahi hai. Aapki booking (ID {bid}) surakshit hai — hum aapki email par jaankari bhejenge.</b>}
      </div>
      {next && !editing && <p className="rf-hint">{isUrgentTier(bk.tier)
        ? "⚡ Urgent booking: 48 ghante ke andar ka slot aapke liye rakha gaya hai."
        : "Aapka appointment payment ke 7–10 din ke andar ka sabse pehla khaali slot hai."} Form submit karte hi final slot aur Google Meet link email par aa jayega.</p>}

      <div className={S(0)}>
        <h2 className="rf-sec first">Aapki Details</h2>
        <div className="rf-2">
        <Field label="Full Name with Surname" req hint="Pura naam likhein"><input className="rf-in" name="name" defaultValue={editing ? raw.name : bk.name} autoComplete="name" /></Field>
        <Field label="WhatsApp Number" req hint="Reading ke liye contact isi number par hoga."><input className="rf-in" name="phone" type="tel" defaultValue={editing ? raw.phone : bk.phone} autoComplete="tel" /></Field>
        <Field label="Email ID" req hint="Google Meet link aur schedule isi email par aayega. Email OTP se verify karein."><EmailVerify key={editing ? "edit" : "new"} defaultValue={editing ? raw.email : /@razorpay\.com$/i.test(bk.email || "") ? "" : bk.email} preVerified={editing && !!bk.edit?.emailVerified} onChange={setEmailOk} /></Field>
        <Field label="Place of Birth" req hint="Jis shehar mein janm hua."><input className="rf-in" name="place" defaultValue={raw.place} placeholder="Jaise Mumbai, Jaipur, Delhi" /></Field>
        <Field label="Date of Birth" hint="Pata ho toh chunein, warna skip."><DateField p="dob" init={{ d: raw.dobd, m: raw.dobm, y: raw.doby }} /></Field>
        <Field label="Birth Time" hint="Pata ho toh clock se chunein, warna skip."><ClockField p="tob" init={{ h: raw.tobh, min: raw.tobmin, ap: raw.tobap }} /></Field>
        </div>
        <Field label="Your One Clear Photo" req={!editing} hint={editing ? "Pehle wali photo rahegi — badalni ho tabhi nayi upload karein." : "Face reading analysis ke liye."}><FileDrop name="photo1" onChange={setPhoto1} /></Field>
      </div>

      {video && (
      <div className={S(1)}>
        <h2 className="rf-sec first">Aapke Sawal <small>(max {VIDEO_MAX_Q})</small></h2>
        <p className="rf-hint">{bk.tier === "video" ? "Video call" : "Is call"} mein <b>sirf aapki</b> reading hogi. Apne {VIDEO_MAX_Q} sawal likhein — har sawal {VIDEO_Q_CHARS} characters tak. Pehla sawal zaroori hai.</p>
        {[1, 2, 3].map((i) => (
          <div key={i} className="vq">
            <label className="rf-label">Sawal {i}{i === 1 && <b> *</b>}</label>
            <div className="vq-topics">{VIDEO_TOPICS.map((t) => (
              <label key={t}><input type="radio" name={`qt${i}`} value={t} defaultChecked={raw[`qt${i}`] === t} /><span>{t === "Love life" ? "❤️" : t === "Career" ? "💼" : "🧭"} {t}</span></label>))}</div>
            <input className="rf-in" name={`q${i}`} maxLength={VIDEO_Q_CHARS} defaultValue={raw[`q${i}`]} placeholder={i === 1 ? "Jaise: Kya meri shaadi is saal hogi?" : "Optional"} />
            <p className="rf-hint" style={{ textAlign: "right", margin: "4px 0 0" }}>{words[`q${i}`] || 0}/{VIDEO_Q_CHARS}</p>
          </div>))}
      </div>)}

      {!video && <>
      <div className={S(1)}>
        <h2 className="rf-sec first">Reading Book Karne Ki Wajah <b>*</b></h2>
        <div className="concerns">
          {[...CONCERNS, ["✍️", "Other"] as [string, string]].map(([ic, c]) => (
            <label key={c} className={concern === c ? "on" : ""}><input type="radio" name="concern" value={c} checked={concern === c} onChange={() => { setConcern(c); if (needsPartner(c)) setP2(true); }} /><span>{ic}</span>{c === "Other" ? "Other (khud likhein)" : c}</label>))}
        </div>
        {concern === "Other" && <><input className="rf-in" name="concernOther" defaultValue={raw.concernOther} placeholder={`Apni wajah likhein (max ${MAX_WORDS} shabd)`} style={{ marginTop: 10 }} /><Count n="concernOther" /></>}
        <Field label="Kuch aur batana chahte hain? (optional)"><textarea className="rf-in" name="notes" defaultValue={raw.notes} rows={3} placeholder={`Jaise: date/time ka koi hissa pata nahi, ya kuch aur. (max ${MAX_WORDS} shabd)`} /><Count n="notes" /></Field>
      </div>

      <div className={S(2)}>
        <h2 className="rf-sec first">Kisi Aur Ke Baare Mein? <small>{partner ? "(partner zaroori)" : "(optional)"}</small></h2>
        <p className="rf-hint">Sirf unhi logon ki reading hogi jinki details yahan doge. {partner ? "Aapki wajah partner ke baare mein hai, isliye partner ka naam aur photo zaroori hai. Third person optional hai." : "Nahi chahiye toh seedha Submit dabayein."}</p>
        <Person n="2" init={raw} keepPhoto={editing && bk.edit?.hadPartner} on={p2 || partner} req={partner} toggle={() => { if (p2) delete photoStore.photo2; setP2(!p2); }} />
        <Person n="3" init={raw} keepPhoto={editing && !!raw.name3} on={p3} toggle={() => { if (p3) delete photoStore.photo3; setP3(!p3); }} />
      </div>
      </>}

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
