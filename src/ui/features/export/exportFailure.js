import { refusalReason } from "../../../api/apiError";

/** O servidor exporta no máximo isto por arquivo (acima, recusa antes de ler qualquer linha). */
export const EXPORT_MAX_ROWS = 20000;

const EXPORT_FAILURES = {
  export_changed: "O extrato mudou enquanto o arquivo era preparado. Exporte de novo.",
  // 500: linhas e totais lidos no mesmo instantâneo continuaram discordando. Exportar de novo daria o mesmo erro.
  export_inconsistent:
    "Não conseguimos conferir os totais do arquivo com os lançamentos. O problema foi registrado; tente com outro recorte ou fale com o suporte.",
  filters_text_too_long: "Há filtros demais para descrever no arquivo. Tire alguns filtros e exporte de novo.",
};

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
  return EXPORT_FAILURES[detail?.code] ?? (refusalReason(error) || "Não foi possível preparar a exportação. Tente novamente.");
}
