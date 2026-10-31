import { FieldValue } from "firebase-admin/firestore";
import { db } from "./db";
import { sendPaymentReceived } from "./mailer";
import { slotMs, tierInfo } from "./slots";
import { notifyAdmins } from "./push";
import { resumeToken } from "./session";

/** Razorpay fills "void@razorpay.com" when the customer skips email at checkout — treat that as no email. */
export const realEmail = (...xs: (string | null | undefined)[]) =>
  xs.map((x) => String(x || "").trim()).find((x) => /^\S+@\S+\.\S+$/.test(x) && !/@razorpay\.com$/i.test(x)) || "";

const auth = () => "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
const rz = async (path: string) => (await fetch(`https://api.razorpay.com/v1/${path}`, { headers: { Authorization: auth() }, cache: "no-store" })).json();

/** Marks an order paid exactly once (webhook and the return-page check can both call this). */
export async function markPaid(bid: string, plinkId: string, paymentId: string | null, email: string, phone: string, paidAt = Date.now()) {
  const ref = db.doc(`orders/${bid}`);
  const order = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref), d = s.data();
    if (!d || d.plinkId !== plinkId) { tx.set(db.doc(`problems/${plinkId}`), { bid, paymentLink: plinkId, why: "paid but order missing/mismatch — check & refund manually", at: Date.now() }); return null; }
    if (d.status !== "created") return null; // already handled
    // Urgent: keep the slot that was held during payment reserved for this customer until the form is filled.
    const hRef = d.heldSlot ? db.doc(`bookings/${d.heldSlot}`) : null, h = hRef ? await tx.get(hRef) : null;
    const cRef = d.coupon ? db.doc(`coupons/${d.coupon}`) : null, c = cRef ? await tx.get(cRef) : null;
    tx.update(ref, { status: "paid", paymentId, email: realEmail(d.customerEmail, email) || email, phone, paidAt });
    if (cRef && c?.exists) tx.update(cRef, { used: FieldValue.increment(1) }); // a coupon counts as used only once paid
    if (hRef && h?.exists && h.data()!.bid === bid && h.data()!.status === "held") {
      const [sd, st] = String(d.heldSlot).split("T");
      tx.update(hRef, { holdUntil: slotMs(sd, st) });
    }
    return d;
  });
  if (order) await notifyAdmins(`💳 Naya payment ₹${Number(order.amount || 0).toLocaleString("en-IN")}`, `${tierInfo(order.tier).name}${order.coupon ? ` · 🎟 ${order.coupon}` : ""} · ${realEmail(order.customerEmail, email) || phone || "—"}`, "/admin");
  const to = realEmail(order?.customerEmail, email); // email typed on our site first, then Razorpay's
  if (order && to) {
    // Personal 24-hour form link (same signed token as the admin "Form link banao" button).
    const site = String(order.origin || process.env.SITE_URL || "https://booking.thedivinetarotonline.com").replace(/\/$/, "");
    const formLink = `${site}/api/resume?t=${resumeToken(bid)}`;
    await sendPaymentReceived({ email: to, bid, tier: order.tier, formLink }).catch((e) => console.error("payment-received mail failed", e));
  }
}

/** Asks Razorpay directly whether this order's payment link is paid — works even if the webhook never arrives. */
export async function verifyWithRazorpay(bid: string, plinkId: string) {
  const pl = await rz(`payment_links/${plinkId}`);
  if (pl?.status !== "paid") return false;
  const pid: string | null = pl.payments?.[0]?.payment_id || null;
  const p = pid ? await rz(`payments/${pid}`) : null;
  await markPaid(bid, plinkId, pid, realEmail(pl.customer?.email, p?.email) || p?.email || "", p?.contact || pl.customer?.contact || "");
  return true;
}

/**
 * Mobile app bookings are paid with Razorpay Checkout (a Razorpay ORDER, id "order_…") instead of a payment link.
 * The order id is stored in the same `plinkId` field, so markPaid's checks work unchanged.
 * Returns true once the order has a CAPTURED payment for the full amount (same as payment links, which always capture).
 */
export async function verifyOrderWithRazorpay(bid: string, orderId: string, paymentId?: string) {
  const order = await rz(`orders/${orderId}`);
  if (!order?.id || order.receipt !== bid) return false;
  const list = paymentId ? [await rz(`payments/${paymentId}`)] : (await rz(`orders/${orderId}/payments`))?.items || [];
  const p = list.find((x: any) => x?.order_id === orderId && x.status === "captured" && Number(x.amount) === Number(order.amount));
  if (!p) return false;
  // paidAt = when the customer actually paid (slot windows count from then, even if this check runs later)
  await markPaid(bid, orderId, p.id, p.email || "", p.contact || "", p.created_at ? Number(p.created_at) * 1000 : Date.now());
  return true;
}

/** Website bookings use payment links ("plink_…"), app bookings use orders ("order_…"). */
export const verifyAnyWithRazorpay = (bid: string, id: string) =>
  id.startsWith("order_") ? verifyOrderWithRazorpay(bid, id) : verifyWithRazorpay(bid, id);

/**
 * A reading was switched OFF in /admin: cancel every still-open Razorpay payment link of that reading (links live
 * 30 min), so nobody can pay for it through a link opened earlier. Only links Razorpay confirms as cancelled are
 * marked void here; a link that got paid in the meantime is left for markPaid as usual. Returns how many were closed.
 */
export async function voidOpenLinks(tiers: string[]) {
  if (!tiers.length) return 0;
  const snap = await db.collection("orders").where("createdAt", ">=", Date.now() - 40 * 60 * 1000).get();
  let n = 0;
  for (const d of snap.docs) {
    const o = d.data();
    if (o.status !== "created" || !tiers.includes(o.tier || "standard") || !String(o.plinkId || "").startsWith("plink_")) continue;
    try {
      const r = await (await fetch(`https://api.razorpay.com/v1/payment_links/${o.plinkId}/cancel`, { method: "POST", headers: { Authorization: auth(), "Content-Type": "application/json" }, cache: "no-store" })).json();
      const st = r?.status || (await rz(`payment_links/${o.plinkId}`))?.status;
      if (st !== "cancelled" && st !== "expired") continue; // paid / unknown → leave it alone
      await db.runTransaction(async (tx) => {
        const s = (await tx.get(d.ref)).data(), hRef = s?.heldSlot ? db.doc(`bookings/${s.heldSlot}`) : null, h = hRef ? await tx.get(hRef) : null;
        if (!s || s.status !== "created") return;
        tx.update(d.ref, { status: "void", voidReason: "reading switched off", voidAt: Date.now() });
        if (hRef && h?.exists && h.data()!.bid === d.id && h.data()!.status === "held") tx.delete(hRef); // free the urgent hold
      });
      n++;
    } catch (e) { console.error("cancel payment link failed", o.plinkId, e); }
  }
  return n;
}
