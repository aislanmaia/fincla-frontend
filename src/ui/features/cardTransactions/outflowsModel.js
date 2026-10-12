import { invoiceKey } from "./invoiceScope.js";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const positive = (row, currency) => Number(row.amount) > 0 && (!currency || row.amount_currency === currency);

/**
 * Barras do card "Saídas por mês/semana".
 *
 * - Uma fatura marcada: SEMANAS dela (`by_week`), porque um mês de calendário não
 *   descreve uma fatura que cruza a virada de mês.
 * - Várias faturas (ou recorte por período): uma barra por FATURA (`by_invoice`),
 *   rotulada com o mês de referência, como nos apps de banco.
 * - Só saídas (> 0) na moeda do cartão; nada vira zero por ausência.
 * - `breakdown.projected_by_invoice` (estimativa de recorrências ainda não cobradas) vira `bar.projected`; nunca soma ao `amount` confirmado.
 * - Só é clicável a fatura que o seletor conhece (`selectableKeys`): uma barra antiga demais não vira recorte.
 */
export function buildOutflows({ mode, summary, ladder, selectedKeys, selectableKeys, currency, now = new Date() }) {
  const breakdown = (mode === "weeks" ? summary : ladder ?? summary)?.breakdown;
  if (mode === "weeks") {
    const bars = (breakdown?.by_week ?? []).filter((row) => positive(row, currency)).map((row) => {
      const [, month, day] = row.week_start.split("-").map(Number);
      const label = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
      return { key: row.week_start, label, title: `Semana de ${label}`, amount: Number(row.amount), selected: true, clickable: false };
    });
    return { kind: "weeks", bars };
  }
  const chosen = new Set(selectedKeys);
  const projectedByKey = new Map((breakdown?.projected_by_invoice ?? []).filter((row) => Number(row.amount) > 0 && (!currency || row.amount_currency === currency))
    .map((row) => [invoiceKey(row.year, row.month), { year: row.year, month: row.month, amount: Number(row.amount), count: row.count, approximate: Boolean(row.approximate) }]));
  const labelOf = (year, month) => year === now.getFullYear() ? MONTHS[month - 1] : `${MONTHS[month - 1]}/${String(year).slice(2)}`;
  const confirmed = (breakdown?.by_invoice ?? []).filter((row) => positive(row, currency)).map((row) => {
    const key = invoiceKey(row.year, row.month);
    return { key, year: row.year, month: row.month, label: labelOf(row.year, row.month), title: `Fatura de ${MONTHS[row.month - 1]} ${row.year}`, amount: Number(row.amount), projected: projectedByKey.get(key) ?? null, selected: chosen.size === 0 || chosen.has(key), clickable: selectableKeys ? selectableKeys.has(key) : true };
  });
  // Meses só com estimativa (sem lançamento nenhum ainda) também ganham barra: sem valor confirmado e sem clique.
  const known = new Set(confirmed.map((bar) => bar.key));
  const projectedOnly = [...projectedByKey.entries()].filter(([key]) => !known.has(key)).map(([key, row]) => ({
    key, year: row.year, month: row.month, label: labelOf(row.year, row.month), title: `Fatura de ${MONTHS[row.month - 1]} ${row.year}`,
    amount: 0, projected: row, selected: chosen.size === 0, clickable: false,
  }));
  const bars = [...confirmed, ...projectedOnly].sort((a, b) => (a.year - b.year) || (a.month - b.month));
  return { kind: "invoices", bars, hasProjection: bars.some((bar) => bar.projected) };
}
