"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import BookingWidget from "@/components/BookingWidget";
import StickyBook from "@/components/StickyBook";
import PayButton from "@/components/PayButton";
import ResumeBanner from "@/components/ResumeBanner";
import { inr } from "@/lib/offer";
import type { PublicPrice } from "@/lib/pricing";
import { TIER_INFO, resolveTier, tierFromHint, type Tier } from "@/lib/slots";


/** Fades an element up into view the first time it scrolls into the viewport. */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("in-view");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// Same menu, same order and same links as the header of thedivinetarotonline.com (third value = opens in a new tab).
const NAV: readonly (readonly [string, string, boolean?])[] = [
  ["Home", "https://thedivinetarotonline.com/"],
  ["About", "https://thedivinetarotonline.com/about"],
  ["Reading", "https://reading.thedivinetarotonline.com/"],
  ["Course", "https://learn.thedivinetarotonline.com/", true],
  ["Kundli Milan", "https://thedivinetarotonline.com/kundli-milan"],
  ["Reports", "https://thedivinetarotonline.com/reports"],
  ["Personal Reading", "https://booking.thedivinetarotonline.com/"],
];
const ACTIVE = "Personal Reading";
const tab = (n?: boolean) => (n ? { target: "_blank", rel: "noopener noreferrer" } : {});
const ASK_URL = "https://reading.thedivinetarotonline.com/";

/** Prices + seasonal offer come from /admin (lib/pricing.ts), passed in by app/page.tsx. */
type Prices = Record<Tier, PublicPrice>;
const untilText = (d?: string | null) => (d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

export default function Landing({ pricing }: { pricing: Prices }) {
  const [menu, setMenu] = useState(false); // phone/tablet hamburger menu
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", esc); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [menu]);
  const std = pricing.standard, offer = !!std.offerName;
  const OFFER = { name: std.offerName || "", price: std.price, untilText: untilText(std.offerUntil) };
  const price = inr(std.price), regular = inr(std.regular), urgent = inr(pricing.urgent.price), videoPrice = inr(pricing.video.price);
  const anyOffer = (["standard", "urgent", "video"] as const).find((t) => pricing[t].offerName), offerName = anyOffer ? pricing[anyOffer].offerName : null;
  const old = (p: PublicPrice) => (p.offerName ? <s className="old-price">{inr(p.regular)}</s> : null);
  // Reading types switched on in /admin; the page shows only those (cards, hero buttons, sticky bar).
  const on = { standard: pricing.standard.enabled, urgent: pricing.urgent.enabled, video: pricing.video.enabled, q3: pricing.q3.enabled, q3urgent: pricing.q3urgent.enabled,
    written: !!pricing.written?.enabled, writtenurgent: !!pricing.writtenurgent?.enabled };
  const count = Object.values(on).filter(Boolean).length;
  const order = ["written", "writtenurgent", "standard", "q3", "video", "urgent", "q3urgent"] as const;
  const primary = order.find((t) => on[t]) || null; // hero price + sticky bar
  const firstBtn = (t: (typeof order)[number]) => primary === t; // the first visible hero button is gold, the rest ghost
  const HERO: Record<(typeof order)[number], { mins: string; kind: string; lines: readonly string[]; sticky: string; stat?: [string, string] }> = {
    written: { mins: "", kind: "", lines: ["Personal Reading by Bharti Singh", "3 Questions", "Delivery within 7 days", "Hindi, Hinglish ya English — aapki pasand ki bhasha"], sticky: "3 Questions · Delivery within 7 days", stat: ["3 Sawal", "Detailed Answers on Email"] },
    writtenurgent: { mins: "", kind: "", lines: ["Urgent Personal Reading by Bharti Singh", "3 Questions", "Delivery within 48 hours", "Hindi, Hinglish ya English — aapki pasand ki bhasha"], sticky: "Urgent · 3 Questions · 48 hours", stat: ["48 Hrs", "Urgent Delivery"] },
    standard: { mins: "40", kind: "Voice Call Reading", lines: ["40 mins Voice Reading", "Appointment Within 7 - 10 Days"], sticky: "40 min voice call reading" },
    video: { mins: "30", kind: "Video Call Reading", lines: ["30 mins Video Call (Google Meet)", "Appointment Within 7 - 10 Days"], sticky: "30 min video call reading" },
    urgent: { mins: "40", kind: "Voice Call Reading", lines: ["40 mins Voice Reading", "Appointment Within 48 Hours"], sticky: "Urgent 40 min voice reading" },
    q3: { mins: "30", kind: "Voice Call · 3 Sawal", lines: ["30 mins Voice Call · 3 Sawal", "Appointment Within 7 - 10 Days"], sticky: "30 min call · 3 sawal" },
    q3urgent: { mins: "30", kind: "Voice Call · 3 Sawal", lines: ["30 mins Voice Call · 3 Sawal", "Appointment Within 48 Hours"], sticky: "Urgent 30 min call · 3 sawal" },
  };
  const hp = primary ? pricing[primary] : null, hero = primary ? HERO[primary] : null;
  const voice = on.standard || on.urgent || on.q3 || on.q3urgent;
  const calls = voice || on.video, writtenOn = on.written || on.writtenurgent;
  const title = writtenOn && !calls ? <>Personal Reading by Bharti Singh</> : voice && on.video ? <>Voice &amp; Video Call Reading</> : on.video ? <>Video Call Reading</> : <>Voice Call Reading</>;
  const wPrice = inr(pricing.written?.price || 0), wuPrice = inr(pricing.writtenurgent?.price || 0);
  const q3Price = inr(pricing.q3.price), q3uPrice = inr(pricing.q3urgent.price);

  // Old / shared links that name a reading (?tier=urgent, ?type=video, #voice, /3-questions …): jump to that card.
  // If the admin has switched that reading OFF, show the most similar reading that is ON instead (and say so).
  const [moved, setMoved] = useState<{ from: Tier; to: Tier } | null>(null);
  useEffect(() => {
    const url = new URL(window.location.href), keys = ["tier", "type", "reading", "call"];
    const hint = keys.map((k) => url.searchParams.get(k)).find(Boolean) || url.hash.slice(1);
    const asked = tierFromHint(hint);
    if (!asked) return;
    const to = resolveTier(asked, on);
    keys.forEach((k) => url.searchParams.delete(k));
    if (!to) { window.history.replaceState(null, "", `${url.pathname}${url.search}#book`); return; } // everything OFF: the page says so
    if (to !== asked) setMoved({ from: asked, to });
    window.history.replaceState(null, "", `${url.pathname}${url.search}#${to}`);
    const t = setTimeout(() => {
      const el = document.getElementById(to);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("card-focus"); setTimeout(() => el.classList.remove("card-focus"), 2600);
    }, 300);
    return () => clearTimeout(t);
  }, []);
  // shown at the top of the card the visitor was moved to, so it is on screen right after the scroll
  const movedNote = (t: Tier) => moved?.to === t ? <div className="moved-note" role="status">ℹ️ <b>{TIER_INFO[moved.from].name}</b> abhi available nahi hai — aapke liye iski jagah yeh reading dikhayi gayi hai.</div> : null;
  return (
    <>
      <ResumeBanner />
      {/* NAV — same look, links and order as the thedivinetarotonline.com header */}
      <header className="navbar">
        <div className="container navbar-inner">
          <a href="https://thedivinetarotonline.com/" className="brand">
            <img src="/logo.png" alt="The Divine Tarot" className="mark" />
            <span>
              <span className="brand-title">The Divine Tarot</span>
              <small>Premium Tarot Guidance</small>
            </span>
          </a>

          <nav className="nav-links" aria-label="Main">
            {NAV.map(([label, href, newTab]) => (
              <a key={label} href={href} {...tab(newTab)} className={label === ACTIVE ? "active" : undefined} aria-current={label === ACTIVE ? "page" : undefined}>
                {label}{label === ACTIVE && <i className="nav-active-bar" />}
              </a>))}
          </nav>

          <div className="nav-right">
            <a href={ASK_URL} className="nav-cta">Ask your question here</a>
            {/* below 1280px: menu button + side drawer, like the main site */}
            <button type="button" className="nav-burger" aria-label="Open menu" aria-expanded={menu} aria-controls="mobile-menu" onClick={() => setMenu(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h16" /></svg>
            </button>
          </div>
        </div>
      </header>
      {menu && (
        <div className="drawer-back" onMouseDown={(e) => e.target === e.currentTarget && setMenu(false)}>
          <aside id="mobile-menu" className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="drawer-head">
              <b>Menu</b>
              <button type="button" className="drawer-x" aria-label="Close menu" onClick={() => setMenu(false)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
            <nav className="drawer-links" aria-label="Main">
              {NAV.map(([label, href, newTab]) => (
                <a key={label} href={href} {...tab(newTab)} className={label === ACTIVE ? "active" : undefined} onClick={() => setMenu(false)}>{label}</a>))}
            </nav>
            <div className="drawer-foot">
              <a href={ASK_URL} className="nav-cta" onClick={() => setMenu(false)}>Ask your question here</a>
            </div>
          </aside>
        </div>)}

      {/* HERO — 50/50 image + text, matching thedivinetarotonline.com's split layout */}
      <section className="hero-split">
        <div className="container hero-split-inner">
          <div className="hero-media">
            <div className="hero-media-glow"></div>
            <img
              src="/hero-bharti.jpg"
              alt="Bharti Singh — The Divine Tarot"
              className="hero-media-img"
            />
            {offer && on.standard && (
              <a href="#book" className="diwali-flash" aria-label={`${OFFER.name}: personal reading at just ${price}, valid till ${OFFER.untilText}`}>
                <b>🪔 {OFFER.name} 🪔</b>
                <span>Get your Personal Reading <strong>@ Just Rs. {OFFER.price}/- Rs Only</strong></span>
                <small>Offer valid till {OFFER.untilText}</small>
              </a>
            )}
            <div className="hero-media-frame"></div>
          </div>

          <div className="hero-copy">
            <div className="eyebrow">The Divine Tarot</div>
            <p className="namaste">Namaste, main hu Bharti Singh</p>
            <h1>India&rsquo;s No.1 Psychic Tarot Reader</h1>
            <p className="sub">
              Expert in Tarot, Astro, Numero, Hoodoo, Runes, Dice, Coffee Cup,
              Psychic Ability, Face Analysis, Candle Wax Reading, Kundli Analysis,
              Kundli Milan &amp; a Manifestation Coach.
            </p>
            {hp && hero ? (
            <div className="hero-price">
              <div className="hp-amount">
                {hp.offerName && <s className="old-price">{inr(hp.regular)}</s>}
                <strong>{hp.price} <small className="rs-only">Rs only</small></strong>
              </div>
              <ul className="hp-lines">
                {hp.offerName && <li className="offer-tag">🪔 {hp.offerName}</li>}
                {hp.offerName && <li>Offer Till {untilText(hp.offerUntil)}</li>}
                {hero.lines.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </div>
            ) : <div className="hero-price closed"><p>Bookings abhi band hain. Jald hi dobara shuru hongi.</p></div>}
            <div className="hero-actions">
              {on.written && <PayButton tier="written" className={firstBtn("written") ? "btn gold" : "btn ghost"} label={`Book Now — ${wPrice}`} />}
              {on.writtenurgent && <PayButton tier="writtenurgent" className={firstBtn("writtenurgent") ? "btn gold" : "btn ghost"} label={`For Urgent Delivery (within 48 Hours) = ${pricing.writtenurgent.price}/- Rs only`} />}
              {on.standard && <PayButton label={`Book Now — ${price}`} />}
              {on.urgent && <PayButton tier="urgent" className={firstBtn("urgent") ? "btn gold" : "btn ghost"} label={`For Urgent Reading (within 48 Hours) = ${pricing.urgent.price}/- Rs only`} />}
              {on.video && <PayButton tier="video" className={firstBtn("video") ? "btn gold" : "btn ghost"} label={`🎥 Video Call Reading (30 min) = ${pricing.video.price}/- Rs only`} />}
              {on.q3 && <PayButton tier="q3" className={firstBtn("q3") ? "btn gold" : "btn ghost"} label={`❓ 3 Question Call (30 min) = ${pricing.q3.price}/- Rs only`} />}
              {on.q3urgent && <PayButton tier="q3urgent" className={firstBtn("q3urgent") ? "btn gold" : "btn ghost"} label={`⚡ Urgent 3 Question Call (48 Hours) = ${pricing.q3urgent.price}/- Rs only`} />}
            </div>
            <div className="hero-stats">
              <div>
                <strong>7L+</strong>
                <span>Seekers Guided</span>
              </div>
              <div>
                <strong>{hero?.stat ? hero.stat[0] : `${hero ? hero.mins : "40"} Min`}</strong>
                <span>{hero?.stat ? hero.stat[1] : hero ? hero.kind : "Call Reading"}</span>
              </div>
              <div>
                <strong>100%</strong>
                <span>Confidential</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOOK + NOTES — inline side by side */}
      <section id="book">
        <div className="container">
          <Reveal>
            <div className="kicker">Book Now</div>
            <h2>{title}</h2>
          </Reveal>

          {count === 0 && <div className="notes-card" style={{ maxWidth: 640, margin: "0 auto 32px", textAlign: "center" }}><p>Abhi koi booking available nahi hai. Bookings jald hi dobara shuru hongi.</p></div>}
          <div className={`tier-grid n${count}`}>
            {on.written && <Reveal delay={80}>
              <div id="written" className={`price-card written${pricing.written.offerName ? " offer" : ""}`}>
                {pricing.written.offerName && <div className="offer-ribbon">🪔 {pricing.written.offerName} · Valid till {untilText(pricing.written.offerUntil)}</div>}
                {movedNote("written")}
                <span className="badge">✍️ 3 Questions · Answers on Email</span>
                <h3>Personal Reading by Bharti Singh</h3>
                <div className="amount">
                  {old(pricing.written)}{wPrice}<small>Tarot, Astro, Numero, Face Reading, Kundli Analysis &amp; Psychic</small>
                </div>

                <ul className="feature-list">
                  <li><b>3 Questions</b> — sirf aapki personal reading</li>
                  <li><b>Delivery within 7 days</b> — har sawal ka detailed jawab, guidance ke saath, aapki email par</li>
                  <li>Choose preferred language: <b>Hindi, Hinglish ya English</b></li>
                  <li>Make sure to ask <b>specific questions</b> — jitna clear sawal, utna clear jawab</li>
                  <li>Bharti Singh khud likh kar bhejengi — koi call ya meeting join nahi karni</li>
                  <li>No Refund Policy</li>
                </ul>

                <BookingWidget price={wPrice} tier="written" />
              </div>
            </Reveal>}

            {on.writtenurgent && <Reveal delay={130}>
              <div id="writtenurgent" className="price-card urgent written">
                {pricing.writtenurgent.offerName && <div className="offer-ribbon">🪔 {pricing.writtenurgent.offerName} · Valid till {untilText(pricing.writtenurgent.offerUntil)}</div>}
                {movedNote("writtenurgent")}
                <span className="badge">⚡ Urgent · Delivery within 48 Hours</span>
                <h3>Urgent Personal Reading</h3>
                <div className="amount">
                  {old(pricing.writtenurgent)}{wuPrice}<small>Same reading — jawab 48 ghante ke andar</small>
                </div>

                <ul className="feature-list">
                  <li><b>3 Questions</b> — sirf aapki personal reading</li>
                  <li><b>Delivery within 48 hours</b> — har sawal ka detailed jawab, guidance ke saath, aapki email par</li>
                  <li>Choose preferred language: <b>Hindi, Hinglish ya English</b></li>
                  <li>Make sure to ask <b>specific questions</b> — jitna clear sawal, utna clear jawab</li>
                  <li>No Refund Policy</li>
                </ul>

                <BookingWidget price={wuPrice} tier="writtenurgent" />
              </div>
            </Reveal>}

            {on.standard && <Reveal delay={80}>
              <div id="standard" className={`price-card${offer ? " offer" : ""}`}>
                {offer && <div className="offer-ribbon">🪔 {OFFER.name} · Valid till {OFFER.untilText}</div>}
                {movedNote("standard")}
                <span className="badge">40 Minutes · Voice Call</span>
                <h3>Call Reading</h3>
                <div className="amount">
                  {offer && <s className="old-price">{regular}</s>}{price}<small>Tarot, Astro, Numero, Face Reading, Kundli Analysis &amp; Psychic</small>
                </div>

                <ul className="feature-list">
                  <li>Appointment payment ke 7–10 din ke andar (Slots between 12 PM – 9 PM IST)</li>
                  <li>Ask unlimited questions, up to 3 people including you</li>
                  <li>Payment ke baad form bharein — slot, Google Meet link aur schedule turant aapki email par aa jayega</li>
                  <li>No Refund Policy · No reschedule after slot time · 5-min wait only</li>
                </ul>

                <BookingWidget price={price} />
              </div>
            </Reveal>}

            {on.urgent && <Reveal delay={130}>
              <div id="urgent" className="price-card urgent">
                {pricing.urgent.offerName && <div className="offer-ribbon">🪔 {pricing.urgent.offerName} · Valid till {untilText(pricing.urgent.offerUntil)}</div>}
                {movedNote("urgent")}
                <span className="badge">⚡ Urgent · Within 48 Hours</span>
                <h3>Urgent Call Reading</h3>
                <div className="amount">
                  {old(pricing.urgent)}{urgent}<small>Same 40 min reading — Tarot, Astro, Numero, Face Reading, Kundli Analysis &amp; Psychic</small>
                </div>

                <ul className="feature-list">
                  <li>Appointment payment ke 48 ghante ke andar</li>
                  <li>Ask unlimited questions, up to 3 people including you</li>
                  <li>Payment ke baad form bharein — slot, Google Meet link aur schedule turant aapki email par aa jayega</li>
                  <li>No Refund Policy · No reschedule after slot time · 5-min wait only</li>
                </ul>

                <BookingWidget price={urgent} tier="urgent" />
              </div>
            </Reveal>}

            {on.video && <Reveal delay={180}>
              <div id="video" className="price-card video">
                {pricing.video.offerName && <div className="offer-ribbon">🪔 {pricing.video.offerName} · Valid till {untilText(pricing.video.offerUntil)}</div>}
                {movedNote("video")}
                <span className="badge">🎥 30 Minutes · Video Call</span>
                <h3>Video Call Reading</h3>
                <div className="amount">
                  {old(pricing.video)}{videoPrice}<small>Face-to-face reading on Google Meet video</small>
                </div>

                <ul className="feature-list">
                  <li>Sirf aapki reading — ek hi person</li>
                  <li>Sirf 3 specific sawal, form mein likh kar (har sawal 100 characters tak)</li>
                  <li>Love life, Career ya kisi bhi issue ke baare mein poochein</li>
                  <li>Appointment payment ke 7–10 din ke andar (12 PM – 9 PM IST) · Google Meet video call</li>
                  <li>No Refund Policy · No reschedule after slot time · 5-min wait only</li>
                </ul>

                <BookingWidget price={videoPrice} tier="video" />
              </div>
            </Reveal>}
            {on.q3 && <Reveal delay={230}>
              <div id="q3" className="price-card q3">
                {pricing.q3.offerName && <div className="offer-ribbon">🪔 {pricing.q3.offerName} · Valid till {untilText(pricing.q3.offerUntil)}</div>}
                {movedNote("q3")}
                <span className="badge">❓ 30 Minutes · Voice Call · 3 Sawal</span>
                <h3>3 Question Call Reading</h3>
                <div className="amount">
                  {old(pricing.q3)}{q3Price}<small>Voice call on Google Meet — sirf aapke 3 sawal</small>
                </div>

                <ul className="feature-list">
                  <li>Sirf aapki reading — ek hi person</li>
                  <li>Sirf 3 specific sawal, form mein likh kar (har sawal 100 characters tak)</li>
                  <li>Love life, Career ya kisi bhi issue ke baare mein poochein</li>
                  <li>Appointment payment ke 7–10 din ke andar (12 PM – 9 PM IST) · Google Meet voice call (30 min)</li>
                  <li>No Refund Policy · No reschedule after slot time · 5-min wait only</li>
                </ul>

                <BookingWidget price={q3Price} tier="q3" />
              </div>
            </Reveal>}
            {on.q3urgent && <Reveal delay={280}>
              <div id="q3urgent" className="price-card urgent q3">
                {pricing.q3urgent.offerName && <div className="offer-ribbon">🪔 {pricing.q3urgent.offerName} · Valid till {untilText(pricing.q3urgent.offerUntil)}</div>}
                {movedNote("q3urgent")}
                <span className="badge">⚡ Urgent · 3 Sawal · Within 48 Hours</span>
                <h3>Urgent 3 Question Call</h3>
                <div className="amount">
                  {old(pricing.q3urgent)}{q3uPrice}<small>Same 30 min · 3 sawal reading, 48 ghante ke andar</small>
                </div>

                <ul className="feature-list">
                  <li>Sirf aapki reading — ek hi person</li>
                  <li>Sirf 3 specific sawal, form mein likh kar (har sawal 100 characters tak)</li>
                  <li>Love life, Career ya kisi bhi issue ke baare mein poochein</li>
                  <li>Appointment payment ke 48 ghante ke andar · Google Meet voice call (30 min)</li>
                  <li>No Refund Policy · No reschedule after slot time · 5-min wait only</li>
                </ul>

                <BookingWidget price={q3uPrice} tier="q3urgent" />
              </div>
            </Reveal>}
          </div>

          <div className="book-notes-grid single">

            <Reveal delay={180}>
              <div className="notes-card">
                <div className="notes-card-heading">Please Read Before Booking</div>
                <div className="notes">
                  <p>
                    We do not offer Tantra, Vashikaran, or free readings under any
                    circumstance. We don&rsquo;t cover legal matters, share market,
                    lottery, child&rsquo;s gender, or sexual questions.
                  </p>
                  <p>
                    <strong>No Refund Policy</strong> — payments are non-refundable.
                    Your details are kept strictly confidential, and this is a
                    judgment-free space.
                  </p>
                </div>

                <details className="tc">
                  <summary>Full Terms &amp; Conditions</summary>
                  <div className="tc-body">
                    <p>
                      We are certified and experienced in Astrology, Numerology,
                      Psychic Tarot Card Reading, Vedic Kundli Analysis, Candle Wax
                      Reading, Coffee Cup Reading, and other spiritual guidance
                      practices.
                    </p>
                    <p>We do not provide sugar-coated readings. Our purpose is to deliver honest messages as guided by the universe with complete sincerity.</p>
                    <p>We strictly DO NOT offer any services related to Tantra, Vashikaran, black magic, or any unethical practices. Please do not request such services.</p>
                    <p>We do not provide readings on: legal matters, court cases, share market, lottery, gambling, child gender prediction, or explicit/sexual questions.</p>
                    {writtenOn && <p><strong>How your reading is delivered:</strong> after payment you fill a short form with your 3 questions and choose the language for your answers (Hindi, Hinglish or English). Bharti Singh personally writes a detailed answer to each question, with guidance, and emails it to the email address in your form within 7 days of submitting the form{on.writtenurgent ? <> — or within 48 hours for the Urgent reading ({wuPrice})</> : null}. This reading is delivered in writing by email; there is no call or meeting to join. Please ask specific questions and check your Spam / Promotions folder.</p>}
                    {calls && <p><strong>Appointment timing:</strong> slots run from 12 October to 30 November, every day from 12 PM to 9 PM IST (last slot 9 PM). A standard booking gets the earliest free slot 7–10 days after payment. No appointments are given on festival days (Dussehra, Karwa Chauth, Dhanteras to Bhai Dooj, Chhath Puja and Guru Nanak Jayanti). If you need the reading sooner, book the Urgent reading ({urgent}), which gets a slot within 48 hours of payment.</p>}
                    {offerName && <p><strong>{offerName}:</strong> the offer prices shown above apply to payments made till {untilText(pricing[anyOffer!].offerUntil)} (IST). After that the regular prices apply.</p>}
                    {calls && <p>Your call takes place on Google Meet at the slot assigned to you — the slot, link and schedule are emailed to you as soon as you submit the form after payment. Please join on time from a stable network; if repeated connection issues occur, the appointment may be cancelled.</p>}
                    {calls && <p><strong>Late arrival:</strong> we wait a maximum of 5 minutes after your slot starts. If you have not joined the Google Meet by then, the appointment is treated as missed. Once your slot time is over, the appointment cannot be rescheduled, and no refund is given.</p>}
                    {calls ? <p>You may ask about up to 3 people in one reading, only those whose details you submit in the form.</p> : <p>Only the 3 questions written in your form are answered, and the reading is about you (the person whose details and photo are in the form).</p>}
                    <p>All readings are for guidance purposes only. Please use your own judgment and decision-making.</p>
                    <p>When asking about another person&rsquo;s feelings, please understand that energies and emotions can change over time, as every individual has free will.</p>
                    <p>We do not offer FREE readings under any circumstances.</p>
                    <p><strong>No Refund Policy:</strong> once payment is made, it is non-refundable under any situation. Please make your payment only after reading all details carefully.</p>
                    <p>Your privacy is our priority. All information shared (name, photos, personal details) is kept strictly confidential.</p>
                    <p>This is a safe and judgment-free space. No matter your situation (including relationships, personal choices, or identity), you are respected and heard with compassion.</p>
                    <p>&ldquo;The Divine Tarot&rdquo; is a legally registered brand. Any unauthorized copying of content, name, or material may lead to legal action.</p>
                    <p>By paying on this page, you agree to share the information entered with The Divine Tarot (owner of this page) and Razorpay, in accordance with applicable laws.</p>
                  </div>
                </details>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FOOTER — replicates thedivinetarotonline.com footer layout */}
      <footer>
        <div className="container footer-grid">
          <div className="footer-brand">
            <a href="https://thedivinetarotonline.com/" className="brand">
              <img src="/logo.png" alt="The Divine Tarot" className="mark" />
              <span>
                The Divine Tarot
                <small>Premium Tarot Guidance</small>
              </span>
            </a>
            <p className="footer-tagline">Clarity for your path. Guidance for your soul.</p>
          </div>

          <div className="footer-col">
            <div className="footer-heading">Quick Links</div>
            <ul className="footer-links">
              <li><a href="https://thedivinetarotonline.com/about">About</a></li>
              <li><a href="https://thedivinetarotonline.com/reading">Readings</a></li>
              <li><a href="https://thedivinetarotonline.com/reading?upgrade=1">Premium</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <div className="footer-heading">Connect With Us</div>
            <div className="social-row">
              <a href="https://instagram.com/thedivineetarot" target="_blank" rel="noreferrer" aria-label="Instagram">◎</a>
              <a href="https://facebook.com/profile.php?id=61578567343068" target="_blank" rel="noreferrer" aria-label="Facebook">f</a>
              <a href="https://youtube.com/@TheDivineTarot" target="_blank" rel="noreferrer" aria-label="YouTube">▶</a>
              <a href="https://youtube.com/@thedivineetarot" target="_blank" rel="noreferrer" aria-label="YouTube (2nd Channel)">▶</a>
            </div>
            <a href="https://thedivinetarotonline.com/privacy" className="footer-privacy-link">Privacy</a>
          </div>

          <div className="footer-col">
            <div className="footer-heading">Get Daily Divine Insights</div>
            <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="Your email" aria-label="Email" />
              <input type="tel" placeholder="WhatsApp number (optional)" aria-label="WhatsApp number" />
              <button type="submit" className="btn gold" style={{ width: "100%", justifyContent: "center" }}>
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="trust-row">
          <span>🔒 Secure &amp; Private Readings</span>
          <span>♡ Trusted by 7L+ Seekers</span>
          <span>✦ Authentic Spiritual Guidance</span>
        </div>

        <div className="footer-bottom">
          <span>Designed by <a href="https://sitelytc.com/" target="_blank" rel="noreferrer">Sitelytc</a></span>
          <span className="footer-bottom-right">
            <a href="https://thedivinetarotonline.com/privacy">Privacy</a> · © {new Date().getFullYear()} The Divine Tarot. All rights reserved.
          </span>
        </div>
      </footer>
      {primary && hp && hero && <StickyBook price={inr(hp.price)} tier={primary} label={hero.sticky} />}
    </>
  );
}
