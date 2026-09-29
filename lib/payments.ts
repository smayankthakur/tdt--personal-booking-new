import { db } from "./db";
import { sendPaymentReceived } from "./mailer";

const auth = () => "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
const rz = async (path: string) => (await fetch(`https://api.razorpay.com/v1/${path}`, { headers: { Authorization: auth() }, cache: "no-store" })).json();

/** Marks an order paid exactly once (webhook and the return-page check can both call this). */
export async function markPaid(bid: string, plinkId: string, paymentId: string | null, email: string, phone: string) {
  const ref = db.doc(`orders/${bid}`);
  const order = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref), d = s.data();
    if (!d || d.plinkId !== plinkId) { tx.set(db.doc(`problems/${plinkId}`), { bid, paymentLink: plinkId, why: "paid but order missing/mismatch — check & refund manually", at: Date.now() }); return null; }
    if (d.status !== "created") return null; // already handled
    tx.update(ref, { status: "paid", paymentId, email, phone, paidAt: Date.now() });
    return d;
  });
  if (order && email) await sendPaymentReceived({ email, bid, origin: order.origin }).catch((e) => console.error("payment-received mail failed", e));
}

/** Asks Razorpay directly whether this order's payment link is paid — works even if the webhook never arrives. */
export async function verifyWithRazorpay(bid: string, plinkId: string) {
  const pl = await rz(`payment_links/${plinkId}`);
  if (pl?.status !== "paid") return false;
  const pid: string | null = pl.payments?.[0]?.payment_id || null;
  const p = pid ? await rz(`payments/${pid}`) : null;
  await markPaid(bid, plinkId, pid, p?.email || pl.customer?.email || "", p?.contact || pl.customer?.contact || "");
  return true;
}
