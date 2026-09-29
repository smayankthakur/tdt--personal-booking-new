import { slotMs } from "./slots";

export function formUrl(b: { bid: string }) {
  return `${process.env.SITE_URL || ""}/form?bid=${b.bid}`;
}

/** Creates a Google Calendar event with a Meet link. No Google email goes out: our own confirmation email is sent after the form is submitted. */
export async function createMeet(key: string, b: { name: string; email: string; bid: string; phone: string }) {
  const [date, time] = key.split("T");
  const tok = await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID as string, client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN as string, grant_type: "refresh_token",
    }),
  })).json();
  const start = slotMs(date, time), end = start + Number(process.env.CALL_MINUTES || 40) * 60000;
  const iso = (ms: number) => new Date(ms + 330 * 60000).toISOString().slice(0, 19) + "+05:30";
  const res = await (await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `Personal Reading — ${b.name}`,
        description: `Booking ID: ${b.bid}\nWhatsApp: ${b.phone}\n\nReading form: ${formUrl(b)}`,
        start: { dateTime: iso(start), timeZone: "Asia/Kolkata" }, end: { dateTime: iso(end), timeZone: "Asia/Kolkata" },
        attendees: [{ email: b.email }],
        conferenceData: { createRequest: { requestId: key, conferenceSolutionKey: { type: "hangoutsMeet" } } },
        reminders: { useDefault: false, overrides: [{ method: "email", minutes: 1440 }, { method: "popup", minutes: 30 }] },
      }),
    }
  )).json();
  return { meetLink: res.hangoutLink as string | undefined, eventId: res.id as string | undefined };
}
