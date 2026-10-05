"use client";
import { useEffect, useState } from "react";

export default function BookingWidget({ price }: { price: string }) {
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);

  useEffect(() => { // old payment-return links that still point at /?bid=
    const b = new URLSearchParams(window.location.search).get("bid");
    if (b) window.location.replace(`/form?bid=${b}`);
  }, []);

  async function pay() {
    setErr(""); setBusy(true);
    try {
      const j = await (await fetch("/api/book", { method: "POST" })).json();
      if (j.url) { window.location.href = j.url; return; }
      setErr(j.error || "Kuch galat hua. Dobara try karein.");
    } catch { setErr("Network error. Dobara try karein."); }
    setBusy(false);
  }

  return (
    <div>
      <ol style={{ textAlign: "left", fontSize: 14, lineHeight: 1.9, margin: "0 0 16px 18px" }}>
        <li>Pehle payment karein</li>
        <li>Phir form bharein — sabse pehla khaali slot (Tue/Fri) aapko apne aap mil jayega</li>
        <li>Meet link &amp; schedule turant aapki email par</li>
      </ol>
      {err && <p style={{ color: "#f66" }}>{err}</p>}
      <button className="btn gold" disabled={busy} onClick={pay} style={{ width: "100%", justifyContent: "center" }}>
        {busy ? "Payment page khul raha hai…" : `Pay ${price} & Book`}
      </button>
    </div>);
}
