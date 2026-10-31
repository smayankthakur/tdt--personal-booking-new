import { NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { db, getCfg } from "@/lib/db";
import { adminFrom } from "@/lib/adminAuth";
import { logActivity } from "@/lib/activity";
import { cancelEvent, moveEvent } from "@/lib/calendar";
import { logMail } from "@/lib/mailLog";
import { sendCancelled, sendRescheduled } from "@/lib/mailer";
import { addDays, daySlots, isTaken, slotMs } from "@/lib/slots";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

const KEY = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
const no = (error: string, status = 400) => NextResponse.json({ error }, { status });
const ms = (k: string) => { const [d, t] = k.split("T"); return slotMs(d, t); };
const pretty = (k: string) => new Date(ms(k)).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

async function docsBetween(from: string, to: string) {
  const s = await db.collection("bookings").where(FieldPath.documentId(), ">=", from).where(FieldPath.documentId(), "<=", to + "~").get();
  return s.docs.map((d) => ({ key: d.id, ...(d.data() as any) }));
}

/**
 * Day grid for the calendar view and the reschedule picker: ?from=YYYY-MM-DD&to=YYYY-MM-DD (max 31 days).
 * Every configured slot time (normal + urgent days) plus any booking at a custom time, with its state:
 * booked | held | blocked | busy (too close to another booking) | free.
 */
export async function GET(req: Request) {
  if (!(await adminFrom(req))) return no("unauthorized", 401);
  const q = new URL(req.url).searchParams, from = q.get("from") || "", to = q.get("to") || from, own = q.get("bid") || "";
  if (!DAY.test(from) || !DAY.test(to) || to < from || addDays(from, 31) < to) return no("Dates galat hain.");
  const cfg = await getCfg(), docs = await docsBetween(addDays(from, -1), addDays(to, 1)), now = Date.now();
  const taken = docs.filter((d) => isTaken(d));
  const blocking = taken.filter((d) => !own || d.bid !== own); // ?bid=… (reschedule picker): that booking's own slot does not block its neighbours
  const days = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const closed = cfg.blocked.includes(date);
    const times = new Set([...daySlots({ ...cfg, blocked: [] }, date, cfg.days), ...daySlots({ ...cfg, blocked: [] }, date, cfg.urgentDays || {}), ...docs.filter((d) => d.key.startsWith(date) && isTaken(d)).map((d) => d.key.slice(11))]);
    const slots = Array.from(times).sort().map((time) => {
      const key = `${date}T${time}`, d = taken.find((x) => x.key === key);
      if (d && own && d.bid === own) return { time, state: "own", name: d.name || "" };
      if (d) return { time, state: d.status === "confirmed" ? "booked" : d.status, name: d.name || "", tier: d.tier || "", bid: d.bid || "", outcome: d.outcome || "" };
      const near = blocking.some((x) => Math.abs(ms(x.key) - ms(key)) < cfg.step * 60000);
      return { time, state: near ? "busy" : "free", past: ms(key) < now };
    });
    days.push({ date, closed, slots });
  }
  return NextResponse.json({ days, step: cfg.step });
}

/**
 * Booking actions (all logged in `activity`):
 *  reschedule { slot, to, note?, notify? } → move booking + calendar event (same Meet link), mail the customer
 *  cancel     { slot, refund, note?, notify? } → booking moved to `cancelled/{bid}`, slot freed, event deleted, customer mailed
 *  outcome    { slot, outcome: "done" | "noshow" | "refunded" | "" }
 *  block / unblock { slot } → keep a free slot closed (calendar view)
 */
export async function POST(req: Request) {
  const who = await adminFrom(req);
  if (!who) return no("unauthorized", 401);
  const body = await req.json().catch(() => ({})), { action, slot } = body;
  if (!KEY.test(String(slot || ""))) return no("Slot galat hai.");
  const ref = db.doc(`bookings/${slot}`);

  if (action === "block" || action === "unblock") {
    const r = await db.runTransaction(async (tx) => {
      const s = await tx.get(ref), d = s.data();
      if (action === "block") {
        if (d && isTaken(d)) return d.status === "blocked" ? "ok" : "Is slot par booking hai — block nahi ho sakta.";
        tx.set(ref, { status: "blocked", blockedBy: who, blockedAt: Date.now(), reason: String(body.note || "").slice(0, 200) });
      } else {
        if (!d || d.status !== "blocked") return "Yeh slot blocked nahi hai.";
        tx.delete(ref);
      }
      return "ok";
    });
    if (r !== "ok") return no(r);
    await logActivity(who, action === "block" ? "Slot block kiya" : "Slot unblock kiya", pretty(slot));
    return NextResponse.json({ result: `${pretty(slot)} ${action === "block" ? "block ho gaya" : "phir se khul gaya"} ✓` });
  }

  const s = await ref.get(), b = s.data() as any;
  if (!b || b.status !== "confirmed") return no("Booking nahi mili (shayad pehle hi badal di gayi). Refresh karein.", 404);
  const oRef = b.bid ? db.doc(`orders/${b.bid}`) : null;

  if (action === "outcome") {
    const outcome = ["done", "noshow", "refunded"].includes(body.outcome) ? body.outcome : "";
    await ref.update({ outcome, outcomeAt: Date.now(), outcomeBy: who });
    if (oRef && (outcome === "refunded" || b.outcome === "refunded"))
      await oRef.update({ refunded: outcome === "refunded", refundedAt: outcome === "refunded" ? Date.now() : null }).catch(() => {});
    const L: Record<string, string> = { done: "Done", noshow: "No-show", refunded: "Refunded", "": "Status hataya" };
    await logActivity(who, `Reading status: ${L[outcome]}`, `${pretty(slot)} · ${b.name || ""} · ${b.bid || ""}`);
    return NextResponse.json({ result: `${b.name || "Booking"}: ${L[outcome]} ✓` });
  }

  if (action === "reschedule") {
    const to = String(body.to || "");
    if (!KEY.test(to)) return no("Naya slot chunein (date + time).");
    if (to === slot) return no("Naya slot purane jaisa hi hai.");
    if (ms(to) < Date.now() + 15 * 60e3) return no("Naya slot kam se kam 15 minute aage ka hona chahiye.");
    const cfg = await getCfg();
    const clash = (await docsBetween(addDays(to.slice(0, 10), -1), addDays(to.slice(0, 10), 1)))
      .find((d) => isTaken(d) && d.key !== slot && d.bid !== b.bid && Math.abs(ms(d.key) - ms(to)) < cfg.step * 60000);
    if (clash) return no(`Yeh time ${clash.key.slice(11)} wali ${clash.status === "blocked" ? "blocked slot" : "booking"} se takra raha hai (gap ${cfg.step} min chahiye).`);
    const nRef = db.doc(`bookings/${to}`), [nd, nt] = to.split("T");
    const r = await db.runTransaction(async (tx) => {
      const cur = await tx.get(ref), nx = await tx.get(nRef), o = oRef ? await tx.get(oRef) : null;
      const c = cur.data() as any;
      if (!c || c.status !== "confirmed" || c.bid !== b.bid) return "Booking badal chuki hai — refresh karein.";
      if (nx.exists && isTaken(nx.data())) return "Naya slot abhi abhi kisi aur ne le liya.";
      const { reminderAt, soonReminderAt, reminderErr, feedbackAt, ...keep } = c;
      tx.set(nRef, { ...keep, answers: { ...(c.answers || {}), Slot: `${nd} ${nt} IST` }, rescheduledFrom: slot, rescheduledAt: Date.now(), rescheduledBy: who, reschedules: (c.reschedules || 0) + 1 });
      tx.delete(ref);
      if (o?.exists && o.data()!.slot === slot) tx.update(oRef!, { slot: to });
      return "ok";
    });
    if (r !== "ok") return no(r, 409);
    const out = [`${b.name}: ${pretty(slot)} → ${pretty(to)} ✓`];
    if (b.eventId) {
      try { await moveEvent(b.eventId, to, b.tier); await logMail({ kind: "invite", bid: b.bid, slot: to, by: who }, b.email, true); out.push("Calendar update ✓"); }
      catch (e: any) { await logMail({ kind: "invite", bid: b.bid, slot: to, by: who }, b.email, false, e); out.push(`Calendar ERROR: ${String(e?.message || e).slice(0, 120)}`); }
    }
    if (body.notify !== false && b.email) {
      try { await sendRescheduled({ name: b.name, email: b.email, bid: b.bid, date: nd, time: nt, oldKey: slot, meetLink: b.meetLink || null, tier: b.tier, note: String(body.note || "").slice(0, 300), by: who }); out.push("Customer ko mail ✓"); }
      catch (e: any) { out.push(`Mail ERROR: ${String(e?.message || e).slice(0, 120)}`); }
    }
    await logActivity(who, "Booking reschedule ki", `${b.name || ""} · ${pretty(slot)} → ${pretty(to)} · ${b.bid || ""}`);
    return NextResponse.json({ result: out.join(" · "), slot: to });
  }

  if (action === "cancel") {
    const refund = !!body.refund, note = String(body.note || "").slice(0, 300);
    const r = await db.runTransaction(async (tx) => {
      const cur = await tx.get(ref), o = oRef ? await tx.get(oRef) : null, c = cur.data() as any;
      if (!c || c.status !== "confirmed" || c.bid !== b.bid) return { err: "Booking badal chuki hai — refresh karein." };
      tx.set(db.doc(`cancelled/${c.bid || slot}`), { ...c, slot, status: "cancelled", cancelledAt: Date.now(), cancelledBy: who, reason: note, refunded: refund });
      tx.delete(ref);
      if (o?.exists) tx.update(oRef!, { status: "cancelled", cancelledAt: Date.now(), refunded: refund, refundedAt: refund ? Date.now() : null });
      return { amount: Number(o?.data()?.amount || 0) };
    });
    if ("err" in r) return no(r.err as string, 409);
    const out = [`${b.name}: ${pretty(slot)} cancel ho gayi, slot free ✓`];
    if (b.eventId) {
      try { await cancelEvent(b.eventId); out.push("Calendar event hataya ✓"); }
      catch (e: any) { out.push(`Calendar ERROR: ${String(e?.message || e).slice(0, 120)}`); }
    }
    if (body.notify !== false && b.email) {
      try { await sendCancelled({ name: b.name, email: b.email, bid: b.bid, key: slot, tier: b.tier, refund, amount: r.amount, note, by: who }); out.push("Customer ko mail ✓"); }
      catch (e: any) { out.push(`Mail ERROR: ${String(e?.message || e).slice(0, 120)}`); }
    }
    if (refund) out.push(`Yaad se Razorpay dashboard se ₹${r.amount.toLocaleString("en-IN")} refund karein`);
    await logActivity(who, refund ? "Booking cancel + refund mark kiya" : "Booking cancel ki", `${b.name || ""} · ${pretty(slot)} · ${b.bid || ""}${note ? ` · ${note}` : ""}`);
    return NextResponse.json({ result: out.join(" · ") });
  }
  return no("Action nahi pehchana.");
}
