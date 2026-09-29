"use client";

import { useEffect, useRef, type ReactNode } from "react";
import BookingWidget from "@/components/BookingWidget";
import StickyBook from "@/components/StickyBook";
import PayButton from "@/components/PayButton";


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

export default function Home() {
  return (
    <>
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
            <a href="https://thedivinetarotonline.com/">Home</a>
            <a href="https://thedivinetarotonline.com/about">About</a>
            <a href="https://thedivinetarotonline.com/reading">Reading</a>
            <a href="https://learn.thedivinetarotonline.com/">Course</a>
            <a href="https://thedivinetarotonline.com/kundli-milan">Kundli Milan</a>
            <a href="https://booking.thedivinetarotonline.com/" className="active">Personal Reading</a>
          </div>

          <div className="nav-right">
            {/* <div className="lang-toggle">
              <span className="active">EN</span>
              <span>हिंदी</span>
              <span>Hinglish</span>
            </div> */}
            <a href="https://thedivinetarotonline.com/reading" className="nav-cta">
              Ask your question here
            </a>
          </div>
        </div>
      </nav>

      {/* HERO — 50/50 image + text, matching thedivinetarotonline.com's split layout */}
      <section className="hero-split">
        <div className="container hero-split-inner">
          <div className="hero-media">
            <div className="hero-media-glow"></div>
            <img
              src="/hero-portrait.jpg"
              alt="Bharti Singh — The Divine Tarot"
              className="hero-media-img"
            />
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
            <div className="hero-price">
              <strong>₹8,500</strong>
              <span>40 min voice call<br />Pay first · choose your slot after</span>
            </div>
            <div className="hero-actions">
              <PayButton label="Book Now — ₹8,500" />
            </div>
            <div className="hero-stats">
              <div>
                <strong>7L+</strong>
                <span>Seekers Guided</span>
              </div>
              <div>
                <strong>40 Min</strong>
                <span>Voice Call Reading</span>
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
            <h2>Voice Call Reading</h2>
          </Reveal>

          <div className="book-notes-grid">
            <Reveal delay={80}>
              <div className="price-card">
                <span className="badge">40 Minutes · Voice Call</span>
                <h3>Call Reading</h3>
                <div className="amount">
                  ₹8,500<small>Tarot, Astro, Numero, Face Reading, Kundli Analysis &amp; Psychic</small>
                </div>

                <ul className="feature-list">
                  <li>Ask unlimited questions, up to 3 people including you</li>
                  <li>Pay → choose slot &amp; fill form → Meet link &amp; schedule on your email</li>
                  <li>No Refund Policy · No reschedule after slot time · 5-min wait only</li>
                </ul>

                <BookingWidget price="₹8,500" />
              </div>
            </Reveal>

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
                    <p>Your call takes place on Google Meet at the slot you book — the link and schedule are emailed to you as soon as you submit the form after payment. Please join on time from a stable network; if repeated connection issues occur, the appointment may be cancelled.</p>
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
      <StickyBook price="₹8,500" />
    </>
  );
}
