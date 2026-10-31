import { callMinutes, slotMs, tierLabel, tierTag } from "./slots";

/** Customer + the owner accounts that must be on every event (override with CALENDAR_GUESTS, comma-separated). */
const guests = (customer: string) =>
  Array.from(new Set([customer, ...(process.env.CALENDAR_GUESTS || "dev.thedivinetarot111@gmail.com,thedivinetarot111@gmail.com").split(",")].map((e) => e.trim().toLowerCase()).filter(Boolean)));

const EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

async function googleToken() {
  const miss = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"].filter((k) => !process.env[k]);
  if (miss.length) throw new Error("Missing env: " + miss.join(", "));
  const tok = await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string, client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN as string, grant_type: "refresh_token",
    }),
  })).json();
  if (!tok.access_token) throw new Error(`Google login failed: ${tok.error || "?"} — ${tok.error_description || ""}`);
  return tok.access_token as string;
}

/** What the CUSTOMER sees in the Google Calendar invite (they now receive it). */
const describe = (bid: string, phone: string, tier?: string) =>
  [
    tier === "video" ? "Aapki Video Call Reading (30 min) — The Divine Tarot. Camera on rakhein, achhi roshni mein baithein. Sirf aapki reading, form wale 3 sawal."
      : tier === "q3" || tier === "q3urgent" ? "Aapki 3 Question Call Reading (30 min, voice) — The Divine Tarot. Sirf aapki reading, form wale 3 sawal." : "Aapki Personal Reading — The Divine Tarot.",
    "Slot time par upar diye gaye Google Meet link se join karein (isi email id se). Headphones lagayein.",
    "Sirf 5 minute wait kiya jayega — uske baad appointment miss maani jayegi. Koi refund / reschedule nahi.",
    "Contact / WhatsApp: +91 88281 16545",
    "",
    `Booking ID: ${bid}`,
    `WhatsApp: ${phone}`,
    `Type: ${tierLabel(tier)}`,
  ].join("\n");

/**
 * Creates a Google Calendar event with a Meet link and lets GOOGLE email the invite to every guest
 * (sendUpdates=all). Google's own invite mail (calendar-notification@google.com) reaches inboxes far more
 * reliably than SMTP, and puts the slot + Meet link straight into the customer's calendar with reminders.
 * Our own SMTP confirmation (with .ics) is still sent as well.
 */
export async function createMeet(key: string, b: { name: string; email: string; bid: string; phone: string; tier?: string }) {
  const [date, time] = key.split("T");
  const access = await googleToken();
  const start = slotMs(date, time), end = start + callMinutes(b.tier) * 60000;
  const iso = (ms: number) => new Date(ms + 330 * 60000).toISOString().slice(0, 19) + "+05:30";
  const res = await (await fetch(`${EVENTS}?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: `${tierTag(b.tier)}Personal Reading — ${b.name}`,
      description: describe(b.bid, b.phone, b.tier),
      start: { dateTime: iso(start), timeZone: "Asia/Kolkata" }, end: { dateTime: iso(end), timeZone: "Asia/Kolkata" },
      attendees: guests(b.email).map((email) => ({ email })),
      guestsCanInviteOthers: false, guestsCanModify: false,
      conferenceData: { createRequest: { requestId: key, conferenceSolutionKey: { type: "hangoutsMeet" } } },
      reminders: { useDefault: false, overrides: [{ method: "email", minutes: 1440 }, { method: "popup", minutes: 30 }] },
    }),
  })).json();
  if (!res.hangoutLink) throw new Error(`Calendar: ${res.error?.message || "event created without Meet link"}`);
  return { meetLink: res.hangoutLink as string | undefined, eventId: res.id as string | undefined };
}

/**
 * For events created before invites were switched on: makes sure the customer is a guest, refreshes the
 * description and asks Google to email the (updated) invite to every guest.
 */
export async function sendInvite(eventId: string, b: { email: string; bid: string; phone: string; tier?: string }) {
  const access = await googleToken();
  const cur = await (await fetch(`${EVENTS}/${encodeURIComponent(eventId)}`, { headers: { Authorization: `Bearer ${access}` } })).json();
  if (!cur?.id) throw new Error(`Calendar: ${cur?.error?.message || "event nahi mila"}`);
  const have = new Set((cur.attendees || []).map((a: any) => String(a.email).toLowerCase()));
  const attendees = [...(cur.attendees || []), ...guests(b.email).filter((e) => !have.has(e)).map((email) => ({ email }))];
  const res = await (await fetch(`${EVENTS}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({ description: describe(b.bid, b.phone, b.tier), attendees, guestsCanInviteOthers: false, guestsCanModify: false }),
  })).json();
  if (!res?.id) throw new Error(`Calendar: ${res?.error?.message || "invite nahi gaya"}`);
}

/** Customer changed their email while editing the form: swap the guest on the event and send the invite to the new address. */
export async function changeGuest(eventId: string, oldEmail: string, newEmail: string) {
  const access = await googleToken();
  const cur = await (await fetch(`${EVENTS}/${encodeURIComponent(eventId)}`, { headers: { Authorization: `Bearer ${access}` } })).json();
  if (!cur?.id) throw new Error(`Calendar: ${cur?.error?.message || "event nahi mila"}`);
  const o = oldEmail.toLowerCase(), n = newEmail.toLowerCase();
  const attendees = (cur.attendees || []).filter((a: any) => String(a.email).toLowerCase() !== o);
  if (!attendees.some((a: any) => String(a.email).toLowerCase() === n)) attendees.push({ email: n });
  const res = await (await fetch(`${EVENTS}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "PATCH", headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" }, body: JSON.stringify({ attendees }),
  })).json();
  if (!res?.id) throw new Error(`Calendar: ${res?.error?.message || "guest update nahi hua"}`);
}

const iso = (ms: number) => new Date(ms + 330 * 60000).toISOString().slice(0, 19) + "+05:30";

/** Booking moved to another slot: move the event (same Meet link) and let Google email the new time to every guest. */
export async function moveEvent(eventId: string, key: string, tier?: string) {
  const [date, time] = key.split("T"), start = slotMs(date, time), end = start + callMinutes(tier) * 60000;
  const access = await googleToken();
  const res = await (await fetch(`${EVENTS}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "PATCH", headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({ start: { dateTime: iso(start), timeZone: "Asia/Kolkata" }, end: { dateTime: iso(end), timeZone: "Asia/Kolkata" } }),
  })).json();
  if (!res?.id) throw new Error(`Calendar: ${res?.error?.message || "event move nahi hua"}`);
}

/** Booking cancelled: delete the event; Google emails a cancellation to every guest. */
export async function cancelEvent(eventId: string) {
  const access = await googleToken();
  const r = await fetch(`${EVENTS}/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: "DELETE", headers: { Authorization: `Bearer ${access}` } });
  if (!r.ok && r.status !== 410 && r.status !== 404) throw new Error(`Calendar: event delete nahi hua (${r.status})`);
}
