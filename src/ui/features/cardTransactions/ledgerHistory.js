import { describeFilterChange } from "../transactions/filters/describeFilterChange.js";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const dayLabel = (ymd) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/**
 * O que o desfazer/refazer do Lançamentos vai fazer, dito por extenso. Os filtros comuns usam o
 * mesmo texto de /transactions; recorte de tipo, semana, fatura e cartão (que só existem aqui) são
 * descritos por este módulo.
 */
export function describeLedgerChange(atual, destino, verbo, { categorias = {}, kindLabels = {} } = {}) {
  if (!same(atual.filter, destino.filter)) return describeFilterChange(atual.filter, destino.filter, verbo, { categorias });
  const back = verbo === "Refazer" ? "vai para" : "volta para";
  if (atual.kind !== destino.kind) {
    return destino.kind ? `${verbo}: ${verbo === "Refazer" ? "aplicar" : "trazer de volta"} ${kindLabels[destino.kind] ?? destino.kind}` : `${verbo}: remover ${kindLabels[atual.kind] ?? atual.kind}`;
  }
  if (!same(atual.week, destino.week)) {
    return destino.week ? `${verbo}: ${verbo === "Refazer" ? "aplicar" : "trazer de volta"} a semana de ${dayLabel(destino.week.from)}` : `${verbo}: remover a semana de ${dayLabel(atual.week.from)}`;
  }
  if (atual.cardScope !== destino.cardScope) return `${verbo}: Cartão ${back} ${destino.cardScope === "all" ? "todos os cartões" : "este cartão"}`;
  if (atual.timeMode !== destino.timeMode || !same(atual.invoiceKeys, destino.invoiceKeys)) return `${verbo}: recorte de tempo ${back} ${destino.timeMode === "invoice" ? "a fatura anterior" : "o período"}`;
  return `${verbo}: voltar ao filtro anterior`;
}

/** Último dia da semana (a semana da API começa em `from` e tem 7 dias). */
export function weekEnd(from) {
  const [y, m, d] = from.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 6)).toISOString().slice(0, 10);
}
