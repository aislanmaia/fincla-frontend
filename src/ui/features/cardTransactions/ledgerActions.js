import { humanizeDetailString, isLegacyError, isSafeError } from "../../../api/apiError";
import { bulkCategorizeTransactions, listTransactions } from "../../../api/transactions";
import { moveInstallmentToInvoice } from "../../../api/creditCards";
import { TRANSACTIONS_API_MAX_LIMIT } from "../../data/transactionsAdapter.js";

/**
 * Por que o servidor recusou: a mensagem do PRÓPRIO servidor, quando é regra de negócio (400/409/422), como
 * "Reabra a fatura paga antes de alterar seus lançamentos." Falha de rede, 5xx ou mensagem que o sanitizador
 * reprova não têm causa que o usuário resolva: ficam sem motivo (e com o convite a tentar de novo).
 */
export function refusalReason(error) {
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

/** O servidor aceita de 1 a 200 lançamentos por pedido. */
export const BULK_MAX_IDS = 200;

const BULK_REASONS = {
  not_found: "um dos lançamentos não existe mais",
  category_not_allowed_for_type: "a categoria escolhida não aceita o tipo de um dos lançamentos",
  detail_tag_outside_category: "um lançamento tem uma etiqueta de detalhe de outra categoria; ajuste-o sozinho",
  invalid_category: "a categoria escolhida não está mais disponível",
};
const BULK_REASONS_SHOWN = 3;

/**
 * Por que o servidor recusou o lote (nada daquele pedido foi alterado), nomeando o lançamento quando o servidor
 * aponta um da seleção ("outra parcela da mesma compra" quando é uma que não foi enviada). Poucos motivos aparecem;
 * o resto vira contagem. Motivo desconhecido ainda diz que foi recusa — repetir não resolve.
 */
function bulkRefusalReason(error, rows, anythingCommitted) {
  const detail = error?.response?.data?.detail;
  if (error?.response?.status !== 422 || detail?.code !== "bulk_rejected" || !Array.isArray(detail.failures)) return refusalReason(error);
  const parts = [...new Set(detail.failures.map((failure) => {
    const reason = BULK_REASONS[failure.reason] ?? "o servidor recusou um dos lançamentos";
    if (failure.id == null) return reason;
    const row = rows.find((entry) => entry.id === failure.id);
    return `${reason} (${row ? row.description : "outra parcela da mesma compra"})`;
  }))];
  const shown = parts.slice(0, BULK_REASONS_SHOWN).join("; ");
  const more = parts.length > BULK_REASONS_SHOWN ? ` e mais ${parts.length - BULK_REASONS_SHOWN}` : "";
  return `${anythingCommitted ? "Este bloco não foi alterado" : "Nada foi alterado"}: ${shown}${more}.`;
}

/**
 * Troca só a categoria (as demais etiquetas ficam) pelo lote do servidor. Cada pedido é tudo ou nada, mas a
 * seleção acima de 200 vai em pedidos sequenciais: uma recusa ou queda num bloco posterior NÃO desfaz os anteriores
 * (ficam em `done`, e a tela diz quantos já foram). Para na primeira falha; o que não foi enviado fica entre os que
 * falharam, e tentar de novo reenvia só esses. `updated` conta o que o servidor efetivamente alterou (uma compra
 * parcelada é reetiquetada inteira, então pode passar do que foi selecionado).
 */
export async function categorizeRows({ rows, categoryId, organizationId }) {
  const done = [];
  let updated = 0;
  for (let start = 0; start < rows.length; start += BULK_MAX_IDS) {
    const chunk = rows.slice(start, start + BULK_MAX_IDS);
    try {
      const response = await bulkCategorizeTransactions(organizationId, chunk.map((row) => row.id), String(categoryId));
      done.push(...chunk);
      updated += Number.isFinite(response?.count) ? response.count : chunk.length;
    } catch (error) {
      return { done, failed: rows.slice(start), updated, reason: bulkRefusalReason(error, rows, done.length > 0) };
    }
  }
  return { done, failed: [], updated, reason: "" };
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
