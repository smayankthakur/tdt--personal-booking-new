import crypto from "crypto";
import { db } from "./db";
import { same, sign } from "./session";

/**
 * /admin login: email + password.
 * The admin emails and a scrypt HASH of the password live in Firestore (config/admin) — never in this
 * (public) repo. Firestore rules deny all client access; only the server reads it.
 * After login the server hands out a signed 12-hour session token (header x-admin-session).
 * Changing the password changes the hash, which instantly invalidates every old session.
 */
const DOC = "config/admin", TTL = 12 * 3600 * 1000;
const MAX_FAILS = 5, WINDOW = 15 * 60 * 1000, LOCK = 15 * 60 * 1000;
type Cfg = { emails: string[]; passHash: string };

let cache: { at: number; cfg: Cfg | null } | null = null;
async function cfg(): Promise<Cfg | null> {
  if (cache && Date.now() - cache.at < 60_000) return cache.cfg;
  const d = (await db.doc(DOC).get()).data() as Cfg | undefined;
  const c = d?.passHash && Array.isArray(d.emails) ? { emails: d.emails.map((e) => String(e).toLowerCase()), passHash: d.passHash } : null;
  cache = { at: Date.now(), cfg: c };
  return c;
}

export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 32).toString("base64url")}`;
}
function checkPassword(pw: string, stored: string) {
  const [alg, salt, hash] = stored.split("$");
  return alg === "scrypt" && !!salt && !!hash && same(crypto.scryptSync(pw, salt, 32).toString("base64url"), hash);
}
const ver = (passHash: string) => passHash.slice(-12); // part of the hash: new password => old sessions die
const b64 = (s: string) => Buffer.from(s).toString("base64url"), unb64 = (s: string) => Buffer.from(s, "base64url").toString();

/** Logged-in admin email for this request, or null. */
export async function adminFrom(req: Request): Promise<string | null> {
  const [e, exp, sig] = (req.headers.get("x-admin-session") || "").split(".");
  if (!e || !exp || !sig || Number(exp) < Date.now()) return null;
  const c = await cfg(), email = unb64(e);
  if (!c || !c.emails.includes(email)) return null;
  return same(sig, sign(`adm:${email}:${exp}:${ver(c.passHash)}`)) ? email : null;
}

export async function login(rawEmail: string, pw: string): Promise<{ token: string; email: string } | { error: string; status: number }> {
  const email = String(rawEmail || "").trim().toLowerCase().slice(0, 200), now = Date.now();
  const lockRef = db.doc(`adminLogins/${crypto.createHash("sha256").update(email).digest("hex").slice(0, 32)}`);
  const lk = (await lockRef.get()).data() || {};
  if ((lk.lockedUntil || 0) > now) return { error: `Bahut galat try. ${Math.ceil((lk.lockedUntil - now) / 60000)} minute baad try karein.`, status: 429 };
  const c = await cfg();
  if (!c) return { error: "Admin login set nahi hai.", status: 503 };
  const ok = c.emails.includes(email) && checkPassword(String(pw || ""), c.passHash);
  if (!ok) {
    const fails = [...(lk.fails || []).filter((t: number) => now - t < WINDOW), now];
    await lockRef.set({ fails, lockedUntil: fails.length >= MAX_FAILS ? now + LOCK : 0, lastFail: now }, { merge: true });
    return { error: "Email ya password galat hai.", status: 401 };
  }
  await lockRef.set({ fails: [], lockedUntil: 0, lastLogin: now }, { merge: true });
  const exp = now + TTL;
  return { token: `${b64(email)}.${exp}.${sign(`adm:${email}:${exp}:${ver(c.passHash)}`)}`, email };
}
