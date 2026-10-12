import { createTransaction, listTransactions, updateTransaction } from "../../../api/transactions";
import { moveInstallmentToInvoice } from "../../../api/creditCards";
import { buildCreateTransactionPayload, pickCategoryTagFromApiTransaction, pickNonCategoryTagIdsFromApiTransaction, TRANSACTIONS_API_MAX_LIMIT } from "../../data/transactionsAdapter.js";

/** Roda uma ação por linha sem parar na primeira falha; devolve quem passou e quem falhou. */
async function eachRow(rows, action) {
  const results = await Promise.allSettled(rows.map(action));
  return {
    done: rows.filter((_, index) => results[index].status === "fulfilled"),
    failed: rows.filter((_, index) => results[index].status === "rejected"),
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

/** Estorno vinculado à compra; herda a categoria e as etiquetas dela. */
export function createRefund({ row, cardId, organizationId, value, description, dateYmd }) {
  const category = pickCategoryTagFromApiTransaction(row);
  return createTransaction(buildCreateTransactionPayload({
    organizationId,
    tipo: "estorno",
    description,
    value,
    paymentMethodKey: "credito",
    categoryTagId: category?.id ?? null,
    detailTagIds: pickNonCategoryTagIdsFromApiTransaction(row),
    dateIso: `${dateYmd}T12:00:00`,
    cardId,
    refundOfTransactionId: row.id,
  }));
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
