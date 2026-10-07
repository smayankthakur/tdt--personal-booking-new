import nodemailer from "nodemailer";
import { slotMs } from "./slots";

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
async function send(m: nodemailer.SendMailOptions) {
  return transporter().sendMail({ ...m, text: toText(String(m.html || "")), headers: { "X-Auto-Response-Suppress": "OOF, AutoReply", ...(m.headers as object) } });
}
const from = () => process.env.SMTP_FROM || `"The Divine Tarot" <${process.env.SMTP_USER}>`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export const prettySlot = (date: string, time: string) => {
  const d = new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const [h, m] = time.split(":").map(Number);
  const start = h * 60 + m, end = start + Number(process.env.CALL_MINUTES || 40);
  const f = (t: number) => `${Math.floor(t / 60) % 12 || 12}:${String(t % 60).padStart(2, "0")} ${Math.floor(t / 60) < 12 ? "AM" : "PM"}`;
  return { day: d, range: `${f(start)} – ${f(end)} (IST)` };
};

const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** .ics attachment so the slot lands in any calendar app. */
function ics(bid: string, date: string, time: string, meet: string | null) {
  const s = slotMs(date, time), e = s + Number(process.env.CALL_MINUTES || 40) * 60000;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Divine Tarot//Booking//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${bid}@thedivinetarot`, `DTSTAMP:${utc(Date.now())}`, `DTSTART:${utc(s)}`, `DTEND:${utc(e)}`,
    "SUMMARY:Personal Reading — The Divine Tarot", `LOCATION:${meet || "Google Meet (link by email)"}`,
    `DESCRIPTION:Google Meet: ${meet || "link will be sent separately"}`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Reading in 30 minutes", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

/** Sent to the customer right after the form is submitted: schedule + Meet link. */
export async function sendClientConfirmation(b: { name: string; email: string; bid: string; date: string; time: string; meetLink: string | null }) {
  const { day, range } = prettySlot(b.date, b.time);
  const meet = b.meetLink
    ? `<p style="text-align:center;margin:26px 0"><a href="${b.meetLink}" style="background:#6d28d9;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Join Google Meet</a><br/><span style="font-size:13px;color:#555">${b.meetLink}</span></p>`
    : `<p style="background:#fff4e5;padding:12px 16px;border-radius:6px">Aapka Google Meet link thodi der mein alag email se bhej diya jayega.</p>`;
  await send({
    from: from(), to: b.email,
    subject: `Your reading is confirmed - ${day}, ${range.split(" – ")[0]} IST`,
    attachments: [{ filename: "reading.ics", content: ics(b.bid, b.date, b.time, b.meetLink), contentType: "text/calendar; method=PUBLISH" }],
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste ${esc(b.name)}</h2>
      <p>Aapka payment aur form mil gaya hai. Aapki Personal Reading confirm ho chuki hai.</p>
      <div style="background:#f6f3fb;border-left:3px solid #6d28d9;padding:14px 20px;margin:20px 0;line-height:1.8">
        <b>Date:</b> ${day}<br/><b>Time:</b> ${range}<br/><b>Call:</b> Google Meet (40 min)<br/><b>Booking ID:</b> ${b.bid}
      </div>
      ${meet}
      <div style="font-size:14px;line-height:1.7">
        <b>Zaroori baatein:</b>
        <ul style="padding-left:18px">
          <li>Slot time par isi email id (${esc(b.email)}) se Meet join karein. Better experience ke liye headphones lagayein.</li>
          <li>Hum sirf 5 minute wait karte hain — uske baad appointment miss maani jayegi.</li>
          <li>Slot time nikalne ke baad reschedule nahi hota. Koi refund nahi diya jata.</li>
          <li>Stable network mein rahein; baar-baar call cut hui toh appointment cancel ho sakti hai.</li>
          <li>Sirf form mein di gayi details (max 3 log) ki reading hoti hai.</li>
        </ul>
      </div>
      <p style="font-size:13px;color:#666;margin-top:28px">Contact: thedivinetarothindi@gmail.com | +91 88281 16545</p></div>`,
  });
}

/** Sent to the owner with every answer and the uploaded photos attached. */
export async function sendOwnerNotification(sub: Record<string, any>, photos: { filename: string; content: Buffer; contentType: string }[], meetLink: string | null) {
  const to = (process.env.OWNER_EMAIL || process.env.SMTP_USER || "").split(",").map((x) => x.trim()).filter(Boolean); // one or many addresses
  const { day, range } = prettySlot(sub.date, sub.time);
  const rows = Object.entries(sub.answers as Record<string, string>).filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">${esc(k)}</td><td style="padding:4px 0"><b>${esc(String(v))}</b></td></tr>`).join("");
  await send({
    from: from(), to, replyTo: sub.email,
    subject: `${sub.tier === "urgent" ? "⚡ URGENT " : ""}New reading form - ${sub.name} - ${day} ${range.split(" – ")[0]}`,
    attachments: photos,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px"><h3>${day} · ${range}</h3>
      <p>Meet: ${meetLink ? `<a href="${meetLink}">${meetLink}</a>` : "<b style='color:#c00'>NOT CREATED — create manually</b>"}<br/>Booking ID: ${sub.bid} · Payment: ${sub.paymentId || "-"}</p>
      <table>${rows}</table><p>Photos attached: ${photos.length}</p></div>`,
  });
}

/** Payment receipt. Deliberately has NO form link: the form opens only on the page Razorpay returns to after payment. */
export async function sendPaymentReceived(b: { email: string; bid: string; tier?: string }) {
  const when = b.tier === "urgent" ? "48 ghante ke andar" : "7 se 10 din ke andar";
  await send({
    from: from(), to: b.email, subject: "Payment received - The Divine Tarot",
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1b1330">
      <h2 style="color:#6d28d9">Namaste</h2>
      <p>Aapka payment receive ho gaya hai${b.tier === "urgent" ? " (<b>Urgent booking</b>)" : ""}. Payment ke baad jo page khula hai, usi par <b>reading form bharein</b> (2-3 minute).</p>
      <p>Form submit karte hi aapka <b>appointment slot (${when}), Google Meet link aur schedule</b> isi email par aa jayega.</p>
      <p style="background:#fff4e5;padding:12px 16px;border-radius:6px;font-size:14px">Page band ho gaya? Usi phone/browser se booking page dobara kholein — form wahin mil jayega. Na mile toh WhatsApp karein <b>+91 88281 16545</b> aur yeh Booking ID bhejein: <b>${b.bid}</b></p></div>`,
  });
}
