"use client";
import { useEffect, useRef, useState } from "react";
import SlotPicker from "./SlotPicker";
import DateField from "./form/DateField";
import ClockField from "./form/ClockField";
import FileDrop, { photoStore } from "./form/FileDrop";

const CONCERNS: [string, string][] = [
  ["💍", "Aapki Shaadi nahi horahi?"], ["💼", "Career ko lekar Tension hai"], ["🔀", "Third Party situation main stuck hai"],
  ["💭", "Partner ki current feelings or actions jaanne hai"], ["🤝", "Partner ke sath reunion ya reconcilation ka pata lagana hai"],
  ["🕉️", "Apni Spritual Journey Jaanni haii"], ["🧭", "Aapna Life Purpose Jaanna hai"], ["💰", "Financial tension bohot hai"],
  ["🧿", "Black magic ka Doubt hai"], ["🩺", "Health ko lekar pareshan hai"], ["👶", "Bacha kab hoga?"], ["❤️", "Current Ya Ex Partner se Shaadi hogi?"],
];
const STEPS = ["Slot", "Aap", "Doosre log", "Wajah"];
const fmtD = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const fmtT = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

function Field({ label, req, hint, children }: { label: string; req?: boolean; hint?: string; children: React.ReactNode }) {
  return <div className="rf-field"><label className="rf-label">{label}{req && <b> *</b>}</label>{hint && <p className="rf-hint">{hint}</p>}{children}</div>;
}
function Person({ n, on, toggle }: { n: "2" | "3"; on: boolean; toggle: () => void }) {
  const ord = n === "2" ? "Second Person / Partner" : "Third Person / Third Party";
  return (
    <div className={`person${on ? " open" : ""}`}>
      <button type="button" className="person-head" onClick={toggle}><span className="plus">{on ? "−" : "+"}</span><div><b>{ord}</b><small>Optional — love life ya family ke liye</small></div></button>
      {on && (
        <div className="person-body">
          <div className="rf-2">
          <Field label="Naam"><input className="rf-in" name={"name" + n} /></Field>
          <Field label="Place of Birth"><input className="rf-in" name={"place" + n} placeholder="Jaise Mumbai, Jaipur, Delhi" /></Field>
          <Field label="Date of Birth"><DateField p={"dob" + n} /></Field>
          <Field label="Birth Time" hint="Pata ho toh, warna skip."><ClockField p={"tob" + n} /></Field>
          </div>
          <Field label="One Clear Photo"><FileDrop name={"photo" + n} /></Field>
        </div>)}
    </div>);
}

export default function ReadingForm() {
  const [waited, setWaited] = useState(false), [bid, setBid] = useState(""), [bk, setBk] = useState<any>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [shake, setShake] = useState(0), [done, setDone] = useState<any>(null);
  const [slots, setSlots] = useState<Record<string, string[]> | null>(null), [date, setDate] = useState(""), [time, setTime] = useState("");
  const [step, setStep] = useState(0), [concern, setConcern] = useState(""), [p2, setP2] = useState(false), [p3, setP3] = useState(false);
  const [dobOk, setDobOk] = useState(false), [photo1, setPhoto1] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const loadSlots = () => fetch("/api/slots").then((r) => r.json()).then((j) => setSlots(j.slots)).catch(() => setSlots({}));
  useEffect(() => { if (bk?.status === "paid" && !bk.formDone && !slots) loadSlots(); }, [bk]);

  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("bid") || ""; setBid(b);
    if (!b) return setBk({ status: "unknown" });
    let n = 0;
    const check = async () => { try { const j = await (await fetch(`/api/booking?bid=${b}`)).json(); setBk(j); return j.status; } catch { return "created"; } };
    check();
    const t = setInterval(async () => { const s = await check(); if (s !== "created") clearInterval(t); else if (++n > 90) { clearInterval(t); setWaited(true); } }, 2000);
    return () => clearInterval(t);
  }, []);

  const val = (n: string) => String((formRef.current?.elements.namedItem(n) as HTMLInputElement | null)?.value || "").trim();
  const bad = (m: string) => { setErr(m); setShake((s) => s + 1); return false; };
  function valid(s: number) {
    setErr("");
    if (s === 0 && (!date || !time)) return bad("Pehle calendar se din aur time chunein.");
    if (s === 1) {
      if (!val("name")) return bad("Apna poora naam likhein.");
      if (val("phone").replace(/\D/g, "").length < 10) return bad("Sahi WhatsApp number likhein.");
      if (!/^\S+@\S+\.\S+$/.test(val("email"))) return bad("Sahi email likhein.");
      if (!dobOk) return bad("Apni Date of Birth chunein.");
      if (!val("place")) return bad("Place of Birth likhein.");
      if (!photo1) return bad("Apni ek clear photo upload karein.");
    }
    if (s === 3 && (!concern || (concern === "Other" && !val("concernOther")))) return bad("Reading ki wajah chunein.");
    return true;
  }
  const go = (d: number) => { if (d < 0 || valid(step)) { setStep(step + d); window.scrollTo({ top: 0, behavior: "smooth" }); } };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!valid(3)) return; setBusy(true);
    const fd = new FormData(e.currentTarget); fd.set("bid", bid); fd.set("date", date); fd.set("time", time);
    for (const k of ["photo1", "photo2", "photo3"]) if (photoStore[k]) fd.set(k, photoStore[k]);
    try {
      const j = await (await fetch("/api/form", { method: "POST", body: fd })).json();
      if (j.ok) { setDone(j); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else { setErr(j.error || "Kuch galat hua. Dobara try karein."); if (j.code === "slot_taken") { setTime(""); setStep(0); loadSlots(); } }
    } catch { setErr("Network error. Dobara try karein."); }
    setBusy(false);
  }

  if (!bk) return <div className="rf-card"><p>Load ho raha hai…</p></div>;
  if (bk.status === "unknown") return <div className="rf-card"><h1>Booking nahi mili</h1><p>Yeh link galat ya adhoora hai. Payment ke baad aapko email par sahi link mila hoga.</p><a className="btn gold" href="/#book">Slot book karein</a></div>;
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
        <p className="rf-hint" style={{ marginTop: 18 }}>Slot time par 5 minute ke andar join karein. Headphones lagana na bhoolein. 🎧</p>
      </div>);
  }

  const S = (i: number) => `step${step === i ? " active" : ""}`;
  return (
    <form ref={formRef} className="rf-card" onSubmit={submit} noValidate>
      <div className="rf-badge">✓ Payment received</div>
      <h1>Personal Reading Form</h1>
      <div className="stepper">
        <div className="stepper-bar"><i style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} /></div>
        {STEPS.map((s, i) => <div key={s} className={`stepper-dot${i <= step ? " on" : ""}`}><span>{i < step ? "✓" : i + 1}</span><small>{s}</small></div>)}
      </div>

      <div className={S(0)}>
        <h2 className="rf-sec first">Apna Slot Chunein</h2>
        {!slots ? <p className="rf-hint">Slots load ho rahe hain…</p> : !Object.keys(slots).length ? <p className="rf-err">Abhi koi slot khaali nahi hai. WhatsApp karein: +91 88281 16545 (Booking ID {bid}).</p>
          : <SlotPicker slots={slots} date={date} time={time} onDate={setDate} onTime={setTime} />}
      </div>

      <div className={S(1)}>
        <h2 className="rf-sec first">Aapki Details</h2>
        <div className="rf-2">
        <Field label="Full Name with Surname" req hint="Pura naam likhein"><input className="rf-in" name="name" defaultValue={bk.name} autoComplete="name" /></Field>
        <Field label="WhatsApp Number" req hint="Reading ke liye contact isi number par hoga."><input className="rf-in" name="phone" type="tel" defaultValue={bk.phone} autoComplete="tel" /></Field>
        <Field label="Email ID" req hint="Payment wali email — Meet link isi par aayega."><input className="rf-in" name="email" type="email" defaultValue={bk.email} readOnly={!!bk.email} /></Field>
        <Field label="Place of Birth" req hint="Jis shehar mein janm hua."><input className="rf-in" name="place" placeholder="Jaise Mumbai, Jaipur, Delhi" /></Field>
        <Field label="Date of Birth" req hint="Vedic Astrology & Numerology chart ke liye zaroori."><DateField p="dob" onChange={setDobOk} /></Field>
        <Field label="Birth Time" hint="Pata ho toh clock se chunein, warna skip."><ClockField p="tob" /></Field>
        </div>
        <Field label="Your One Clear Photo" req hint="Face reading analysis ke liye."><FileDrop name="photo1" onChange={setPhoto1} /></Field>
      </div>

      <div className={S(2)}>
        <h2 className="rf-sec first">Kisi Aur Ke Baare Mein? <small>(optional)</small></h2>
        <p className="rf-hint">Sirf unhi logon ki reading hogi jinki details yahan doge. Nahi chahiye toh seedha Next dabayein.</p>
        <Person n="2" on={p2} toggle={() => { if (p2) delete photoStore.photo2; setP2(!p2); }} />
        <Person n="3" on={p3} toggle={() => { if (p3) delete photoStore.photo3; setP3(!p3); }} />
      </div>

      <div className={S(3)}>
        <h2 className="rf-sec first">Reading Book Karne Ki Wajah <b>*</b></h2>
        <div className="concerns">
          {[...CONCERNS, ["✍️", "Other"] as [string, string]].map(([ic, c]) => (
            <label key={c} className={concern === c ? "on" : ""}><input type="radio" name="concern" value={c} checked={concern === c} onChange={() => setConcern(c)} /><span>{ic}</span>{c === "Other" ? "Other (khud likhein)" : c}</label>))}
        </div>
        {concern === "Other" && <input className="rf-in" name="concernOther" placeholder="Apni wajah likhein" style={{ marginTop: 10 }} />}
        <Field label="Kuch aur batana chahte hain? (optional)"><textarea className="rf-in" name="notes" rows={3} placeholder="Jaise: date/time ka koi hissa pata nahi, ya kuch aur." /></Field>
      </div>

      {err && <p className="rf-err" key={shake} style={{ animation: "shake .4s" }}>{err}</p>}
      <div className="rf-nav">
        {step > 0 && <button type="button" className="btn ghost" onClick={() => go(-1)}>← Back</button>}
        {step < STEPS.length - 1
          ? <button type="button" className="btn gold" style={{ marginLeft: "auto" }} onClick={() => go(1)}>Next →</button>
          : <button className="btn gold" disabled={busy} style={{ marginLeft: "auto" }}>{busy ? "Submit ho raha hai…" : "Submit & Confirm ✦"}</button>}
      </div>
    </form>);
}
