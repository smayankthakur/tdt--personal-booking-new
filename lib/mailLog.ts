import { db } from "./db";

/**
 * Every customer / owner email (and Google Calendar invite) is recorded in Firestore `mailLog`, so /admin can show
 * which mail reached which booking, which ones failed and why, and re-send them. OTP codes are not logged.
 */
import type { MailKind } from "./mailKinds";
export type { MailKind } from "./mailKinds";

export type MailMeta = { kind: MailKind; bid?: string; slot?: string; by?: string };

export async function logMail(meta: MailMeta, to: string | string[], ok: boolean, err?: unknown) {
  try {
    await db.collection("mailLog").add({
      kind: meta.kind, bid: meta.bid || "", slot: meta.slot || "", by: meta.by || "system",
      to: (Array.isArray(to) ? to.join(", ") : String(to || "")).slice(0, 300), ok,
      err: ok ? "" : String((err as any)?.message || err || "").slice(0, 300), at: Date.now(),
    });
  } catch (e) { console.error("mailLog write failed", e); } // logging must never break the actual mail
}
