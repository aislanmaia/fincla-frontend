import { resolveReportMonths } from "../../data/reportsAdapter.js";
import { filePrefixOf } from "./exportRequest.js";
import { exportTexts } from "./exportTexts.js";

const ymd = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * Como a exportação de Relatórios se identifica (fincla-api#526). O período do relatório ("3m"/"6m"/"12m") é o MESMO
 * que os gráficos mostram — do 1º dia do mês mais antigo ao último dia do mês atual, como `monthly-evolution` no
 * servidor — e vira `date_start`/`date_end` do pedido ao exportador, sem nenhum outro filtro (todas as contas).
 *
 * `today` é a data local do navegador (nunca o dia em UTC). O prefixo leva o intervalo de meses
 * (`relatorios-2026-06-a-2026-11`): o servidor acrescenta o dia da geração.
 */
export function reportsExportScope(periodo, today = new Date()) {
  const months = resolveReportMonths(periodo);
  const start = new Date(today.getFullYear(), today.getMonth() - months + 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const dateStart = ymd(start);
  const dateEnd = ymd(end);
  return {
    dateStart,
    dateEnd,
    title: "Relatórios",
    filePrefix: filePrefixOf("relatorios", `${dateStart.slice(0, 7)} a ${dateEnd.slice(0, 7)}`),
    filtersText: [exportTexts("pt-BR").period(dateStart, dateEnd)],
  };
}
