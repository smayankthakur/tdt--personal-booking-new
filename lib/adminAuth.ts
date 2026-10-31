import crypto from "crypto";
import { db } from "./db";
import { same, sign } from "./session";

/**
 * /admin login: email + password. Every admin has their OWN password.
 * Firestore config/admin (server-only, never in this public repo):
 *   { users: { "<email>": "<scrypt hash>" } }
 * Older shape { emails: [...], passHash } (one shared password) still works: each email uses passHash until
 * that admin sets their own password, which moves the doc to the `users` map.
 * After login the server hands out a signed 12-hour session token (header x-admin-session). The token includes
 * part of THAT admin's hash, so changing a password logs out only that admin's old sessions.
 */
const DOC = "config/admin", TTL = 12 * 3600 * 1000;
const MAX_FAILS = 5, WINDOW = 15 * 60 * 1000, LOCK = 15 * 60 * 1000;
export const MIN_PW = 10;
type Users = Record<string, string>;

let cache: { at: number; users: Users | null } | null = null;
async function users(fresh = false): Promise<Users | null> {
  if (!fresh && cache && Date.now() - cache.at < 60_000) return cache.users;
  const d = (await db.doc(DOC).get()).data() as any;
  let u: Users | null = null;
  if (d?.users && typeof d.users === "object") u = Object.fromEntries(Object.entries(d.users as Users).map(([e, h]) => [e.toLowerCase(), String(h)]));
  else if (d?.passHash && Array.isArray(d.emails)) u = Object.fromEntries(d.emails.map((e: string) => [String(e).toLowerCase(), d.passHash]));
  if (u && !Object.keys(u).length) u = null;
  cache = { at: Date.now(), users: u };
  return u;
}

export function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 32).toString("base64url")}`;
}
function checkPassword(pw: string, stored: string) {
  const [alg, salt, hash] = String(stored || "").split("$");
  return alg === "scrypt" && !!salt && !!hash && same(crypto.scryptSync(pw, salt, 32).toString("base64url"), hash);
}
const ver = (hash: string) => hash.slice(-12); // part of the hash: new password => that admin's old sessions die
const b64 = (s: string) => Buffer.from(s).toString("base64url"), unb64 = (s: string) => Buffer.from(s, "base64url").toString();
const token = (email: string, hash: string) => { const exp = Date.now() + TTL; return `${b64(email)}.${exp}.${sign(`adm:${email}:${exp}:${ver(hash)}`)}`; };

/** Logged-in admin email for this request, or null. */
export async function adminFrom(req: Request): Promise<string | null> {
  const [e, exp, sig] = (req.headers.get("x-admin-session") || "").split(".");
  if (!e || !exp || !sig || Number(exp) < Date.now()) return null;
  const u = await users(), email = unb64(e);
  if (!u || !u[email]) return null;
  return same(sig, sign(`adm:${email}:${exp}:${ver(u[email])}`)) ? email : null;
}

export async function login(rawEmail: string, pw: string): Promise<{ token: string; email: string } | { error: string; status: number }> {
  const email = String(rawEmail || "").trim().toLowerCase().slice(0, 200), now = Date.now();
  const lockRef = db.doc(`adminLogins/${crypto.createHash("sha256").update(email).digest("hex").slice(0, 32)}`);
  const lk = (await lockRef.get()).data() || {};
  if ((lk.lockedUntil || 0) > now) return { error: `Bahut galat try. ${Math.ceil((lk.lockedUntil - now) / 60000)} minute baad try karein.`, status: 429 };
  const u = await users(true);
  if (!u) return { error: "Admin login set nahi hai.", status: 503 };
  const ok = !!u[email] && checkPassword(String(pw || ""), u[email]);
  if (!ok) {
    const fails = [...(lk.fails || []).filter((t: number) => now - t < WINDOW), now];
    await lockRef.set({ fails, lockedUntil: fails.length >= MAX_FAILS ? now + LOCK : 0, lastFail: now }, { merge: true });
    return { error: "Email ya password galat hai.", status: 401 };
  }
  await lockRef.set({ fails: [], lockedUntil: 0, lastLogin: now }, { merge: true });
  return { token: token(email, u[email]), email };
}

export const pwProblem = (pw: string) =>
  pw.length < MIN_PW ? `Password kam se kam ${MIN_PW} characters ka ho.` : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? "Password mein letters aur numbers dono hon." : "";

/** Admin list (emails only — hashes never leave the server). */
export async function adminList() { return Object.keys((await users(true)) || {}).sort(); }

/** Writes the users map (migrating the old shared-password shape) and refreshes the cache. */
async function update(fn: (u: Users) => Users | string): Promise<Users | string> {
  const ref = db.doc(DOC);
  const r = await db.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data() as any;
    const cur: Users = d?.users ? { ...d.users } : Object.fromEntries((d?.emails || []).map((e: string) => [String(e).toLowerCase(), d.passHash]));
    const next = fn(cur);
    if (typeof next === "string") return next;
    tx.set(ref, { users: next, updatedAt: Date.now() }); // drops the old emails/passHash fields
    return next;
  });
  cache = null;
  return r;
}

/** Own password change (needs the current one). Returns a fresh session token for this admin. */
export async function changeOwnPassword(email: string, current: string, next: string) {
  const u = await users(true);
  if (!u?.[email] || !checkPassword(String(current || ""), u[email])) return { error: "Purana password galat hai." };
  const bad = pwProblem(String(next || "")); if (bad) return { error: bad };
  if (checkPassword(next, u[email])) return { error: "Naya password purane se alag rakhein." };
  const h = hashPassword(next);
  const r = await update((cur) => (cur[email] ? { ...cur, [email]: h } : "Admin nahi mila."));
  return typeof r === "string" ? { error: r } : { token: token(email, h) };
}

/** Add an admin, or set a new password for another admin (they must change it after logging in). */
export async function setAdmin(rawEmail: string, pw: string) {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email) || email.length > 200) return { error: "Email sahi likhein." };
  const bad = pwProblem(String(pw || "")); if (bad) return { error: bad };
  const h = hashPassword(pw);
  const r = await update((cur) => ({ ...cur, [email]: h }));
  return typeof r === "string" ? { error: r } : { ok: true, email };
}

export async function removeAdmin(self: string, rawEmail: string) {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (email === self) return { error: "Aap khud ko remove nahi kar sakte." };
  const r = await update((cur) => {
    if (!cur[email]) return "Yeh admin nahi hai.";
    const { [email]: _gone, ...rest } = cur;
    return Object.keys(rest).length ? rest : "Kam se kam ek admin zaroori hai.";
  });
  return typeof r === "string" ? { error: r } : { ok: true };
}
