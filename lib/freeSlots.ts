import { FieldPath } from "firebase-admin/firestore";
import { db, getCfg } from "./db";
import { candidates, isTaken, slotMs, type Tier } from "./slots";

const ms = (k: string) => { const [d, t] = k.split("T"); return slotMs(d, t); };

/**
 * Bookable slots for one booking, earliest first, as "YYYY-MM-DDTHH:MM" (IST).
 * standard → day 7–10 after payment, earliest first (later only if that window is full), within 12 Oct – 30 Nov.
 * urgent   → within 48 h of payment (every day).
 * Slots held by this same booking (`bid`) count as free; `prefer` is moved to the front if still free.
 */
export async function freeSlots(o: { tier: Tier; paidAt?: number; bid?: string; prefer?: string }): Promise<string[]> {
  const cfg = await getCfg();
  const all = candidates(cfg, o.tier, o.paidAt || Date.now());
  if (!all.length) return [];
  const first = all[0].slice(0, 10), last = all[all.length - 1].slice(0, 10);
  const snap = await db.collection("bookings")
    .where(FieldPath.documentId(), ">=", first)
    .where(FieldPath.documentId(), "<=", last + "~").get();
  const taken = snap.docs.filter((d) => isTaken(d.data()) && (!o.bid || d.data().bid !== o.bid)).map((d) => ms(d.id));
  // a slot is blocked if any other booking starts less than one slot-gap away (standard and urgent share the calendar)
  const free = all.filter((k) => !taken.some((t) => Math.abs(t - ms(k)) < cfg.step * 60000));
  if (o.prefer && free.includes(o.prefer)) return [o.prefer, ...free.filter((k) => k !== o.prefer)];
  return free;
}
