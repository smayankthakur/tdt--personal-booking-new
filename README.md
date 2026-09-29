# The Divine Tarot — Personal Reading Booking (Next.js)

## Flow
1. Visitor clicks **Pay ₹8,500 & Book** — no slot needed yet. A Razorpay Payment Link is created; its return URL is built from the domain the visitor is on.
2. Razorpay webhook (`payment_link.paid`) marks the order paid (`orders/{bid}`), saves the payer's email/phone and emails a "choose slot & fill form" link.
3. Visitor lands on **`/form?bid=…`**: picks a slot (Tue 1–5pm, Thu 3–6pm, Sat 12–8pm, Sun 12–1pm IST; editable at `/admin`) and fills the full form. Photos are compressed in the browser.
4. On submit the slot is claimed atomically (if someone took it first, they pick another), a Google Meet event is created, the **customer gets an email with date, time, Meet link and .ics**, and **you get an email with every answer + photos**.

## Setup
```bash
npm install
cp .env.local.example .env.local   # fill Firebase, Razorpay, Google OAuth, SMTP
npm run dev
```
Razorpay webhook URL: `https://<your-domain>/api/razorpay-webhook`, event `payment_link.paid`, secret = `RAZORPAY_WEBHOOK_SECRET`.
Gmail SMTP needs an **App Password** (Google Account → Security → 2-Step Verification → App passwords).

## Notes
- Google Calendar no longer emails guests itself (`sendUpdates=none`); the confirmation mail comes from SMTP after the form, so the order is always pay → form → mail.
- Uploaded photos are not stored on the server: they go to your email as attachments. Form answers are saved in Firestore (`bookings/{slot}.answers`).
- Vercel limits request bodies to ~4.5 MB, hence client-side photo compression (~1400px JPEG).
- `/admin` shows confirmed bookings, "Paid, form baaki" (paid but form not submitted) and mail failures.
