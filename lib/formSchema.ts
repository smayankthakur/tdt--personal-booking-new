/**
 * Reading form layout — editable in /admin → "Form Builder" (Firestore config/form), with these defaults.
 * Shared by the form page (client), /api/form (server) and the admin editor, so the fields, limits and
 * validation messages come from ONE place.
 *
 * Three forms: written (email readings), questions (3-question + video calls), voice (40-min calls).
 * Built-in fields (system: true) keep fixed ids/answer names because the backend uses them (name → booking
 * name, email → OTP + delivery, lang → mails, concern → partner rule, p2/p3 → other people, q → questions).
 * They can be edited and hidden, not deleted. Fields the admin adds get ids "c_xxxx" and can be deleted.
 */
import { CONCERNS, PARTNER_CONCERNS, VIDEO_MAX_Q, VIDEO_Q_CHARS, VIDEO_TOPICS } from "./concerns";
import { ISSUE_WORDS, MAX_WORDS, wordCount } from "./words";
import { LANGUAGES, isQuestionTier, isWrittenTier } from "./slots";

export type FormKind = "written" | "questions" | "voice";
export const FORM_KINDS: FormKind[] = ["written", "questions", "voice"];
export const FORM_KIND_NAME: Record<FormKind, string> = {
  written: "✍️ Written readings (email)",
  questions: "❓ 3-Question / Video call",
  voice: "🎧 Voice call (40 min)",
};
export const FORM_KIND_USE: Record<FormKind, string> = {
  written: "Personal Reading by Bharti Singh (₹5,500) aur Urgent (48 ghante) — jawab email par.",
  questions: "3 Question Voice Reading (normal + urgent) aur Video Call reading.",
  voice: "Voice Reading (40 min) aur Urgent voice reading.",
};
export const kindOf = (tier: unknown): FormKind => (isWrittenTier(tier) ? "written" : isQuestionTier(tier) ? "questions" : "voice");

export type FieldType =
  | "text" | "textarea" | "phone" | "number" | "date" | "time" | "photo" | "choice" | "select" | "checkbox" | "info" // admin can add these
  | "email" | "questions" | "concern" | "person"; // built-in only
export const ADDABLE: { type: FieldType; name: string }[] = [
  { type: "text", name: "Short text" }, { type: "textarea", name: "Long text (paragraph)" }, { type: "choice", name: "Choice (buttons — ek chunein)" },
  { type: "select", name: "Dropdown" }, { type: "checkbox", name: "Checkbox (haan / tick)" }, { type: "number", name: "Number" },
  { type: "phone", name: "Phone number" }, { type: "date", name: "Date" }, { type: "time", name: "Time (clock)" },
  { type: "photo", name: "Photo upload" }, { type: "info", name: "Sirf text / instruction (koi input nahi)" },
];
export const TYPE_NAME: Record<FieldType, string> = {
  ...(Object.fromEntries(ADDABLE.map((a) => [a.type, a.name])) as Record<FieldType, string>),
  email: "Email (OTP verify)", questions: "Sawal (questions block)", concern: "Reading ki wajah (concern)", person: "Doosra vyakti (person)",
};

export type Opt = { label: string; icon?: string; partner?: boolean };
export type FormField = {
  id: string; type: FieldType; label: string;
  hint?: string; placeholder?: string; error?: string;
  required?: boolean; hidden?: boolean; half?: boolean;
  maxWords?: number; maxChars?: number;
  options?: Opt[];   // choice / select / concern; questions → topics
  other?: boolean;   // concern: "Other (khud likhein)" option
  count?: number;    // questions: number of question boxes
  key?: string;      // name in mails / admin answers (built-in fields keep their old names); default = label
  system?: boolean;
};
export type FormStep = { id: string; title: string; heading: string; note?: string; intro?: string; fields: FormField[] };
export type FormDef = { title: string; steps: FormStep[] };
export type FormsConfig = Record<FormKind, FormDef>;

export const MAX_PHOTOS = 4; // upload limit per request (~4.5 MB on Vercel; photos are compressed to ~200–500 KB)
export const PARTNER_ID = "p2";
export const personNo = (id: string) => (id === "p3" ? "3" : "2");

// ---------- defaults (= the form as it was before the builder) ----------
const opt = (label: string, icon?: string, partner?: boolean): Opt => ({ label, ...(icon ? { icon } : {}), ...(partner ? { partner } : {}) });
const TOPICS = VIDEO_TOPICS.map((t) => opt(t, t === "Love life" ? "❤️" : t === "Career" ? "💼" : "🧭"));
function aboutYou(written: boolean): FormStep {
  return {
    id: "s1", title: "Aap", heading: "Aapki Details", fields: [
      { id: "name", type: "text", label: "Full Name with Surname", hint: "Pura naam likhein", required: true, half: true, maxWords: MAX_WORDS, error: "Apna poora naam likhein.", key: "Full name", system: true },
      { id: "phone", type: "phone", label: "WhatsApp Number", hint: written ? "Zaroorat padne par contact isi number par hoga." : "Reading ke liye contact isi number par hoga.", required: true, half: true, error: "Sahi WhatsApp number likhein.", key: "WhatsApp", system: true },
      { id: "email", type: "email", label: "Email ID", hint: written ? "Aapke sawalon ke jawab isi email par aayenge. Email OTP se verify karein." : "Google Meet link aur schedule isi email par aayega. Email OTP se verify karein.", required: true, half: true, key: "Email (payment)", system: true },
      { id: "place", type: "text", label: "Place of Birth", hint: "Jis shehar mein janm hua.", placeholder: "Jaise Mumbai, Jaipur, Delhi", required: true, half: true, maxWords: MAX_WORDS, error: "Place of Birth likhein.", key: "Place of birth", system: true },
      { id: "dob", type: "date", label: "Date of Birth", hint: "Pata ho toh chunein, warna skip.", half: true, key: "Date of birth (D/M/Y)", system: true },
      { id: "tob", type: "time", label: "Birth Time", hint: "Pata ho toh clock se chunein, warna skip.", half: true, key: "Birth time", system: true },
      { id: "photo1", type: "photo", label: "Your One Clear Photo", hint: "Face reading analysis ke liye.", required: true, error: "Apni ek clear photo upload karein.", key: "Photo", system: true },
    ],
  };
}
const questionsField = (): FormField => ({
  id: "q", type: "questions", label: "Sawal", placeholder: "Jaise: Kya meri shaadi is saal hogi?", required: true, count: VIDEO_MAX_Q, maxChars: VIDEO_Q_CHARS,
  options: TOPICS, error: "Kam se kam ek sawal likhein.", key: "Sawal", system: true,
});
export const DEFAULT_FORMS: FormsConfig = {
  written: {
    title: "Personal Reading Form",
    steps: [aboutYou(true), {
      id: "s2", title: "Sawal", heading: "Aapke Sawal", note: `(max ${VIDEO_MAX_Q})`, fields: [
        { id: "lang", type: "choice", label: "Jawab kis bhasha mein chahiye?", required: true, options: LANGUAGES.map((l) => opt(l)), error: "Jawab kis bhasha mein chahiye — Hindi, Hinglish ya English chunein.", key: "Language", system: true },
        { id: "qinfo", type: "info", label: `**Sirf aapki** reading hogi. Apne ${VIDEO_MAX_Q} sawal likhein — har sawal ${VIDEO_Q_CHARS} characters tak. Pehla sawal zaroori hai. **Make sure to ask specific questions** — jaise "Kya meri shaadi 2027 mein hogi?" (sirf "Meri shaadi?" nahi). Jitna clear sawal, utna clear jawab.`, system: true },
        questionsField(),
        { id: "issue", type: "textarea", label: "Explain your issues related to your questions", hint: "Apne sawalon se judi problem ya situation thoda detail mein likhein — kya ho raha hai, kab se, kis baare mein confusion hai. Isse jawab zyada sateek milega.", placeholder: `Jaise: 2 saal se rishta chal raha hai, ghar wale nahi maan rahe, isliye shaadi ko lekar confusion hai… (max ${ISSUE_WORDS} shabd)`, required: true, maxWords: ISSUE_WORDS, error: "Apne sawalon se judi problem / situation thoda explain karein.", key: "Issue (explained)", system: true },
      ],
    }],
  },
  questions: {
    title: "Personal Reading Form",
    steps: [aboutYou(false), {
      id: "s2", title: "Sawal", heading: "Aapke Sawal", note: `(max ${VIDEO_MAX_Q})`, fields: [
        { id: "qinfo", type: "info", label: `Is call mein **sirf aapki** reading hogi. Apne ${VIDEO_MAX_Q} sawal likhein — har sawal ${VIDEO_Q_CHARS} characters tak. Pehla sawal zaroori hai.`, system: true },
        questionsField(),
      ],
    }],
  },
  voice: {
    title: "Personal Reading Form",
    steps: [aboutYou(false), {
      id: "s2", title: "Wajah", heading: "Reading Book Karne Ki Wajah", fields: [
        { id: "concern", type: "concern", label: "", required: true, other: true, maxWords: MAX_WORDS, placeholder: `Apni wajah likhein (max ${MAX_WORDS} shabd)`,
          options: CONCERNS.map(([ic, c]) => opt(c, ic, PARTNER_CONCERNS.includes(c))), error: "Reading ki wajah chunein.", key: "Concern", system: true },
        { id: "notes", type: "textarea", label: "Kuch aur batana chahte hain? (optional)", placeholder: `Jaise: date/time ka koi hissa pata nahi, ya kuch aur. (max ${MAX_WORDS} shabd)`, maxWords: MAX_WORDS, key: "Anything else", system: true },
      ],
    }, {
      id: "s3", title: "Doosre log", heading: "Kisi Aur Ke Baare Mein?", note: "(optional)", intro: "Sirf unhi logon ki reading hogi jinki details yahan doge.", fields: [
        { id: "p2", type: "person", label: "Second Person / Partner", hint: "Optional — love life ya family ke liye", system: true },
        { id: "p3", type: "person", label: "Third Person / Third Party", hint: "Optional — love life ya family ke liye", system: true },
      ],
    }],
  },
};
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export const defaultForm = (k: FormKind): FormDef => clone(DEFAULT_FORMS[k]);

/** Saved layout + any built-in field that is missing (e.g. added to the code later) put back where the default has it. */
export function withSystem(k: FormKind, saved?: FormDef | null): FormDef {
  if (!saved?.steps?.length) return defaultForm(k);
  const d = defaultForm(k), f = clone(saved), have = new Set(f.steps.flatMap((s) => s.fields.map((x) => x.id)));
  d.steps.forEach((ds, i) => ds.fields.forEach((x) => { if (x.system && !have.has(x.id)) (f.steps[i] || f.steps[f.steps.length - 1]).fields.push(x); }));
  return f;
}

// ---------- helpers ----------
export const visibleSteps = (def: FormDef) => def.steps.map((s) => ({ ...s, fields: s.fields.filter((x) => !x.hidden) })).filter((s) => s.fields.length);
export const allFields = (def: FormDef) => def.steps.flatMap((s) => s.fields);
export const answerKey = (x: FormField) => x.key || x.label.replace(/\*\*/g, "").trim() || x.id;
export const findField = (def: FormDef, id: string) => allFields(def).find((x) => x.id === id && !x.hidden);
export const partnerConcern = (def: FormDef, concern: string) => !!findField(def, "concern")?.options?.some((o) => o.partner && o.label === concern);
/** Form-field names that carry text with a word / character limit (for the live counter and the server check). */
export function limits(def: FormDef) {
  const m: Record<string, { words?: number; chars?: number }> = {};
  for (const x of allFields(def)) {
    if (x.hidden) continue;
    if ((x.type === "text" || x.type === "textarea") && (x.maxWords || x.maxChars)) m[x.id] = { words: x.maxWords, chars: x.maxChars };
    if (x.type === "concern" && x.maxWords) m.concernOther = { words: x.maxWords };
    if (x.type === "person") { const n = personNo(x.id); m["name" + n] = m["place" + n] = { words: MAX_WORDS }; }
    if (x.type === "questions") for (let i = 1; i <= (x.count || 1); i++) m["q" + i] = { chars: x.maxChars || VIDEO_Q_CHARS };
  }
  return m;
}
export const textLimit = (def: FormDef, id: string) => (allFields(def).some((x) => x.id === id && x.type === "textarea") || id === "notes" || id === "issue" ? 2000 : 300);

/** What a check needs to read the form — FormData on the server, the DOM + photo store in the browser. */
/** The mobile app has its own (older) form: only what it always sends is required from it. */
const APP_REQUIRED = ["name", "phone", "email", "place", "photo1", "concern", "q", "lang"];
export type Reader = { str: (name: string) => string; file: (name: string) => boolean };
export type Ctx = { editing?: boolean; emailOk?: boolean; app?: boolean; hadPartner?: boolean; keepPhotos?: string[] };
const lbl = (x: FormField) => (x.label || x.key || "Yeh sawal").replace(/\*\*/g, "").replace(/\s*\((optional|zaroori)\)\s*$/i, "").trim();
const tobStr = (r: Reader, p: string) => (r.str(p + "h") ? `${r.str(p + "h")}:${r.str(p + "min") || "00"} ${r.str(p + "ap") || "AM"}` : "");
const dobStr = (r: Reader, p: string) => [r.str(p + "d"), r.str(p + "m"), r.str(p + "y")].filter(Boolean).join(" / ");
/** Question block answers: [{ i, topic, text }] for the filled boxes. */
export function questionsOf(x: FormField, r: Reader) {
  const out: { i: number; topic: string; text: string }[] = [];
  for (let i = 1; i <= (x.count || 1); i++) { const text = r.str("q" + i); if (text) out.push({ i, topic: r.str("qt" + i), text }); }
  return out;
}

/** First problem in one field, or "" — same messages in the browser and on the server. */
export function checkField(x: FormField, r: Reader, c: Ctx, def: FormDef): string {
  if (x.hidden || x.type === "info") return "";
  // Mobile app has its own form: only the built-in rules apply to it (fields added here can't be sent from it).
  const need = !!x.required && (!c.app || APP_REQUIRED.includes(x.id));
  const L = lbl(x), err = x.error;
  switch (x.type) {
    case "email": return c.emailOk === false ? "Apni email OTP se verify karein." : "";
    case "text": case "textarea": case "number": {
      const v = r.str(x.id);
      if (need && !v) return err || `${L} — yeh bharna zaroori hai.`;
      if (x.maxWords && wordCount(v) > x.maxWords) return `${L}: ${x.maxWords} shabdon tak hi likh sakte hain — chhota karke dobara bhejein.`;
      if (x.maxChars && v.length > x.maxChars) return `${L}: ${x.maxChars} characters tak hi likh sakte hain.`;
      if (x.type === "number" && v && !/^-?\d+(\.\d+)?$/.test(v)) return `${L}: sirf number likhein.`;
      return "";
    }
    case "phone": { const v = r.str(x.id), d = v.replace(/\D/g, "").length; return (need && !v) || (v && d < 10) || d > 15 ? err || `Sahi ${L} likhein.` : ""; }
    case "choice": case "select": {
      const v = r.str(x.id), ok = (x.options || []).some((o) => o.label === v);
      return (need && !v) || (v && !ok) ? err || `${L} — ek option chunein.` : "";
    }
    case "checkbox": return need && !r.str(x.id) ? err || `${L} — tick karna zaroori hai.` : "";
    case "date": return need && !(r.str(x.id + "d") && r.str(x.id + "m") && r.str(x.id + "y")) ? err || `${L} chunein.` : "";
    case "time": return need && !r.str(x.id + "h") ? err || `${L} chunein.` : "";
    case "photo": return need && !c.editing && !r.file(x.id) && !c.keepPhotos?.includes(x.id) ? err || `${L} upload karein.` : "";
    case "questions": {
      const qs = questionsOf(x, r), topics = (x.options || []).map((o) => o.label);
      if (need && !qs.length) return err || "Kam se kam ek sawal likhein.";
      const long = qs.find((q) => q.text.length > (x.maxChars || VIDEO_Q_CHARS));
      if (long) return `Har sawal ${x.maxChars || VIDEO_Q_CHARS} characters tak hi ho sakta hai (sawal ${long.i}).`;
      const noTopic = topics.length ? qs.find((q) => !topics.includes(q.topic)) : undefined;
      if (noTopic) return `Sawal ${noTopic.i} ka topic chunein — ${topics.join(", ")}.`;
      return "";
    }
    case "concern": {
      const v = r.str("concern"), ok = (x.options || []).some((o) => o.label === v) || (x.other && v === "Other");
      if ((need && !v) || (v && !ok) || (v === "Other" && !r.str("concernOther"))) return err || "Reading ki wajah chunein.";
      if (v === "Other" && x.maxWords && wordCount(r.str("concernOther")) > x.maxWords) return `Wajah ${x.maxWords} shabdon tak hi likh sakte hain.`;
      return "";
    }
    case "person": {
      const n = personNo(x.id);
      for (const k of ["name" + n, "place" + n]) if (wordCount(r.str(k)) > MAX_WORDS) return `Har jawab ${MAX_WORDS} shabdon tak hi likh sakte hain — chhota karke dobara bhejein.`;
      if (x.id !== PARTNER_ID || !partnerConcern(def, r.str("concern"))) return "";
      if (!r.str("name2")) return "Partner ka naam likhein.";
      if (!r.file("photo2") && !c.hadPartner) return "Partner ki ek clear photo upload karein.";
      return "";
    }
  }
  return "";
}
export function checkStep(step: FormStep, r: Reader, c: Ctx, def: FormDef) {
  for (const x of step.fields) { const e = checkField(x, r, c, def); if (e) return e; }
  return "";
}
export const checkForm = (def: FormDef, r: Reader, c: Ctx) => { for (const s of def.steps) { const e = checkStep(s, r, c, def); if (e) return e; } return ""; };

/** Readable answers (mail + admin) in form order. Built-in fields keep their old names. */
export function answersOf(def: FormDef, r: Reader, extra: { verified: string; concern?: string }) {
  const a: Record<string, string> = {};
  for (const x of allFields(def)) {
    if (x.hidden && !(x.system && r.str(x.id))) continue; // a hidden built-in field still keeps what the app sends
    let k = answerKey(x);
    if (!x.system) for (let i = 2; k in a || ["Verified", "Concern", "Slot", "Booking type", "Deliver by", "Price paid", "Edited"].includes(k); i++) k = `${answerKey(x)} (${i})`; // never overwrite another answer
    switch (x.type) {
      case "info": case "photo": break;
      case "email": a[k] = r.str("email"); a["Verified"] = extra.verified; break;
      case "date": a[k] = dobStr(r, x.id); break;
      case "time": a[k] = tobStr(r, x.id); break;
      case "checkbox": a[k] = r.str(x.id) ? "Haan ✓" : ""; break;
      case "questions": for (const q of questionsOf(x, r)) a[`${x.key || "Sawal"} ${q.i}${q.topic ? ` (${q.topic})` : ""}`] = q.text; break;
      case "concern": { const v = r.str("concern"); a[k] = v === "Other" ? `Other: ${r.str("concernOther")}` : v; break; }
      case "person": {
        const n = personNo(x.id), o = n === "2" ? "2nd" : "3rd";
        a[`${o} person name`] = r.str("name" + n); a[`${o} DOB`] = dobStr(r, "dob" + n); a[`${o} birth time`] = tobStr(r, "tob" + n); a[`${o} place`] = r.str("place" + n);
        break;
      }
      default: a[k] = r.str(x.id);
    }
  }
  if (extra.concern !== undefined && !("Concern" in a)) a["Concern"] = extra.concern;
  return a;
}
/** Photo fields that are on the form (built-in person photos included), in order. */
export function photoFields(def: FormDef) {
  const out: { name: string; who: string }[] = [];
  for (const x of allFields(def)) {
    if (x.hidden) continue;
    if (x.type === "photo") out.push({ name: x.id, who: x.id === "photo1" ? "you" : x.id.replace(/[^a-z0-9]/gi, "") });
    if (x.type === "person") out.push({ name: "photo" + personNo(x.id), who: x.id === "p3" ? "third-person" : "second-person" });
  }
  return out;
}

// ---------- admin save: clean + check a layout ----------
const T = (v: unknown, n: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, n);
const N = (v: unknown, lo: number, hi: number) => { const n = Math.round(Number(v)); return n >= lo && n <= hi ? n : undefined; };
export const CUSTOM_ID = /^c_[a-z0-9]{4,12}$/;
export function cleanForm(k: FormKind, raw: any): { def?: FormDef; error?: string } {
  const d = defaultForm(k), sys = new Map(allFields(d).map((x) => [x.id, x]));
  if (!raw || !Array.isArray(raw.steps) || !raw.steps.length) return { error: "Form mein kam se kam ek step hona chahiye." };
  if (raw.steps.length > 6) return { error: "Zyada se zyada 6 steps ho sakte hain." };
  const seen = new Set<string>(), steps: FormStep[] = [];
  let photos = 0;
  for (const [si, s] of raw.steps.entries()) {
    const title = T(s?.title, 24), heading = T(s?.heading, 120);
    if (!title) return { error: `Step ${si + 1} ka naam (stepper par dikhne wala) likhein.` };
    if (!Array.isArray(s.fields) || s.fields.length > 40) return { error: `Step ${si + 1} mein fields sahi nahi hain.` };
    const fields: FormField[] = [];
    for (const f of s.fields) {
      const id = String(f?.id || ""), base = sys.get(id);
      if (seen.has(id)) return { error: `Field "${id}" do baar hai.` };
      if (!base && !CUSTOM_ID.test(id)) return { error: `Field id "${id}" sahi nahi hai.` };
      const type: FieldType = base ? base.type : f.type;
      if (!base && !ADDABLE.some((a) => a.type === type)) return { error: `Field type "${type}" nahi chalega.` };
      seen.add(id);
      const x: FormField = { id, type, label: T(f.label, type === "info" ? 1500 : 200) };
      if (!x.label && type !== "concern") return { error: `Step ${si + 1}: har field ka label / text likhein.` };
      for (const p of ["hint", "placeholder", "error"] as const) { const v = T(f[p], 400); if (v) x[p] = v; }
      if (type !== "info" && type !== "person" && f.required) x.required = true;
      if (f.hidden) x.hidden = true;
      if (f.half) x.half = true;
      if (type === "text" || type === "textarea" || type === "concern") { const w = N(f.maxWords, 1, 500); if (w) x.maxWords = w; }
      if (type === "text" || type === "textarea") { const c = N(f.maxChars, 10, 2000); if (c) x.maxChars = c; }
      if (type === "questions") { x.count = N(f.count, 1, 5) || 3; x.maxChars = N(f.maxChars, 10, 1000) || VIDEO_Q_CHARS; }
      if (["choice", "select", "concern", "questions"].includes(type)) {
        const opts: Opt[] = (Array.isArray(f.options) ? f.options : []).map((o: any) => ({ label: T(o?.label, 120), icon: T(o?.icon, 8), partner: !!o?.partner }))
          .filter((o: Opt) => o.label).slice(0, 40).map((o: Opt) => opt(o.label, o.icon, type === "concern" && o.partner));
        if (new Set(opts.map((o) => o.label)).size !== opts.length) return { error: `"${x.label || TYPE_NAME[type]}": do options ka naam same hai.` };
        if (type !== "questions" && !opts.length) return { error: `"${x.label || TYPE_NAME[type]}": kam se kam ek option likhein.` };
        x.options = opts;
      }
      if (type === "concern" && f.other) x.other = true;
      if (base) { x.system = true; if (base.key) x.key = base.key; }
      if (type === "email") { x.required = true; delete x.hidden; } // email: needed for the OTP and to send the reading
      if (!x.hidden && (type === "photo" || type === "person")) photos++;
      fields.push(x);
    }
    steps.push({ id: T(s.id, 20) || `s${si + 1}`, title, heading, ...(T(s.note, 60) ? { note: T(s.note, 60) } : {}), ...(T(s.intro, 600) ? { intro: T(s.intro, 600) } : {}), fields });
  }
  const missing = Array.from(sys.keys()).filter((id) => !seen.has(id));
  if (missing.length) return { error: `Built-in field delete nahi ho sakte (sirf hide): ${missing.join(", ")}` };
  if (photos > MAX_PHOTOS) return { error: `Ek form mein zyada se zyada ${MAX_PHOTOS} photo upload ho sakti hain (doosre log ki photo bhi gini jaati hai). Koi photo field hide karein.` };
  if (!steps.some((s) => s.fields.some((x) => !x.hidden && x.type !== "info"))) return { error: "Form mein kam se kam ek sawal dikhna chahiye." };
  return { def: { title: T(raw.title, 80) || d.title, steps } };
}
