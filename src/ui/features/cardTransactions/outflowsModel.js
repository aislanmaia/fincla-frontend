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
  const bars = (breakdown?.by_invoice ?? []).filter((row) => positive(row, currency))
    .sort((a, b) => (a.year - b.year) || (a.month - b.month))
    .map((row) => {
      const key = invoiceKey(row.year, row.month);
      const label = row.year === now.getFullYear() ? MONTHS[row.month - 1] : `${MONTHS[row.month - 1]}/${String(row.year).slice(2)}`;
      return { key, label, title: `Fatura de ${MONTHS[row.month - 1]} ${row.year}`, amount: Number(row.amount), selected: chosen.size === 0 || chosen.has(key), clickable: selectableKeys ? selectableKeys.has(key) : true };
    });
  return { kind: "invoices", bars };
}
