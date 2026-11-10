import nodemailer, { type SendMailOptions } from "nodemailer";
import { logMail, type MailMeta } from "./mailLog";
import { callMinutes, isQuestionTier, isUrgentTier, isWrittenTier, slotMs, tierInfo, tierTag } from "./slots";

function transporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) throw new Error("SMTP settings missing (SMTP_HOST / SMTP_USER / SMTP_PASS)");
  return nodemailer.createTransport({
    host: SMTP_HOST, port: Number(SMTP_PORT || 465), secure: SMTP_SECURE !== "false",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}
/** Every mail gets a plain-text twin and normal transactional headers — HTML-only mail is a common spam signal. */
const toText = (h: string) => h.replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n").replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n").trim();
async function send(m: SendMailOptions, meta?: MailMeta) {
  try {
    const r = await transporter().sendMail({ ...m, text: toText(String(m.html || "")), headers: { "X-Auto-Response-Suppress": "OOF, AutoReply", ...(m.headers as object) } });
    if (meta) await logMail(meta, m.to as string | string[], true);
    return r;
  } catch (e) { if (meta) await logMail(meta, m.to as string | string[], false, e); throw e; }
}
const from = () => process.env.SMTP_FROM || `"The Divine Tarot" <${process.env.SMTP_USER}>`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export const prettySlot = (date: string, time: string, tier?: string) => {
  const d = new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const [h, m] = time.split(":").map(Number);
  const start = h * 60 + m, end = start + callMinutes(tier);
  const f = (t: number) => `${Math.floor(t / 60) % 12 || 12}:${String(t % 60).padStart(2, "0")} ${Math.floor(t / 60) < 12 ? "AM" : "PM"}`;
  return { day: d, range: `${f(start)} – ${f(end)} (IST)` };
};

const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** .ics attachment so the slot lands in any calendar app. */
function ics(bid: string, date: string, time: string, meet: string | null, tier?: string) {
  const s = slotMs(date, time), e = s + callMinutes(tier) * 60000;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Divine Tarot//Booking//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${bid}@thedivinetarot`, `DTSTAMP:${utc(Date.now())}`, `DTSTART:${utc(s)}`, `DTEND:${utc(e)}`,
    "SUMMARY:Personal Reading — The Divine Tarot", `LOCATION:${meet || "Google Meet (link by email)"}`,
    `DESCRIPTION:Google Meet: ${meet || "link will be sent separately"}`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Reading in 30 minutes", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

/** One-click "Add to Google Calendar" link for the slot (40-min event with the Meet link). */
export function gcalLink(date: string, time: string, meet: string | null, tier?: string) {
  const s = slotMs(date, time), e = s + callMinutes(tier) * 60000;
  const q = new URLSearchParams({ action: "TEMPLATE", text: "Personal Reading — The Divine Tarot", dates: `${utc(s)}/${utc(e)}`,
    details: `Google Meet: ${meet || "link aapki email mein"}\nSirf 5 minute wait kiya jayega — time par join karein.`, location: meet || "Google Meet" });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** Sent to the customer right after the form is submitted: schedule + Meet link. */
const until = (ms?: number) => ms ? new Date(ms).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
/** "Form mein galti? Edit karein" box (only while the edit window is open). */
const editBox = (link?: string | null, ms?: number) => !link ? "" :
  `<div style="border:1px dashed #6d28d9;border-radius:8px;padding:12px 16px;margin:18px 0;font-size:14px;line-height:1.6">✏️ Form mein kuch galat bhar diya? <b>${until(ms)} tak</b> aap form edit kar sakte hain (slot same rahega).<br/><a href="${link}" style="color:#6d28d9;font-weight:600">Form edit karein →</a></div>`;

/** "Mon, 17 Nov 2026" — the date written answers are promised by. */
export const deliverDate = (ms?: number | null) => ms ? new Date(ms).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
const deliverWhen = (tier?: string) => (isUrgentTier(tier) ? "48 ghante" : "7 din");
const contact = `<p style="font-size:13px;color:#666;margin-top:28px">Contact: thedivinetarothindi@gmail.com | +91 88281 16545</p>`;

/** Written (email) reading booked: NO meeting link, NO calendar invite — answers come by email. */
async function sendWrittenConfirmation(b: { name: string; email: string; bid: string; date: string; time: string; editLink?: string | null; editUntil?: number; updated?: boolean; tier?: string; by?: string; deliverBy?: number | null; lang?: string }) {
  const by = deliverDate(b.deliverBy), urgent = isUrgentTier(b.tier);
  await send({
    from: from(), to: b.email,
    subject: `Your personal reading is booked - answers by ${by || `${deliverWhen(b.tier)} se pehle`} - The Divine Tarot`,
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste ${esc(b.name)}</h2>
      <p>${b.updated ? "Aapka form update ho gaya hai." : "Aapka payment aur form mil gaya hai."} Aapki ${urgent ? "<b>Urgent</b> " : ""}Personal Reading confirm ho chuki hai.</p>
      <div style="background:#f6f3fb;border-left:3px solid #6d28d9;padding:14px 20px;margin:20px 0;line-height:1.8">
        <b>Reading:</b> Personal Reading by Bharti Singh — aapke 3 sawal<br/>
        <b>Jawab kab tak:</b> ${by ? `<b>${by}</b> tak` : ""} (${deliverWhen(b.tier)} ke andar)<br/>
        ${b.lang ? `<b>Bhasha:</b> ${esc(b.lang)}<br/>` : ""}<b>Booking ID:</b> ${b.bid}
      </div>
      <p>Bharti Singh aapke form mein likhe <b>3 sawalon ke detailed jawab, guidance ke saath</b>, khud likh kar <b>isi email (${esc(b.email)}) par</b> bhejengi${b.lang ? ` — ${esc(b.lang)} mein` : ""}.</p>
      ${editBox(b.editLink, b.editUntil)}
      <div style="font-size:14px;line-height:1.7">
        <b>Zaroori baatein:</b>
        <ul style="padding-left:18px">
          <li>Jawab isi email par aayenge — <b>Spam / Promotions folder</b> bhi check karte rahein.</li>
          <li>Sirf aapki reading hoti hai — form mein likhe 3 sawalon ke jawab.</li>
          <li>Koi call ya meeting nahi hoti; aapko kahin join nahi karna hai.</li>
          <li>Koi refund nahi diya jata.</li>
        </ul>
      </div>
      ${contact}</div>`,
  }, { kind: "confirm", bid: b.bid, slot: `${b.date}T${b.time}`, by: b.by });
}

export async function sendClientConfirmation(b: { name: string; email: string; bid: string; date: string; time: string; meetLink: string | null; editLink?: string | null; editUntil?: number; updated?: boolean; tier?: string; by?: string; deliverBy?: number | null; lang?: string }) {
  if (isWrittenTier(b.tier)) return sendWrittenConfirmation(b);
  const { day, range } = prettySlot(b.date, b.time, b.tier);
  const video = b.tier === "video", q3 = isQuestionTier(b.tier) && !video;
  const meet = b.meetLink
    ? `<p style="text-align:center;margin:26px 0"><a href="${b.meetLink}" style="background:#6d28d9;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Join Google Meet</a><br/><span style="font-size:13px;color:#555">${b.meetLink}</span></p>`
    : `<p style="background:#fff4e5;padding:12px 16px;border-radius:6px">Aapka Google Meet link thodi der mein alag email se bhej diya jayega.</p>`;
  await send({
    from: from(), to: b.email,
    subject: `Your reading is confirmed - ${day}, ${range.split(" – ")[0]} IST`,
    attachments: [{ filename: "reading.ics", content: ics(b.bid, b.date, b.time, b.meetLink, b.tier), contentType: "text/calendar; method=PUBLISH" }],
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste ${esc(b.name)}</h2>
      <p>${b.updated ? "Aapka form update ho gaya hai." : "Aapka payment aur form mil gaya hai."} Aapki Personal Reading confirm ho chuki hai.</p>
      <div style="background:#f6f3fb;border-left:3px solid #6d28d9;padding:14px 20px;margin:20px 0;line-height:1.8">
        <b>Date:</b> ${day}<br/><b>Time:</b> ${range}<br/><b>Call:</b> ${video ? "Google Meet VIDEO call (30 min) — camera on rakhein" : `Google Meet voice call (${callMinutes(b.tier)} min)`}<br/><b>Booking ID:</b> ${b.bid}
      </div>
      ${meet}
      ${editBox(b.editLink, b.editUntil)}
      <div style="background:#fff4e5;border:2px solid #f59e0b;border-radius:8px;padding:14px 18px;margin:22px 0;line-height:1.7">
        <b style="font-size:16px">⏰ Please set a reminder in your calendar or clock so you don't miss your consultation.</b><br/>
        Abhi apne phone ke Calendar ya Alarm mein reminder laga lein. <b>Hum alag se koi reminder call ya message nahi karte.</b><br/>
        <b>Slot time par sirf 5 minute wait kiya jayega.</b> 5 minute ke andar join nahi kiya toh appointment miss maani jayegi — koi refund ya reschedule nahi.
        <p style="margin:12px 0 0"><a href="${gcalLink(b.date, b.time, b.meetLink, b.tier)}" style="background:#1b1330;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">📅 Add to Google Calendar</a>
        <span style="font-size:12px;color:#555;display:block;margin-top:6px">Ya is email ke saath attached reading.ics file kholein — kisi bhi calendar app mein add ho jayegi.</span></p>
      </div>
      <div style="font-size:14px;line-height:1.7">
        <b>Zaroori baatein:</b>
        <ul style="padding-left:18px">
          <li>Slot time par isi email id (${esc(b.email)}) se Meet join karein. Better experience ke liye headphones lagayein.</li>
          <li><b>Hum sirf 5 minute wait karte hain</b> — uske baad appointment miss maani jayegi.</li>
          <li>Slot time nikalne ke baad reschedule nahi hota. Koi refund nahi diya jata.</li>
          <li>Stable network mein rahein; baar-baar call cut hui toh appointment cancel ho sakti hai.</li>
          <li>${video ? "Video call mein sirf aapki reading hoti hai — form mein likhe 3 sawalon ke jawab. Camera on rakhein aur achhi roshni mein baithein." : q3 ? "Is call mein sirf aapki reading hoti hai — form mein likhe 3 sawalon ke jawab." : "Sirf form mein di gayi details (max 3 log) ki reading hoti hai."}</li>
        </ul>
      </div>
      <p style="font-size:13px;color:#666;margin-top:28px">Contact: thedivinetarothindi@gmail.com | +91 88281 16545</p></div>`,
  }, { kind: "confirm", bid: b.bid, slot: `${b.date}T${b.time}`, by: b.by });
}

/** Sent to the owner with every answer and the uploaded photos attached. */
export async function sendOwnerNotification(sub: Record<string, any>, photos: { filename: string; content: Buffer; contentType: string }[], meetLink: string | null) {
  const to = (process.env.OWNER_EMAIL || process.env.SMTP_USER || "").split(",").map((x) => x.trim()).filter(Boolean); // one or many addresses
  const { day, range } = prettySlot(sub.date, sub.time, sub.tier), written = isWrittenTier(sub.tier);
  const rows = Object.entries(sub.answers as Record<string, string>).filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">${esc(k)}</td><td style="padding:4px 0"><b>${esc(String(v))}</b></td></tr>`).join("");
  const head = written
    ? `<h3 style="color:${isUrgentTier(sub.tier) ? "#c2410c" : "#6d28d9"}">${isUrgentTier(sub.tier) ? "⚡ URGENT · " : ""}✍️ Written reading — jawab ${esc(sub.email)} par bhejna hai <u>${deliverDate(sub.deliverBy)}</u> tak</h3>
      <p>Language: <b>${esc(sub.answers?.Language || "-")}</b><br/>Booking ID: ${sub.bid} · Payment: ${sub.paymentId || "-"}<br/><span style="color:#666">Plan slot (admin calendar): ${day} · ${range.split(" – ")[0]}</span></p>`
    : `<h3>${day} · ${range}</h3>
      <p>Meet: ${meetLink ? `<a href="${meetLink}">${meetLink}</a>` : "<b style='color:#c00'>NOT CREATED — create manually</b>"}<br/>Booking ID: ${sub.bid} · Payment: ${sub.paymentId || "-"}</p>`;
  await send({
    from: from(), to, replyTo: sub.email,
    subject: written ? `${tierTag(sub.tier)}New reading form - ${sub.name} - answer by ${deliverDate(sub.deliverBy)}` : `${tierTag(sub.tier)}New reading form - ${sub.name} - ${day} ${range.split(" – ")[0]}`,
    attachments: photos,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px">${head}
      <table>${rows}</table><p>Photos attached: ${photos.length}</p></div>`,
  }, { kind: "owner", bid: sub.bid, slot: `${sub.date}T${sub.time}` });
}

/** One-off mail to customers who booked before form editing existed: their personal edit link. */
export async function sendEditLink(b: { name: string; email: string; date: string; time: string; editLink: string; editUntil: number; tier?: string; bid?: string; by?: string }) {
  const { day, range } = prettySlot(b.date, b.time, b.tier);
  await send({
    from: from(), to: b.email, subject: `Edit your reading form (till ${until(b.editUntil)}) - The Divine Tarot`,
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste ${esc(b.name || "")}</h2>
      <p>Aapki Personal Reading <b>${day}, ${range}</b> ke liye confirm hai.</p>
      <p>Ab aap apna reading form <b>${until(b.editUntil)} tak</b> edit kar sakte hain — naam, birth details, partner details, wajah ya photo. Slot aur Google Meet link same rahenge.</p>
      <p style="text-align:center;margin:26px 0"><a href="${b.editLink}" style="background:#6d28d9;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Form edit karein</a></p>
      <p style="font-size:13px;color:#666">Kuch badalna nahi hai toh is email ko ignore karein. Contact: +91 88281 16545</p></div>`,
  }, { kind: "edit", bid: b.bid, slot: `${b.date}T${b.time}`, by: b.by });
}

/** Owner copy when a customer edits their form: what changed (old → new) + any new photos. */
export async function sendOwnerUpdate(sub: { bid: string; tier?: string; date: string; time: string; name: string; email: string; deliverBy?: number | null }, before: Record<string, string>, after: Record<string, string>, photos: { filename: string; content: Buffer; contentType: string }[], meetLink: string | null) {
  const to = (process.env.OWNER_EMAIL || process.env.SMTP_USER || "").split(",").map((x) => x.trim()).filter(Boolean);
  const { day, range } = prettySlot(sub.date, sub.time, sub.tier);
  const keys = Array.from(new Set([...Object.keys(after), ...Object.keys(before)])).filter((k) => k !== "Edited");
  const changed = keys.filter((k) => (before[k] || "") !== (after[k] || ""));
  const td = "padding:4px 12px 4px 0;vertical-align:top";
  const diff = changed.map((k) => `<tr><td style="${td};color:#555">${esc(k)}</td><td style="${td};color:#999;text-decoration:line-through">${esc(before[k] || "—")}</td><td style="${td}"><b>${esc(after[k] || "—")}</b></td></tr>`).join("");
  const all = Object.entries(after).filter(([, v]) => v).map(([k, v]) => `<tr><td style="${td};color:#555">${esc(k)}</td><td style="padding:4px 0"><b>${esc(String(v))}</b></td></tr>`).join("");
  await send({
    from: from(), to, replyTo: sub.email,
    subject: isWrittenTier(sub.tier) ? `${tierTag(sub.tier)}UPDATED reading form - ${sub.name} - answer by ${deliverDate(sub.deliverBy)}` : `${tierTag(sub.tier)}UPDATED reading form - ${sub.name} - ${day} ${range.split(" – ")[0]}`,
    attachments: photos,
    html: `<div style="font-family:Arial,sans-serif;max-width:680px"><h3 style="color:#b45309">✏️ Customer ne form edit kiya · ${isWrittenTier(sub.tier) ? `✍️ Written reading — jawab ${deliverDate(sub.deliverBy)} tak` : `${day} · ${range}`}</h3>
      <p>${isWrittenTier(sub.tier) ? "" : `Meet: ${meetLink ? `<a href="${meetLink}">${meetLink}</a>` : "-"}<br/>`}Booking ID: ${sub.bid}</p>
      <h4>Kya badla (${changed.length})</h4>${changed.length ? `<table><tr><th align="left">Sawal</th><th align="left">Pehle</th><th align="left">Ab</th></tr>${diff}</table>` : "<p>Koi text change nahi (sirf photo).</p>"}
      <p>Nayi photos attached: ${photos.length}${photos.length ? "" : " (purani photos pichhle email mein hain)"}</p>
      <h4>Poora form (ab)</h4><table>${all}</table></div>`,
  }, { kind: "ownerUpdate", bid: sub.bid, slot: `${sub.date}T${sub.time}` });
}

/** Payment receipt + a personal 24-hour form link, so a customer who loses the payment page (Instagram browser,
 *  UPI app switch, closed tab) can still open the form from any phone/browser. */
export async function sendPaymentReceived(b: { email: string; bid: string; tier?: string; formLink?: string | null; by?: string }) {
  const when = isUrgentTier(b.tier) ? "48 ghante ke andar" : "7 se 10 din ke andar", written = isWrittenTier(b.tier);
  const kind = b.tier && b.tier !== "standard" ? ` (<b>${tierInfo(b.tier).name}</b>)` : "";
  const btn = b.formLink
    ? `<p style="text-align:center;margin:26px 0"><a href="${b.formLink}" style="background:#6d28d9;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Reading Form Bharein</a><br/><span style="font-size:12px;color:#555">Yeh link sirf aapke liye hai aur 24 ghante tak valid hai.</span></p>`
    : "";
  await send({
    from: from(), to: b.email, subject: "Payment received - fill your reading form - The Divine Tarot",
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste</h2>
      <p>Aapka payment receive ho gaya hai${kind}. Ab apna <b>reading form bharein</b> (2-3 minute).</p>
      ${btn}
      <p>${written ? `Form mein apne <b>3 sawal</b> likhein aur jawab ki <b>bhasha</b> (Hindi, Hinglish ya English) chunein. Form submit karne ke <b>${deliverWhen(b.tier)} ke andar</b> Bharti Singh ke likhe jawab, guidance ke saath, isi email par aa jayenge.` : `Form submit karte hi aapka <b>appointment slot (${when}), Google Meet link aur schedule</b> isi email par aa jayega, aur Google Calendar invite bhi milega.`}</p>
      <p style="background:#fff4e5;padding:12px 16px;border-radius:6px;font-size:14px">Koi dikkat ho toh WhatsApp karein <b>+91 88281 16545</b> aur yeh Booking ID bhejein: <b>${b.bid}</b></p></div>`,
  }, { kind: "payment", bid: b.bid, by: b.by });
}

/** 6-digit email verification code for the reading form (valid 10 minutes). */
export async function sendOtpEmail(email: string, code: string) {
  await send({
    from: from(), to: email, subject: `${code} - your verification code - The Divine Tarot`,
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste</h2>
      <p>Reading form mein apni email verify karne ke liye yeh code daalein:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700;text-align:center;background:#f6f3fb;padding:16px;border-radius:8px">${code}</p>
      <p style="font-size:13px;color:#666">Yeh code 10 minute tak valid hai. Agar aapne yeh request nahi ki, toh is email ko ignore karein.</p></div>`,
  });
}

/** Sent once by /api/cron/reminders, about 3 hours before the slot. */
export async function sendReminder(b: { name: string; email: string; bid: string; date: string; time: string; meetLink: string | null; tier?: string; by?: string }) {
  const { day, range } = prettySlot(b.date, b.time, b.tier);
  const meet = b.meetLink
    ? `<p style="text-align:center;margin:26px 0"><a href="${b.meetLink}" style="background:#6d28d9;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Join Google Meet</a><br/><span style="font-size:13px;color:#555">${b.meetLink}</span></p>`
    : `<p style="background:#fff4e5;padding:12px 16px;border-radius:6px">Meet link ke liye WhatsApp karein: +91 88281 16545</p>`;
  await send({
    from: from(), to: b.email,
    subject: `Reminder: your reading starts at ${range.split(" – ")[0]} IST today - The Divine Tarot`,
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste ${esc(b.name || "")}</h2>
      <p><b>Aapki reading lagbhag 3 ghante mein shuru hogi.</b></p>
      <div style="background:#f6f3fb;border-left:3px solid #6d28d9;padding:14px 20px;margin:20px 0;line-height:1.8">
        <b>Date:</b> ${day}<br/><b>Time:</b> ${range}<br/><b>Booking ID:</b> ${b.bid}
      </div>
      ${meet}
      <p style="font-size:14px;line-height:1.7"><b>Slot time par sirf 5 minute wait kiya jayega.</b> ${b.tier === "video" ? "Camera on rakhein, achhi roshni aur stable network ke saath" : "Stable network aur headphones ke saath"}, isi email id (${esc(b.email)}) se join karein.</p>
      <p style="font-size:13px;color:#666;margin-top:28px">Contact: thedivinetarothindi@gmail.com | +91 88281 16545</p></div>`,
  }, { kind: "reminder", bid: b.bid, slot: `${b.date}T${b.time}`, by: b.by });
}

/** "Aapka form abhi baaki hai" — a fresh 24-hour form link for a paid customer who has not filled the form yet
 *  (sent once automatically ~12 h after payment by the cron, or any time from /admin). */
export async function sendFormReminder(b: { email: string; bid: string; tier?: string; formLink: string; by?: string }) {
  const when = isUrgentTier(b.tier) ? "48 ghante ke andar" : "7 se 10 din ke andar";
  const after = isWrittenTier(b.tier) ? `Form mein apne 3 sawal likhte hi, ${deliverWhen(b.tier)} ke andar aapke jawab isi email par aa jayenge.` : `Form bharte hi aapka appointment slot (${when}) aur Google Meet link isi email par aa jayega.`;
  await send({
    from: from(), to: b.email, subject: "Reminder: your reading form is still pending - The Divine Tarot",
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste</h2>
      <p>Aapka payment mil chuka hai${b.tier && b.tier !== "standard" ? ` (<b>${tierInfo(b.tier).name}</b>)` : ""}, lekin <b>reading form abhi tak nahi bhara gaya</b>.</p>
      <p>${after}</p>
      <p style="text-align:center;margin:26px 0"><a href="${b.formLink}" style="background:#6d28d9;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Reading Form Bharein</a><br/><span style="font-size:12px;color:#555">Yeh link sirf aapke liye hai aur 24 ghante tak valid hai.</span></p>
      <p style="font-size:13px;color:#666">Booking ID: ${b.bid}</p></div>`,
  }, { kind: "formReminder", bid: b.bid, by: b.by });
}

/** Admin moved the booking to a new slot (same Meet link). */
export async function sendRescheduled(b: { name: string; email: string; bid: string; date: string; time: string; oldKey: string; meetLink: string | null; tier?: string; note?: string; by?: string }) {
  const { day, range } = prettySlot(b.date, b.time, b.tier), [od, ot] = b.oldKey.split("T"), old = prettySlot(od, ot, b.tier);
  const meet = b.meetLink
    ? `<p style="text-align:center;margin:26px 0"><a href="${b.meetLink}" style="background:#6d28d9;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Join Google Meet</a><br/><span style="font-size:13px;color:#555">${b.meetLink} (link wahi hai)</span></p>` : "";
  await send({
    from: from(), to: b.email, subject: `Your reading has been rescheduled - ${day}, ${range.split(" – ")[0]} IST`,
    attachments: [{ filename: "reading.ics", content: ics(b.bid, b.date, b.time, b.meetLink, b.tier), contentType: "text/calendar; method=PUBLISH" }],
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste ${esc(b.name || "")}</h2>
      <p>Aapki reading ka <b>time badal diya gaya hai</b>.</p>
      <div style="background:#f6f3fb;border-left:3px solid #6d28d9;padding:14px 20px;margin:20px 0;line-height:1.8">
        <span style="color:#999;text-decoration:line-through">${old.day}, ${old.range}</span><br/>
        <b>Naya Date:</b> ${day}<br/><b>Naya Time:</b> ${range}<br/><b>Booking ID:</b> ${b.bid}
      </div>
      ${b.note ? `<p style="background:#fff4e5;padding:12px 16px;border-radius:6px">${esc(b.note)}</p>` : ""}
      ${meet}
      <p style="text-align:center"><a href="${gcalLink(b.date, b.time, b.meetLink, b.tier)}" style="color:#6d28d9;font-weight:600">📅 Naya time Google Calendar mein add karein</a></p>
      <p style="font-size:14px">Google Calendar invite bhi naye time ke saath update ho gaya hai. Slot time par sirf 5 minute wait kiya jayega.</p></div>`,
  }, { kind: "reschedule", bid: b.bid, slot: `${b.date}T${b.time}`, by: b.by });
}

/** Admin cancelled the booking (refund, if any, is done by hand in the Razorpay dashboard). */
export async function sendCancelled(b: { name: string; email: string; bid: string; key: string; tier?: string; refund: boolean; amount?: number; note?: string; by?: string }) {
  const [d, t] = b.key.split("T"), { day, range } = prettySlot(d, t, b.tier);
  await send({
    from: from(), to: b.email, subject: isWrittenTier(b.tier) ? "Your personal reading has been cancelled - The Divine Tarot" : `Your reading on ${day} has been cancelled - The Divine Tarot`,
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste ${esc(b.name || "")}</h2>
      <p>Aapki ${isWrittenTier(b.tier) ? `Personal Reading (Booking ID ${b.bid})` : `<b>${day}, ${range}</b> wali reading`} <b>cancel</b> kar di gayi hai.</p>
      ${b.note ? `<p style="background:#f6f3fb;padding:12px 16px;border-radius:6px">${esc(b.note)}</p>` : ""}
      ${b.refund ? `<p style="background:#edfaef;padding:12px 16px;border-radius:6px">Aapka refund${b.amount ? ` <b>₹${Number(b.amount).toLocaleString("en-IN")}</b>` : ""} process kar diya gaya hai. Bank ke hisaab se 5–7 working days mein aapke account mein aa jayega.</p>` : ""}
      <p style="font-size:13px;color:#666">Booking ID: ${b.bid}</p></div>`,
  }, { kind: "cancel", bid: b.bid, slot: b.key, by: b.by });
}

/** ~1 day after the reading: "kaisi lagi aapki reading?" with a personal 1-click rating link. */
export async function sendFeedbackRequest(b: { name: string; email: string; bid: string; date: string; time: string; tier?: string; link: string; by?: string }) {
  const { day } = prettySlot(b.date, b.time, b.tier);
  const star = (n: number) => `<a href="${b.link}&r=${n}" style="font-size:30px;text-decoration:none;color:#f59e0b;padding:0 3px">★</a>`;
  await send({
    from: from(), to: b.email, subject: "How was your reading? - The Divine Tarot",
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste ${esc(b.name || "")}</h2>
      <p>${isWrittenTier(b.tier) ? "Aapki Personal Reading (email par bheje gaye jawab)" : `Aapki <b>${day}</b> wali reading`} kaisi lagi? Aapka feedback humein aur behtar banne mein madad karta hai — sirf 30 second lagenge.</p>
      <p style="text-align:center;margin:22px 0 6px">${[1, 2, 3, 4, 5].map(star).join("")}</p>
      <p style="text-align:center;font-size:12px;color:#555;margin:0 0 22px">Star par click karein (5 = bahut achhi)</p>
      <p style="text-align:center"><a href="${b.link}" style="background:#6d28d9;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Feedback dein</a></p>
      <p style="font-size:13px;color:#666">Booking ID: ${b.bid}</p></div>`,
  }, { kind: "feedback", bid: b.bid, slot: `${b.date}T${b.time}`, by: b.by });
}

/** Owner alert the moment an URGENT reading is paid (before the form) — urgent ones must never be missed. */
export async function sendOwnerUrgentPaid(o: { bid: string; tier?: string; amount?: number; email?: string; phone?: string }) {
  const to = (process.env.OWNER_EMAIL || process.env.SMTP_USER || "").split(",").map((x) => x.trim()).filter(Boolean);
  await send({
    from: from(), to, subject: `⚡ URGENT payment received - ${tierInfo(o.tier).name} - ₹${Number(o.amount || 0).toLocaleString("en-IN")}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px"><h3 style="color:#c2410c">⚡ URGENT booking ka payment aa gaya</h3>
      <p><b>${esc(tierInfo(o.tier).name)}</b> · ₹${Number(o.amount || 0).toLocaleString("en-IN")}<br/>Customer: ${esc(o.email || "-")} · ${esc(o.phone || "-")}<br/>Booking ID: ${o.bid}</p>
      <p>${isWrittenTier(o.tier) ? "Customer form bharte hi aapko sawalon wali email aayegi — jawab <b>48 ghante ke andar</b> bhejne hain." : "Customer form bharte hi slot confirm hoga (48 ghante ke andar)."}</p></div>`,
  }, { kind: "owner", bid: o.bid });
}
