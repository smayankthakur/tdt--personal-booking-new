import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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
if (!getApps().length) initializeApp({ credential: credential() });

export const db = getFirestore();
export async function getCfg(): Promise<Cfg> {
  const s = await db.doc("config/availability").get();
  return s.exists ? { ...DEFAULT_CFG, ...(s.data() as Cfg) } : DEFAULT_CFG;
}
