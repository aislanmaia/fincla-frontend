import { currencyInfo } from "../../money/currencyRegistry.js";
import { formatDay, parseBRL } from "../accounts/accountMeta.js";

/**
 * Mover um lançamento para uma conta de OUTRA moeda (regra do Owner, opção 1): a
 * tela sugere o valor convertido pela cotação — num campo EDITÁVEL — e o `PUT` leva
 * `account_id` + o `value` que a pessoa confirmou, já na moeda nova. A conversão em
 * si é a do app inteiro (`money/convertAmount.js`); o parser do campo é o `parseBRL`
 * das contas — um parser só.
 */

/** Número em pt-BR com 2 casas, sem símbolo: 52.4 → "52,40". */
export function formatAmountInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Texto do campo → número. "1.500" → 1500 e "1.500,25" → 1500.25 (milhar pt-BR,
 * via `parseBRL`); vazio → `null` (não é zero: é "ainda não informado").
 */
export function parseAmountInput(text) {
  if (String(text ?? "").trim() === "") return null;
  const n = parseBRL(text);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/**
 * A taxa como a API a deu, na direção em que foi buscada, em pt-BR: "0.1825" →
 * "0,1825". Sem inverter nem arredondar para 2 casas — numa moeda de valor
 * unitário baixo (JPY, KRW) a inversa em 2 casas vira "0,00".
 */
export function formatRatePtBr(rate) {
  const s = String(rate ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return s;
  const [int, frac = ""] = s.split(".");
  const trimmed = frac.replace(/0+$/, "");
  const shown = trimmed.length >= 2 ? trimmed : trimmed.padEnd(2, "0");
  return `${int},${shown}`;
}

/**
 * "Esta conta é em US$. Valor convertido pela cotação de 03/11 (US$ 1 = R$ 5,4914):"
 *
 * A taxa aparece como se lê câmbio no Brasil — 1 unidade da moeda NOVA em moeda de
 * origem — usando `quote.displayRate`, que vem pronta da API (cotação destino→origem).
 * Sem ela, cai na direção direta ("R$ 1 = US$ 0,1821") em vez de inverter na mão.
 * `null` sem cotação.
 */
export function conversionHeadline({ from, to, quote }) {
  if (!quote?.rate || !from || !to) return null;
  const fromSymbol = currencyInfo(from).symbol;
  const toSymbol = currencyInfo(to).symbol;
  const quotedOn = formatDay(quote.quoted_on);
  const rateText = quote.displayRate
    ? `${toSymbol} 1 = ${fromSymbol} ${formatRatePtBr(quote.displayRate)}`
    : `${fromSymbol} 1 = ${toSymbol} ${formatRatePtBr(quote.rate)}`;
  return `Esta conta é em ${toSymbol}. Valor convertido pela cotação${quotedOn ? ` de ${quotedOn}` : ""} (${rateText}):`;
}
