"use client";
import { useEffect, useMemo, useState } from "react";
import { ALL_TIERS, TIER_INFO, slotMs, type Cfg } from "@/lib/slots";
import "./admin.css";
import { Notice, TypeTag, tone } from "./ui";
import Dashboard from "./Dashboard";
import Bookings from "./Bookings";
import CustomerPanel from "./CustomerPanel";
import Customers from "./Customers";
import CalendarView from "./CalendarView";
import Reports from "./Reports";
import { buildCustomers } from "./customers";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Admin() {
  const [token, setToken] = useState(""), [cfg, setCfg] = useState<Cfg | null>(null), [rows, setRows] = useState<any[]>([]), [orders, setOrders] = useState<any[]>([]), [tab, setTab] = useState<"dash" | "book" | "cal" | "cust" | "pay" | "report" | "slots" | "price" | "tools">("dash"), [msg, setMsg] = useState(""), [openId, setOpenId] = useState(""), [missing, setMissing] = useState<string[]>([]), [note, setNote] = useState("");
  const [cancelled, setCancelled] = useState<any[]>([]), [custOpen, setCustOpen] = useState("");
  const customers = useMemo(() => buildCustomers(rows, orders, cancelled), [rows, orders, cancelled]);
  const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [who, setWho] = useState(""), [busy, setBusy] = useState(false);
  const SKEY = "tdt_admin";
  useEffect(() => { // keep the session across refreshes in this tab only
    try { const v = JSON.parse(sessionStorage.getItem(SKEY) || "null"); if (v?.token) { setToken(v.token); setWho(v.email); } } catch {}
  }, []);
  useEffect(() => { if (token) load(); }, [token]);
  const logout = () => { try { sessionStorage.removeItem(SKEY); } catch {} setToken(""); setWho(""); setCfg(null); setPw(""); };
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(""); setBusy(true);
    try {
      const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error || "Login nahi hua"); setBusy(false); return; }
      try { sessionStorage.setItem(SKEY, JSON.stringify({ token: j.token, email: j.email })); } catch {}
      setPw(""); setWho(j.email); setToken(j.token);
    } catch { setMsg("Network error"); }
    setBusy(false);
  };
  const load = async () => {
    const r = await fetch("/api/admin", { headers: { "x-admin-session": token } });
    if (r.status === 401) { logout(); return setMsg("Session khatam ho gaya. Dobara login karein."); }
    if (!r.ok) return setMsg("Load nahi hua");
    const j = await r.json(); setCfg(j.cfg); setRows(j.bookings); setOrders(j.orders || []); setCancelled(j.cancelled || []); setMissing(j.missingEnv || []); setMsg("");
  };
  /** JSON call to an /api/admin… route with the session header (logs out on 401). */
  const api = async (path: string, method = "GET", body?: unknown) => {
    const r = await fetch(path, { method, headers: { "x-admin-session": token, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.status === 401) logout();
    return r.json().catch(() => ({ error: `Server error (${r.status})` }));
  };
  const openBooking = (slot: string) => { setTab("book"); setOpenId(slot); setTimeout(() => document.getElementById("bk-" + slot)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60); };
  const formReminder = async (bid: string) => { setNote("Form reminder bheja ja raha hai…"); const j = await api("/api/admin/mail", "POST", { bid, kind: "formReminder" }); setNote(j.result || j.error || "Kuch galat hua"); load(); };
  // ---- Prices, seasonal offer, coupons (/api/admin/pricing) ----
  const TIERS = ALL_TIERS.map((t) => [t, TIER_INFO[t].name] as const);
  const [pricing, setPricing] = useState<any>(null), [coupons, setCoupons] = useState<any[]>([]), [pmsg, setPmsg] = useState(""), [delCode, setDelCode] = useState("");
  const [nc, setNc] = useState<any>({ code: "", type: "percent", value: "", tiers: [...ALL_TIERS], expires: "", maxUses: "" });
  const papi = (method: string, body?: object, q = "") => fetch(`/api/admin/pricing${q}`, { method, headers: { "x-admin-session": token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => { if (r.status === 401) logout(); return r.json(); });
  const loadPricing = async () => { const j = await papi("GET"); if (j.pricing) { setPricing(j.pricing); setCoupons(j.coupons || []); } };
  const savePricing = async () => { setPmsg("Save ho raha hai…"); const j = await papi("PUT", pricing); setPmsg(j.ok ? "Saved ✓ — website par 1 minute ke andar dikhega" : j.error || "Save nahi hua"); if (j.pricing) setPricing(j.pricing); };
  const createCoupon = async () => { setPmsg(""); const j = await papi("POST", { ...nc, value: Number(nc.value), maxUses: nc.maxUses ? Number(nc.maxUses) : null, expires: nc.expires || null }); if (j.ok) { setPmsg(`Coupon ${j.coupon.code} ban gaya ✓`); setNc({ ...nc, code: "", value: "", maxUses: "", expires: "" }); loadPricing(); } else setPmsg(j.error || "Coupon nahi bana"); };
  const [editCode, setEditCode] = useState(""), [ec, setEc] = useState<any>({});
  const patchCoupon = async (body: object) => { const j = await papi("PATCH", body); setPmsg(j.ok ? "Coupon update ho gaya ✓" : j.error || "Update nahi hua"); setEditCode(""); loadPricing(); };
  const deleteCoupon = async (code: string) => { const j = await papi("DELETE", undefined, `?code=${encodeURIComponent(code)}`); setDelCode(""); setPmsg(j.ok ? `Coupon ${code} delete ho gaya` : j.error || "Delete nahi hua"); loadPricing(); };
  const setPrice = (t: string, v: string) => setPricing({ ...pricing, prices: { ...pricing.prices, [t]: v } });
  const setOffer = (o: object) => setPricing({ ...pricing, offer: { ...pricing.offer, ...o } });
  const setOfferPrice = (t: string, v: string) => setOffer({ prices: { ...pricing.offer.prices, [t]: v === "" ? null : v } });
  const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

  const retry = async (slot: string) => {
    setNote("Try ho raha hai…");
    const r = await fetch("/api/admin", { method: "POST", headers: { "x-admin-session": token, "Content-Type": "application/json" }, body: JSON.stringify({ slot }) });
    const j = await r.json(); setNote(`${slot.replace("T", " ")}: ${j.result || j.error}`); load();
  };
  const resume = async (bid: string) => {
    const r = await fetch("/api/admin", { method: "POST", headers: { "x-admin-session": token, "Content-Type": "application/json" }, body: JSON.stringify({ resume: bid }) });
    const j = await r.json();
    if (j.link) { await navigator.clipboard?.writeText(j.link).catch(() => {}); setNote(`Form link (24 ghante valid, customer ko bhejein — copy ho gaya): ${j.link}`); }
    else setNote(j.error || "Link nahi bana");
  };
  const invite = async () => {
    setNote("Upcoming customers ko Google Calendar invite bheja ja raha hai…");
    const r = await fetch("/api/admin", { method: "POST", headers: { "x-admin-session": token, "Content-Type": "application/json" }, body: JSON.stringify({ inviteUpcoming: true }) });
    const j = await r.json(); setNote(j.result || j.error || "Kuch galat hua"); load();
  };
  const editLinks = async () => {
    setNote("Pichhle 24 ghante wale customers ko edit link bheja ja raha hai…");
    const r = await fetch("/api/admin", { method: "POST", headers: { "x-admin-session": token, "Content-Type": "application/json" }, body: JSON.stringify({ sendEditLinks: true }) });
    const j = await r.json(); setNote(j.result || j.error || "Kuch galat hua"); load();
  };
  const saveCfg = async (c: Cfg) => {
    const r = await fetch("/api/admin", { method: "PUT", headers: { "x-admin-session": token, "Content-Type": "application/json" }, body: JSON.stringify(c) });
    if (r.ok) setCfg(c);
    return r.ok;
  };
  const save = async () => {
    const r = await fetch("/api/admin", { method: "PUT", headers: { "x-admin-session": token, "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
    setMsg(r.ok ? "Saved ✓ — naye slots turant live" : "Save nahi hua");
  };
  const day = (i: number) => cfg!.days[i] || { on: false, start: "12:00", end: "18:00" };
  const setDay = (i: number, p: object) => setCfg({ ...cfg!, days: { ...cfg!.days, [i]: { ...day(i), ...p } } });
  const uday = (i: number) => cfg!.urgentDays?.[i] || { on: false, start: "12:00", end: "21:00" };
  const setUday = (i: number, p: object) => setCfg({ ...cfg!, urgentDays: { ...cfg!.urgentDays, [i]: { ...uday(i), ...p } } });
  const box = {} as const; // inputs are styled by the WordPress-like admin stylesheet (.wpa)

  // ---------- WordPress-style admin UI ----------
  const TYPE = (t?: string) => <TypeTag t={t} />;

  if (!cfg) return (
    <div className="wpa-login">
      <div className="wpa-login-box">
        <div className="wpa-login-logo"><img src="/logo.png" alt="" /><span>The Divine Tarot</span></div>
        {msg && <div className="wpa-login-error">{msg}</div>}
        <form onSubmit={signIn} className="wpa-login-form">
          {token ? <p>Load ho raha hai…</p> : (<>
            <label>Email Address<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Password<input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            <div className="wpa-login-row"><span className="wpa-muted">Booking Admin</span><button className="wpa-btn primary large" disabled={busy || !email || !pw}>{busy ? "Logging in…" : "Log In"}</button></div>
          </>)}
        </form>
      </div>
      <p className="wpa-login-back"><a href="/">← Go to The Divine Tarot</a></p>
    </div>);

  const paidForm = orders.filter((o) => o.status === "paid" && o.formDone).length, paidPending = orders.filter((o) => o.status === "paid" && !o.formDone).length, unpaid = orders.filter((o) => o.status !== "paid" && o.status !== "cancelled").length;
  const MENU = [
    ["dash", "🏠", "Dashboard", 0],
    ["book", "📅", "Bookings", rows.filter((b) => { const [d, t] = b.slot.split("T"); return slotMs(d, t) >= Date.now(); }).length],
    ["cal", "📆", "Calendar", 0],
    ["cust", "👥", "Customers", 0],
    ["pay", "💳", "Payments", paidPending],
    ["report", "📊", "Reports", 0],
    ["slots", "🕒", "Slots", 0],
    ["price", "🏷️", "Prices & Offers", 0],
    ["tools", "🛠️", "Tools", 0],
  ] as const;
  const TITLE = { dash: "Dashboard", book: "Bookings", cal: "Calendar", cust: "Customers", report: "Revenue Report", pay: "Payments", slots: "Slot Settings", price: "Prices & Offers", tools: "Tools" } as const;
  return (
    <div className="wpa">
      <div className="wpa-bar">
        <span className="wpa-bar-logo"><img src="/logo.png" alt="" />The Divine Tarot</span>
        <a href="/" target="_blank" rel="noreferrer">🏠 Visit Site</a>
        <span className="wpa-bar-right">Howdy, <b>{who}</b><button onClick={logout}>Log Out</button></span>
      </div>
      <nav className="wpa-menu">
        {MENU.map(([k, ic, l, n]) => (
          <button key={k} className={tab === k ? "current" : ""} onClick={() => { setTab(k); if (k === "price") loadPricing(); }}>
            <span className="ic">{ic}</span><span className="lbl">{l}</span>{n > 0 && <span className="count">{n}</span>}
          </button>))}
      </nav>
      <main className="wpa-main">
        <div className="wpa-head">
          <h1>{TITLE[tab]}</h1>
          <button className="wpa-btn" onClick={() => { load(); if (tab === "price") loadPricing(); }}>↻ Refresh</button>
        </div>
        {missing.length > 0 && <Notice kind="error">Vercel mein yeh settings missing hain: <b>{missing.join(", ")}</b> — jab tak yeh set nahi hongi Meet link aur emails nahi jayenge.</Notice>}
        {note && <div className="wpa-sticky"><Notice kind={tone(note)}>{note} <a className="wpa-dismiss" onClick={() => setNote("")}>✕</a></Notice></div>}

        {tab === "dash" && <Dashboard api={api} rows={rows} orders={orders} onNote={setNote} openBooking={openBooking} resumeLink={resume} />}

        {tab === "book" && <Bookings api={api} rows={rows} orders={orders} cancelled={cancelled} customers={customers} openId={openId} setOpenId={setOpenId} onNote={setNote} reload={load} retry={retry} openCustomer={setCustOpen} />}

        {tab === "cal" && <CalendarView api={api} cfg={cfg} saveCfg={saveCfg} openBooking={openBooking} onNote={setNote} />}

        {tab === "report" && <Reports api={api} />}

        {tab === "cust" && <Customers customers={customers} openCustomer={setCustOpen} />}

        {tab === "pay" && (<>
          <ul className="wpa-subsubsub"><li><b>Sab</b> ({orders.length})</li><li className="ok">Paid + form ({paidForm})</li><li className="warn">Paid, form baaki ({paidPending})</li><li>Unpaid ({unpaid})</li></ul>
          <table className="wpa-table">
            <thead><tr><th style={{ width: 150 }}>Status</th><th>Customer</th><th style={{ width: 200 }}>Reading</th><th style={{ width: 140 }}>Slot</th><th>Payment</th></tr></thead>
            <tbody>
              {!orders.length && <tr><td colSpan={5}>Abhi koi payment attempt nahi hai.</td></tr>}
              {orders.map((o) => (
                <tr key={o.bid}>
                  <td>{o.status === "cancelled" ? <span className="wpa-status err">Cancelled{o.refunded ? " · refund" : ""}</span> : o.status !== "paid" ? <span className="wpa-status">Payment pending</span> : o.refunded ? <span className="wpa-status warn">Refunded</span> : o.formDone ? <span className="wpa-status ok">Paid · form bhara</span> : <span className="wpa-status warn">Paid · form baaki</span>}</td>
                  <td><b>{o.name || "—"}</b><div className="wpa-muted">{o.email || "-"}{o.phone ? ` · ${o.phone}` : ""}</div>
                    {o.status === "paid" && !o.formDone && <div className="wpa-row-actions"><a onClick={() => formReminder(o.bid)}>Reminder email bhejo</a> | <a onClick={() => resume(o.bid)}>Form link copy</a>{o.formReminders ? <span className="wpa-muted"> · {o.formReminders} reminder gaye</span> : null}</div>}</td>
                  <td>{TYPE(o.tier)}</td>
                  <td>{o.slot ? o.slot.replace("T", " ") : "—"}</td>
                  <td>{o.amount ? <b>₹{Number(o.amount).toLocaleString("en-IN")}</b> : "—"}{o.coupon ? <span className="wpa-tag">🎟 {o.coupon}</span> : null}
                    <div className="wpa-muted">{new Date(o.paidAt || o.createdAt).toLocaleString("en-IN")} · ID {o.bid}{o.paymentId ? ` · ${o.paymentId}` : ""}</div></td>
                </tr>))}
            </tbody>
          </table>
        </>)}

        {tab === "slots" && (<>
          {msg && <Notice kind={tone(msg)}>{msg}</Notice>}
          <div className="wpa-postbox"><h2>Booking dates</h2><div className="inside">
            <p>Bookings <input type="date" value={cfg.fromDate || ""} onChange={(e) => setCfg({ ...cfg, fromDate: e.target.value })} /> se <input type="date" value={cfg.toDate || ""} onChange={(e) => setCfg({ ...cfg, toDate: e.target.value })} /> tak</p>
            <p>Band karne wali dates / festivals (YYYY-MM-DD, comma se alag):<br />
              <input className="wide" value={cfg.blocked.join(",")} onChange={(e) => setCfg({ ...cfg, blocked: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></p>
          </div></div>
          <div className="wpa-cols">
            <div className="wpa-postbox"><h2>Normal booking — days &amp; time (IST)</h2><div className="inside">
              <table className="wpa-form-table"><tbody>{DAYS.map((n, i) => (
                <tr key={i}><th><label><input type="checkbox" checked={day(i).on} onChange={(e) => setDay(i, { on: e.target.checked })} /> {n}</label></th>
                  <td><input type="time" value={day(i).start} onChange={(e) => setDay(i, { start: e.target.value })} /> to <input type="time" value={day(i).end} onChange={(e) => setDay(i, { end: e.target.value })} /></td></tr>))}</tbody></table>
              <p>Call length <input className="sm" type="number" value={cfg.duration} onChange={(e) => setCfg({ ...cfg, duration: +e.target.value })} /> min &nbsp; Slot gap <input className="sm" type="number" value={cfg.step} onChange={(e) => setCfg({ ...cfg, step: +e.target.value })} /> min</p>
              <p>Payment ke kam se kam <input className="sm" type="number" value={cfg.minDays} onChange={(e) => setCfg({ ...cfg, minDays: +e.target.value })} /> din baad · max <input className="sm" type="number" value={cfg.advanceDays} onChange={(e) => setCfg({ ...cfg, advanceDays: +e.target.value })} /> din aage tak</p>
            </div></div>
            <div className="wpa-postbox"><h2>⚡ Urgent bookings — days &amp; time (IST)</h2><div className="inside">
              <table className="wpa-form-table"><tbody>{DAYS.map((n, i) => (
                <tr key={"u" + i}><th><label><input type="checkbox" checked={uday(i).on} onChange={(e) => setUday(i, { on: e.target.checked })} /> {n}</label></th>
                  <td><input type="time" value={uday(i).start} onChange={(e) => setUday(i, { start: e.target.value })} /> to <input type="time" value={uday(i).end} onChange={(e) => setUday(i, { end: e.target.value })} /></td></tr>))}</tbody></table>
              <p>Payment ke <input className="sm" type="number" value={cfg.urgentHours} onChange={(e) => setCfg({ ...cfg, urgentHours: +e.target.value })} /> ghante ke andar · kam se kam <input className="sm" type="number" value={cfg.urgentLeadHours} onChange={(e) => setCfg({ ...cfg, urgentLeadHours: +e.target.value })} /> ghante baad</p>
              <p className="description">Normal aur urgent ke start time ek jaise rakhein (12:00, 13:00…) taaki slots overlap na hon. Band dates dono par lagti hain.</p>
            </div></div>
          </div>
          <p><button className="wpa-btn primary" onClick={save}>Save Changes</button></p>
        </>)}

        {tab === "price" && (!pricing ? <p>Load ho raha hai…</p> : (<>
          {pmsg && <Notice kind={tone(pmsg)}>{pmsg}</Notice>}
          <div className="wpa-postbox"><h2>Readings — on/off &amp; prices (₹)</h2><div className="inside">
            <p className="description">OFF karne par woh reading website se hat jaati hai (card, buttons, sticky bar) aur uski nayi booking nahi hoti. Pehle se bani bookings par koi asar nahi.</p>
            <table className="wpa-table compact"><thead><tr><th>Reading</th><th style={{ width: 120 }}>Website par</th><th style={{ width: 160 }}>Regular price</th><th style={{ width: 200 }}>Offer price <small>(khaali = nahi)</small></th></tr></thead><tbody>
              {TIERS.map(([t, l]) => { const off = pricing.enabled?.[t] === false; return (
                <tr key={t} className={off ? "past" : ""}><td><b>{l}</b></td>
                  <td><label className={`wpa-toggle ${off ? "" : "on"}`}><input type="checkbox" checked={!off} onChange={(e) => setPricing({ ...pricing, enabled: { ...pricing.enabled, [t]: e.target.checked } })} /><span />{off ? "OFF" : "ON"}</label></td>
                  <td><input type="number" min={100} value={pricing.prices[t] ?? ""} onChange={(e) => setPrice(t, e.target.value)} /></td>
                  <td><input type="number" min={100} value={pricing.offer.prices?.[t] ?? ""} onChange={(e) => setOfferPrice(t, e.target.value)} placeholder="—" /></td></tr>); })}
            </tbody></table>
            {pricing.enabled && Object.values(pricing.enabled).every((v) => v === false) && <Notice kind="warning">Saari readings OFF hain — website par &quot;Bookings abhi band hain&quot; dikhega.</Notice>}
          </div></div>
          <div className="wpa-postbox"><h2>Seasonal discount / offer</h2><div className="inside">
            <table className="wpa-form-table"><tbody>
              <tr><th>Offer</th><td><label><input type="checkbox" checked={!!pricing.offer.on} onChange={(e) => setOffer({ on: e.target.checked })} /> Offer chalu hai</label></td></tr>
              <tr><th>Naam</th><td><input value={pricing.offer.name || ""} onChange={(e) => setOffer({ name: e.target.value })} placeholder="Diwali Offer" /></td></tr>
              <tr><th>Dates</th><td><input type="date" value={pricing.offer.from || ""} onChange={(e) => setOffer({ from: e.target.value })} /> se <input type="date" value={pricing.offer.until || ""} onChange={(e) => setOffer({ until: e.target.value })} /> tak
                <p className="description">Offer sirf in dates ke beech (India time) aur sirf un readings par lagta hai jinka offer price bhara hai.</p></td></tr>
            </tbody></table>
          </div></div>
          <p><button className="wpa-btn primary" onClick={savePricing}>Save Changes</button></p>

          <div className="wpa-postbox"><h2>Coupons</h2><div className="inside">
            <div className="wpa-inline-form">
              <input value={nc.code} onChange={(e) => setNc({ ...nc, code: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="CODE (jaise SAVE10)" />
              <select value={nc.type} onChange={(e) => setNc({ ...nc, type: e.target.value })}><option value="percent">% off</option><option value="flat">₹ off</option></select>
              <input className="sm" type="number" value={nc.value} onChange={(e) => setNc({ ...nc, value: e.target.value })} placeholder={nc.type === "percent" ? "10" : "500"} />
              <span className="wpa-muted">Expiry</span><input type="date" min={today} value={nc.expires} onChange={(e) => setNc({ ...nc, expires: e.target.value })} />
              <input type="number" min={1} value={nc.maxUses} onChange={(e) => setNc({ ...nc, maxUses: e.target.value })} placeholder="Max uses (khaali = unlimited)" />
            </div>
            <div className="wpa-inline-form">{TIERS.map(([t, l]) => <label key={t}><input type="checkbox" checked={nc.tiers.includes(t)} onChange={(e) => setNc({ ...nc, tiers: e.target.checked ? [...nc.tiers, t] : nc.tiers.filter((x: string) => x !== t) })} /> {l}</label>)}
              <button className="wpa-btn primary" onClick={createCoupon} disabled={!nc.code || !nc.value}>Add Coupon</button></div>
            <table className="wpa-table compact" style={{ marginTop: 12 }}><thead><tr><th>Code</th><th>Discount</th><th>Readings</th><th>Expiry</th><th>Used</th><th style={{ width: 170 }}></th></tr></thead><tbody>
              {!coupons.length && <tr><td colSpan={6}>Abhi koi coupon nahi hai.</td></tr>}
              {coupons.map((c) => { const expired = c.expires && c.expires < today, full = c.maxUses && c.used >= c.maxUses; return editCode === c.code ? (
                <tr key={c.code}><td><b>{c.code}</b></td><td colSpan={5}><div className="wpa-inline-form" style={{ margin: 0 }}>
                  <span className="wpa-muted">Expiry</span><input type="date" value={ec.expires || ""} onChange={(e) => setEc({ ...ec, expires: e.target.value })} />
                  <input type="number" min={1} value={ec.maxUses || ""} onChange={(e) => setEc({ ...ec, maxUses: e.target.value })} placeholder="Max uses (khaali = unlimited)" />
                  <button className="wpa-btn primary" onClick={() => patchCoupon({ code: c.code, expires: ec.expires || null, maxUses: ec.maxUses ? Number(ec.maxUses) : null })}>Save</button>
                  <button className="wpa-btn" onClick={() => setEditCode("")}>Cancel</button></div></td></tr>) : (
                <tr key={c.code} className={expired || full || c.paused ? "past" : ""}>
                  <td><b>{c.code}</b>{c.paused ? <span className="wpa-status warn">paused</span> : expired ? <span className="wpa-status">expired</span> : full ? <span className="wpa-status">limit poori</span> : null}</td>
                  <td>{c.type === "percent" ? `${c.value}%` : `₹${c.value}`} off</td>
                  <td>{(c.tiers || []).map((t: string) => TIERS.find(([k]) => k === t)?.[1]).join(", ")}</td>
                  <td>{c.expires || "—"}</td>
                  <td>{c.used || 0}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                  <td style={{ textAlign: "right" }}>{delCode === c.code
                    ? <><button className="wpa-btn danger" onClick={() => deleteCoupon(c.code)}>Pakka delete?</button> <button className="wpa-btn" onClick={() => setDelCode("")}>Nahi</button></>
                    : <><a onClick={() => patchCoupon({ code: c.code, paused: !c.paused })}>{c.paused ? "Chalu karein" : "Pause"}</a> | <a onClick={() => { setEditCode(c.code); setEc({ expires: c.expires || "", maxUses: c.maxUses || "" }); }}>Edit</a> | <a className="wpa-link-delete" onClick={() => setDelCode(c.code)}>Delete</a></>}</td>
                </tr>); })}
            </tbody></table>
            <p className="description">Pause karne par coupon turant band ho jaata hai (delete nahi hota, baad mein chalu kar sakte hain). Coupon offer price ke upar lagta hai. Koi bhi price ₹100 se kam nahi hoti. &quot;Used&quot; sirf payment hone par badhta hai.</p>
          </div></div>
        </>))}

        {tab === "tools" && (<>
          <div className="wpa-postbox"><h2>📅 Upcoming customers ko calendar invite bhejo</h2><div className="inside">
            <p>Jin aane wali bookings ko abhi tak Google Calendar invite nahi gaya, unhe ek baar bhejta hai.</p>
            <p><button className="wpa-btn" onClick={invite}>Invite bhejo</button></p>
          </div></div>
          <div className="wpa-postbox"><h2>✏️ Edit link bhejo (pichhle 24 ghante)</h2><div className="inside">
            <p>Jinhone pichhle 24 ghante mein form bhara aur jinka edit time abhi baaki hai, unhe form edit ka link email karta hai (har customer ko ek baar).</p>
            <p><button className="wpa-btn" onClick={editLinks}>Edit link bhejo</button></p>
          </div></div>
        </>)}
        <p className="wpa-footer">The Divine Tarot · Booking Admin</p>
        {custOpen && customers.get(custOpen) && <CustomerPanel api={api} c={customers.get(custOpen)!} onClose={() => setCustOpen("")} openBooking={openBooking} />}
      </main>
    </div>);
}
