import { NextResponse } from "next/server";
import { adminFrom } from "@/lib/adminAuth";
import { logActivity } from "@/lib/activity";
import { customised, getForms, saveForm } from "@/lib/formConfig";
import { FORM_KINDS, FORM_KIND_NAME, allFields, cleanForm, defaultForm, type FormKind } from "@/lib/formSchema";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const unauth = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });
const kindOk = (k: unknown): k is FormKind => FORM_KINDS.includes(k as FormKind);

// Form Builder: the reading form layouts (config/form).
export async function GET(req: Request) {
  if (!(await adminFrom(req))) return unauth();
  return NextResponse.json({ forms: await getForms(true), custom: await customised() });
}

// Save one form: { kind, def }
export async function PUT(req: Request) {
  const who = await adminFrom(req); if (!who) return unauth();
  const b = await req.json().catch(() => ({}));
  if (!kindOk(b?.kind)) return NextResponse.json({ error: "Form type sahi nahi hai." }, { status: 400 });
  const { def, error } = cleanForm(b.kind, b.def);
  if (!def) return NextResponse.json({ error }, { status: 400 });
  const before = (await getForms(true))[b.kind as FormKind];
  await saveForm(b.kind, def, who);
  const ids = (d: typeof def) => new Map(allFields(d).map((x) => [x.id, x]));
  const old = ids(before), now = ids(def);
  const added = Array.from(now.values()).filter((x) => !old.has(x.id)).map((x) => x.label);
  const removed = Array.from(old.values()).filter((x) => !now.has(x.id)).map((x) => x.label);
  const hidden = Array.from(now.values()).filter((x) => x.hidden && !old.get(x.id)?.hidden).map((x) => x.label || x.id);
  await logActivity(who, "Form badla", `${FORM_KIND_NAME[b.kind as FormKind]}${added.length ? ` · added: ${added.join(", ")}` : ""}${removed.length ? ` · deleted: ${removed.join(", ")}` : ""}${hidden.length ? ` · hidden: ${hidden.join(", ")}` : ""}`.slice(0, 900));
  return NextResponse.json({ ok: true, forms: await getForms(true), custom: await customised() });
}

// Back to the default layout: DELETE ?kind=written
export async function DELETE(req: Request) {
  const who = await adminFrom(req); if (!who) return unauth();
  const k = new URL(req.url).searchParams.get("kind");
  if (!kindOk(k)) return NextResponse.json({ error: "Form type sahi nahi hai." }, { status: 400 });
  await saveForm(k, null, who);
  await logActivity(who, "Form default par reset kiya", FORM_KIND_NAME[k]);
  return NextResponse.json({ ok: true, forms: await getForms(true), custom: await customised(), def: defaultForm(k) });
}
