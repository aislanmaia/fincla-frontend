/**
 * Conversão de dinheiro pela cotação — UM caminho para o app inteiro.
 *
 * `amount × rate` em inteiros (BigInt), arredondado em 2 casas com HALF_UP: o
 * mesmo `quantize(Decimal("0.01"), ROUND_HALF_UP)` do `Quotation.convert` do
 * backend. Ponto flutuante (`287.15 * 0.1825`, `.toFixed(2)`) erra o centavo
 * justamente na metade, e a tela sugeriria um número que o backend não grava.
 * Armazenamento é sempre em 2 casas (ADR-0003); `decimal_places` da moeda é só
 * exibição.
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
  return { digits: BigInt(`${m[2]}${frac}`) * (m[1] ? -1n : 1n), scale: frac.length };
}

/** `numerator / denominator` em inteiros, HALF_UP (metade para longe do zero). */
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
  const negative = scaled < 0n;
  const abs = (negative ? -scaled : scaled).toString().padStart(MONEY_PLACES + 1, "0");
  return `${negative ? "-" : ""}${abs.slice(0, -MONEY_PLACES)}.${abs.slice(-MONEY_PLACES)}`;
}
