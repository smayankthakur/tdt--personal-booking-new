import crypto from "crypto";
import webpush from "web-push";
import { db } from "./db";

/**
 * Phone / desktop notifications for admins (Web Push, works when /admin is installed as an app or open in Chrome).
 * VAPID keys: env VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY if set, otherwise generated once and kept in Firestore
 * config/push (server-only, like config/admin) — so it works without any Vercel setup.
 * Subscriptions: pushSubs/{sha256(endpoint)}.
 */
let keys: { publicKey: string; privateKey: string } | null = null;
export async function vapid() {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return (keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY });
  const ref = db.doc("config/push");
  keys = await db.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    if (d?.publicKey && d?.privateKey) return { publicKey: d.publicKey as string, privateKey: d.privateKey as string };
    const k = webpush.generateVAPIDKeys();
    tx.set(ref, { ...k, createdAt: Date.now() });
    return k;
  });
  return keys;
}

export const subId = (endpoint: string) => crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

/** Sends to every subscribed admin device; dead subscriptions are removed. Never throws. */
export async function notifyAdmins(title: string, body: string, url = "/admin") {
  try {
    const snap = await db.collection("pushSubs").get();
    if (snap.empty) return 0;
    const k = await vapid(), subject = `mailto:${process.env.SMTP_USER || "dev.thedivinetarot111@gmail.com"}`;
    const payload = JSON.stringify({ title, body, url });
    let sent = 0;
    await Promise.all(snap.docs.map(async (d) => {
      try {
        await webpush.sendNotification(d.data().sub, payload, { vapidDetails: { subject, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 6 * 3600, timeout: 6000, urgency: "high" });
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await d.ref.delete().catch(() => {});
        else console.error("push failed", e?.statusCode, String(e?.body || e?.message || e).slice(0, 200));
      }
    }));
    return sent;
  } catch (e) { console.error("notifyAdmins failed", e); return 0; }
}
