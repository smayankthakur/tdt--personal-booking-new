import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { DEFAULT_CFG, type Cfg } from "./slots";

// Preferred: paste the whole downloaded service-account JSON (single line) into FIREBASE_SERVICE_ACCOUNT_JSON.
// That keeps project_id, client_email and private_key from the SAME file. Fallback: the 3 separate vars.
function credential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const j = JSON.parse(raw);
    return cert({ projectId: j.project_id, clientEmail: j.client_email, privateKey: j.private_key });
  }
  const missing = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"].filter((k) => !process.env[k]);
  if (missing.length) throw new Error("Missing Firebase env vars: " + missing.join(", "));
  return cert({
    projectId: process.env.FIREBASE_PROJECT_ID as string,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL as string,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY as string).replace(/\\n/g, "\n"),
  });
}
// Initialised on first use (not at import), so `next build` succeeds even before env vars exist.
let _db: Firestore | null = null;
function real(): Firestore {
  if (!_db) { if (!getApps().length) initializeApp({ credential: credential() }); _db = getFirestore(); }
  return _db;
}
export const db = new Proxy({} as Firestore, {
  get: (_t, prop) => { const v = (real() as any)[prop]; return typeof v === "function" ? v.bind(real()) : v; },
});
export const CFG_DOC = "config/schedule2026";
export async function getCfg(): Promise<Cfg> {
  // New schedule (12 Oct – 30 Nov, every day, festivals blocked) lives in a fresh doc so an older saved
  // Tue/Fri setting in "config/availability" can't override it. /admin saves here.
  const s = await db.doc(CFG_DOC).get();
  return s.exists ? { ...DEFAULT_CFG, ...(s.data() as Cfg) } : DEFAULT_CFG;
}
