import { buildEditBaselineFromUi, buildUpdateTransactionPayload } from "../../../data/transactionsAdapter.js";
import { divideAmountExact } from "../../../money/convertAmount.js";
import { formatAmountInput } from "../../novaTransacao/accountConversion.js";

/**
 * "Mover para a conta…" em lote (#281). Sem endpoint de lote na API: um PUT por
 * lançamento, com o mesmo corpo da edição individual (#269/#273/#452).
 */

/**
 * Moeda do VALOR de uma linha da lista (a da conta em que ela caiu). Sem moeda na
 * linha, a moeda base da organização; sem nenhuma das duas, `null` — nunca um "BRL"
 * chutado (moeda errada move dinheiro errado).
 */
export function rowCurrency(tx, fallback = null) {
  const code = tx?.currency || fallback;
  return code ? String(code).toUpperCase() : null;
}

/**
 * Por que esta linha NÃO pode ir para `target` — ou `null` se pode. Só o que a lista
 * já sabe; o resto (ex.: aporte de meta) volta como 422 do servidor, por item.
 */
export function moveIneligibility(tx, target, fallbackCurrency = null) {
  if (tx?.kind === "transfer") return "Transferência entre contas: altere em Minhas Contas";
  if (tx?.settleable === false) return "Compra no cartão: a conta é a do cartão";
  if (tx?.seriesId != null) return "Ocorrência de recorrência: mova a série";
  if (target && String(tx?.accountId ?? "") === String(target.id)) return "Já está nessa conta";
  const from = rowCurrency(tx, fallbackCurrency);
  if (!from) return "Moeda desconhecida";
  const to = target ? rowCurrency(target, fallbackCurrency) : null;
  if (target && !to) return "Moeda da conta de destino desconhecida";
  const cross = target && from !== to;
  if (cross && tx?.type === "refund") return "Estorno ligado a uma compra: não muda de moeda";
  if (cross && (tx?.refundsSummary?.count ?? 0) > 0) return "Tem estorno ligado: não muda de moeda";
  return null;
}

/**
 * Plano do lote: o que vai, o que fica (com motivo) e os grupos por moeda de
 * ORIGEM — uma cotação por par (origem → conta de destino).
 */
export function planBulkMove(transactions, target, fallbackCurrency = null) {
  const eligible = [];
  const ineligible = [];
  for (const tx of transactions || []) {
    const reason = moveIneligibility(tx, target, fallbackCurrency);
    if (reason) ineligible.push({ tx, reason });
    else eligible.push(tx);
  }
  const targetCurrency = target ? rowCurrency(target, fallbackCurrency) : null;
  const sameCurrency = eligible.filter((tx) => rowCurrency(tx, fallbackCurrency) === targetCurrency);
  const crossGroups = new Map();
  for (const tx of eligible) {
    const from = rowCurrency(tx, fallbackCurrency);
    if (from === targetCurrency) continue;
    if (!crossGroups.has(from)) crossGroups.set(from, []);
    crossGroups.get(from).push(tx);
  }
  return {
    eligible,
    ineligible,
    sameCurrency,
    crossGroups: [...crossGroups.entries()].map(([from, rows]) => ({ from, rows })),
    targetCurrency,
  };
}

/**
 * Valor sugerido para uma linha entre moedas. "keep" = o mesmo número na moeda
 * nova; "convert" = origem ÷ taxa (decimal exato, HALF_UP). Sem cotação, "convert"
 * fica VAZIO — nunca taxa 1.
 */
export function suggestedMoveValue(tx, mode, rate) {
  const abs = Math.abs(Number(tx?.val) || 0).toFixed(2);
  if (mode === "keep") return formatAmountInput(abs);
  const converted = rate ? divideAmountExact(abs, rate) : null;
  return converted != null ? formatAmountInput(converted) : "";
}

/**
 * Corpo do PUT de UM lançamento: o diff contra o próprio estado da linha leva só
 * `account_id` — e, entre moedas, `value` + `value_currency` (a moeda de destino).
 */
export function buildMovePayload(tx, targetAccountId, { value = null, currency = null } = {}) {
  const baseline = buildEditBaselineFromUi(tx);
  return buildUpdateTransactionPayload({
    ...baseline,
    accountId: targetAccountId,
    moveValue: value,
    moveCurrency: currency,
    baseline,
  });
}

/** Roda `fn` sobre `items` com no máximo `limit` em voo; resultados na ordem dos itens. */
export async function runWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      try {
        results[i] = { ok: true, value: await fn(items[i], i) };
      } catch (error) {
        results[i] = { ok: false, error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
