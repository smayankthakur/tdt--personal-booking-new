import { db } from "./db";

/** Who changed what in /admin (Firestore `activity`, newest first in the Activity page). Never stores passwords. */
export async function logActivity(by: string, action: string, detail = "") {
  try { await db.collection("activity").add({ by, action: action.slice(0, 80), detail: String(detail).slice(0, 500), at: Date.now() }); }
  catch (e) { console.error("activity log failed", e); } // never block the real action
}
