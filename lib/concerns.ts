/** Reading reasons shown on the form. Shared by the form (client) and /api/form (server). */
export const CONCERNS: [string, string][] = [
  ["💍", "Aapki Shaadi nahi horahi?"], ["💼", "Career ko lekar Tension hai"], ["🔀", "Third Party situation main stuck hai"],
  ["💭", "Partner ki current feelings or actions jaanne hai"], ["🤝", "Partner ke sath reunion ya reconcilation ka pata lagana hai"],
  ["🕉️", "Apni Spritual Journey Jaanni haii"], ["🧭", "Aapna Life Purpose Jaanna hai"], ["💰", "Financial tension bohot hai"],
  ["🧿", "Black magic ka Doubt hai"], ["🩺", "Health ko lekar pareshan hai"], ["👶", "Bacha kab hoga?"], ["❤️", "Current Ya Ex Partner se Shaadi hogi?"],
];

/** Reasons that are about a partner: the Second Person / Partner section (name + photo) becomes required. */
export const PARTNER_CONCERNS = [
  "Third Party situation main stuck hai",
  "Partner ki current feelings or actions jaanne hai",
  "Partner ke sath reunion ya reconcilation ka pata lagana hai",
  "Current Ya Ex Partner se Shaadi hogi?",
];
export const needsPartner = (concern: string) => PARTNER_CONCERNS.includes(concern);

/** Phone number in E.164: 10 digits => India (+91); "+..." kept; "91XXXXXXXXXX" => +91XXXXXXXXXX. */
export function e164(raw: string): string {
  const s = String(raw || "").trim(), d = s.replace(/\D/g, "");
  if (s.startsWith("+")) return "+" + d;
  if (d.length === 10) return "+91" + d;
  if (d.length === 12 && d.startsWith("91")) return "+" + d;
  if (d.length === 11 && d.startsWith("0")) return "+91" + d.slice(1);
  return d ? "+" + d : "";
}
