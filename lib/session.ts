import crypto from "crypto";

/**
 * The reading form is never reachable by URL. After a verified payment the server sets a signed,
 * httpOnly cookie holding the booking ID, and /form + its APIs read the booking from that cookie only.
 */
export const COOKIE = "tdt_bk";
const BID = /^[A-Za-z0-9]{8,20}$/;
const key = () => process.env.FORM_SECRET || process.env.RAZORPAY_KEY_SECRET || "";
const mac = (s: string) => crypto.createHmac("sha256", key()).update(s).digest("base64url");
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function originOf(req: Request) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
  const proto = host.startsWith("localhost") ? "http" : req.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export const sealBid = (bid: string) => `${bid}.${mac("bk:" + bid)}`;

/** Booking ID from the signed cookie, or null. */
export function bidFrom(req: Request): string | null {
  const m = (req.headers.get("cookie") || "").match(/(?:^|;\s*)tdt_bk=([^;]+)/);
  if (!m || !key()) return null;
  const [bid, sig] = decodeURIComponent(m[1]).split(".");
  return bid && sig && BID.test(bid) && same(sig, mac("bk:" + bid)) ? bid : null;
}

export const cookieOpts = (req: Request) => ({
  httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 14 * 86400,
  secure: !originOf(req).startsWith("http://"),
});

/** Razorpay signs its return redirect: HMAC(link_id|reference_id|status|payment_id, key secret). */
export function razorpayReturnOk(q: URLSearchParams) {
  const sig = q.get("razorpay_signature") || "", secret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!sig || !secret) return false;
  const body = ["razorpay_payment_link_id", "razorpay_payment_link_reference_id", "razorpay_payment_link_status", "razorpay_payment_id"].map((k) => q.get(k) || "").join("|");
  return same(sig, crypto.createHmac("sha256", secret).update(body).digest("hex"));
}

/** Admin-only, 24-hour link to reopen a paid customer's form (e.g. they changed phone). Never emailed automatically. */
export const resumeToken = (bid: string, exp = Date.now() + 864e5) => `${bid}.${exp}.${mac(`rs:${bid}:${exp}`)}`;
export function openResume(t: string): string | null {
  const [bid, exp, sig] = t.split(".");
  if (!bid || !exp || !sig || !key() || !BID.test(bid) || Number(exp) < Date.now()) return null;
  return same(sig, mac(`rs:${bid}:${exp}`)) ? bid : null;
}
