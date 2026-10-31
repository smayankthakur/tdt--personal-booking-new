"use client";
import { useState } from "react";

/** 1–5 stars + optional comment. Shown from the feedback mail link (/feedback?t=…). */
export default function FeedbackForm({ t, name, day, initial, comment: c0, done: d0 }: { t: string; name: string; day: string; initial: number; comment: string; done: boolean }) {
  const [rating, setRating] = useState(initial), [hover, setHover] = useState(0), [comment, setComment] = useState(c0);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState<null | { reviewUrl: string | null }>(null);
  const L = ["", "Bilkul achhi nahi", "Theek nahi", "Theek thi", "Achhi thi", "Bahut achhi!"];
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t, rating, comment }) });
      const j = await r.json();
      if (!r.ok) setErr(j.error || "Save nahi hua"); else setDone({ reviewUrl: j.reviewUrl });
    } catch { setErr("Network error — dobara try karein."); }
    setBusy(false);
  };
  if (done) return (
    <div className="rf-card" style={{ textAlign: "center" }}>
      <h1>Shukriya{name ? `, ${name.split(" ")[0]}` : ""}! 🙏</h1>
      <p>Aapka feedback mil gaya.</p>
      {done.reviewUrl && <><p style={{ marginTop: 14 }}>Agar aapko reading achhi lagi, toh Google par ek review likh kar doosron ki madad karein.</p>
        <a className="btn gold" href={done.reviewUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 14 }}>⭐ Google par review dein</a></>}
    </div>);
  return (
    <form className="rf-card" onSubmit={send}>
      <h1>Aapki reading kaisi lagi?</h1>
      <p>{name ? `Namaste ${name.split(" ")[0]}, ` : ""}{day ? `aapki ${day} wali reading ke baare mein bataiye.` : ""}{d0 ? " (Aap pehle feedback de chuke hain — chahein toh badal sakte hain.)" : ""}</p>
      <div className="fb-stars" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star`} className={(hover || rating) >= n ? "on" : ""}
            onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}>★</button>))}
      </div>
      <p className="fb-label">{L[hover || rating] || "Star chunein"}</p>
      <label className="rf-label" htmlFor="fb-c">Kuch kehna chahenge? (optional)</label>
      <textarea id="fb-c" className="fb-text" rows={4} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Kya achha laga, kya behtar ho sakta hai…" />
      {err && <p className="rf-err" style={{ color: "#f87171" }}>{err}</p>}
      <button className="btn gold" disabled={busy || !rating} style={{ marginTop: 16, width: "100%" }}>{busy ? "Bhej rahe hain…" : "Feedback bhejein"}</button>
    </form>);
}
