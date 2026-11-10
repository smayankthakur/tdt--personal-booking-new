"use client";
import { useEffect, useState } from "react";
import { usePay, type PayTier } from "./PayGate";
import { isQuestionTier, isUrgentTier, isWrittenTier } from "@/lib/slots";

const fmt = (n: { date: string; time: string }) => {
  const d = new Date(n.date + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const [h, m] = n.time.split(":").map(Number);
  return `${d}, ${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function BookingWidget({ price, tier = "standard" }: { price: string; tier?: PayTier }) {
  const urgent = isUrgentTier(tier), questions = isQuestionTier(tier), written = isWrittenTier(tier);
  const [err, setErr] = useState("");
  // undefined = checking, null = nothing free
  const [next, setNext] = useState<{ date: string; time: string } | null | undefined>(undefined);

  useEffect(() => {
    if (!urgent && new URLSearchParams(window.location.search).get("payment") === "failed") {
      setErr("Payment complete nahi hua. Dobara try karein.");
      window.history.replaceState(null, "", "/#book");
    }
    fetch(`/api/slots?tier=${tier}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setNext(j.available ? j.next : null)).catch(() => setNext(null));
  }, [urgent, tier]);

  const { start, busy, modal } = usePay(tier, () => setNext(null));

  const off = !urgent && next === null; // urgent: always clickable; if no slot is free, the reason is shown on click
  return (
    <div>
      <ol style={{ textAlign: "left", fontSize: 14, lineHeight: 1.9, margin: "0 0 16px 18px" }}>
        <li>Apni email dein aur payment karein</li>
        <li>Payment ke baad ek form open hoga — {written ? "apne 3 sawal likhein, bhasha chunein aur" : questions ? "apne 3 sawal likh kar" : "fill karke"} submit karein</li>
        {written
          ? <li>Form submit karne ke {urgent ? "48 ghante" : "7 din"} ke andar Bharti Singh ke likhe jawab, guidance ke saath, aapki email par aa jayenge</li>
          : <li>Form submit karte hi aapka slot ({urgent ? "48 ghante ke andar" : "7–10 din ke andar"}), Google Meet link aur schedule aapki email par aa jayega</li>}
      </ol>
      {!urgent && <p style={{ fontSize: 13, margin: "0 0 12px", color: next ? "#7ee2a8" : "var(--ivory-dim)" }}>
        {next === undefined ? (written ? "Booking check ho rahi hai…" : "Slot check ho raha hai…")
          : next ? (written ? "✓ Bookings open — jawab 7 din ke andar" : `✓ ${urgent ? "Urgent slot available" : "Abhi book karne par slot"} — ${fmt(next)} IST`)
          : written ? "Abhi bookings full hain. Kripya baad mein dobara dekhein." : "Abhi saare slots full hain. Kripya baad mein dobara dekhein."}
      </p>}
      {err && <p style={{ color: "#f66" }}>{err}</p>}
      <button className="btn gold" disabled={busy || off} onClick={start} style={{ width: "100%", justifyContent: "center" }}>
        {busy ? "Payment page khul raha hai…" : urgent ? "Book Now" : tier === "video" ? `Pay ${price} & Book Video Call` : `Pay ${price} & Book`}
      </button>
      {modal}
    </div>);
}
