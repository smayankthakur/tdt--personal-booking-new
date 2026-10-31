import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/db";
import { changeGuest, createMeet } from "@/lib/calendar";
import { freeSlots } from "@/lib/freeSlots";
import { isQuestionTier, isTaken, parseTier, tierInfo, tierLabel } from "@/lib/slots";
import { sendClientConfirmation, sendOwnerNotification, sendOwnerUpdate } from "@/lib/mailer";
import { bidFrom, editToken, originOf } from "@/lib/session";
import { editUntil } from "@/lib/formEdit";
import { logMail } from "@/lib/mailLog";
import { notifyAdmins } from "@/lib/push";
import { MAX_WORDS, WORD_FIELDS, wordCount } from "@/lib/words";
import { VIDEO_MAX_Q, VIDEO_Q_CHARS, VIDEO_TOPICS, needsPartner } from "@/lib/concerns";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 30;

const MAX_PHOTO = 1.4 * 1024 * 1024; // client compresses first; Vercel body limit is ~4.5MB for all 3
const PHOTOS = ["photo1", "photo2", "photo3"];
const S = (f: FormData, k: string) => String(f.get(k) ?? "").trim().slice(0, 300);
const S2000 = (f: FormData, k: string) => String(f.get(k) ?? "").trim().slice(0, 2000);

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

  const dob = (p: string) => [S(f, p + "d"), S(f, p + "m"), S(f, p + "y")];
  const tob = (p: string) => (S(f, p + "h") ? `${S(f, p + "h")}:${S(f, p + "min") || "00"} ${S(f, p + "ap") || "AM"}` : "");
  // Video call reading: one person only, up to 3 written questions (100 characters each) with a topic each.
  const video = isQuestionTier(b.tier); // video, q3, q3urgent: one person + 3 written questions
  const questions: { topic: string; text: string }[] = [];
  if (video) {
    for (let i = 1; i <= VIDEO_MAX_Q; i++) {
      const text = String(f.get(`q${i}`) ?? "").trim(), topic = S(f, `qt${i}`);
      if (!text) continue;
      if (text.length > VIDEO_Q_CHARS) return NextResponse.json({ error: `Har sawal ${VIDEO_Q_CHARS} characters tak hi ho sakta hai (sawal ${i}).`, code: "q_long" }, { status: 400 });
      if (!VIDEO_TOPICS.includes(topic)) return NextResponse.json({ error: `Sawal ${i} ka topic chunein (Love life, Career ya Koi aur issue).`, code: "q_topic" }, { status: 400 });
      questions.push({ topic, text });
    }
    if (!questions.length) return NextResponse.json({ error: "Kam se kam ek sawal likhein.", code: "q_none" }, { status: 400 });
  }
  const concern = video ? `${tierInfo(b.tier).name} — ${questions.length} sawal (${Array.from(new Set(questions.map((q) => q.topic))).join(", ")})`
    : S(f, "concern") === "Other" ? `Other: ${S(f, "concernOther")}` : S(f, "concern");
  const p1 = { name: S(f, "name"), phone: S(f, "phone"), place: S(f, "place") };
  if (!p1.name || p1.phone.replace(/\D/g, "").length < 10 || !p1.place || !concern || concern === "Other: ")
    return NextResponse.json({ error: "Zaroori (*) sawal bharein." }, { status: 400 });

  // Every free-text answer: max 25 words.
  const long = WORD_FIELDS.find((k) => wordCount(S2000(f, k)) > MAX_WORDS);
  if (long) return NextResponse.json({ error: `Har jawab ${MAX_WORDS} shabdon tak hi likh sakte hain — chhota karke dobara bhejein.`, code: "too_long", field: long }, { status: 400 });

  // Email must ALWAYS be OTP-verified (website and app, new form and edits): orders/{bid}.verifiedEmail is set
  // only by a correct OTP for this booking. Partner reasons need the partner's name + photo.
  const web = !req.headers.get("x-tdt-booking");
  const hasFile = (k: string) => { const x = f.get(k); return x instanceof File && x.size > 0; };
  if (b.verifiedEmail !== email) return NextResponse.json({ error: "Pehle apni email OTP se verify karein.", code: "verify_email" }, { status: 400 });
  {
    const hadPartner = editing && !!String(cur.answers?.["2nd person name"] || "").trim(); // edit: earlier partner photo is already with the owner
    if (!video && needsPartner(S(f, "concern")) && (!S(f, "name2") || (!hasFile("photo2") && !hadPartner)))
      return NextResponse.json({ error: "Aapki wajah partner ke baare mein hai — partner ka naam aur ek clear photo zaroori hai.", code: "partner" }, { status: 400 });
  }

  const photos: { filename: string; content: Buffer; contentType: string }[] = [];
  for (const k of PHOTOS) {
    const file = f.get(k);
    if (!(file instanceof File) || !file.size || (video && k !== "photo1")) continue; // video: one person only
    if (!file.type.startsWith("image/") || file.size > MAX_PHOTO)
      return NextResponse.json({ error: "Photo sirf image ho aur chhoti size ki (auto-compress fail hua)." }, { status: 400 });
    const who = k === "photo1" ? "you" : k === "photo2" ? "second-person" : "third-person";
    photos.push({ filename: `${who}-${bid}.jpg`, content: Buffer.from(await file.arrayBuffer()), contentType: file.type });
  }
  if (!editing && !hasFile("photo1"))
    return NextResponse.json({ error: "Apni ek clear photo upload karein." }, { status: 400 });

  let answers: Record<string, string> = video ? {
    "Full name": p1.name, "WhatsApp": p1.phone, "Email (payment)": email,
    "Date of birth (D/M/Y)": dob("dob").filter(Boolean).join(" / "), "Place of birth": p1.place, "Birth time": tob("tob"),
    "Verified": web ? "Email ✓ (OTP)" : "Email ✓ (OTP) · App booking", "Concern": concern,
    ...Object.fromEntries(questions.map((q, i) => [`Sawal ${i + 1} (${q.topic})`, q.text])),
  } : {
    "Full name": p1.name, "WhatsApp": p1.phone, "Email (payment)": email,
    "Date of birth (D/M/Y)": dob("dob").filter(Boolean).join(" / "), "Place of birth": p1.place, "Birth time": tob("tob"),
    "2nd person name": S(f, "name2"), "2nd DOB": dob("dob2").filter(Boolean).join(" / "), "2nd birth time": tob("tob2"), "2nd place": S(f, "place2"),
    "3rd person name": S(f, "name3"), "3rd DOB": dob("dob3").filter(Boolean).join(" / "), "3rd birth time": tob("tob3"), "3rd place": S(f, "place3"),
    "Verified": web ? "Email ✓ (OTP)" : "Email ✓ (OTP) · App booking", "Concern": concern, "Anything else": String(f.get("notes") ?? "").trim().slice(0, 2000),
  };

  if (b.amount) answers["Price paid"] = `₹${Number(b.amount).toLocaleString("en-IN")}${b.offerName ? ` · ${b.offerName}` : ""}${b.coupon ? ` · coupon ${b.coupon} (−₹${b.discount})` : ""}`;

  // Raw field values (form names) so the form can be prefilled when the customer edits it later.
  const raw: Record<string, string> = {};
  f.forEach((v, k) => { if (typeof v === "string" && k !== "mode" && !(video && /^(name|place|dob|tob)[23]|^concern|^notes/.test(k))) raw[k] = v.trim().slice(0, k === "notes" ? 2000 : 300); });
  raw.email = email;

  if (editing) {
    const [date, time] = String(b.slot).split("T"), tier = parseTier(b.tier);
    const before: Record<string, string> = cur.answers || {};
    const after: Record<string, string> = {
      "Slot": before["Slot"] || `${date} ${time} IST`, "Booking type": before["Booking type"] || tierLabel(tier),
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
      sendOwnerUpdate({ bid, tier, date, time, name: p1.name, email }, before, after, photos, meetLink),
      emailChanged ? sendClientConfirmation({ name: p1.name, email, bid, date, time, meetLink, editLink, editUntil: until, updated: true, tier }) : Promise.resolve(),
    ]);
    mails.forEach((x) => x.status === "rejected" && console.error("edit mail failed", x.reason));
    await slotRef.update({ ownerMailOk: mails[0].status === "fulfilled", ...(emailChanged ? { clientMailOk: mails[1].status === "fulfilled" } : {}) });
    return NextResponse.json({ ok: true, edited: true, date, time, meetLink });
  }

  // Slot is AUTO-ASSIGNED and claimed atomically. Standard: earliest free slot on day 7–10 after payment (later only if full).
  // Urgent: the slot held at payment time (or the next free one within 48 h). The customer never has to pick.
  const tier = parseTier(b.tier);
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
      tx.set(ref, { status: "confirmed", tier, bid, name: p1.name, email, phone: p1.phone, paymentId: b.paymentId || null, formDone: true, raw, answers: { "Slot": `${d} ${t} IST`, "Booking type": tierLabel(tier), ...answers }, createdAt: Date.now() });
      tx.update(orderRef, { formDone: true, slot: k, name: p1.name, formAt: Date.now() });
      if (heldRef && k !== b.heldSlot && held?.exists && held.data()!.bid === bid && held.data()!.status === "held") tx.delete(heldRef); // free the old hold
      return k;
    }
    return "taken";
  });
  if (claimed === "done") return NextResponse.json({ error: "Form pehle hi submit ho chuka hai." }, { status: 409 });
  if (claimed === "taken") return noSlot();
  const key = claimed, [date, time] = key.split("T"), slotRef = db.doc(`bookings/${key}`);
  answers = { "Slot": `${date} ${time} IST`, "Booking type": tierLabel(tier), ...answers };

  let m: { meetLink?: string; eventId?: string } | null = null, calendarErr = "";
  try { m = await createMeet(key, { name: p1.name, email, bid, phone: p1.phone, tier }); await logMail({ kind: "invite", bid, slot: key }, email, true); }
  catch (e: any) { calendarErr = String(e?.message || e).slice(0, 300); console.error("calendar failed", e); await logMail({ kind: "invite", bid, slot: key }, email, false, e); }
  const meetLink = m?.meetLink || null;
  await slotRef.update({ meetLink, eventId: m?.eventId || null, calendarOk: !!meetLink, calendarErr });
  await orderRef.update({ meetLink });

  const eu = editUntil(Date.now(), key);
  const mails = await Promise.allSettled([
    sendClientConfirmation({ name: p1.name, email, bid, date, time, meetLink, tier, editUntil: eu, editLink: eu > Date.now() + 60e3 ? `${originOf(req)}/api/edit?t=${editToken(bid, eu)}` : null }),
    sendOwnerNotification({ bid, tier, date, time, name: p1.name, email, paymentId: b.paymentId, answers }, photos, meetLink),
  ]);
  mails.forEach((x) => x.status === "rejected" && console.error("mail failed", x.reason));
  const why = (r: PromiseSettledResult<unknown>) => (r.status === "rejected" ? String((r.reason as any)?.message || r.reason).slice(0, 300) : "");
  await slotRef.update({ clientMailOk: mails[0].status === "fulfilled", ownerMailOk: mails[1].status === "fulfilled", mailErr: why(mails[0]) || why(mails[1]) });
  const when = new Date(`${key}:00+05:30`).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  await notifyAdmins(`📅 Nayi booking: ${p1.name}`, `${when} · ${tierInfo(tier).name}${meetLink ? "" : " · ⚠ Meet link nahi bana"}`, "/admin");

  return NextResponse.json({ ok: true, date, time, meetLink });
}
