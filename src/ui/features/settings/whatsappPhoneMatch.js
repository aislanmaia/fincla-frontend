/**
 * Whether two phone numbers are the same line, tolerating only the Brazilian
 * 9th-digit variance (+55 DDD [9] XXXXXXXX). Mirrors the backend's
 * `_brazil_alternate_formats` so the pending-verification poll recognises the
 * number activating even when the API echoes a slightly different format.
 *
 * Deliberately NOT a "last N digits" match: that would let a different DDD with
 * the same subscriber digits look like the pending number and end the flow as if
 * it were verified.
 */
const onlyDigits = (p) => (p || "").replace(/\D/g, "");

function brazilVariants(digits) {
  const out = [digits];
  let m = /^55(\d{2})(\d{8})$/.exec(digits); // 12 digits, no 9 -> add the 9
  if (m) out.push(`55${m[1]}9${m[2]}`);
  m = /^55(\d{2})9(\d{8})$/.exec(digits); // 13 digits, with 9 -> drop the 9
  if (m) out.push(`55${m[1]}${m[2]}`);
  return out;
}

export function phoneDigitsMatch(a, b) {
  const da = onlyDigits(a);
  const db = onlyDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const vb = new Set(brazilVariants(db));
  return brazilVariants(da).some((v) => vb.has(v));
}

/**
 * Normalise what the user typed into the E.164 string the API requires.
 *
 * The field's placeholder shows "+55 11 99999-0000" — the friendly Brazilian
 * layout — but the backend accepts nothing except "+5511999990000". Strip the
 * spaces, dashes, dots and parentheses here so following the example works.
 * A number typed without country code (10–11 digits, the DDD + line) is
 * assumed Brazilian, like the placeholder. Anything else is left for the API
 * to validate; this never invents digits.
 */
export function normalizePhoneE164(input) {
  const raw = (input || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}
