import { slotMs } from "./slots";

/** A submitted form can be edited for 24 h after submission, but never later than 3 h before the slot. */
export const EDIT_MS = 24 * 3600 * 1000, CUTOFF_MS = 3 * 3600 * 1000;
export function editUntil(formAt: number | undefined, slot: string | undefined) {
  if (!formAt || !slot || !slot.includes("T")) return 0;
  const [d, t] = slot.split("T");
  return Math.min(formAt + EDIT_MS, slotMs(d, t) - CUTOFF_MS);
}

/** The raw form field values (names as in the form). Stored with new submissions; rebuilt from the readable
 *  answers for bookings made before raw values were stored. */
export function rawFromAnswers(a: Record<string, string> = {}): Record<string, string> {
  const r: Record<string, string> = {};
  const dob = (v: string | undefined, p: string) => { const x = String(v || "").split("/").map((s) => s.trim()); if (x.length === 3) [r[p + "d"], r[p + "m"], r[p + "y"]] = x; };
  const tob = (v: string | undefined, p: string) => { const m = String(v || "").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i); if (m) { r[p + "h"] = String(+m[1]); r[p + "min"] = m[2]; r[p + "ap"] = m[3].toUpperCase(); } };
  r.name = a["Full name"] || ""; r.phone = a["WhatsApp"] || ""; r.email = a["Email (payment)"] || ""; r.place = a["Place of birth"] || "";
  dob(a["Date of birth (D/M/Y)"], "dob"); tob(a["Birth time"], "tob");
  r.name2 = a["2nd person name"] || ""; dob(a["2nd DOB"], "dob2"); tob(a["2nd birth time"], "tob2"); r.place2 = a["2nd place"] || "";
  r.name3 = a["3rd person name"] || ""; dob(a["3rd DOB"], "dob3"); tob(a["3rd birth time"], "tob3"); r.place3 = a["3rd place"] || "";
  const c = a["Concern"] || "";
  if (c.startsWith("Other: ")) { r.concern = "Other"; r.concernOther = c.slice(7); } else r.concern = c;
  r.notes = a["Anything else"] || "";
  return r;
}
