/**
 * Country picker data for the WhatsApp "Vincular número" form.
 *
 * Fincla will run outside Brazil, so the country code is chosen, not typed —
 * Brazil preselected. Names in PT-BR (UI language); `placeholder` shows the
 * local layout of that country so the user types only the national number.
 * `nationalDigits` is the [min, max] digit count of a national number there
 * (area code included, trunk zero excluded) — it is what lets buildE164 tell
 * "typed the country code again" from a genuine number.
 */
export const DEFAULT_PHONE_COUNTRY = "BR";

export const PHONE_COUNTRIES = [
  { code: "BR", name: "Brasil", dial: "55", flag: "🇧🇷", placeholder: "11 99999-0000", nationalDigits: [10, 11] },
  { code: "AR", name: "Argentina", dial: "54", flag: "🇦🇷", placeholder: "11 2345-6789", nationalDigits: [10, 10] },
  { code: "AU", name: "Austrália", dial: "61", flag: "🇦🇺", placeholder: "412 345 678", nationalDigits: [9, 9] },
  { code: "BO", name: "Bolívia", dial: "591", flag: "🇧🇴", placeholder: "7123 4567", nationalDigits: [8, 8] },
  { code: "CA", name: "Canadá", dial: "1", flag: "🇨🇦", placeholder: "416 555 0123", nationalDigits: [10, 10] },
  { code: "CL", name: "Chile", dial: "56", flag: "🇨🇱", placeholder: "9 6123 4567", nationalDigits: [9, 9] },
  { code: "CO", name: "Colômbia", dial: "57", flag: "🇨🇴", placeholder: "321 1234567", nationalDigits: [10, 10] },
  { code: "DE", name: "Alemanha", dial: "49", flag: "🇩🇪", placeholder: "1512 3456789", nationalDigits: [10, 11] },
  { code: "ES", name: "Espanha", dial: "34", flag: "🇪🇸", placeholder: "612 34 56 78", nationalDigits: [9, 9] },
  { code: "US", name: "Estados Unidos", dial: "1", flag: "🇺🇸", placeholder: "201 555 0123", nationalDigits: [10, 10] },
  { code: "FR", name: "França", dial: "33", flag: "🇫🇷", placeholder: "6 12 34 56 78", nationalDigits: [9, 9] },
  { code: "IE", name: "Irlanda", dial: "353", flag: "🇮🇪", placeholder: "85 012 3456", nationalDigits: [9, 9] },
  { code: "IT", name: "Itália", dial: "39", flag: "🇮🇹", placeholder: "312 345 6789", nationalDigits: [9, 10] },
  { code: "JP", name: "Japão", dial: "81", flag: "🇯🇵", placeholder: "90 1234 5678", nationalDigits: [10, 10] },
  { code: "MX", name: "México", dial: "52", flag: "🇲🇽", placeholder: "55 1234 5678", nationalDigits: [10, 10] },
  { code: "NL", name: "Países Baixos", dial: "31", flag: "🇳🇱", placeholder: "6 12345678", nationalDigits: [9, 9] },
  { code: "PY", name: "Paraguai", dial: "595", flag: "🇵🇾", placeholder: "961 456789", nationalDigits: [9, 9] },
  { code: "PE", name: "Peru", dial: "51", flag: "🇵🇪", placeholder: "912 345 678", nationalDigits: [9, 9] },
  { code: "PT", name: "Portugal", dial: "351", flag: "🇵🇹", placeholder: "912 345 678", nationalDigits: [9, 9] },
  { code: "GB", name: "Reino Unido", dial: "44", flag: "🇬🇧", placeholder: "7400 123456", nationalDigits: [10, 10] },
  { code: "CH", name: "Suíça", dial: "41", flag: "🇨🇭", placeholder: "78 123 45 67", nationalDigits: [9, 9] },
  { code: "UY", name: "Uruguai", dial: "598", flag: "🇺🇾", placeholder: "94 231 234", nationalDigits: [8, 8] },
  { code: "VE", name: "Venezuela", dial: "58", flag: "🇻🇪", placeholder: "412 1234567", nationalDigits: [10, 10] },
];

export function findPhoneCountry(code) {
  return PHONE_COUNTRIES.find((c) => c.code === code) ?? PHONE_COUNTRIES[0];
}

/**
 * Compose the E.164 string the API requires from the picked country and the
 * national number as typed (spaces, dashes and parentheses tolerated).
 *
 * Guards, because the backend's E.164 check is only "+ and 7–15 digits" and
 * a wrong-but-well-formed number opens a pending link that never activates:
 * - typed with its own "+": taken as complete, picker ignored ("+55 11…"
 *   under Brasil must not become "+5555 11…");
 * - country code typed again without "+" ("55 11 99999-0000", how WhatsApp
 *   itself shows numbers): recognised by length and not prefixed twice —
 *   "55 99999-0000" (DDD 55, Santa Maria) is a real national number and stays;
 * - trunk zero ("011 99999-0000"): dropped, except under +1 where 0 is never
 *   a trunk prefix;
 * - digit count outside the country's national range: returned as typed so
 *   the API rejects it with the translated hint instead of us guessing.
 * Never invents digits: an empty national number yields "".
 */
export function buildE164(dial, local) {
  const raw = (local || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const all = raw.replace(/\D/g, "");
    return all ? `+${all}` : raw;
  }
  let digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  const country = PHONE_COUNTRIES.find((c) => c.dial === dial);
  const [min, max] = country?.nationalDigits ?? [6, 14];
  const inRange = (n) => n.length >= min && n.length <= max;
  if (digits.startsWith("0") && dial !== "1" && inRange(digits.slice(1))) digits = digits.slice(1);
  if (!inRange(digits) && digits.startsWith(dial) && inRange(digits.slice(dial.length))) {
    digits = digits.slice(dial.length);
  }
  if (!inRange(digits)) return raw;
  return `+${dial}${digits}`;
}
