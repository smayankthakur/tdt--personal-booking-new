"use client";
import { useEffect, useState } from "react";
import { StepFields, type FieldCtx } from "@/components/form/Fields";
import {
  ADDABLE, FORM_KINDS, FORM_KIND_NAME, FORM_KIND_USE, MAX_PHOTOS, TYPE_NAME, limits, partnerConcern, visibleSteps,
  type FieldType, type FormDef, type FormField, type FormKind, type FormStep, type Opt,
} from "@/lib/formSchema";
import { type Api } from "./ui";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const ICON: Partial<Record<FieldType, string>> = {
  text: "🔤", textarea: "📝", phone: "📞", number: "🔢", date: "📅", time: "🕒", photo: "📷", choice: "🔘", select: "🔽", checkbox: "☑️",
  info: "ℹ️", email: "✉️", questions: "❓", concern: "🎯", person: "👥",
};
const plain = (s: string) => s.replace(/\*\*/g, "");
const rid = () => "c_" + Math.random().toString(36).slice(2, 8).padEnd(6, "0");
const optsToText = (o: Opt[] = [], concern = false) => o.map((x) => (x.icon || (concern && x.partner) ? `${x.icon || ""} | ${x.label}${x.partner ? " | partner" : ""}` : x.label)).join("\n");
const textToOpts = (t: string): Opt[] => t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
  const p = l.split("|").map((s) => s.trim());
  if (p.length === 1) return { label: p[0] };
  return { icon: p[0] || undefined, label: p[1] || "", ...(/partner/i.test(p[2] || "") ? { partner: true } : {}) };
}).filter((o) => o.label);
const has = (t: FieldType, ...list: FieldType[]) => list.includes(t);

function newField(type: FieldType): FormField {
  const x: FormField = { id: rid(), type, label: type === "info" ? "Yahan apni instruction likhein. **Bold** ke liye do star lagayein." : type === "checkbox" ? "Main is baat se sahmat hoon" : "Naya sawal" };
  if (has(type, "choice", "select")) x.options = [{ label: "Option 1" }, { label: "Option 2" }];
  if (type === "textarea") x.maxWords = 100;
  return x;
}

/** Live preview: the real form fields (all steps one below the other), on the site's dark background. */
function Preview({ def }: { def: FormDef }) {
  const [concern, setConcern] = useState(""), [p2, setP2] = useState(false), [p3, setP3] = useState(false), [words, setWords] = useState<Record<string, number>>({});
  const lim = limits(def), steps = visibleSteps(def);
  const c: FieldCtx = { raw: {}, editing: false, preview: true, bk: null, words, limits: lim, concern, setConcern, p2, p3, setP2, setP3, partner: partnerConcern(def, concern) };
  return (
    <div className="fb-preview" onInput={(e) => { const t = e.target as HTMLInputElement, l = lim[t.name]; if (l) setWords((w) => ({ ...w, [t.name]: l.words ? (t.value.trim().match(/\S+/g) || []).length : t.value.length })); }}>
      <div className="rf-card">
        <div className="rf-badge">✓ Payment received · Preview</div>
        <h1>{def.title || "Personal Reading Form"}</h1>
        {steps.map((s, i) => <div key={s.id} className="fb-pstep"><div className="fb-pstep-tag">Step {i + 1} · {s.title}</div><StepFields step={s} c={c} /></div>)}
        <div className="rf-nav"><button type="button" className="btn gold" style={{ marginLeft: "auto" }} disabled>Submit &amp; Confirm ✦</button></div>
      </div>
    </div>);
}

function FieldEditor({ x, set }: { x: FormField; set: (p: Partial<FormField>) => void }) {
  const t = x.type, num = (v: string) => (v === "" ? undefined : Math.max(0, Math.round(Number(v))) || undefined);
  return (
    <div className="fb-edit">
      <table className="wpa-form-table"><tbody>
        <tr><th>{t === "info" ? "Text" : "Label (sawal)"}</th><td>
          {t === "info" ? <textarea className="wpa-textarea" rows={4} value={x.label} onChange={(e) => set({ label: e.target.value })} />
            : <input className="wide" value={x.label} onChange={(e) => set({ label: e.target.value })} placeholder={t === "concern" ? "(khaali chhod sakte hain — step ki heading dikhegi)" : ""} />}
          {t === "info" && <p className="description">**do star ke beech** likha text bold dikhega. Nayi line = nayi line.</p>}
        </td></tr>
        {t !== "info" && <tr><th>{t === "person" ? "Chhota text (neeche)" : "Hint (chhota text)"}</th><td><textarea className="wpa-textarea" rows={2} value={x.hint || ""} onChange={(e) => set({ hint: e.target.value })} /></td></tr>}
        {has(t, "text", "textarea", "number", "phone", "select", "questions", "concern") && <tr><th>{t === "questions" ? "Placeholder (sawal 1)" : t === "concern" ? "Placeholder (Other)" : t === "select" ? "Pehli line (— Chunein —)" : "Placeholder"}</th><td><input className="wide" value={x.placeholder || ""} onChange={(e) => set({ placeholder: e.target.value })} /></td></tr>}
        {!has(t, "info", "person") && <tr><th>Zaroori (*)</th><td>
          {t === "email" ? <span className="wpa-muted">Hamesha zaroori — OTP verify aur jawab isi email par jaate hain.</span>
            : <label className={`wpa-toggle${x.required ? " on" : ""}`}><input type="checkbox" checked={!!x.required} onChange={(e) => set({ required: e.target.checked })} /><span />{x.required ? "Haan, zaroori" : "Optional"}</label>}
          {t === "questions" && <p className="description">Zaroori = kam se kam pehla sawal bharna padega.</p>}
        </td></tr>}
        {!has(t, "info", "person", "email", "questions", "concern") && x.required && <tr><th>Error message</th><td><input className="wide" value={x.error || ""} onChange={(e) => set({ error: e.target.value })} placeholder="Khaali chhodne par apne aap banega" /></td></tr>}
        {has(t, "text", "textarea", "concern") && <tr><th>{t === "concern" ? "Max shabd (Other)" : "Max shabd"}</th><td><input type="number" min={1} max={500} value={x.maxWords ?? ""} onChange={(e) => set({ maxWords: num(e.target.value) })} /> <span className="wpa-muted">khaali = koi limit nahi</span></td></tr>}
        {has(t, "text", "textarea", "questions") && <tr><th>{t === "questions" ? "Har sawal max characters" : "Max characters"}</th><td><input type="number" min={10} max={2000} value={x.maxChars ?? ""} onChange={(e) => set({ maxChars: num(e.target.value) })} /></td></tr>}
        {t === "questions" && <tr><th>Kitne sawal</th><td><select value={x.count || 3} onChange={(e) => set({ count: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></td></tr>}
        {has(t, "choice", "select", "concern", "questions") && <tr><th>{t === "questions" ? "Topics (har sawal ke saath)" : "Options"}</th><td>
          <textarea key={x.id} className="wpa-textarea" rows={Math.min(14, Math.max(3, (x.options || []).length + 1))} defaultValue={optsToText(x.options, t === "concern")} onChange={(e) => set({ options: textToOpts(e.target.value) })} />
          <p className="description">Ek line = ek option. Emoji ke saath: <code>💼 | Career</code>.{t === "concern" && <> Partner ki details zaroori karni ho toh: <code>💭 | Partner ki feelings | partner</code>.</>}{t === "questions" && " Khaali = topic nahi poocha jayega."}</p>
        </td></tr>}
        {t === "concern" && <tr><th>&quot;Other&quot; option</th><td><label><input type="checkbox" checked={!!x.other} onChange={(e) => set({ other: e.target.checked })} /> Customer apni wajah khud likh sake</label></td></tr>}
        {!has(t, "info", "person", "questions", "concern") && <tr><th>Aadhi width</th><td><label><input type="checkbox" checked={!!x.half} onChange={(e) => set({ half: e.target.checked })} /> Computer par do fields ek line mein (mobile par poori width)</label></td></tr>}
        {x.system && <tr><th>Built-in</th><td className="wpa-muted">Yeh field system use karta hai{x.key ? <> (mail / admin mein naam: <b>{x.key}</b>)</> : ""} — delete nahi ho sakta, sirf hide.</td></tr>}
      </tbody></table>
    </div>);
}

export default function FormBuilder({ api, onNote }: { api: Api; onNote: (m: string) => void }) {
  const [all, setAll] = useState<Record<FormKind, FormDef> | null>(null), [custom, setCustom] = useState<Record<string, boolean>>({});
  const [kind, setKind] = useState<FormKind>("written"), [d, setD] = useState<FormDef | null>(null), [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(""), [addType, setAddType] = useState<Record<string, FieldType>>({}), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const take = (j: any, k = kind) => { if (j.forms) { setAll(j.forms); setCustom(j.custom || {}); setD(clone(j.forms[k])); setDirty(false); } };
  useEffect(() => { api("/api/admin/form").then((j) => (j.error ? setErr(j.error) : take(j))); }, []);
  useEffect(() => { // warn before leaving the page with unsaved changes
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
  if (err) return <div className="wpa-notice error"><p>{err}</p></div>;
  if (!all || !d) return <p>Load ho raha hai…</p>;

  const pick = (k: FormKind) => {
    if (k === kind) return;
    if (dirty && !confirm("Is form ke changes save nahi hue. Chhod kar doosra form kholein?")) return;
    setKind(k); setD(clone(all[k])); setDirty(false); setOpen(""); setErr("");
  };
  const upd = (fn: (x: FormDef) => void) => { const n = clone(d); fn(n); setD(n); setDirty(true); };
  const setField = (si: number, fi: number, p: Partial<FormField>) => upd((n) => { n.steps[si].fields[fi] = { ...n.steps[si].fields[fi], ...p }; });
  const setStep = (si: number, p: Partial<FormStep>) => upd((n) => { n.steps[si] = { ...n.steps[si], ...p }; });
  const move = (si: number, fi: number, dir: -1 | 1) => upd((n) => {
    const f = n.steps[si].fields, j = fi + dir;
    if (j >= 0 && j < f.length) { [f[fi], f[j]] = [f[j], f[fi]]; return; }
    const sj = si + dir; if (sj < 0 || sj >= n.steps.length) return; // past the end of the step → next / previous step
    const [x] = f.splice(fi, 1); if (dir > 0) n.steps[sj].fields.unshift(x); else n.steps[sj].fields.push(x);
  });
  const toStep = (si: number, fi: number, sj: number) => upd((n) => { const [x] = n.steps[si].fields.splice(fi, 1); n.steps[sj].fields.push(x); });
  const del = (si: number, fi: number) => { const x = d.steps[si].fields[fi]; if (confirm(`"${plain(x.label) || TYPE_NAME[x.type]}" field delete karein?`)) upd((n) => { n.steps[si].fields.splice(fi, 1); }); };
  const add = (si: number) => { const x = newField(addType[d.steps[si].id] || "text"); upd((n) => { n.steps[si].fields.push(x); }); setOpen(x.id); };
  const addStep = () => upd((n) => { n.steps.push({ id: "s" + Date.now().toString(36), title: "Naya step", heading: "Naya Step", fields: [] }); });
  const moveStep = (si: number, dir: -1 | 1) => upd((n) => { const j = si + dir; if (j >= 0 && j < n.steps.length) [n.steps[si], n.steps[j]] = [n.steps[j], n.steps[si]]; });
  const delStep = (si: number) => upd((n) => { n.steps.splice(si, 1); });
  const photos = d.steps.flatMap((s) => s.fields).filter((x) => !x.hidden && (x.type === "photo" || x.type === "person")).length;

  const save = async () => {
    setBusy(true); setErr("");
    const j = await api("/api/admin/form", "PUT", { kind, def: d });
    setBusy(false);
    if (j.ok) { take(j); onNote(`Form save ho gaya ✓ — ${FORM_KIND_NAME[kind]} ab naye customers ko aise dikhega.`); } else setErr(j.error || "Save nahi hua");
  };
  const reset = async () => {
    if (!confirm(`${FORM_KIND_NAME[kind]} ko default (shuru wale) form par wapas karein? Aapke saare changes hat jayenge.`)) return;
    setBusy(true); const j = await api(`/api/admin/form?kind=${kind}`, "DELETE"); setBusy(false);
    if (j.ok) { take(j); setOpen(""); onNote("Form default par reset ho gaya ✓"); } else setErr(j.error || "Reset nahi hua");
  };

  return (<>
    <ul className="wpa-subsubsub">
      {FORM_KINDS.map((k) => <li key={k}>{k === kind ? <b>{FORM_KIND_NAME[k]}</b> : <a onClick={() => pick(k)}>{FORM_KIND_NAME[k]}</a>}{custom[k] && <span className="wpa-muted"> (badla hua)</span>}</li>)}
    </ul>
    <p className="description" style={{ marginTop: 0 }}>Yeh form in readings ke liye hai: {FORM_KIND_USE[kind]} Changes sirf <b>Save</b> dabane ke baad naye forms par lagte hain — jo form pehle bhar chuke hain unke jawab waise hi rahenge.</p>
    {err && <div className="wpa-notice error"><p>{err}</p></div>}
    <div className="fb-bar">
      <button className="wpa-btn primary large" disabled={busy || !dirty} onClick={save}>{busy ? "Save ho raha hai…" : "💾 Save form"}</button>
      <button className="wpa-btn" disabled={busy || !dirty} onClick={() => { setD(clone(all[kind])); setDirty(false); setOpen(""); setErr(""); }}>Changes chhodein</button>
      {dirty ? <span className="wpa-status warn">Save nahi hua</span> : <span className="wpa-status ok">Saved</span>}
      <span style={{ marginLeft: "auto" }} />
      <button className="wpa-btn" disabled={busy} onClick={reset}>↺ Default form par wapas</button>
    </div>

    <div className="fb-cols">
      <div>
        <div className="wpa-postbox"><h2>Form ka naam</h2><div className="inside">
          <p><input className="wide" value={d.title} onChange={(e) => upd((n) => { n.title = e.target.value; })} /></p>
          <p className="description">Photo fields: {photos}/{MAX_PHOTOS} (doosre log wale section mein bhi ek photo hoti hai).</p>
        </div></div>

        {d.steps.map((s, si) => (
          <div key={s.id} className="wpa-postbox fb-step">
            <h2>Step {si + 1}: {s.title || "—"}
              <span className="fb-acts">
                <button className="wpa-btn" disabled={si === 0} onClick={() => moveStep(si, -1)} title="Step upar">↑</button>
                <button className="wpa-btn" disabled={si === d.steps.length - 1} onClick={() => moveStep(si, 1)} title="Step neeche">↓</button>
                {d.steps.length > 1 && <button className="wpa-btn" disabled={s.fields.length > 0} title={s.fields.length ? "Pehle is step ke fields doosre step mein bhejein" : "Step delete"} onClick={() => delStep(si)}>🗑</button>}
              </span>
            </h2>
            <div className="inside">
              <div className="fb-stephead">
                <label>Stepper par naam<input value={s.title} maxLength={24} onChange={(e) => setStep(si, { title: e.target.value })} /></label>
                <label>Heading<input value={s.heading} onChange={(e) => setStep(si, { heading: e.target.value })} /></label>
                <label>Heading ke saath chhota text<input value={s.note || ""} onChange={(e) => setStep(si, { note: e.target.value })} placeholder="jaise (max 3)" /></label>
                <label className="full">Upar ka text (optional)<textarea className="wpa-textarea" rows={2} value={s.intro || ""} onChange={(e) => setStep(si, { intro: e.target.value })} /></label>
              </div>

              {!s.fields.length && <p className="wpa-muted">Is step mein abhi koi field nahi. Neeche se add karein ya doosre step se bhejein.</p>}
              {s.fields.map((x, fi) => (
                <div key={x.id} className={`fb-field${x.hidden ? " off" : ""}${open === x.id ? " open" : ""}`}>
                  <div className="fb-row">
                    <span className="fb-ic" title={TYPE_NAME[x.type]}>{ICON[x.type]}</span>
                    <div className="fb-name">
                      <a onClick={() => setOpen(open === x.id ? "" : x.id)}><b>{plain(x.label).slice(0, 90) || <i>{TYPE_NAME[x.type]}</i>}</b></a>
                      <div className="fb-tags">
                        <span>{TYPE_NAME[x.type]}</span>
                        {x.required && !x.hidden && <span className="req">Zaroori</span>}
                        {x.hidden && <span className="hid">Hidden — form par nahi dikhega</span>}
                        {x.system && <span>Built-in</span>}
                        {x.type === "questions" && <span>{x.count || 3} sawal</span>}
                      </div>
                    </div>
                    <span className="fb-acts">
                      <button className="wpa-btn" onClick={() => move(si, fi, -1)} disabled={si === 0 && fi === 0} title="Upar">↑</button>
                      <button className="wpa-btn" onClick={() => move(si, fi, 1)} disabled={si === d.steps.length - 1 && fi === s.fields.length - 1} title="Neeche">↓</button>
                      <button className="wpa-btn" onClick={() => setOpen(open === x.id ? "" : x.id)}>{open === x.id ? "Band" : "✏️ Edit"}</button>
                      {x.type !== "email" && <button className="wpa-btn" onClick={() => setField(si, fi, { hidden: !x.hidden })}>{x.hidden ? "👁 Show" : "Hide"}</button>}
                      {!x.system && <button className="wpa-btn fb-del" onClick={() => del(si, fi)} title="Delete">🗑</button>}
                    </span>
                  </div>
                  {open === x.id && <>
                    <FieldEditor x={x} set={(p) => setField(si, fi, p)} />
                    {d.steps.length > 1 && <p className="fb-movestep">Doosre step mein bhejein: <select value={si} onChange={(e) => toStep(si, fi, Number(e.target.value))}>{d.steps.map((t, j) => <option key={t.id} value={j}>Step {j + 1}: {t.title}</option>)}</select></p>}
                  </>}
                </div>))}

              <div className="fb-add">
                <select value={addType[s.id] || "text"} onChange={(e) => setAddType({ ...addType, [s.id]: e.target.value as FieldType })}>
                  {ADDABLE.map((a) => <option key={a.type} value={a.type}>{ICON[a.type]} {a.name}</option>)}
                </select>
                <button className="wpa-btn" onClick={() => add(si)}>＋ Field add karein</button>
              </div>
            </div>
          </div>))}
        {d.steps.length < 6 && <p><button className="wpa-btn" onClick={addStep}>＋ Naya step add karein</button></p>}
        <p className="description">Built-in fields (naam, email, sawal, photo…) delete nahi hote kyunki booking system unhe use karta hai — unhe <b>Hide</b> karke form se hata sakte hain, aur kabhi bhi <b>Show</b> karke wapas la sakte hain. Aapke add kiye fields ke jawab Bharti ke form wale email aur Bookings mein usi label ke naam se dikhenge. Mobile app ka form alag hai — wahan naye fields nahi dikhte.</p>
      </div>

      <div className="fb-side">
        <div className="fb-side-head"><b>👀 Live preview</b> <span className="wpa-muted">— customer ko aisa dikhega (yahan submit nahi hota)</span></div>
        <Preview key={kind} def={d} />
      </div>
    </div>
  </>);
}
