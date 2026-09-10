// api/recurringSeries.ts — modelo novo (guia: materialização lazy via GET /transactions)
import apiClient from './client';
// Este módulo normalizava a LISTA e o resumo, mas devolvia cru os cinco endpoints
// de série individual — normalização parcial é pior que nenhuma, porque parece
// coberta. O `value` de série migrou no lote de movimento (fincla-api#131).
import { toCurrency, toFiniteNumber, unwrapMoney } from './money';
import type {
  RecurringSeries,
  RecurringSeriesCurrencyTotals,
  RecurringSeriesPeriodCurrencyTotals,
  RecurringSeriesListResponse,
  RawRecurringSeriesListResponse,
  ListRecurringSeriesParams,
  CreateRecurringSeriesRequest,
  UpdateRecurringSeriesRequest,
  RecurringSeriesToggleRequest,
  ChangeSeriesValueRequest,
  ChangeSeriesValueResponse,
} from './types';

export const createRecurringSeries = async (
  organizationId: string,
  data: CreateRecurringSeriesRequest,
): Promise<RecurringSeries> => {
  const response = await apiClient.post<RecurringSeries>('/recurring-series', data, {
    params: { organization_id: organizationId },
  });
  return unwrapMoney(response.data);
};

/**
 * A quebra por moeda com o dinheiro em número e o código da moeda intacto.
 *
 * Ela é o que responde quando o total não responde — numa organização com duas
 * moedas o cabeçalho vem `null` de propósito —, então cada linha precisa chegar
 * pronta para desenhar: `{currency, <campos>}` com os valores já convertidos. Sem
 * isto os campos seguem `{amount, currency}` crus e a tela imprime
 * `[object Object]` justamente no caso em que a quebra é a única verdade.
 */
const normalizarQuebra = <T,>(linhas: unknown, campos: string[]): T[] | undefined => {
  if (!Array.isArray(linhas)) return undefined;
  return linhas.map((linha) => {
    const crua = (linha ?? {}) as Record<string, unknown>;
    const saida: Record<string, unknown> = { ...crua };
    for (const campo of campos) saida[campo] = toFiniteNumber(crua[campo]);
    return saida as T;
  });
};

export const listRecurringSeries = async (
  organizationId: string,
  params?: ListRecurringSeriesParams,
): Promise<RecurringSeriesListResponse> => {
  const response = await apiClient.get<RecurringSeriesListResponse>('/recurring-series', {
    params: {
      organization_id: organizationId,
      ...(params?.isActive !== undefined ? { is_active: params.isActive } : {}),
      ...(params?.dateStart && params?.dateEnd
        ? { date_start: params.dateStart, date_end: params.dateEnd }
        : {}),
    },
  });
  // `value`, `total_monthly_*` são `Decimal` no schema e chegam como STRING; os
  // campos de `summary_for_period` são `float` e chegam como número. A conversão
  // aceita as duas formas — o ponto é o consumidor nunca precisar saber qual é.
  //
  // O tipo `Raw*` na entrada existe para o COMPILADOR cobrar cada campo: com o
  // `as unknown as` que estava aqui, encolher a lista de campos convertidos deixava
  // `total_monthly_income` cru e nada acusava — nem o tsc, nem a suíte.
  const raw = response.data as unknown as RawRecurringSeriesListResponse;
  return {
    ...raw,
    // `stampCurrency` ANTES de converter: `toFiniteNumber` colapsa `{amount, currency}`
    // num número e a moeda da linha se perde. Uma série de € 1.200 chegava à tela
    // como `1200` e era desenhada "R$ 1.200,00" — número certo, unidade errada.
    series: Array.isArray(raw?.series)
      ? raw.series.map((s) => ({
          ...s,
          value: toFiniteNumber(s?.value),
          value_currency: toCurrency(s?.value),
        }))
      : [],
    summary: {
      // Contadores podem faltar num payload degradado. Zero aqui é CONTAGEM, não
      // dinheiro — inventar zero em contagem é inofensivo; em saldo não seria.
      active_count: raw?.summary?.active_count ?? 0,
      paused_count: raw?.summary?.paused_count ?? 0,
      ...raw?.summary,
      total_monthly_income: toFiniteNumber(raw?.summary?.total_monthly_income),
      total_monthly_expense: toFiniteNumber(raw?.summary?.total_monthly_expense),
      // A moeda do CABEÇALHO, preservada antes de o número perder o rótulo. `null`
      // quando o backend não publicou total — organização com mais de uma moeda —,
      // e aí é `by_currency` que responde.
      currency:
        toCurrency(raw?.summary?.total_monthly_expense) ??
        toCurrency(raw?.summary?.total_monthly_income),
      by_currency: normalizarQuebra<RecurringSeriesCurrencyTotals>(raw?.summary?.by_currency, [
        'total_monthly_income',
        'total_monthly_expense',
      ]),
    },
    summary_for_period: raw?.summary_for_period
      ? {
          ...raw.summary_for_period,
          total_expense: toFiniteNumber(raw.summary_for_period.total_expense),
          total_income: toFiniteNumber(raw.summary_for_period.total_income),
          currency:
            toCurrency(raw.summary_for_period.total_expense) ??
            toCurrency(raw.summary_for_period.total_income),
          by_currency: normalizarQuebra<RecurringSeriesPeriodCurrencyTotals>(
            raw.summary_for_period.by_currency,
            ['total_expense', 'total_income'],
          ),
        }
      : undefined,
  };
};

export interface RecurringProjectionItem {
  series_id: string;
  date: string; // YYYY-MM-DD
  value: number;
  type: 'income' | 'expense';
  description: string;
  category: string;
}

export interface RecurringProjectionResponse {
  items: RecurringProjectionItem[];
}

/**
 * Returns future recurring occurrences (strictly after today, up to date_end).
 * Past occurrences are not included — they are materialized into transactions
 * and already counted as realized values.
 */
export const getRecurringProjection = async (
  organizationId: string,
  dateStart: string,
  dateEnd: string,
): Promise<RecurringProjectionResponse> => {
  const response = await apiClient.get<RecurringProjectionResponse>('/recurring-series/projection', {
    params: { organization_id: organizationId, date_start: dateStart, date_end: dateEnd },
  });
  // `value` da projeção é `float` no backend e chega como NÚMERO — ao contrário
  // das séries. A conversão fica como guarda: o campo já mudou de tipo antes
  // (fincla-api#112 registra a inconsistência) e o custo de tolerar os dois é zero.
  const raw = response.data as unknown as { items?: Array<Record<string, unknown>> };
  return {
    items: Array.isArray(raw?.items)
      ? raw.items.map((i) => ({ ...i, value: toFiniteNumber(i?.value) }))
      : [],
  } as RecurringProjectionResponse;
};

export const getRecurringSeries = async (
  seriesId: string,
  organizationId: string,
): Promise<RecurringSeries> => {
  const response = await apiClient.get<RecurringSeries>(`/recurring-series/${seriesId}`, {
    params: { organization_id: organizationId },
  });
  return unwrapMoney(response.data);
};

export const updateRecurringSeries = async (
  seriesId: string,
  organizationId: string,
  data: UpdateRecurringSeriesRequest,
): Promise<RecurringSeries> => {
  const response = await apiClient.patch<RecurringSeries>(
    `/recurring-series/${seriesId}`,
    data,
    { params: { organization_id: organizationId } },
  );
  return unwrapMoney(response.data);
};

export const deleteRecurringSeries = async (
  seriesId: string,
  organizationId: string,
): Promise<void> => {
  await apiClient.delete(`/recurring-series/${seriesId}`, {
    params: { organization_id: organizationId },
  });
};

export const toggleRecurringSeries = async (
  seriesId: string,
  organizationId: string,
  body: RecurringSeriesToggleRequest,
): Promise<RecurringSeries> => {
  const response = await apiClient.patch<RecurringSeries>(
    `/recurring-series/${seriesId}/toggle`,
    body,
    { params: { organization_id: organizationId } },
  );
  return unwrapMoney(response.data);
};

export const changeRecurringSeriesValue = async (
  seriesId: string,
  organizationId: string,
  data: ChangeSeriesValueRequest,
): Promise<ChangeSeriesValueResponse> => {
  const response = await apiClient.post<ChangeSeriesValueResponse>(
    `/recurring-series/${seriesId}/change-value`,
    data,
    { params: { organization_id: organizationId } },
  );
  return unwrapMoney(response.data);
};
