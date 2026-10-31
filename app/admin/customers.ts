/** Groups bookings, cancelled bookings and payments into customers (by email; phone when there is no email). */
export type Customer = { key: string; name: string; email: string; phone: string; bookings: any[]; orders: any[]; spent: number; last: string };

const mail = (...xs: unknown[]) => xs.map((x) => String(x || "").trim().toLowerCase()).find((x) => /^\S+@\S+\.\S+$/.test(x) && !/@razorpay\.com$/.test(x)) || "";
const ph = (x: unknown) => String(x || "").replace(/\D/g, "").slice(-10);
export const custKey = (email?: unknown, phone?: unknown) => mail(email) || (ph(phone).length === 10 ? `ph:${ph(phone)}` : "");

export function buildCustomers(rows: any[], orders: any[], cancelled: any[]): Map<string, Customer> {
  const map = new Map<string, Customer>(), byBid = new Map<string, string>(), byPhone = new Map<string, string>();
  const get = (key: string) => {
    if (!map.has(key)) map.set(key, { key, name: "", email: key.startsWith("ph:") ? "" : key, phone: "", bookings: [], orders: [], spent: 0, last: "" });
    return map.get(key)!;
  };
  for (const b of [...rows.map((r) => ({ ...r, _state: "confirmed" })), ...cancelled.map((c) => ({ ...c, _state: "cancelled" }))]) {
    // same phone as an earlier email-customer → same person (they may have typed another email)
    const key = custKey(b.email, b.phone), k = (!key.startsWith("ph:") && key) || byPhone.get(ph(b.phone)) || key;
    if (!k) continue;
    const c = get(k);
    c.bookings.push(b); c.name ||= b.name || ""; c.phone ||= b.phone || "";
    if (b.slot > c.last) { c.last = b.slot; c.name = b.name || c.name; }
    if (b.bid) byBid.set(b.bid, k);
    if (ph(b.phone).length === 10 && !byPhone.has(ph(b.phone))) byPhone.set(ph(b.phone), k);
  }
  for (const o of orders) {
    if (o.status !== "paid" && o.status !== "cancelled") continue;
    const k = byBid.get(o.bid) || custKey(o.customerEmail, "") || custKey(o.email, o.phone) || byPhone.get(ph(o.phone)) || "";
    if (!k) continue;
    const c = get(k);
    c.orders.push(o); c.phone ||= o.phone || ""; c.name ||= o.name || "";
    if (!o.refunded) c.spent += Number(o.amount || 0); // cancelled without refund: money was kept
  }
  return map;
}
