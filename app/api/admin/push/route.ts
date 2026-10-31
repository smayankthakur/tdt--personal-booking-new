import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminFrom } from "@/lib/adminAuth";
import { logActivity } from "@/lib/activity";
import { notifyAdmins, subId, vapid } from "@/lib/push";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const no = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Public VAPID key + how many devices are subscribed. */
export async function GET(req: Request) {
  const me = await adminFrom(req);
  if (!me) return no("unauthorized", 401);
  const s = await db.collection("pushSubs").get();
  return NextResponse.json({ publicKey: (await vapid()).publicKey, devices: s.docs.map((d) => ({ id: d.id, email: d.data().email, device: d.data().device, at: d.data().at })) });
}

/** { sub } → subscribe this device · { test: true } → send a test notification to all devices */
export async function POST(req: Request) {
  const me = await adminFrom(req);
  if (!me) return no("unauthorized", 401);
  const b = await req.json().catch(() => ({}));
  if (b.test) {
    const n = await notifyAdmins("🔔 Test notification", `${me} ne test bheja — notifications chal rahe hain ✓`);
    return NextResponse.json({ result: n ? `${n} device par test notification bheja ✓` : "Koi device subscribe nahi hai (ya bhejna fail hua)." });
  }
  const sub = b.sub;
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth || JSON.stringify(sub).length > 2000) return no("Subscription sahi nahi hai.");
  await db.doc(`pushSubs/${subId(sub.endpoint)}`).set({ sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, email: me, device: String(b.device || "").slice(0, 120), at: Date.now() });
  await logActivity(me, "Notifications on kiye", String(b.device || "").slice(0, 120));
  return NextResponse.json({ ok: true });
}

/** ?id=… (or { endpoint }) → stop notifications on that device */
export async function DELETE(req: Request) {
  const me = await adminFrom(req);
  if (!me) return no("unauthorized", 401);
  const q = new URL(req.url).searchParams, b = await req.json().catch(() => ({}));
  const id = q.get("id") || (b.endpoint ? subId(String(b.endpoint)) : "");
  if (!/^[a-f0-9]{40}$/.test(id)) return no("Device nahi mila.");
  await db.doc(`pushSubs/${id}`).delete();
  await logActivity(me, "Notifications band kiye", id.slice(0, 8));
  return NextResponse.json({ ok: true });
}
