import axios from "axios";
import { handleApiError } from "../../../api/client";
import { listTransactions, updateTransaction } from "../../../api/transactions";
import { moveInstallmentToInvoice } from "../../../api/creditCards";
import { pickNonCategoryTagIdsFromApiTransaction, TRANSACTIONS_API_MAX_LIMIT } from "../../data/transactionsAdapter.js";

/**
 * Por que o servidor recusou: só quando é regra de negócio (400/409/422) com mensagem própria, como "Reabra a
 * fatura paga antes de alterar seus lançamentos." Falha de rede ou 5xx não tem causa que o usuário resolva.
 */
function refusalReason(error) {
  if (!axios.isAxiosError(error)) return "";
  const detail = error.response?.data?.detail;
  if (![400, 409, 422].includes(error.response?.status) || !detail || typeof detail !== "object" || typeof detail.message !== "string") return "";
  return handleApiError(error);
}

/**
 * Roda uma ação por linha sem parar na primeira falha; devolve quem passou, quem falhou e, se todas as
 * falhas foram a mesma recusa do servidor, a causa dela (`reason`; vazia quando não há uma causa única).
 */
async function eachRow(rows, action) {
  const results = await Promise.allSettled(rows.map(action));
  const reasons = results.filter((result) => result.status === "rejected").map((result) => refusalReason(result.reason));
  return {
    done: rows.filter((_, index) => results[index].status === "fulfilled"),
    failed: rows.filter((_, index) => results[index].status === "rejected"),
    reason: reasons.length > 0 && reasons.every((reason) => reason && reason === reasons[0]) ? reasons[0] : "",
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
