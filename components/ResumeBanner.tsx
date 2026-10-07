"use client";
import { useEffect, useState } from "react";

/** If this browser already paid but hasn't filled the form, offer a way back (works only via the secure cookie). */
export default function ResumeBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    fetch("/api/booking", { cache: "no-store" }).then((r) => r.json()).then((j) => setShow(j.status === "paid" && !j.formDone)).catch(() => {});
  }, []);
  if (!show) return null;
  return (
    <div className="resume-banner">
      <span>✓ Aapka payment ho chuka hai — ab reading form bharein.</span>
      <a className="btn gold" href="/form">Form bharein →</a>
    </div>);
}
