"use client";
import { useEffect, useState } from "react";

const fmt = (n: { date: string; time: string }) => {
  const d = new Date(n.date + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const [h, m] = n.time.split(":").map(Number);
  return `${d}, ${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function BookingWidget({ price, tier = "standard" }: { price: string; tier?: "standard" | "urgent" }) {
  const urgent = tier === "urgent";
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  // undefined = checking, null = nothing free
  const [next, setNext] = useState<{ date: string; time: string } | null | undefined>(undefined);

  useEffect(() => {
    if (!urgent && new URLSearchParams(window.location.search).get("payment") === "failed") {
      setErr("Payment complete nahi hua. Dobara try karein.");
      window.history.replaceState(null, "", "/#book");
    }
    fetch(`/api/slots?tier=${tier}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setNext(j.available ? j.next : null)).catch(() => setNext(null));
  }, [urgent, tier]);

  async function pay() {
    setErr(""); setBusy(true);
    try {
      const j = await (await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier }) })).json();
      if (j.url) { window.location.href = j.url; return; }
      setErr(j.error || "Kuch galat hua. Dobara try karein.");
      if (j.code === "no_slots") setNext(null);
    } catch { setErr("Network error. Dobara try karein."); }
    setBusy(false);
  }

  const off = next === null;
  return (
    <div>
      <ol style={{ textAlign: "left", fontSize: 14, lineHeight: 1.9, margin: "0 0 16px 18px" }}>
        <li>Pehle payment karein</li>
        <li>Payment ke baad ek form open hoga — fill karke submit karein</li>
        <li>{urgent ? "48 ghante ke andar ka slot" : "7–10 din ke andar ka slot"}, Google Meet link &amp; schedule turant aapki email par</li>
      </ol>
      <p style={{ fontSize: 13, margin: "0 0 12px", color: next ? "#7ee2a8" : "var(--ivory-dim)" }}>
        {next === undefined ? "Slot check ho raha hai…"
          : next ? `✓ ${urgent ? "Urgent slot available" : "Abhi book karne par slot"} — ${fmt(next)} IST`
          : urgent ? "Abhi 48 ghante mein koi urgent slot khaali nahi hai (urgent slots 12 Oct se)." : "Abhi saare slots full hain. WhatsApp karein: +91 88281 16545."}
      </p>
      {err && <p style={{ color: "#f66" }}>{err}</p>}
      <button className="btn gold" disabled={busy || off} onClick={pay} style={{ width: "100%", justifyContent: "center" }}>
        {busy ? "Payment page khul raha hai…" : `Pay ${price} & Book${urgent ? " Urgent" : ""}`}
      </button>
    </div>);
}
