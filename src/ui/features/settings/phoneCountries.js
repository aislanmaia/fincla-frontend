/**
 * Country picker data for the WhatsApp "Vincular número" form.
 *
 * Fincla will run outside Brazil, so the country code is chosen, not typed —
 * Brazil preselected. Names in PT-BR (UI language); `placeholder` shows the
 * local layout of that country so the user types only the national number.
 */
export const DEFAULT_PHONE_COUNTRY = "BR";

export const PHONE_COUNTRIES = [
  { code: "BR", name: "Brasil", dial: "55", flag: "🇧🇷", placeholder: "11 99999-0000" },
  { code: "AR", name: "Argentina", dial: "54", flag: "🇦🇷", placeholder: "11 2345-6789" },
  { code: "AU", name: "Austrália", dial: "61", flag: "🇦🇺", placeholder: "412 345 678" },
  { code: "BO", name: "Bolívia", dial: "591", flag: "🇧🇴", placeholder: "7123 4567" },
  { code: "CA", name: "Canadá", dial: "1", flag: "🇨🇦", placeholder: "416 555 0123" },
  { code: "CL", name: "Chile", dial: "56", flag: "🇨🇱", placeholder: "9 6123 4567" },
  { code: "CO", name: "Colômbia", dial: "57", flag: "🇨🇴", placeholder: "321 1234567" },
  { code: "DE", name: "Alemanha", dial: "49", flag: "🇩🇪", placeholder: "1512 3456789" },
  { code: "ES", name: "Espanha", dial: "34", flag: "🇪🇸", placeholder: "612 34 56 78" },
  { code: "US", name: "Estados Unidos", dial: "1", flag: "🇺🇸", placeholder: "201 555 0123" },
  { code: "FR", name: "França", dial: "33", flag: "🇫🇷", placeholder: "6 12 34 56 78" },
  { code: "IE", name: "Irlanda", dial: "353", flag: "🇮🇪", placeholder: "85 012 3456" },
  { code: "IT", name: "Itália", dial: "39", flag: "🇮🇹", placeholder: "312 345 6789" },
  { code: "JP", name: "Japão", dial: "81", flag: "🇯🇵", placeholder: "90 1234 5678" },
  { code: "MX", name: "México", dial: "52", flag: "🇲🇽", placeholder: "55 1234 5678" },
  { code: "NL", name: "Países Baixos", dial: "31", flag: "🇳🇱", placeholder: "6 12345678" },
  { code: "PY", name: "Paraguai", dial: "595", flag: "🇵🇾", placeholder: "961 456789" },
  { code: "PE", name: "Peru", dial: "51", flag: "🇵🇪", placeholder: "912 345 678" },
  { code: "PT", name: "Portugal", dial: "351", flag: "🇵🇹", placeholder: "912 345 678" },
  { code: "GB", name: "Reino Unido", dial: "44", flag: "🇬🇧", placeholder: "7400 123456" },
  { code: "CH", name: "Suíça", dial: "41", flag: "🇨🇭", placeholder: "78 123 45 67" },
  { code: "UY", name: "Uruguai", dial: "598", flag: "🇺🇾", placeholder: "94 231 234" },
  { code: "VE", name: "Venezuela", dial: "58", flag: "🇻🇪", placeholder: "412 1234567" },
];

export function findPhoneCountry(code) {
  return PHONE_COUNTRIES.find((c) => c.code === code) ?? PHONE_COUNTRIES[0];
}

/**
 * Compose the E.164 string the API requires from the picked country and the
 * national number as typed (spaces, dashes and parentheses tolerated).
 *
 * A number typed with its own "+" is taken as complete and the picker is
 * ignored — otherwise "+55 11…" under Brasil would become "+5555 11…".
 * Never invents digits: an empty national number yields "".
 */
export function buildE164(dial, local) {
  const raw = (local || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits ? `+${digits}` : raw;
  if (!digits) return raw; // garbage goes to the API to reject with the translated hint
  return `+${dial}${digits}`;
}
