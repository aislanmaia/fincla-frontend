import { invoiceKey } from "./invoiceScope.js";
import { weekEnd } from "./ledgerHistory.js";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const positive = (row, currency) => Number(row.amount) > 0 && (!currency || row.amount_currency === currency);

/**
 * Barras do card "Saídas por mês/semana".
 *
 * - Uma fatura marcada: SEMANAS dela (`by_week`), porque um mês de calendário não
 *   descreve uma fatura que cruza a virada de mês. Cada semana é clicável (recorte de datas).
 * - Várias faturas (ou recorte por período): uma barra por FATURA (`by_invoice`),
 *   rotulada com o mês de referência, como nos apps de banco. Com faturas marcadas, só elas
 *   têm barra; sem marcação (período), todas as do período.
 * - Só saídas (> 0) na moeda do cartão; nada vira zero por ausência.
 * - `breakdown.projected_by_invoice` (estimativa de recorrências ainda não cobradas) vira `bar.projected`; nunca soma ao `amount` confirmado.
 * - Só é clicável a fatura que o seletor conhece (`selectableKeys`): uma barra antiga demais não vira recorte.
 */
export function buildOutflows({ mode, summary, ladder, selectedKeys, selectableKeys, selectedWeek = null, currency, now = new Date() }) {
  // Com uma semana marcada o resumo já vem recortado nela: as outras barras vêm da consulta sem o recorte de semana (`ladder`).
  const breakdown = (ladder ?? summary)?.breakdown;
  if (mode === "weeks") {
    const bars = (breakdown?.by_week ?? []).filter((row) => positive(row, currency)).map((row) => {
      const [, month, day] = row.week_start.split("-").map(Number);
      const label = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
      return { key: row.week_start, label, title: `Semana de ${label}`, amount: Number(row.amount), from: row.week_start, to: weekEnd(row.week_start), selected: !selectedWeek || selectedWeek === row.week_start, clickable: true };
    });
    return { kind: "weeks", bars };
  }
  const chosen = new Set(selectedKeys);
  // Linhas do mesmo mês somam (nunca a última vence): cada uma é uma parte da estimativa.
  const projectedByKey = new Map();
  (breakdown?.projected_by_invoice ?? []).filter((row) => Number(row.amount) > 0 && (!currency || row.amount_currency === currency)).forEach((row) => {
    const key = invoiceKey(row.year, row.month);
    const before = projectedByKey.get(key);
    projectedByKey.set(key, { year: row.year, month: row.month, amount: (before?.amount ?? 0) + Number(row.amount), count: (before?.count ?? 0) + Number(row.count ?? 0), approximate: Boolean(before?.approximate || row.approximate) });
  });
  const labelOf = (year, month) => year === now.getFullYear() ? MONTHS[month - 1] : `${MONTHS[month - 1]}/${String(year).slice(2)}`;
  const confirmed = (breakdown?.by_invoice ?? []).filter((row) => positive(row, currency)).map((row) => {
    const key = invoiceKey(row.year, row.month);
    return { key, year: row.year, month: row.month, label: labelOf(row.year, row.month), title: `Fatura de ${MONTHS[row.month - 1]} ${row.year}`, amount: Number(row.amount), projected: projectedByKey.get(key) ?? null, selected: chosen.size === 0 || chosen.has(key), clickable: selectableKeys ? selectableKeys.has(key) : true };
  });
  // Meses só com estimativa (sem lançamento nenhum ainda) também ganham barra: sem valor confirmado e sem clique.
  const known = new Set(confirmed.map((bar) => bar.key));
  const projectedOnly = [...projectedByKey.entries()].filter(([key]) => !known.has(key)).map(([key, row]) => ({
    key, year: row.year, month: row.month, label: labelOf(row.year, row.month), title: `Fatura de ${MONTHS[row.month - 1]} ${row.year}`,
    amount: 0, projected: row, selected: true, clickable: false,
  }));
  // Com faturas marcadas o gráfico retrata o recorte: só elas têm barra (o ladder traz o cartão inteiro, mas as outras faturas não pertencem ao recorte).
  // Sem marcação (recorte por período) todas as faturas do período aparecem.
  const inScope = (bar) => chosen.size === 0 || chosen.has(bar.key);
  const bars = [...confirmed, ...projectedOnly].filter(inScope).sort((a, b) => (a.year - b.year) || (a.month - b.month));
  return { kind: "invoices", bars, hasProjection: bars.some((bar) => bar.projected) };
}
