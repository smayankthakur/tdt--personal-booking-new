# The Divine Tarot — Personal Reading Booking (Next.js)

## Flow
1. Visitor picks **Normal** (₹8,500 — **Diwali Offer ₹5,500 till 11 Nov 2026**, switches back automatically; edit `lib/offer.ts`) or **Urgent ₹17,000** (slot within 48 hours). Slots run **12 Oct – 30 Nov 2026, every day, hourly 12 PM – 9 PM** (last slot 9 PM). Normal bookings get the earliest free slot 7–10 days after payment (later only if that window is full); Urgent within 48 hours. Festival days are blocked (Dussehra, Karwa Chauth, 6–11 Nov Diwali, Chhath, Guru Nanak Jayanti) — editable at `/admin`. Payment is refused if no slot is free; for Urgent a slot is held *before* the payment page opens.
2. Razorpay returns the customer to `/api/pay-return`, which verifies Razorpay's signature, sets a signed httpOnly cookie and redirects to a clean **`/form`** (no booking ID in the URL). The webhook (`payment_link.paid`) also marks the order paid and sends a payment receipt — **with no form link**.
3. `/form` opens only for a paid booking in that browser (cookie). Typing `/form` or an old `/form?bid=…` link opens nothing.
4. On submit the slot is auto-assigned and claimed atomically — Normal: earliest free slot on day 7–10 after payment; Urgent: the held slot. A Google Meet event is created, the **customer gets the slot, Meet link and .ics by email**, and **you get every answer + photos**.
5. Customer lost the page? Same browser: the booking page shows a "Form bharein" banner. Different device: `/admin` → Payment status → **Form link banao** (24-hour link, send on WhatsApp).

## Setup
```bash
npm install
cp .env.local.example .env.local   # fill Firebase, Razorpay, Google OAuth, SMTP
npm run dev
```
Optional: `FORM_SECRET` (long random string) signs the form cookie; falls back to `RAZORPAY_KEY_SECRET`.
Razorpay webhook URL: `https://<your-domain>/api/razorpay-webhook`, event `payment_link.paid`, secret = `RAZORPAY_WEBHOOK_SECRET`.
Gmail SMTP needs an **App Password** (Google Account → Security → 2-Step Verification → App passwords).

## Notes
- Google Calendar no longer emails guests itself (`sendUpdates=none`); the confirmation mail comes from SMTP after the form, so the order is always pay → form → mail.
- Uploaded photos are not stored on the server: they go to your email as attachments. Form answers are saved in Firestore (`bookings/{slot}.answers`).
- Vercel limits request bodies to ~4.5 MB, hence client-side photo compression (~1400px JPEG).
- `/admin` shows confirmed bookings, "Paid, form baaki" (paid but form not submitted) and mail failures.
