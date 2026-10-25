/**
 * "Did you mean …?" for common email typos (gmail.con, gmial.com, yahoo.co …). Returns the corrected email,
 * or null when the address looks fine. Pure function, used in the browser only — never blocks anyone.
 */
const DOMAINS = [
  "gmail.com", "yahoo.com", "yahoo.co.in", "yahoo.in", "ymail.com", "rediffmail.com", "hotmail.com",
  "outlook.com", "outlook.in", "live.com", "icloud.com", "me.com", "protonmail.com", "proton.me", "aol.com", "zoho.com", "mail.com", "gmx.com", "yandex.com", "live.in",
];
/** Exact fixes that edit distance alone gets wrong. */
const FIX: Record<string, string> = {
  "gmail.co": "gmail.com", "gmail.cm": "gmail.com", "gmail.in": "gmail.com", "gmail.co.in": "gmail.com", "gmail": "gmail.com",
  "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gmil.com": "gmail.com", "gnail.com": "gmail.com", "gmal.com": "gmail.com",
  "yahoo.co": "yahoo.co.in", "yaho.com": "yahoo.com", "yahoo": "yahoo.com", "hotmail.co": "hotmail.com", "outlook.co": "outlook.com",
  "rediff.com": "rediffmail.com", "rediffmail.co": "rediffmail.com", "icloud.co": "icloud.com",
};
const TLD: Record<string, string> = { con: "com", cpm: "com", vom: "com", xom: "com", comm: "com", coom: "com", cim: "com", om: "com", cm: "com", comn: "com", ocm: "com" };

function dist(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // swapped letters
    }
  return d[a.length][b.length];
}

export function emailTypo(raw: string): string | null {
  const typed = String(raw || "").trim().toLowerCase(), email = typed.replace(/\s+/g, "");
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const user = email.slice(0, at);
  let domain = email.slice(at + 1).replace(/^\.+|\.+$/g, "").replace(/\.{2,}/g, ".").replace(/,/g, ".");
  if (!domain) return null;
  const fixed = (e: string) => (e === typed ? null : e);
  if (DOMAINS.includes(domain)) return fixed(`${user}@${domain}`);
  if (FIX[domain]) return `${user}@${FIX[domain]}`;
  const parts = domain.split("."), last = parts[parts.length - 1];
  if (parts.length > 1 && TLD[last]) { const d = [...parts.slice(0, -1), TLD[last]].join("."); domain = d; if (DOMAINS.includes(d)) return `${user}@${d}`; }
  let best = "", score = 99;
  for (const d of DOMAINS) { const s = dist(domain, d); if (s < score) { score = s; best = d; } }
  const max = domain.length <= 7 ? 1 : 2; // short domains: only 1-letter slips, so real company domains aren't "corrected"
  if (best && score <= max && Math.abs(best.length - domain.length) <= 2) return `${user}@${best}`;
  return fixed(`${user}@${domain}`); // only spaces/dots/TLD were fixed (e.g. company.con → company.com)
}
