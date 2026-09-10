import { T } from "../../tokens";
import { formatMoney as formatarDinheiro } from "../../money/formatMoney.js";
import { offeredCurrencies } from "../../money/currencyRegistry.js";

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

/**
 * As moedas que a interface pode OFERECER, vindas do registro do backend.
 *
 * Era uma lista escrita à mão aqui — três objetos que precisavam ser editados a
 * cada moeda nova, e que ficavam mentindo no dia em que o backend desativasse uma.
 * Agora é `GET /v1/currencies` (fincla-frontend#136): só as ativas, em ordem de
 * código, e **vazio enquanto o registro não chegou** — oferecer uma lista chapada
 * seria voltar a decidir no cliente o que é decisão do backend.
 *
 * `label` continua existindo para não quebrar quem consome; ele é o `name` do
 * registro ("Real brasileiro" em vez do "Real" que estava escrito aqui).
 */
export function currencyOptions() {
  return offeredCurrencies().map((m) => ({ code: m.code, label: m.name, symbol: m.symbol }));
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
export const formatMoney = formatarDinheiro;

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

/** @deprecated marca tudo como real — use `formatMoney(valor, moeda)`. */
export function formatBRL(value) {
  return formatarDinheiro(Number(value || 0), "BRL");
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
