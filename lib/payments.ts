import { db } from "./db";
import { sendPaymentReceived } from "./mailer";
import { slotMs } from "./slots";
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
    tx.update(ref, { status: "paid", paymentId, email, phone, paidAt });
    if (hRef && h?.exists && h.data()!.bid === bid && h.data()!.status === "held") {
      const [sd, st] = String(d.heldSlot).split("T");
      tx.update(hRef, { holdUntil: slotMs(sd, st) });
    }
    return d;
  });
  const to = realEmail(email);
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
