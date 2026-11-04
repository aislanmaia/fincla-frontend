import { currencyInfo } from "../../money/currencyRegistry.js";
import { formatMoneyPlainSpace } from "../../money/formatMoney.js";

/**
 * Mover um lançamento para uma conta de OUTRA moeda (regra do Owner, opção 1):
 * a tela sugere o valor convertido pela cotação do dia — num campo EDITÁVEL — e o
 * `PUT` leva `account_id` + o `value` que a pessoa confirmou, já na moeda nova.
 * A taxa é só sugestão: quem manda é o extrato do banco.
 *
 * Nada aqui usa ponto flutuante para o valor: `287.15 * 0.1825` em float pode cair
 * um centavo para o lado errado. A conta é em inteiros (BigInt), com HALF_UP em 2
 * casas — o mesmo `quantize(Decimal("0.01"), ROUND_HALF_UP)` do `Quotation.convert`
 * do backend. Valor guardado tem sempre 2 casas (ADR-0003); `decimal_places` da
 * moeda é só exibição.
 */

const MONEY_PLACES = 2;

/** "123.45" | 123.45 → { digits: 12345n, scale: 2 }. `null` se não for decimal válido. */
function parseDecimal(value) {
  let s = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "") : String(value ?? "").trim();
  if (/e/i.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    s = n.toFixed(12);
  }
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const frac = m[3] ?? "";
  const digits = BigInt(`${m[2]}${frac}`) * (m[1] ? -1n : 1n);
  return { digits, scale: frac.length };
}

/** Inteiro escalado (10^places) → "123.45". */
function toDecimalString(scaled, places) {
  const negative = scaled < 0n;
  const abs = (negative ? -scaled : scaled).toString().padStart(places + 1, "0");
  const intPart = places > 0 ? abs.slice(0, -places) : abs;
  const fracPart = places > 0 ? `.${abs.slice(-places)}` : "";
  return `${negative ? "-" : ""}${intPart}${fracPart}`;
}

/** `numerator / denominator` (inteiros), HALF_UP — metade arredonda para longe do zero. */
function divHalfUp(numerator, denominator) {
  const negative = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  let q = n / d;
  if ((n % d) * 2n >= d) q += 1n;
  return negative ? -q : q;
}

/** `amount × rate` em 2 casas, HALF_UP. String decimal ("52.40") ou `null`. */
export function convertAmountExact(amount, rate) {
  const a = parseDecimal(amount);
  const r = parseDecimal(rate);
  if (!a || !r) return null;
  const scale = a.scale + r.scale;
  const product = a.digits * r.digits;
  const scaled = scale <= MONEY_PLACES
    ? product * 10n ** BigInt(MONEY_PLACES - scale)
    : divHalfUp(product, 10n ** BigInt(scale - MONEY_PLACES));
  return toDecimalString(scaled, MONEY_PLACES);
}

/** `1 / rate` em 2 casas, HALF_UP — só para exibir "US$ 1 = R$ 5,48". */
export function inverseRateExact(rate) {
  const r = parseDecimal(rate);
  if (!r || r.digits === 0n) return null;
  // 1 / (digits / 10^scale) = 10^scale / digits; em 2 casas: 10^(scale+2) / digits.
  return toDecimalString(divHalfUp(10n ** BigInt(r.scale + MONEY_PLACES), r.digits), MONEY_PLACES);
}

/** Número em pt-BR com 2 casas, sem símbolo: 52.4 → "52,40". */
export function formatAmountInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: MONEY_PLACES, maximumFractionDigits: MONEY_PLACES });
}

/** "1.234,56" / "52,4" / "52.40" → 1234.56 / 52.4 / 52.4; `null` se vazio ou inválido. */
export function parseAmountInput(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  let s = raw.replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** "2026-11-03" → "03/11/2026". Fatia a string: `new Date()` voltaria um dia em fuso negativo. */
export function formatQuotedOn(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * "Esta conta é em US$. Valor convertido pela cotação de 03/11/2026 (US$ 1 = R$ 5,48):"
 * `null` sem cotação.
 */
export function conversionHeadline({ from, to, quote }) {
  if (!quote?.rate || !from || !to) return null;
  const toSymbol = currencyInfo(to).symbol;
  const inverse = inverseRateExact(quote.rate);
  const rateLabel = inverse != null ? ` (${toSymbol} 1 = ${formatMoneyPlainSpace(inverse, from)})` : "";
  const quotedOn = formatQuotedOn(quote.quoted_on);
  return `Esta conta é em ${toSymbol}. Valor convertido pela cotação${quotedOn ? ` de ${quotedOn}` : ""}${rateLabel}:`;
}
