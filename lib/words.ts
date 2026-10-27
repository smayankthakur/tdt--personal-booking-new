/** Free-text answers on the reading form are capped at 25 words (client trims while typing; server re-checks). */
export const MAX_WORDS = 25;
export const wordCount = (s: string) => (String(s || "").trim().match(/\S+/g) || []).length;
export function limitWords(s: string, n = MAX_WORDS) {
  const parts = String(s || "").match(/\s*\S+/g) || [];
  return parts.length <= n ? s : parts.slice(0, n).join("");
}
/** Text fields the limit applies to (form field names). */
export const WORD_FIELDS = ["name", "place", "name2", "place2", "name3", "place3", "concernOther", "notes"];
