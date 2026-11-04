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

const RATE_MAX_PLACES = 4;

/**
 * A taxa em pt-BR, no máximo 4 casas (HALF_UP, em inteiros), no mínimo 2:
 * "5.49140000" → "5,4914", "0.1821029" → "0,1821", "5.5" → "5,50". Só EXIBIÇÃO:
 * a conta usa a taxa inteira, como a API deu.
 */
export function formatRatePtBr(rate) {
  const s = String(rate ?? "").trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return s;
  let [int, frac = ""] = s.split(".");
  if (frac.length > RATE_MAX_PLACES) {
    const n = BigInt(`${int}${frac}`);
    const d = 10n ** BigInt(frac.length - RATE_MAX_PLACES);
    const q = n / d + ((n % d) * 2n >= d ? 1n : 0n);
    const digits = q.toString().padStart(RATE_MAX_PLACES + 1, "0");
    int = digits.slice(0, -RATE_MAX_PLACES);
    frac = digits.slice(-RATE_MAX_PLACES);
  }
  const trimmed = frac.replace(/0+$/, "");
  const shown = trimmed.length >= 2 ? trimmed : trimmed.padEnd(2, "0");
  return `${int},${shown}`;
}

/**
 * "Esta conta é em US$. Valor convertido pela cotação de 03/11 (US$ 1 = R$ 5,4914):"
 *
 * `quote` traz a taxa como buscada e a data DELA; `direction` (de `quoteDirection`)
 * diz o par mostrado — "1 <direction.base> = <direction.quote> taxa" —, o MESMO par
 * em que a cotação foi buscada e usada na conta. `null` sem cotação.
 */
export function conversionHeadline({ to, quote, direction }) {
  if (!quote?.rate || !to || !direction?.base || !direction?.quote) return null;
  const toSymbol = currencyInfo(to).symbol;
  const quotedOn = formatDay(quote.quoted_on);
  const pair = `${currencyInfo(direction.base).symbol} 1 = ${currencyInfo(direction.quote).symbol} ${formatRatePtBr(quote.rate)}`;
  return `Esta conta é em ${toSymbol}. Valor convertido pela cotação${quotedOn ? ` de ${quotedOn}` : ""} (${pair}):`;
}
