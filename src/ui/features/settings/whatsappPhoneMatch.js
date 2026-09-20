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
 * The field's placeholder shows "+55 11 99999-0000" — the friendly layout —
 * but the backend accepts nothing except "+5511999990000". Strip the spaces,
 * dashes, dots and parentheses so following the example works.
 *
 * The country code stays the user's job: Fincla will run outside Brazil, so
 * nothing here assumes "+55" (a country picker is the planned follow-up).
 *
 * Without a leading "+" the input goes to the API EXACTLY as typed, formatting
 * included. Stripping it to bare digits is not harmless: the backend prefixes
 * "+" to any digit-only string (its Evolution-format normalisation), so
 * "11 99999-0000" would silently become "+1 199..." — a US number — and open a
 * pending link that can never activate. Left intact, it is rejected with the
 * translated hint, as it was before this helper existed.
 */
export function normalizePhoneE164(input) {
  const raw = (input || "").trim();
  if (!raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `+${digits}` : raw;
}
