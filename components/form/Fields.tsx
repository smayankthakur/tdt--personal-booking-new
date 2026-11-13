"use client";
import { Fragment, type ReactNode } from "react";
import DateField from "./DateField";
import ClockField from "./ClockField";
import FileDrop, { photoStore } from "./FileDrop";
import { EmailVerify } from "./Verify";
import { MAX_WORDS } from "@/lib/words";
import { PARTNER_ID, personNo, type FormField, type FormStep } from "@/lib/formSchema";

/** Renders the reading form from its layout (lib/formSchema) — used by /form and by the admin Form Builder preview. */
type Raw = Record<string, string>;
export type FieldCtx = {
  raw: Raw; editing: boolean; preview?: boolean;
  bk?: { name?: string; phone?: string; email?: string; edit?: any } | null;
  words: Record<string, number>; limits: Record<string, { words?: number; chars?: number }>;
  concern: string; setConcern: (c: string) => void;
  p2: boolean; p3: boolean; setP2: (on: boolean) => void; setP3: (on: boolean) => void;
  partner: boolean; setEmailOk?: (ok: boolean) => void;
};

/** **bold** + line breaks in admin-written text. */
export function md(s?: string): ReactNode {
  if (!s) return null;
  return s.split("\n").map((line, i) => (
    <Fragment key={i}>{i > 0 && <br />}{line.split(/(\*\*[^*]+\*\*)/g).map((p, j) => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <b key={j}>{p.slice(2, -2)}</b> : p))}</Fragment>));
}
function Field({ label, req, hint, children }: { label?: string; req?: boolean; hint?: string; children: ReactNode }) {
  return <div className="rf-field">{label && <label className="rf-label">{md(label)}{req && <b> *</b>}</label>}{hint && <p className="rf-hint">{md(hint)}</p>}{children}</div>;
}
const Count = ({ c, n }: { c: FieldCtx; n: string }) => {
  const l = c.limits[n]; if (!l) return null;
  return <p className="rf-hint" style={{ textAlign: "right", margin: "4px 0 0" }}>{c.words[n] || 0}/{l.words || l.chars}{l.words ? " shabd" : ""}</p>;
};

function Person({ x, c }: { x: FormField; c: FieldCtx }) {
  const n = personNo(x.id), r = c.raw, req = x.id === PARTNER_ID && c.partner;
  const on = (n === "2" ? c.p2 : c.p3) || req, keepPhoto = c.editing && (n === "2" ? !!c.bk?.edit?.hadPartner : !!r.name3);
  const toggle = () => { if (on) delete photoStore["photo" + n]; (n === "2" ? c.setP2 : c.setP3)(!on); };
  return (
    <div className={`person${on ? " open" : ""}${req ? " req" : ""}`}>
      <button type="button" className="person-head" onClick={req ? undefined : toggle} aria-disabled={req || undefined}><span className="plus">{on ? "−" : "+"}</span><div><b>{x.label}{req && " *"}</b><small>{req ? "Zaroori — aapki wajah partner ke baare mein hai. Partner ka naam aur photo dein." : x.hint}</small></div></button>
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

function FieldView({ x, c }: { x: FormField; c: FieldCtx }) {
  const r = c.raw, req = !!x.required, ph = x.placeholder;
  const chars = x.maxChars ? { maxLength: x.maxChars } : {};
  switch (x.type) {
    case "info": return <p className="rf-hint">{md(x.label)}</p>;
    case "text": case "number": case "phone": {
      const def = x.id === "name" ? (c.editing ? r.name : c.bk?.name) : x.id === "phone" ? (c.editing ? r.phone : c.bk?.phone) : r[x.id];
      return <Field label={x.label} req={req} hint={x.hint}>
        <input className="rf-in" name={x.id} type={x.type === "phone" ? "tel" : x.type === "number" ? "number" : "text"} inputMode={x.type === "number" ? "decimal" : undefined}
          defaultValue={def} placeholder={ph} autoComplete={x.id === "name" ? "name" : x.id === "phone" ? "tel" : undefined} {...chars} />
        {x.maxChars ? <Count c={c} n={x.id} /> : null}
      </Field>;
    }
    case "textarea": return <Field label={x.label} req={req} hint={x.hint}>
      <textarea className="rf-in" name={x.id} rows={x.id === "notes" ? 3 : 5} defaultValue={r[x.id]} placeholder={ph} {...chars} /><Count c={c} n={x.id} />
    </Field>;
    case "email": return <Field label={x.label} req hint={x.hint}>
      {c.preview ? <input className="rf-in" placeholder="aapki@email.com" readOnly />
        : <EmailVerify key={c.editing ? "edit" : "new"} defaultValue={c.editing ? r.email : /@razorpay\.com$/i.test(c.bk?.email || "") ? "" : c.bk?.email} preVerified={c.editing && !!c.bk?.edit?.emailVerified} onChange={(ok) => c.setEmailOk?.(ok)} />}
    </Field>;
    case "date": return <Field label={x.label} req={req} hint={x.hint}><DateField p={x.id} init={{ d: r[x.id + "d"], m: r[x.id + "m"], y: r[x.id + "y"] }} /></Field>;
    case "time": return <Field label={x.label} req={req} hint={x.hint}><ClockField p={x.id} init={{ h: r[x.id + "h"], min: r[x.id + "min"], ap: r[x.id + "ap"] }} /></Field>;
    case "photo": return <Field label={x.label} req={req && !c.editing} hint={c.editing ? "Pehle wali photo rahegi — badalni ho tabhi nayi upload karein." : x.hint}><FileDrop name={x.id} /></Field>;
    case "choice": return <Field label={x.label} req={req} hint={x.hint}>
      <div className="vq-topics">{(x.options || []).map((o) => (
        <label key={o.label}><input type="radio" name={x.id} value={o.label} defaultChecked={r[x.id] === o.label} /><span>{o.icon ? `${o.icon} ` : ""}{o.label}</span></label>))}</div>
    </Field>;
    case "select": return <Field label={x.label} req={req} hint={x.hint}>
      <select className="rf-in" name={x.id} defaultValue={r[x.id] || ""}><option value="">{ph || "— Chunein —"}</option>
        {(x.options || []).map((o) => <option key={o.label} value={o.label}>{o.icon ? `${o.icon} ` : ""}{o.label}</option>)}</select>
    </Field>;
    case "checkbox": return <div className="rf-field">
      <label className="rf-check"><input type="checkbox" name={x.id} value="1" defaultChecked={!!r[x.id]} /><span>{md(x.label)}{req && <b> *</b>}</span></label>
      {x.hint && <p className="rf-hint">{md(x.hint)}</p>}
    </div>;
    case "questions": {
      const n = x.count || 3, max = x.maxChars || 100, topics = x.options || [];
      return <>{x.hint && <p className="rf-hint">{md(x.hint)}</p>}
        {Array.from({ length: n }, (_, k) => k + 1).map((i) => (
          <div key={i} className="vq">
            <label className="rf-label">{x.label} {i}{i === 1 && req && <b> *</b>}</label>
            {topics.length > 0 && <div className="vq-topics">{topics.map((t) => (
              <label key={t.label}><input type="radio" name={`qt${i}`} value={t.label} defaultChecked={r[`qt${i}`] === t.label} /><span>{t.icon ? `${t.icon} ` : ""}{t.label}</span></label>))}</div>}
            <input className="rf-in" name={`q${i}`} maxLength={max} defaultValue={r[`q${i}`]} placeholder={i === 1 ? ph : "Optional"} />
            <p className="rf-hint" style={{ textAlign: "right", margin: "4px 0 0" }}>{c.words[`q${i}`] || 0}/{max}</p>
          </div>))}
      </>;
    }
    case "concern": return <div className="rf-field">
      {x.label && <label className="rf-label">{md(x.label)}{req && <b> *</b>}</label>}{x.hint && <p className="rf-hint">{md(x.hint)}</p>}
      <div className="concerns">
        {[...(x.options || []), ...(x.other ? [{ label: "Other", icon: "✍️" }] : [])].map((o) => (
          <label key={o.label} className={c.concern === o.label ? "on" : ""}><input type="radio" name="concern" value={o.label} checked={c.concern === o.label}
            onChange={() => { c.setConcern(o.label); if ((o as any).partner) c.setP2(true); }} /><span>{o.icon}</span>{o.label === "Other" && x.other ? "Other (khud likhein)" : o.label}</label>))}
      </div>
      {c.concern === "Other" && x.other && <><input className="rf-in" name="concernOther" defaultValue={r.concernOther} placeholder={ph || `Apni wajah likhein (max ${x.maxWords || MAX_WORDS} shabd)`} style={{ marginTop: 10 }} /><Count c={c} n="concernOther" /></>}
    </div>;
    case "person": return <Person x={x} c={c} />;
  }
  return null;
}

/** One step: heading, intro, fields (half-width fields next to each other sit in a 2-column grid). */
export function StepFields({ step, c }: { step: FormStep; c: FieldCtx }) {
  const out: ReactNode[] = [];
  let half: FormField[] = [];
  const flush = () => { if (half.length) out.push(<div key={"g" + out.length} className="rf-2">{half.map((x) => <FieldView key={x.id} x={x} c={c} />)}</div>); half = []; };
  for (const x of step.fields) { if (x.hidden) continue; if (x.half) half.push(x); else { flush(); out.push(<FieldView key={x.id} x={x} c={c} />); } }
  flush();
  const persons = step.fields.some((x) => x.type === "person" && !x.hidden), star = step.fields.some((x) => !x.hidden && x.required && !x.label);
  const note = persons && c.partner ? "(partner zaroori)" : step.note;
  return <>
    {step.heading && <h2 className="rf-sec first">{step.heading}{star && <b> *</b>}{note && <> <small>{note}</small></>}</h2>}
    {(step.intro || persons) && <p className="rf-hint">{md(step.intro)}{persons && <>{step.intro ? " " : ""}{c.partner ? "Aapki wajah partner ke baare mein hai, isliye partner ka naam aur photo zaroori hai. Third person optional hai." : "Nahi chahiye toh seedha Submit dabayein."}</>}</p>}
    {out}
  </>;
}
