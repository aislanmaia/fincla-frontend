import { T } from "../../tokens";

/** Tipos oferecidos no seletor de conta (o backend também aceita 'crypto'). */
export const ACCOUNT_TYPES = [
  { value: "checking", label: "Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "investment", label: "Investimento" },
  { value: "wallet", label: "Carteira" },
];

const META = {
  checking: { label: "corrente", emoji: "🏦", tint: T.purpleLight },
  savings: { label: "poupança", emoji: "🐷", tint: T.greenLight },
  investment: { label: "investimento", emoji: "📈", tint: T.amberLight },
  wallet: { label: "carteira", emoji: "👛", tint: T.grayLight },
  crypto: { label: "cripto", emoji: "🪙", tint: T.purpleLight },
};

export function accountMeta(type) {
  return META[type] || META.wallet;
}

/** Swatches de cor (hex) e ícones para o formulário de conta. */
export const ACCOUNT_COLORS = [T.purple, T.blue, T.green, T.amber, T.red];
export const ACCOUNT_ICONS = ["🏦", "🐷", "📈", "💳", "💰", "👛"];

/** Moedas que o registro do backend oferece hoje (fincla-api#128). */
export const CURRENCIES = [
  { code: "BRL", label: "Real", symbol: "R$" },
  { code: "USD", label: "Dólar", symbol: "US$" },
  { code: "EUR", label: "Euro", symbol: "€" },
];

const formatters = new Map();
function formatterFor(currency) {
  const code = (currency || "BRL").toUpperCase();
  if (!formatters.has(code)) {
    formatters.set(
      code,
      // pt-BR de propósito: o usuário é brasileiro mesmo quando o dinheiro não é,
      // então a separação de milhar e a vírgula decimal seguem a locale dele.
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: code }),
    );
  }
  return formatters.get(code);
}

/**
 * Formata um valor NA MOEDA DELE.
 *
 * `formatBRL` marcava tudo como real, então uma conta em dólar aparecia como
 * "R$ 250,50" — o número certo com a unidade errada, que é pior que número
 * nenhum porque parece correto.
 *
 * Ausência devolve `null`, nunca "R$ 0,00": zero inventado num saldo afirma que
 * a pessoa não tem dinheiro. Quem chama decide como mostrar a ausência.
 */
export function formatMoney(value, currency = "BRL") {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return formatterFor(currency).format(n);
}

/**
 * "2026-09-03" -> "03/09". Só dia e mês: a cotação relevante é sempre recente, e
 * o ano ocuparia espaço sem informar.
 *
 * Fatia a string em vez de usar `new Date("2026-09-03")`, que o JS interpreta
 * como UTC e, em fuso negativo, mostra o dia ANTERIOR — exatamente o erro que
 * tornaria uma taxa de ontem parecer de anteontem.
 */
export function formatDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}` : "";
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatBRL(value) {
  return brl.format(Number(value || 0));
}

/** Converte "R$ 1.234,56" / "1234,56" / "1234.56" em número. */
export function parseBRL(input) {
  if (typeof input === "number") return input;
  const cleaned = String(input || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
