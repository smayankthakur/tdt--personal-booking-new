import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createMeet } from "@/lib/calendar";
import { getCfg } from "@/lib/db";
import { daySlots, slotMs, isTaken, LEAD_MS } from "@/lib/slots";
import { sendClientConfirmation, sendOwnerNotification } from "@/lib/mailer";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 30;

const MAX_PHOTO = 1.4 * 1024 * 1024; // client compresses first; Vercel body limit is ~4.5MB for all 3
const PHOTOS = ["photo1", "photo2", "photo3"];
const S = (f: FormData, k: string) => String(f.get(k) ?? "").trim().slice(0, 300);

export async function POST(req: Request) {
  const f = await req.formData();
  const bid = S(f, "bid");
  if (!/^[A-Za-z0-9]{8,20}$/.test(bid)) return NextResponse.json({ error: "Booking nahi mili." }, { status: 404 });
  const orderRef = db.doc(`orders/${bid}`), os = await orderRef.get();
  if (!os.exists) return NextResponse.json({ error: "Booking nahi mili." }, { status: 404 });
  const b = os.data()!;
  if (b.status !== "paid") return NextResponse.json({ error: "Payment abhi confirm nahi hua." }, { status: 402 });
  if (b.formDone) return NextResponse.json({ error: "Form pehle hi submit ho chuka hai." }, { status: 409 });

  const date = S(f, "date"), time = S(f, "time"), key = `${date}T${time}`;
  const cfg = await getCfg();
  if (!daySlots(cfg, date).includes(time) || slotMs(date, time) < Date.now() + LEAD_MS)
    return NextResponse.json({ error: "Yeh slot available nahi hai. Doosra slot chunein.", code: "slot_taken" }, { status: 409 });
  const email = S(f, "email").toLowerCase() || b.email; // customer may use a different email than the payment one
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Sahi email bharein." }, { status: 400 });

  const dob = (p: string) => [S(f, p + "d"), S(f, p + "m"), S(f, p + "y")];
  const tob = (p: string) => (S(f, p + "h") ? `${S(f, p + "h")}:${S(f, p + "min") || "00"} ${S(f, p + "ap") || "AM"}` : "");
  const concern = S(f, "concern") === "Other" ? `Other: ${S(f, "concernOther")}` : S(f, "concern");
  const p1 = { name: S(f, "name"), phone: S(f, "phone"), place: S(f, "place") };
  if (!p1.name || p1.phone.replace(/\D/g, "").length < 10 || !p1.place || !dob("dob").every(Boolean) || !concern || concern === "Other: ")
    return NextResponse.json({ error: "Zaroori (*) sawal bharein." }, { status: 400 });

  const photos: { filename: string; content: Buffer; contentType: string }[] = [];
  for (const k of PHOTOS) {
    const file = f.get(k);
    if (!(file instanceof File) || !file.size) continue;
    if (!file.type.startsWith("image/") || file.size > MAX_PHOTO)
      return NextResponse.json({ error: "Photo sirf image ho aur chhoti size ki (auto-compress fail hua)." }, { status: 400 });
    const who = k === "photo1" ? "you" : k === "photo2" ? "second-person" : "third-person";
    photos.push({ filename: `${who}-${bid}.jpg`, content: Buffer.from(await file.arrayBuffer()), contentType: file.type });
  }
  if (!(f.get("photo1") instanceof File) || !(f.get("photo1") as File).size)
    return NextResponse.json({ error: "Apni ek clear photo upload karein." }, { status: 400 });

  const answers: Record<string, string> = {
    "Slot": `${date} ${time} IST`, "Full name": p1.name, "WhatsApp": p1.phone, "Email (payment)": email,
    "Date of birth (D/M/Y)": dob("dob").join(" / "), "Place of birth": p1.place, "Birth time": tob("tob"),
    "2nd person name": S(f, "name2"), "2nd DOB": dob("dob2").filter(Boolean).join(" / "), "2nd birth time": tob("tob2"), "2nd place": S(f, "place2"),
    "3rd person name": S(f, "name3"), "3rd DOB": dob("dob3").filter(Boolean).join(" / "), "3rd birth time": tob("tob3"), "3rd place": S(f, "place3"),
    "Concern": concern, "Anything else": String(f.get("notes") ?? "").trim().slice(0, 2000),
  };

  // claim slot + submission atomically: first paid customer to submit gets the slot
  const slotRef = db.doc(`bookings/${key}`);
  const claimed = await db.runTransaction(async (tx) => {
    const [o, sl] = await Promise.all([tx.get(orderRef), tx.get(slotRef)]);
    if (o.data()?.formDone) return "done";
    if (sl.exists && isTaken(sl.data())) return "taken";
    tx.set(slotRef, { status: "confirmed", bid, name: p1.name, email, phone: p1.phone, paymentId: b.paymentId || null, formDone: true, answers, createdAt: Date.now() });
    tx.update(orderRef, { formDone: true, slot: key, name: p1.name, formAt: Date.now() });
    return "ok";
  });
  if (claimed === "done") return NextResponse.json({ error: "Form pehle hi submit ho chuka hai." }, { status: 409 });
  if (claimed === "taken") return NextResponse.json({ error: "Yeh slot abhi kisi ne le liya. Doosra slot chunein.", code: "slot_taken" }, { status: 409 });

  let m: { meetLink?: string; eventId?: string } | null = null, calendarErr = "";
  try { m = await createMeet(key, { name: p1.name, email, bid, phone: p1.phone }); } catch (e: any) { calendarErr = String(e?.message || e).slice(0, 300); console.error("calendar failed", e); }
  const meetLink = m?.meetLink || null;
  await slotRef.update({ meetLink, eventId: m?.eventId || null, calendarOk: !!meetLink, calendarErr });
  await orderRef.update({ meetLink });

  const mails = await Promise.allSettled([
    sendClientConfirmation({ name: p1.name, email, bid, date, time, meetLink }),
    sendOwnerNotification({ bid, date, time, name: p1.name, email, paymentId: b.paymentId, answers }, photos, meetLink),
  ]);
  mails.forEach((x) => x.status === "rejected" && console.error("mail failed", x.reason));
  const why = (r: PromiseSettledResult<unknown>) => (r.status === "rejected" ? String((r.reason as any)?.message || r.reason).slice(0, 300) : "");
  await slotRef.update({ clientMailOk: mails[0].status === "fulfilled", ownerMailOk: mails[1].status === "fulfilled", mailErr: why(mails[0]) || why(mails[1]) });

  return NextResponse.json({ ok: true, date, time, meetLink });
}
