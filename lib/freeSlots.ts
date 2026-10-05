import { FieldPath } from "firebase-admin/firestore";
import { db, getCfg } from "./db";
import { daySlots, istNow, ymd, slotMs, isTaken, LEAD_MS } from "./slots";

/** Every bookable slot, earliest first, as "YYYY-MM-DDTHH:MM" (IST). Used to auto-assign the customer's slot. */
export async function freeSlots(): Promise<string[]> {
  const cfg = await getCfg();
  const dates = Array.from({ length: cfg.advanceDays + 1 }, (_, i) => ymd(new Date(istNow().getTime() + i * 864e5)));
  const snap = await db.collection("bookings")
    .where(FieldPath.documentId(), ">=", dates[0])
    .where(FieldPath.documentId(), "<=", dates[dates.length - 1] + "~").get();
  const taken = new Set(snap.docs.filter((d) => isTaken(d.data())).map((d) => d.id));
  const out: string[] = [];
  for (const d of dates)
    for (const t of daySlots(cfg, d))
      if (!taken.has(`${d}T${t}`) && slotMs(d, t) > Date.now() + LEAD_MS) out.push(`${d}T${t}`);
  return out;
}
