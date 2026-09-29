"use client";
import { useState } from "react";

/** CTA that goes straight to the Razorpay payment page (creates the payment link, then redirects). */
export default function PayButton({ label, className = "btn gold", tabIndex }: { label: string; className?: string; tabIndex?: number }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const j = await (await fetch("/api/book", { method: "POST" })).json();
      if (j.url) { window.location.href = j.url; return; }
      alert(j.error || "Payment page nahi khul paya. Dobara try karein.");
    } catch { alert("Network error. Dobara try karein."); }
    setBusy(false);
  }
  return <button type="button" className={className} onClick={go} disabled={busy} tabIndex={tabIndex}>{busy ? "Payment page khul raha hai…" : label}</button>;
}
