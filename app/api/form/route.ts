import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/db";
import { changeGuest, createMeet } from "@/lib/calendar";
import { freeSlots } from "@/lib/freeSlots";
import { deliverByMs, isTaken, isUrgentTier, parseTier, tierInfo, tierLabel } from "@/lib/slots";
import { sendClientConfirmation, sendOwnerNotification, sendOwnerUpdate } from "@/lib/mailer";
import { bidFrom, editToken, originOf } from "@/lib/session";
import { editUntil } from "@/lib/formEdit";
import { logMail } from "@/lib/mailLog";
import { notifyAdmins } from "@/lib/push";
import { MAX_PHOTOS, answersOf, checkForm, findField, kindOf, photoFields, questionsOf, textLimit } from "@/lib/formSchema";
import { getForm } from "@/lib/formConfig";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 30;

const MAX_PHOTO = 1.4 * 1024 * 1024; // client compresses first; Vercel body limit is ~4.5MB for all photos
const S = (f: FormData, k: string) => String(f.get(k) ?? "").trim().slice(0, 300);

export async function POST(req: Request) {
  const f = await req.formData();
  const bid = bidFrom(req); // only from the signed cookie set after a verified payment — never from the request body
  if (!bid) return NextResponse.json({ error: "Booking nahi mili. Form sirf payment ke baad khulta hai." }, { status: 404 });
  const orderRef = db.doc(`orders/${bid}`), os = await orderRef.get();
  if (!os.exists) return NextResponse.json({ error: "Booking nahi mili." }, { status: 404 });
  const b = os.data()!;
  if (b.status !== "paid") return NextResponse.json({ error: "Payment abhi confirm nahi hua." }, { status: 402 });
  // Already submitted: only an EDIT is allowed, and only inside the edit window (24 h, closes 3 h before the slot).
  const editing = !!b.formDone;
  let cur: any = null;
  if (editing) {
    if (S(f, "mode") !== "edit") return NextResponse.json({ error: "Form pehle hi submit ho chuka hai." }, { status: 409 });
    if (editUntil(b.formAt, b.slot) < Date.now()) return NextResponse.json({ error: "Form edit karne ka time khatam ho gaya hai.", code: "edit_closed" }, { status: 409 });
    cur = (await db.doc(`bookings/${b.slot}`).get()).data();
    if (!cur || cur.bid !== bid) return NextResponse.json({ error: "Booking nahi mili." }, { status: 404 });
  }

  const email = S(f, "email").toLowerCase() || b.email; // customer may use a different email than the payment one
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Sahi email bharein." }, { status: 400 });

  // The form layout (fields, required, limits) comes from admin → Form Builder (lib/formSchema defaults).
  const kind = kindOf(b.tier), def = await getForm(kind);
  const app = !!req.headers.get("x-tdt-booking"), web = !app;
  const video = kind !== "voice"; // video, q3, q3urgent, written: one person + written questions
  const written = kind === "written";
  f.set("email", email);
  // Written readings: the customer picks the answer language (the mobile app may not have the field yet → Hinglish).
  if (written && app && !S(f, "lang")) { const o = (findField(def, "lang")?.options || []).map((x) => x.label); f.set("lang", o.includes("Hinglish") || !o.length ? "Hinglish" : o[0]); }
  const lang = S(f, "lang");
  const hasFile = (k: string) => { const x = f.get(k); return x instanceof File && x.size > 0; };
  const reader = { str: (k: string) => String(f.get(k) ?? "").trim().slice(0, textLimit(def, k)), file: hasFile };
  const hadPartner = editing && !!String(cur.answers?.["2nd person name"] || "").trim(); // edit: earlier partner photo is already with the owner
  const problem = checkForm(def, reader, { editing, app, hadPartner });
  if (problem) return NextResponse.json({ error: problem, code: "invalid" }, { status: 400 });

  // Email must ALWAYS be OTP-verified (website and app, new form and edits): orders/{bid}.verifiedEmail is set
  // only by a correct OTP for this booking.
  if (b.verifiedEmail !== email) return NextResponse.json({ error: "Pehle apni email OTP se verify karein.", code: "verify_email" }, { status: 400 });

  const qField = findField(def, "q"), questions = qField ? questionsOf(qField, reader) : [];
  const topics = Array.from(new Set(questions.map((q) => q.topic).filter(Boolean)));
  const p1 = { name: reader.str("name") || b.name || email.split("@")[0], phone: reader.str("phone") || b.phone || "", place: reader.str("place") };

  const photos: { filename: string; content: Buffer; contentType: string }[] = [];
  for (const { name: k, who } of photoFields(def).slice(0, MAX_PHOTOS)) {
    const file = f.get(k);
    if (!(file instanceof File) || !file.size) continue;
    if (!file.type.startsWith("image/") || file.size > MAX_PHOTO)
      return NextResponse.json({ error: "Photo sirf image ho aur chhoti size ki (auto-compress fail hua)." }, { status: 400 });
    photos.push({ filename: `${who}-${bid}.jpg`, content: Buffer.from(await file.arrayBuffer()), contentType: file.type });
  }

  let answers: Record<string, string> = answersOf(def, reader, {
    verified: web ? "Email ✓ (OTP)" : "Email ✓ (OTP) · App booking",
    concern: video ? `${tierInfo(b.tier).name} — ${questions.length} sawal${topics.length ? ` (${topics.join(", ")})` : ""}` : undefined,
  });

  if (b.test) answers["Price paid"] = `₹0 — 🧪 TEST booking (coupon ${b.coupon || "-"}, no payment)`;
  else if (b.amount) answers["Price paid"] = `₹${Number(b.amount).toLocaleString("en-IN")}${b.offerName ? ` · ${b.offerName}` : ""}${b.coupon ? ` · coupon ${b.coupon} (−₹${b.discount})` : ""}`;

  // Raw field values (form names) so the form can be prefilled when the customer edits it later.
  const raw: Record<string, string> = {};
  f.forEach((v, k) => { if (typeof v === "string" && k !== "mode") raw[k] = v.trim().slice(0, textLimit(def, k)); });
  raw.email = email;

  if (editing) {
    const [date, time] = String(b.slot).split("T"), tier = parseTier(b.tier);
    const before: Record<string, string> = cur.answers || {};
    const after: Record<string, string> = {
      "Slot": before["Slot"] || `${date} ${time} IST`, "Booking type": before["Booking type"] || tierLabel(tier),
      ...(before["Deliver by"] ? { "Deliver by": before["Deliver by"] } : {}),
      ...answers, "Edited": new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    };
    const slotRef = db.doc(`bookings/${b.slot}`);
    await slotRef.update({ name: p1.name, email, phone: p1.phone, answers: after, raw, prevAnswers: before, editedAt: Date.now(), edits: FieldValue.increment(1) });
    await orderRef.update({ name: p1.name, editedAt: Date.now() });
    const emailChanged = String(cur.email || "").toLowerCase() !== email, meetLink = cur.meetLink || null;
    if (emailChanged && cur.eventId) await changeGuest(cur.eventId, cur.email || "", email).then(() => logMail({ kind: "invite", bid, slot: b.slot }, email, true))
      .catch((e) => { console.error("calendar guest change failed", e); return logMail({ kind: "invite", bid, slot: b.slot }, email, false, e); });
    const until = editUntil(b.formAt, b.slot), editLink = `${originOf(req)}/api/edit?t=${editToken(bid, until)}`;
    const mails = await Promise.allSettled([
      sendOwnerUpdate({ bid, tier, date, time, name: p1.name, email, deliverBy: b.deliverBy }, before, after, photos, meetLink),
      emailChanged ? sendClientConfirmation({ name: p1.name, email, bid, date, time, meetLink, editLink, editUntil: until, updated: true, tier, deliverBy: b.deliverBy, lang: written ? lang : undefined }) : Promise.resolve(),
    ]);
    mails.forEach((x) => x.status === "rejected" && console.error("edit mail failed", x.reason));
    await slotRef.update({ ownerMailOk: mails[0].status === "fulfilled", ...(emailChanged ? { clientMailOk: mails[1].status === "fulfilled" } : {}) });
    return NextResponse.json({ ok: true, edited: true, date, time, meetLink, deliverBy: b.deliverBy || null, lang: written ? lang : null });
  }

  // Slot is AUTO-ASSIGNED and claimed atomically. Standard: earliest free slot on day 7–10 after payment (later only if full).
  // Urgent: the slot held at payment time (or the next free one within 48 h). The customer never has to pick.
  const tier = parseTier(b.tier), formAt = Date.now();
  // Written readings: answers promised within 7 days (urgent: 48 hours) of this form; the slot is only the work plan.
  const deliverBy = written ? deliverByMs(tier, formAt) : null;
  const dby = deliverBy ? new Date(deliverBy).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  if (written) answers = { "Deliver by": `${dby} IST`, ...answers };
  const candidates = (await freeSlots({ tier, paidAt: b.paidAt, bid, prefer: b.heldSlot || undefined })).slice(0, 20);
  const noSlot = () => NextResponse.json({ error: `Abhi koi slot khaali nahi hai. Aapki booking (ID ${bid}) surakshit hai — hum aapki email par jaankari bhejenge.`, code: "no_slots" }, { status: 409 });
  if (!candidates.length) return noSlot();
  const claimed = await db.runTransaction(async (tx) => {
    const o = await tx.get(orderRef);
    if (o.data()?.formDone) return "done";
    const heldRef = b.heldSlot ? db.doc(`bookings/${b.heldSlot}`) : null, held = heldRef ? await tx.get(heldRef) : null;
    for (const k of candidates) {
      const ref = db.doc(`bookings/${k}`), sl = await tx.get(ref);
      if (sl.exists && isTaken(sl.data()) && sl.data()!.bid !== bid) continue;
      const [d, t] = k.split("T");
      tx.set(ref, { status: "confirmed", tier, bid, ...(deliverBy ? { deliverBy, lang } : {}), name: p1.name, email, phone: p1.phone, paymentId: b.paymentId || null, formDone: true, raw, answers: { "Slot": `${d} ${t} IST`, "Booking type": tierLabel(tier), ...answers }, createdAt: Date.now() });
      tx.update(orderRef, { formDone: true, slot: k, name: p1.name, formAt, ...(deliverBy ? { deliverBy, lang } : {}) });
      if (heldRef && k !== b.heldSlot && held?.exists && held.data()!.bid === bid && held.data()!.status === "held") tx.delete(heldRef); // free the old hold
      return k;
    }
    return "taken";
  });
  if (claimed === "done") return NextResponse.json({ error: "Form pehle hi submit ho chuka hai." }, { status: 409 });
  if (claimed === "taken") return noSlot();
  const key = claimed, [date, time] = key.split("T"), slotRef = db.doc(`bookings/${key}`);
  answers = { "Slot": `${date} ${time} IST`, "Booking type": tierLabel(tier), ...answers };

  // Calls only: Google Meet + calendar invite. Written readings get NO meeting link and NO invite.
  let m: { meetLink?: string; eventId?: string } | null = null, calendarErr = "";
  if (!written) {
    try { m = await createMeet(key, { name: p1.name, email, bid, phone: p1.phone, tier }); await logMail({ kind: "invite", bid, slot: key }, email, true); }
    catch (e: any) { calendarErr = String(e?.message || e).slice(0, 300); console.error("calendar failed", e); await logMail({ kind: "invite", bid, slot: key }, email, false, e); }
  }
  const meetLink = m?.meetLink || null;
  if (!written) { await slotRef.update({ meetLink, eventId: m?.eventId || null, calendarOk: !!meetLink, calendarErr }); await orderRef.update({ meetLink }); }

  const eu = editUntil(Date.now(), key);
  const mails = await Promise.allSettled([
    sendClientConfirmation({ name: p1.name, email, bid, date, time, meetLink, tier, deliverBy, lang: written ? lang : undefined, editUntil: eu, editLink: eu > Date.now() + 60e3 ? `${originOf(req)}/api/edit?t=${editToken(bid, eu)}` : null }),
    sendOwnerNotification({ bid, tier, date, time, name: p1.name, email, paymentId: b.paymentId, answers, deliverBy, test: !!b.test }, photos, meetLink),
  ]);
  mails.forEach((x) => x.status === "rejected" && console.error("mail failed", x.reason));
  const why = (r: PromiseSettledResult<unknown>) => (r.status === "rejected" ? String((r.reason as any)?.message || r.reason).slice(0, 300) : "");
  await slotRef.update({ clientMailOk: mails[0].status === "fulfilled", ownerMailOk: mails[1].status === "fulfilled", mailErr: why(mails[0]) || why(mails[1]) });
  const when = new Date(`${key}:00+05:30`).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  if (written) await notifyAdmins(`${isUrgentTier(tier) ? "⚡ URGENT " : ""}✍️ Naya written form: ${p1.name}`, `Jawab bhejna hai ${dby} tak · ${lang} · ${questions.length} sawal`, "/admin");
  else await notifyAdmins(`📅 Nayi booking: ${p1.name}`, `${when} · ${tierInfo(tier).name}${meetLink ? "" : " · ⚠ Meet link nahi bana"}`, "/admin");

  return NextResponse.json({ ok: true, date, time, meetLink, deliverBy, lang: written ? lang : null });
}
