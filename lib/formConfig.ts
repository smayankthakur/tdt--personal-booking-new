import { db } from "./db";
import { FORM_KINDS, withSystem, type FormDef, type FormKind, type FormsConfig } from "./formSchema";

/** Saved form layouts (admin → Form Builder). Missing form = the default from lib/formSchema. */
const DOC = "config/form";
let cache: { at: number; f: FormsConfig } | null = null;

export async function getForms(fresh = false): Promise<FormsConfig> {
  if (!fresh && cache && Date.now() - cache.at < 30_000) return cache.f;
  const d = (await db.doc(DOC).get()).data() as { forms?: Partial<Record<FormKind, FormDef>> } | undefined;
  const f = Object.fromEntries(FORM_KINDS.map((k) => [k, withSystem(k, d?.forms?.[k])])) as FormsConfig;
  cache = { at: Date.now(), f };
  return f;
}
export const getForm = async (k: FormKind, fresh = false) => (await getForms(fresh))[k];
/** Which forms have been changed from the default. */
export async function customised(): Promise<Record<FormKind, boolean>> {
  const d = (await db.doc(DOC).get()).data() as { forms?: Partial<Record<FormKind, FormDef>> } | undefined;
  return Object.fromEntries(FORM_KINDS.map((k) => [k, !!d?.forms?.[k]])) as Record<FormKind, boolean>;
}
/** def = null → back to the default layout. */
export async function saveForm(k: FormKind, def: FormDef | null, by: string) {
  const ref = db.doc(DOC), cur = ((await ref.get()).data() as { forms?: Record<string, FormDef> } | undefined)?.forms || {};
  const forms = { ...cur };
  if (def) forms[k] = def; else delete forms[k];
  await ref.set({ forms, updatedAt: Date.now(), updatedBy: by });
  cache = null;
}
