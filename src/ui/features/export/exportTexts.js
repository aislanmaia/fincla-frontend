/**
 * Os textos do painel de exportação e da prévia do arquivo, por idioma (fincla-api#520). Espelha o catálogo do
 * servidor (`src/application/services/export/texts.py`): a prévia repete as linhas que o arquivo vai trazer, então as
 * duas pontas têm de dizer a mesma frase. Só pt-BR existe; qualquer outro idioma cai nele até ser traduzido.
 *
 * Contagem concorda com o número (em pt-BR só 1 é singular; 0 é plural). Datas saem absolutas e com ano: o arquivo é
 * lido depois e fora da tela, onde "Este mês" não diz nada.
 */
import { formatYmdToLocaleDisplay } from "../../data/transactionsAdapter.js";

const counted = (n, one, many, locale) => {
  const count = Number(n ?? 0);
  return (count === 1 ? one : many).replace("{n}", count.toLocaleString(locale));
};

const PT_BR = {
  locale: "pt-BR",
  noFilters: "Sem filtros: todos os lançamentos",
  /** Uma contagem com o agrupamento do idioma ("25.000"). */
  number(n) {
    return Number(n).toLocaleString(this.locale);
  },
  entries(n) {
    return counted(n, "{n} lançamento", "{n} lançamentos", this.locale);
  },
  selected(n) {
    return counted(n, "{n} lançamento selecionado", "{n} lançamentos selecionados", this.locale);
  },
  pendingIncluded(n) {
    return counted(n, "{n} pendente (incluído nos totais)", "{n} pendentes (incluídos nos totais)", this.locale);
  },
  /** A linha do arquivo, igual à do servidor: é texto, então a contagem leva o separador de milhar do idioma. */
  fileCountLine(count, pending) {
    const p = Number(pending ?? 0);
    return `LANÇAMENTOS: ${this.number(count ?? 0)} (${this.number(p)} ${p === 1 ? "pendente, incluído" : "pendentes, incluídos"} nos totais)`;
  },
  /** A nota do PDF "Só o resumo" (igual à do servidor, #523). */
  summaryOnlyNote(n) {
    const count = Number(n ?? 0);
    return count === 1
      ? "Versão resumida: o 1 lançamento do recorte não está listado neste arquivo. Exporte em “Completo” para vê-lo."
      : `Versão resumida: a lista dos ${this.number(count)} lançamentos não está neste arquivo. Exporte em “Completo” para vê-la.`;
  },
  /** A linha de contagem do PDF, igual à do servidor. */
  pdfCountLine(count, pending) {
    const p = Number(pending ?? 0);
    return `${this.entries(count)} · ${this.number(p)} ${p === 1 ? "pendente, incluído" : "pendentes, incluídos"} nos totais`;
  },
  countLabel: "LANÇAMENTOS",
  pendingLabel: "PENDENTES (incluídos nos totais)",
  /** O aviso da planilha quando os totais não podem ser fórmula (igual ao do servidor). */
  fixedTotals(symbols) {
    return `Totais fixos, sem fórmula: o recorte tem lançamentos em ${symbols.join(", ")}, e somar a coluna Valor juntaria moedas diferentes.`;
  },
  day(ymd) {
    return formatYmdToLocaleDisplay(ymd, this.locale);
  },
  /** O período que o pedido leva (`date_start`/`date_end`), em datas com ano. */
  period(from, to) {
    if (from && to) return from === to ? `Período: ${this.day(from)}` : `Período: ${this.day(from)} a ${this.day(to)}`;
    if (from) return `Período: a partir de ${this.day(from)}`;
    if (to) return `Período: até ${this.day(to)}`;
    return "Período: todo o histórico";
  },
  /** "Incluir saldo" (fincla-api#541): a opção do painel e as linhas que o arquivo ganha (iguais às do servidor). */
  balanceOption: "Incluir saldo",
  balanceHint: "Saldo anterior, a coluna Saldo e o saldo final, como no extrato do banco.",
  balanceOpening: "Saldo anterior",
  balanceClosing: "Saldo final",
  balanceColumn: "Saldo",
  noteColumn: "Observação",
  /** O valor que a prévia não tem: o arquivo traz o saldo da conta (nunca um zero inventado). */
  balancePending: "saldo da conta",
  balanceAccounts: "Saldo de: as contas do recorte",
  /** O dia anterior ao início do período ("2026-10-01" → "2026-09-30"): o Saldo anterior é o do fim desse dia. */
  dayBefore(ymd) {
    if (typeof ymd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const [y, m, d] = ymd.split("-").map(Number);
    const date = new Date(y, m - 1, d - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  },
  /** Etiquetas numa linha só; com duas ou mais, o modo escolhido (`modeLabel`, o texto do painel de Tags). */
  tags(labels, modeLabel) {
    const list = (labels ?? []).filter(Boolean);
    if (list.length === 0) return null;
    const names = list.map((label) => `#${label}`).join(", ");
    return list.length === 1 ? `Tags: ${names}` : `Tags · ${modeLabel}: ${names}`;
  },
};

const BY_LOCALE = { "pt-br": PT_BR };

export function exportTexts(locale) {
  return BY_LOCALE[String(locale ?? "").trim().toLowerCase()] ?? PT_BR;
}
