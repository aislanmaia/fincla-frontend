/**
 * Locale BCP 47 para datas na UI (ex.: `LocaleDatePicker`, revisão de transação).
 * Defina `VITE_APP_LOCALE` no `.env` (ex.: `en-US`, `es-ES`) ou troque o fallback
 * quando integrar um provedor de i18n — importe o locale ativo aqui.
 */
export const APP_UI_LOCALE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_LOCALE
    ? String(import.meta.env.VITE_APP_LOCALE)
    : "pt-BR";
