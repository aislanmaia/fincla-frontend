/**
 * Os totais do relatório como o painel de exportação os mostra, tirados do MESMO resumo que a tela já tem
 * (`GET /v1/transactions/summary` para os mesmos filtros). O painel não soma nada: o arquivo usa o mesmo cálculo
 * no servidor, e é isso que faz tela, painel e arquivo dizerem o mesmo número (fincla-api#520).
 *
 * Ausência nunca vira zero: um total que o servidor não conseguiu converter chega `null` e segue `null`.
 */
import { currencyInfo } from "../../money/currencyRegistry.js";
import { formatMoneyAbs, formatMoneySigned } from "../../money/formatMoney.js";

const num = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** `summary` no formato da UI (totais já numéricos, `currency`, `consolidation`, `result_by_currency`). */
export function exportTotalsFromSummary(summary) {
  if (!summary) return null;
  const consolidation = summary.consolidation ?? null;
  const currency = summary.currency ?? consolidation?.target_currency ?? null;
  const result = num(summary.balance);
  const byCurrency = (summary.result_by_currency ?? []).map((item) => ({
    currency: item.currency,
    count: item.total_transactions ?? 0,
    result: num(item.balance),
  }));
  return {
    currency,
    result,
    income: num(summary.total_income),
    expenses: num(summary.total_expenses),
    refunds: num(summary.total_refunds),
    count: summary.total_transactions ?? 0,
    pending: summary.unsettled_count ?? 0,
    rates: (consolidation?.rates ?? []).map((rate) => ({
      base: rate.base, quote: rate.quote, rate: num(rate.rate), quotedOn: rate.quoted_on ?? null,
    })),
    unavailable: result === null,
    mixed: byCurrency.length > 1,
    byCurrency,
  };
}

export const UNAVAILABLE = "indisponível";

export const moneyOrUnavailable = (value, currency) => formatMoneyAbs(value, currency) ?? UNAVAILABLE;
export const signedOrUnavailable = (value, currency) => formatMoneySigned(value, currency) ?? UNAVAILABLE;

const rateFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

const brDay = (ymd) => (typeof ymd === "string" && /^\d{4}-\d{2}-\d{2}/.test(ymd) ? ymd.slice(0, 10).split("-").reverse().join("/") : null);

/** A frase da conversão, com o símbolo de cada moeda vindo do registro. `null` quando nada foi convertido. */
export function conversionNote(totals) {
  if (!totals) return null;
  const target = currencyInfo(totals.currency).symbol;
  if (totals.unavailable && totals.mixed) {
    return `Cotação para ${target} indisponível no momento: o total consolidado não pôde ser calculado. Veja o resultado de cada moeda.`;
  }
  if (!totals.rates.length) return null;
  const days = [...new Set(totals.rates.map((rate) => brDay(rate.quotedOn)))];
  const pair = (rate) => `1 ${currencyInfo(rate.base).symbol} = ${target} ${rate.rate === null ? UNAVAILABLE : rateFormat.format(rate.rate)}`;
  if (days.length === 1 && days[0]) {
    return `Totais em ${target}, moeda base da organização. Cotações de ${days[0]}: ${totals.rates.map(pair).join(" · ")}. Cada lançamento aparece na moeda da sua conta.`;
  }
  const dated = totals.rates.map((rate) => `${pair(rate)} (${brDay(rate.quotedOn) ?? UNAVAILABLE})`);
  return `Totais em ${target}, moeda base da organização. Cotações: ${dated.join(" · ")}. Cada lançamento aparece na moeda da sua conta.`;
}

/** "BRL +R$ 100,00 (1) · USD −US$ 7,50 (2)" — o Resultado de cada moeda, sem conversão. A contagem sai com o
 *  agrupamento do idioma (`texts.number`: "12.000"), como no arquivo. */
export function byCurrencyLine(totals, texts) {
  if (!totals?.mixed) return null;
  return totals.byCurrency
    .map((item) => `${item.currency} ${signedOrUnavailable(item.result, item.currency)} (${texts.number(item.count)})`)
    .join(" · ");
}

