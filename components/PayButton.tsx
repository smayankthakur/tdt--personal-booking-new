"use client";
import { usePay, type PayTier } from "./PayGate";

/** CTA: asks the customer's email, then creates the payment link and opens Razorpay. */
export default function PayButton({ label, tier = "standard", className = "btn gold", tabIndex }: { label: string; tier?: PayTier; className?: string; tabIndex?: number }) {
  const { start, busy, modal } = usePay(tier);
  return (<>
    <button type="button" className={className} onClick={start} disabled={busy} tabIndex={tabIndex}>{busy ? "Payment page khul raha hai…" : label}</button>
    {modal}
  </>);
}
