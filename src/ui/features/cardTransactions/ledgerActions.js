import { humanizeDetailString, isLegacyError, isSafeError } from "../../../api/apiError";
import { listTransactions, updateTransaction } from "../../../api/transactions";
import { moveInstallmentToInvoice } from "../../../api/creditCards";
import { pickNonCategoryTagIdsFromApiTransaction, TRANSACTIONS_API_MAX_LIMIT } from "../../data/transactionsAdapter.js";

/**
 * Por que o servidor recusou: a mensagem do PRÓPRIO servidor, quando é regra de negócio (400/409/422), como
 * "Reabra a fatura paga antes de alterar seus lançamentos." Falha de rede, 5xx ou mensagem que o sanitizador
 * reprova não têm causa que o usuário resolva: ficam sem motivo (e com o convite a tentar de novo).
 */
function refusalReason(error) {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  if (![400, 409, 422].includes(status) || !(isSafeError(detail) || isLegacyError(detail))) return "";
  const message = humanizeDetailString(detail.message, status);
  return message && !/[.!?]$/.test(message) ? `${message}.` : message;
}

/**
 * Roda uma ação por linha sem parar na primeira falha; devolve quem passou, quem falhou e a causa das recusas
 * do servidor (`reason`, sem repetição). Se só parte das falhas tem causa, o resto avisa que pode funcionar de novo.
 */
async function eachRow(rows, action) {
  const results = await Promise.allSettled(rows.map(action));
  const reasons = results.filter((result) => result.status === "rejected").map((result) => refusalReason(result.reason));
  const known = [...new Set(reasons.filter(Boolean))];
  const partial = known.length > 0 && reasons.some((reason) => !reason);
  return {
    done: rows.filter((_, index) => results[index].status === "fulfilled"),
    failed: rows.filter((_, index) => results[index].status === "rejected"),
    reason: known.length === 0 ? "" : `${known.join(" ")}${partial ? " As demais falharam por outro motivo; tente novamente." : ""}`,
  };
}

/** Troca só a categoria (as demais etiquetas ficam). Manda só `tag_ids` + a data exigida pelo PUT. */
export function categorizeRows({ rows, categoryId, organizationId }) {
  return eachRow(rows, (row) => updateTransaction(row.id, organizationId, {
    date: row.date,
    tag_ids: [...new Set([String(categoryId), ...pickNonCategoryTagIdsFromApiTransaction(row)])],
  }));
}

/** Só parcelas de compra parcelada podem mudar de fatura; as demais linhas são ignoradas aqui. */
export function moveRows({ rows, cardId, organizationId, year, month }) {
  return eachRow(rows, (row) => moveInstallmentToInvoice(cardId, row.id, organizationId, { target_year: year, target_month: month }));
}

/** Todas as páginas do recorte filtrado (a exportação nunca sai só com o que está carregado). */
export async function fetchAllRows({ base, filter, total, signal }) {
  const rows = [];
  for (let page = 1; rows.length < total; page += 1) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    const response = await listTransactions({ ...base, ...filter, page, limit: TRANSACTIONS_API_MAX_LIMIT });
    const data = response.data ?? [];
    rows.push(...data);
    if (data.length === 0 || !response.pagination?.has_next) break;
  }
  return rows;
}
