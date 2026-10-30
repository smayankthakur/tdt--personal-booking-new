"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import BookingWidget from "@/components/BookingWidget";
import StickyBook from "@/components/StickyBook";
import PayButton from "@/components/PayButton";
import ResumeBanner from "@/components/ResumeBanner";
import { inr } from "@/lib/offer";
import type { PublicPrice } from "@/lib/pricing";


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

const NAV = [
  ["Home", "https://thedivinetarotonline.com/"],
  ["About", "https://thedivinetarotonline.com/about"],
  ["Reading", "https://thedivinetarotonline.com/reading"],
  ["Course", "https://learn.thedivinetarotonline.com/"],
  ["Kundli Milan", "https://thedivinetarotonline.com/kundli-milan"],
  ["Personal Reading", "https://booking.thedivinetarotonline.com/"],
] as const;
const ASK_URL = "https://reading.thedivinetarotonline.com/";

/** Prices + seasonal offer come from /admin (lib/pricing.ts), passed in by app/page.tsx. */
type Prices = { standard: PublicPrice; urgent: PublicPrice; video: PublicPrice };
const untilText = (d?: string | null) => (d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

export default function Landing({ pricing }: { pricing: Prices }) {
  const [menu, setMenu] = useState(false); // phone/tablet hamburger menu
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [menu]);
  const std = pricing.standard, offer = !!std.offerName;
  const OFFER = { name: std.offerName || "", price: std.price, untilText: untilText(std.offerUntil) };
  const price = inr(std.price), regular = inr(std.regular), urgent = inr(pricing.urgent.price), videoPrice = inr(pricing.video.price);
  const anyOffer = (["standard", "urgent", "video"] as const).find((t) => pricing[t].offerName), offerName = anyOffer ? pricing[anyOffer].offerName : null;
  const old = (p: PublicPrice) => (p.offerName ? <s className="old-price">{inr(p.regular)}</s> : null);
  // Reading types switched on in /admin; the page shows only those (cards, hero buttons, sticky bar).
  const on = { standard: pricing.standard.enabled, urgent: pricing.urgent.enabled, video: pricing.video.enabled };
  const count = Number(on.standard) + Number(on.urgent) + Number(on.video);
  const primary = on.standard ? "standard" : on.video ? "video" : on.urgent ? "urgent" : null; // hero price + sticky bar
  const HERO = {
    standard: { mins: "40", kind: "Voice Call Reading", lines: ["40 mins Voice Reading", "Appointment Within 7 - 10 Days"], sticky: "40 min voice call reading" },
    video: { mins: "30", kind: "Video Call Reading", lines: ["30 mins Video Call (Google Meet)", "Appointment Within 7 - 10 Days"], sticky: "30 min video call reading" },
    urgent: { mins: "40", kind: "Voice Call Reading", lines: ["40 mins Voice Reading", "Appointment Within 48 Hours"], sticky: "Urgent 40 min voice reading" },
  } as const;
  const hp = primary ? pricing[primary] : null, hero = primary ? HERO[primary] : null;
  const title = (on.standard || on.urgent) && on.video ? <>Voice &amp; Video Call Reading</> : on.video ? <>Video Call Reading</> : <>Voice Call Reading</>;
  return (
    <>
      <ResumeBanner />
      {/* NAV — exact structure/order per thedivinetarotonline.com header */}
      <nav className="navbar">
        <div className="container navbar-inner">
          <a href="https://thedivinetarotonline.com/" className="brand">
            <img src="/logo.png" alt="The Divine Tarot" className="mark" />
            <span>
              The Divine Tarot
              <small>Premium Tarot Guidance</small>
            </span>
          </a>

          <div className="nav-links">
            {NAV.map(([label, href]) => <a key={label} href={href} className={label === "Personal Reading" ? "active" : undefined}>{label}</a>)}
          </div>

          <div className="nav-right">
            {/* <div className="lang-toggle">
              <span className="active">EN</span>
              <span>हिंदी</span>
              <span>Hinglish</span>
            </div> */}
            <a href={ASK_URL} className="nav-cta">Ask your question here</a>
            {/* Phones/tablets: three-line menu instead of the CTA pill (the CTA moves inside the menu) */}
            <button type="button" className={`nav-burger${menu ? " open" : ""}`} aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu} aria-controls="mobile-menu" onClick={() => setMenu(!menu)}>
              <span /><span /><span />
            </button>
          </div>
        </div>
        {menu && (
          <div id="mobile-menu" className="mobile-menu">
            {NAV.map(([label, href]) => (
              <a key={label} href={href} className={label === "Personal Reading" ? "active" : undefined} onClick={() => setMenu(false)}>{label}</a>))}
            <a href={ASK_URL} className="nav-cta" onClick={() => setMenu(false)}>Ask your question here</a>
          </div>)}
      </nav>

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
              {on.standard && <PayButton label={`Book Now — ${price}`} />}
              {on.urgent && <PayButton tier="urgent" className={on.standard ? "btn ghost" : "btn gold"} label={`For Urgent Reading (within 48 Hours) = ${pricing.urgent.price}/- Rs only`} />}
              {on.video && <PayButton tier="video" className={on.standard || on.urgent ? "btn ghost" : "btn gold"} label={`🎥 Video Call Reading (30 min) = ${pricing.video.price}/- Rs only`} />}
            </div>
            <div className="hero-stats">
              <div>
                <strong>7L+</strong>
                <span>Seekers Guided</span>
              </div>
              <div>
                <strong>{hero ? hero.mins : "40"} Min</strong>
                <span>{hero ? hero.kind : "Call Reading"}</span>
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
            {on.standard && <Reveal delay={80}>
              <div className={`price-card${offer ? " offer" : ""}`}>
                {offer && <div className="offer-ribbon">🪔 {OFFER.name} · Valid till {OFFER.untilText}</div>}
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
              <div className="price-card urgent">
                {pricing.urgent.offerName && <div className="offer-ribbon">🪔 {pricing.urgent.offerName} · Valid till {untilText(pricing.urgent.offerUntil)}</div>}
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
              <div className="price-card video">
                {pricing.video.offerName && <div className="offer-ribbon">🪔 {pricing.video.offerName} · Valid till {untilText(pricing.video.offerUntil)}</div>}
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
                    <p><strong>Appointment timing:</strong> slots run from 12 October to 30 November, every day from 12 PM to 9 PM IST (last slot 9 PM). A standard booking gets the earliest free slot 7–10 days after payment. No appointments are given on festival days (Dussehra, Karwa Chauth, Dhanteras to Bhai Dooj, Chhath Puja and Guru Nanak Jayanti). If you need the reading sooner, book the Urgent reading ({urgent}), which gets a slot within 48 hours of payment.</p>
                    {offerName && <p><strong>{offerName}:</strong> the offer prices shown above apply to payments made till {untilText(pricing[anyOffer!].offerUntil)} (IST). After that the regular prices apply.</p>}
                    <p>Your call takes place on Google Meet at the slot assigned to you — the slot, link and schedule are emailed to you as soon as you submit the form after payment. Please join on time from a stable network; if repeated connection issues occur, the appointment may be cancelled.</p>
                    <p><strong>Late arrival:</strong> we wait a maximum of 5 minutes after your slot starts. If you have not joined the Google Meet by then, the appointment is treated as missed. Once your slot time is over, the appointment cannot be rescheduled, and no refund is given.</p>
                    <p>You may ask about up to 3 people in one reading, only those whose details you submit in the form.</p>
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
