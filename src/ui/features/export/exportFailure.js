import { refusalReason } from "../../../api/apiError";

/** O servidor exporta no máximo isto por arquivo (acima, recusa antes de ler qualquer linha). */
export const EXPORT_MAX_ROWS = 20000;

/**
 * "Exportar seleção" (#524): o máximo de ids que o pedido leva. Vai na URL de um GET, e o servidor recusa pedido
 * acima de 16 KiB antes de responder: 500 ids no maior tamanho (10 dígitos) cabem com folga (G3-2-07; o mesmo
 * limite de `MAX_SELECTION_IDS` da API, que devolve 422 `selection_too_large` acima dele).
 */
export const SELECTION_MAX_IDS = 500;

/** A seleção passou do limite: o texto do painel e o da recusa do servidor são o mesmo. */
export const selectionTooLargeMessage = (count, limit = SELECTION_MAX_IDS) =>
  `A seleção tem ${count.toLocaleString("pt-BR")} lançamentos e o máximo é ${limit.toLocaleString("pt-BR")}. Selecione menos lançamentos ou exporte pelos filtros da tela.`;

const EXPORT_FAILURES = {
  export_changed: "O extrato mudou enquanto o arquivo era preparado. Exporte de novo.",
  // 500: linhas e totais lidos no mesmo instantâneo continuaram discordando. Exportar de novo daria o mesmo erro.
  export_inconsistent:
    "Não conseguimos conferir os totais do arquivo com os lançamentos. O problema foi registrado; tente com outro recorte ou fale com o suporte.",
  filters_text_too_long: "Há filtros demais para descrever no arquivo. Tire alguns filtros e exporte de novo.",
};

/** 404 de um id da seleção que não é lançamento da organização (apagado depois de marcado, por exemplo). */
const SELECTION_GONE = "Um ou mais lançamentos marcados não existem mais. Atualize a lista e selecione de novo.";

/**
 * Por que a exportação pelo servidor falhou, em português. Código conhecido tem texto próprio; outra recusa de negócio
 * (400/409/422) mostra a mensagem do próprio servidor; sem causa que o usuário resolva, o convite a tentar de novo.
 */
export function exportFailureMessage(error) {
  const detail = error?.response?.data?.detail;
  if (detail?.code === "export_too_large" && Number.isFinite(detail.total) && Number.isFinite(detail.limit)) {
    const fmt = (value) => value.toLocaleString("pt-BR");
    return `O recorte tem ${fmt(detail.total)} lançamentos e o limite por arquivo é ${fmt(detail.limit)}. Estreite os filtros e exporte de novo.`;
  }
  if (detail?.code === "selection_too_large" && Number.isFinite(detail.total) && Number.isFinite(detail.limit)) {
    return selectionTooLargeMessage(detail.total, detail.limit);
  }
  if (detail?.error === "TRANSACTION_NOT_FOUND") return SELECTION_GONE;
  return EXPORT_FAILURES[detail?.code] ?? (refusalReason(error) || "Não foi possível preparar a exportação. Tente novamente.");
}
