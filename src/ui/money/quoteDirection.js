import { convertAmountExact, divideAmountExact, PLAIN_DECIMAL_RE } from "./convertAmount.js";

/**
 * Em que direção buscar e mostrar a cotação de uma conversão `from → to`.
 *
 * Regra do Owner (2026-11-04): a tela sempre diz "1 <moeda estrangeira> = <moeda
 * base> x" — "US$ 1 = R$ 5,4914", nos dois sentidos. Quando nenhum lado é a moeda
 * base da organização (ou ela não é conhecida), "1 <origem> = <destino> x".
 *
 * A cotação é buscada JÁ nessa direção (`GET /quotations/{base}/{quote}`) e a MESMA
 * taxa é mostrada e usada na conta — nunca se inverte um número arredondado:
 *   - origem = `base` da cotação → valor × taxa  (US$ 52,40 × 5,4914 = R$ 287,75)
 *   - origem = `quote` da cotação → valor ÷ taxa (R$ 123,45 ÷ 5,4653 = US$ 22,59)
 */
export function quoteDirection({ from, to, base = null }) {
  const f = code(from);
  const t = code(to);
  const b = code(base);
  if (b && f === b && t !== b) return { base: t, quote: f, op: "divide" };
  return { base: f, quote: t, op: "multiply" };
}

/** Valor na moeda de destino pela cotação na direção de `quoteDirection`. `null` sem taxa usável. */
export function convertByQuote(amount, rate, op) {
  const r = String(rate ?? "").trim();
  if (!PLAIN_DECIMAL_RE.test(r) || !/[1-9]/.test(r)) return null;
  return op === "divide" ? divideAmountExact(amount, r) : convertAmountExact(amount, r);
}

function code(value) {
  const s = String(value ?? "").trim().toUpperCase();
  return s || null;
}
