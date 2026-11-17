import { convertByQuote } from "./quoteDirection.js";

/**
 * Levar valores em outra moeda para a moeda base com as cotações que a própria API
 * usou para o total do período (o recibo `consolidation` de `/transactions/summary`,
 * `/analytics/by-category` etc.: `{ target_currency, rates: [{base, quote, rate}] }`).
 *
 * Existe para as telas que somam transações no navegador — curva de ritmo,
 * velocidade, gasto por dia — e que, sem isto, empilhavam US$ 100 como R$ 100.
 * Usar a MESMA taxa do total do período mantém a curva coerente com o número que
 * aparece no cartão ao lado.
 */

/** A taxa para levar `from` a `target`, na direção em que a API a mandou, ou `null`. */
export function rateTo(target, from, rates) {
  for (const r of rates ?? []) {
    if (r?.base === from && r?.quote === target) return { rate: r.rate, op: "multiply" };
    if (r?.base === target && r?.quote === from) return { rate: r.rate, op: "divide" };
  }
  return null;
}

/**
 * `amount` em `currency` levado a `target`. Mesma moeda (ou moeda não declarada, que
 * é a base por convenção) → o próprio valor. Sem taxa ou valor inválido → `null`.
 */
export function convertToBase(amount, currency, target, rates) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  if (!currency || currency === target) return n;
  if (!target) return null;
  const q = rateTo(target, currency, rates);
  const converted = q ? convertByQuote(n.toFixed(2), q.rate, q.op) : null;
  return converted == null ? null : Number(converted);
}

/**
 * As despesas de `transactions` com as estrangeiras convertidas para `target`, para
 * quem soma por dia e escreve o resultado na base. As sem moeda declarada contam
 * como a base. Tudo já na base (ou nenhuma moeda declarada): a lista sai como
 * entrou. Moeda declarada sem `target` conhecido, ou estrangeira sem taxa → `null`:
 * não há como saber se a soma é honesta, e quem chama não desenha.
 *
 * `amountOf(tx)` é o valor da ocorrência (no app, `pickDisplayAmount`): a camada
 * de dinheiro não conhece o formato das transações.
 */
export function expensesInBase(transactions, target, rates, amountOf) {
  const list = transactions ?? [];
  const declared = new Set();
  for (const tx of list) {
    if (tx?.type === "expense" && tx.value_currency) declared.add(tx.value_currency);
  }
  if (declared.size === 0 || (declared.size === 1 && target && declared.has(target))) return list;
  if (!target) return null;
  const out = [];
  for (const tx of list) {
    const currency = tx?.value_currency;
    if (tx?.type !== "expense" || !currency || currency === target) {
      out.push(tx);
      continue;
    }
    const converted = convertToBase(amountOf(tx), currency, target, rates);
    if (converted == null) return null;
    // `installment_info: null`: o valor convertido já é o desta ocorrência.
    out.push({ ...tx, value: converted, installment_info: null, value_currency: target });
  }
  return out;
}
