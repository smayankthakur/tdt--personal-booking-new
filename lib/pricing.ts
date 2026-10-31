import { db } from "./db";
import { OFFER, REGULAR_PRICE, URGENT_PRICE, VIDEO_PRICE } from "./offer";
import { ALL_TIERS, TIER_INFO, istDate, resolveTier, type Tier } from "./slots";

/**
 * Prices, seasonal offer and coupons — all editable from /admin (Firestore config/pricing + coupons/{CODE}).
 * Every amount charged is computed HERE on the server; the browser/app never sends an amount.
 */
export const TIERS: Tier[] = ALL_TIERS;
export const TIER_NAME = Object.fromEntries(ALL_TIERS.map((t) => [t, TIER_INFO[t].name])) as Record<Tier, string>;
export const MIN_PRICE = 100; // nothing is ever charged below ₹100 (offers and coupons included)

export type Offer = { on: boolean; name: string; from: string; until: string; prices: Partial<Record<Tier, number | null>> };
export type Pricing = { prices: Record<Tier, number>; offer: Offer; enabled: Record<Tier, boolean> };
export type Coupon = { code: string; type: "percent" | "flat"; value: number; tiers: Tier[]; expires?: string | null; maxUses?: number | null; used: number; createdAt: number; createdBy?: string; paused?: boolean };

export const DEFAULT_PRICING: Pricing = {
  prices: { standard: Number(process.env.PRICE_INR || REGULAR_PRICE), urgent: Number(process.env.PRICE_URGENT_INR || URGENT_PRICE), video: Number(process.env.PRICE_VIDEO_INR || VIDEO_PRICE), q3: 4500, q3urgent: 9000 }, // q3 prices = placeholders; admin sets them
  offer: { on: true, name: OFFER.name, from: "2026-10-01", until: istDate(OFFER.until), prices: { standard: OFFER.price } },
  // admin can switch each reading type off: hidden on the website + refused by the server.
  // The two 3-question voice readings start OFF until the admin sets their price and switches them on.
  enabled: { standard: true, urgent: true, video: true, q3: false, q3urgent: false },
};
const DOC = "config/pricing";
let cache: { at: number; p: Pricing } | null = null;

export async function getPricing(fresh = false): Promise<Pricing> {
  if (!fresh && cache && Date.now() - cache.at < 30_000) return cache.p;
  const d = (await db.doc(DOC).get()).data() as Partial<Pricing> | undefined;
  const p: Pricing = { prices: { ...DEFAULT_PRICING.prices, ...(d?.prices || {}) }, offer: { ...DEFAULT_PRICING.offer, ...(d?.offer || {}) }, enabled: { ...DEFAULT_PRICING.enabled, ...(d?.enabled || {}) } };
  cache = { at: Date.now(), p };
  return p;
}
export async function savePricing(p: Pricing) { await db.doc(DOC).set(p); cache = null; }

export const offerLive = (o: Offer, now = Date.now()) => { const t = istDate(now); return !!o.on && (!o.from || t >= o.from) && (!o.until || t <= o.until); };

/** Price for a tier right now: the seasonal offer price when the offer is live and lower than the regular price. */
export function priceOf(p: Pricing, tier: Tier, now = Date.now()) {
  const regular = p.prices[tier], op = Number(p.offer.prices?.[tier] || 0);
  const live = offerLive(p.offer, now) && op >= MIN_PRICE && op < regular;
  return { enabled: p.enabled[tier] !== false, regular, price: live ? op : regular, offerName: live ? p.offer.name : null, offerUntil: live ? p.offer.until : null };
}
export type PublicPrice = ReturnType<typeof priceOf>;
export async function publicPricing(): Promise<Record<Tier, PublicPrice>> {
  const p = await getPricing(true).catch(() => DEFAULT_PRICING); // page renders are rare (ISR) — always read fresh
  return Object.fromEntries(ALL_TIERS.map((t) => [t, priceOf(p, t)])) as Record<Tier, PublicPrice>;
}

export const normCode = (c: unknown) => String(c || "").trim().toUpperCase().replace(/\s+/g, "");
export const CODE_RE = /^[A-Z0-9-]{3,20}$/;

/**
 * The reading actually on sale for a requested tier: itself when ON, else the most similar ON reading
 * (old links, old app versions, a page opened before the admin switched it off). null = everything is OFF.
 */
export async function liveTier(tier: Tier): Promise<Tier | null> {
  return resolveTier(tier, (await getPricing()).enabled);
}
/** 409 body for a request naming a switched-off tier: the customer is moved to `alt` and sees its price before paying. */
export async function tierOff(tier: Tier) {
  const alt = await liveTier(tier);
  return {
    error: alt ? `${TIER_NAME[tier]} abhi available nahi hai — iski jagah ${TIER_NAME[alt]} chuna gaya hai. Price dekh kar dobara Continue dabayein.` : "Abhi koi booking available nahi hai.",
    code: "tier_off", alt, altName: alt ? TIER_NAME[alt] : null,
  };
}

/** Checks a coupon for a tier and returns the final amount (never below MIN_PRICE). */
export async function quote(tier: Tier, rawCode?: unknown): Promise<{ regular: number; price: number; offerName: string | null; coupon: string | null; discount: number; final: number } | { error: string }> {
  const p = await getPricing(), { enabled, ...base } = priceOf(p, tier);
  if (!enabled) return { error: `${TIER_NAME[tier]} abhi available nahi hai. Doosri reading chunein.` };
  const code = normCode(rawCode);
  if (!code) return { ...base, coupon: null, discount: 0, final: base.price };
  if (!CODE_RE.test(code)) return { error: "Yeh coupon code sahi nahi hai." };
  const c = (await db.doc(`coupons/${code}`).get()).data() as Coupon | undefined;
  if (!c) return { error: "Yeh coupon code sahi nahi hai." };
  if (c.paused) return { error: "Yeh coupon abhi band hai." };
  if (c.expires && istDate(Date.now()) > c.expires) return { error: "Yeh coupon expire ho chuka hai." };
  if (c.maxUses && (c.used || 0) >= c.maxUses) return { error: "Yeh coupon ki limit poori ho chuki hai." };
  if (c.tiers?.length && !c.tiers.includes(tier)) return { error: `Yeh coupon ${TIER_NAME[tier]} par nahi lagta.` };
  const off = c.type === "percent" ? Math.round((base.price * c.value) / 100) : c.value;
  const final = Math.max(MIN_PRICE, base.price - off);
  return { ...base, coupon: code, discount: base.price - final, final };
}

export const couponLabel = (c: Pick<Coupon, "type" | "value">) => (c.type === "percent" ? `${c.value}% off` : `₹${c.value} off`);
