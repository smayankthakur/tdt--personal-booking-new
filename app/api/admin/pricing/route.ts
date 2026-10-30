import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { adminFrom } from "@/lib/adminAuth";
import { CODE_RE, MIN_PRICE, TIERS, getPricing, normCode, savePricing, type Coupon, type Pricing } from "@/lib/pricing";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const unauth = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

// Prices, seasonal offer and coupons for /admin.
export async function GET(req: Request) {
  if (!(await adminFrom(req))) return unauth();
  const cs = await db.collection("coupons").orderBy("createdAt", "desc").limit(200).get();
  return NextResponse.json({ pricing: await getPricing(true), coupons: cs.docs.map((d) => d.data()) });
}

// Save prices + seasonal offer.
export async function PUT(req: Request) {
  const who = await adminFrom(req); if (!who) return unauth();
  const b = (await req.json().catch(() => ({}))) as Pricing;
  const prices = {} as Pricing["prices"], offerPrices: Pricing["offer"]["prices"] = {};
  for (const t of TIERS) {
    const v = Math.round(Number(b?.prices?.[t]));
    if (!(v >= MIN_PRICE && v <= 500000)) return bad(`Price ₹${MIN_PRICE} se ₹5,00,000 ke beech honi chahiye (${t}).`);
    prices[t] = v;
    const o = b?.offer?.prices?.[t];
    if (o !== null && o !== undefined && String(o) !== "") {
      const n = Math.round(Number(o));
      if (!(n >= MIN_PRICE && n < v)) return bad(`Offer price ₹${MIN_PRICE} se zyada aur regular price se kam honi chahiye (${t}).`);
      offerPrices[t] = n;
    }
  }
  const o = b?.offer || ({} as Pricing["offer"]);
  if (o.on && (!DATE.test(o.from || "") || !DATE.test(o.until || "") || o.from > o.until)) return bad("Offer ki start aur end date sahi bharein.");
  const name = String(o.name || "").trim().slice(0, 40);
  if (o.on && !name) return bad("Offer ka naam likhein (jaise Diwali Offer).");
  const enabled = Object.fromEntries(TIERS.map((t) => [t, b?.enabled?.[t] !== false])) as Pricing["enabled"];
  await savePricing({ prices, offer: { on: !!o.on, name, from: o.from || "", until: o.until || "", prices: offerPrices }, enabled });
  revalidatePath("/"); // the landing page shows the new prices / on-off at once
  console.log("pricing saved by", who);
  return NextResponse.json({ ok: true, pricing: await getPricing(true) });
}

// Create a coupon.
export async function POST(req: Request) {
  const who = await adminFrom(req); if (!who) return unauth();
  const b = await req.json().catch(() => ({}));
  const code = normCode(b?.code), type = b?.type === "flat" ? "flat" : "percent", value = Math.round(Number(b?.value));
  if (!CODE_RE.test(code)) return bad("Code 3–20 characters ka ho: sirf A–Z, 0–9 aur -");
  if (type === "percent" && !(value >= 1 && value <= 90)) return bad("Percent discount 1 se 90 ke beech ho.");
  if (type === "flat" && !(value >= 1 && value <= 100000)) return bad("₹ discount sahi bharein.");
  const tiers = (Array.isArray(b?.tiers) ? b.tiers : []).filter((t: any) => TIERS.includes(t));
  if (!tiers.length) return bad("Kam se kam ek reading type chunein.");
  const expires = b?.expires ? String(b.expires) : null;
  if (expires && !DATE.test(expires)) return bad("Expiry date sahi bharein.");
  const maxUses = b?.maxUses ? Math.round(Number(b.maxUses)) : null;
  if (maxUses !== null && !(maxUses >= 1)) return bad("Max uses 1 ya zyada ho.");
  const ref = db.doc(`coupons/${code}`);
  if ((await ref.get()).exists) return bad("Yeh code pehle se hai.");
  const c: Coupon = { code, type, value, tiers, expires, maxUses, used: 0, createdAt: Date.now(), createdBy: who };
  await ref.set(c);
  return NextResponse.json({ ok: true, coupon: c });
}

// Delete a coupon: DELETE ?code=XYZ
export async function DELETE(req: Request) {
  if (!(await adminFrom(req))) return unauth();
  const code = normCode(new URL(req.url).searchParams.get("code"));
  if (!CODE_RE.test(code)) return bad("Code sahi nahi hai.");
  await db.doc(`coupons/${code}`).delete();
  return NextResponse.json({ ok: true });
}
