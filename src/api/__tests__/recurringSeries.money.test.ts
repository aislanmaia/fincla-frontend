import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../client';
import { getRecurringProjection, listRecurringSeries } from '../recurringSeries';

vi.mock('../client', () => ({ default: { get: vi.fn() } }));

/**
 * `value` das séries e da projeção é `Decimal` no backend, logo chega como string.
 * O card "Próximos Débitos" somava esses valores e imprimia NaN (#88). A conversão
 * mora na fronteira; estes testes alimentam o payload como ele chega de verdade.
 */
describe('recurringSeries — dinheiro chega como string', () => {
  beforeEach(() => vi.mocked(apiClient.get).mockReset());

  it('listRecurringSeries converte o valor de cada série', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        series: [
          { id: 's1', description: 'Internet', value: '120.00', type: 'expense' },
          { id: 's2', description: 'Salário', value: '8400.00', type: 'income' },
        ],
        summary: { total_monthly_expense: '4127.64', total_monthly_income: '8400.00', active_count: 2, paused_count: 0 },
      },
    });
    const out = await listRecurringSeries('org-1');
    expect(out.series[0].value).toBe(120);
    expect(out.series[1].value).toBe(8400);
    expect(typeof out.series[0].value).toBe('number');
    // A soma que quebrava a tela agora fecha.
    expect(out.series.reduce((s, x) => s + (x.value as number), 0)).toBe(8520);
  });

  it('converte também os somatórios, que alimentam o KPI Comprometido', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        series: [],
        // `total_monthly_*` são Decimal → string. `summary_for_period.*` são float
        // → número. O conversor tolera as duas formas; os valores aqui refletem o que
        // cada endpoint realmente manda, e não o que seria conveniente testar.
        summary: { total_monthly_expense: '4127.64', total_monthly_income: '8400.00', active_count: 2, paused_count: 0 },
        summary_for_period: { total_expense: 250, total_income: 90.5, period: { start_date: 'x', end_date: 'y' } },
      },
    });
    const out = await listRecurringSeries('org-1');
    expect(out.summary.total_monthly_expense).toBe(4127.64);
    // Sem esta asserção, encolher a conversão para um campo só passava despercebido:
    // `total_monthly_income` alimenta `saldoFixo`, a mesma aritmética que gerou o #88.
    expect(out.summary.total_monthly_income).toBe(8400);
    expect(out.summary_for_period?.total_expense).toBe(250);
    expect(out.summary_for_period?.total_income).toBe(90.5);
  });

  it('não explode quando `series` não vem', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { summary: {} } });
    const out = await listRecurringSeries('org-1');
    expect(out.series).toEqual([]);
  });

  it('getRecurringProjection converte o valor de cada ocorrência', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      // `RecurringProjectionItemResponse.value` é `float` no backend: chega NÚMERO.
      data: { items: [{ series_id: 's1', date: '2026-08-25', value: 1880, type: 'expense', description: 'Fatura', category: 'cartao' }] },
    });
    const out = await getRecurringProjection('org-1', '2026-08-01', '2026-08-31');
    expect(out.items[0].value).toBe(1880);
  });

  it('projeção sem itens não quebra', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: {} });
    const out = await getRecurringProjection('org-1', 'a', 'b');
    expect(out.items).toEqual([]);
  });
});
