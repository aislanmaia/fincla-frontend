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
  entries(n) {
    return counted(n, "{n} lançamento", "{n} lançamentos", this.locale);
  },
  selected(n) {
    return counted(n, "{n} lançamento selecionado", "{n} lançamentos selecionados", this.locale);
  },
  pendingIncluded(n) {
    return counted(n, "{n} pendente (incluído nos totais)", "{n} pendentes (incluídos nos totais)", this.locale);
  },
  /** A linha do arquivo, igual à do servidor: o número sem separador de milhar, como a coluna Valor. */
  fileCountLine(count, pending) {
    const p = Number(pending ?? 0);
    return `LANÇAMENTOS: ${Number(count ?? 0)} (${p} ${p === 1 ? "pendente, incluído" : "pendentes, incluídos"} nos totais)`;
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
