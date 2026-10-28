import { db } from "./db";
import { OFFER, REGULAR_PRICE, URGENT_PRICE, VIDEO_PRICE } from "./offer";
import { istDate, type Tier } from "./slots";

/**
 * Prices, seasonal offer and coupons — all editable from /admin (Firestore config/pricing + coupons/{CODE}).
 * Every amount charged is computed HERE on the server; the browser/app never sends an amount.
 */
export const TIERS: Tier[] = ["standard", "urgent", "video"];
export const TIER_NAME: Record<Tier, string> = { standard: "Voice Call (40 min)", urgent: "Urgent Voice Call (48 hrs)", video: "Video Call (30 min)" };
export const MIN_PRICE = 100; // nothing is ever charged below ₹100 (offers and coupons included)

export type Offer = { on: boolean; name: string; from: string; until: string; prices: Partial<Record<Tier, number | null>> };
export type Pricing = { prices: Record<Tier, number>; offer: Offer };
export type Coupon = { code: string; type: "percent" | "flat"; value: number; tiers: Tier[]; expires?: string | null; maxUses?: number | null; used: number; createdAt: number; createdBy?: string };

export const DEFAULT_PRICING: Pricing = {
  prices: { standard: Number(process.env.PRICE_INR || REGULAR_PRICE), urgent: Number(process.env.PRICE_URGENT_INR || URGENT_PRICE), video: Number(process.env.PRICE_VIDEO_INR || VIDEO_PRICE) },
  offer: { on: true, name: OFFER.name, from: "2026-10-01", until: istDate(OFFER.until), prices: { standard: OFFER.price } },
};
const DOC = "config/pricing";
let cache: { at: number; p: Pricing } | null = null;

export async function getPricing(fresh = false): Promise<Pricing> {
  if (!fresh && cache && Date.now() - cache.at < 30_000) return cache.p;
  const d = (await db.doc(DOC).get()).data() as Partial<Pricing> | undefined;
  const p: Pricing = { prices: { ...DEFAULT_PRICING.prices, ...(d?.prices || {}) }, offer: { ...DEFAULT_PRICING.offer, ...(d?.offer || {}) } };
  cache = { at: Date.now(), p };
  return p;
}
export async function savePricing(p: Pricing) { await db.doc(DOC).set(p); cache = null; }

export const offerLive = (o: Offer, now = Date.now()) => { const t = istDate(now); return !!o.on && (!o.from || t >= o.from) && (!o.until || t <= o.until); };

/** Price for a tier right now: the seasonal offer price when the offer is live and lower than the regular price. */
export function priceOf(p: Pricing, tier: Tier, now = Date.now()) {
  const regular = p.prices[tier], op = Number(p.offer.prices?.[tier] || 0);
  const live = offerLive(p.offer, now) && op >= MIN_PRICE && op < regular;
  return { regular, price: live ? op : regular, offerName: live ? p.offer.name : null, offerUntil: live ? p.offer.until : null };
}
export type PublicPrice = ReturnType<typeof priceOf>;
export async function publicPricing(): Promise<Record<Tier, PublicPrice>> {
  const p = await getPricing().catch(() => DEFAULT_PRICING);
  return { standard: priceOf(p, "standard"), urgent: priceOf(p, "urgent"), video: priceOf(p, "video") };
}

export const normCode = (c: unknown) => String(c || "").trim().toUpperCase().replace(/\s+/g, "");
export const CODE_RE = /^[A-Z0-9-]{3,20}$/;

/** Checks a coupon for a tier and returns the final amount (never below MIN_PRICE). */
export async function quote(tier: Tier, rawCode?: unknown): Promise<{ regular: number; price: number; offerName: string | null; coupon: string | null; discount: number; final: number } | { error: string }> {
  const p = await getPricing(), base = priceOf(p, tier);
  const code = normCode(rawCode);
  if (!code) return { ...base, coupon: null, discount: 0, final: base.price };
  if (!CODE_RE.test(code)) return { error: "Yeh coupon code sahi nahi hai." };
  const c = (await db.doc(`coupons/${code}`).get()).data() as Coupon | undefined;
  if (!c) return { error: "Yeh coupon code sahi nahi hai." };
  if (c.expires && istDate(Date.now()) > c.expires) return { error: "Yeh coupon expire ho chuka hai." };
  if (c.maxUses && (c.used || 0) >= c.maxUses) return { error: "Yeh coupon ki limit poori ho chuki hai." };
  if (c.tiers?.length && !c.tiers.includes(tier)) return { error: `Yeh coupon ${TIER_NAME[tier]} par nahi lagta.` };
  const off = c.type === "percent" ? Math.round((base.price * c.value) / 100) : c.value;
  const final = Math.max(MIN_PRICE, base.price - off);
  return { ...base, coupon: code, discount: base.price - final, final };
}

export const couponLabel = (c: Pick<Coupon, "type" | "value">) => (c.type === "percent" ? `${c.value}% off` : `₹${c.value} off`);
