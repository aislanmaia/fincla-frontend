import { beforeEach, describe, expect, it, vi } from 'vitest';

import apiClient from '../client';
import {
  getCashFlow,
  getClientsAtRisk,
  getConsultantClients,
  getConsultantConsolidatedReport,
  getConsultantSummary,
  getExpensesByCategory,
  getFinancialHealthIndex,
  getTotalCreditCardDebt,
} from '../consultant';

import consultantFamily from '../__fixtures__/consultant_family.example.json';

/**
 * #314 — a moeda atravessa a fronteira do consultor.
 *
 * `unwrapMoney` colapsa `{amount, currency}` num número e joga o rótulo fora. Para
 * o consultor isso fazia todo cliente virar real: a tela não tinha de onde ler que
 * o cliente de Lisboa está em euro. Cada leitura agora devolve `currency` ao lado
 * dos números — a do CLIENTE nas linhas por cliente, a de LEITURA nos agregados.
 * Com as fixtures canônicas do backend (cópia de `fincla-api/docs/contracts`).
 */
vi.mock('../client', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const responde = (data: unknown) => vi.mocked(apiClient.get).mockResolvedValueOnce({ data } as never);
const money = (amount: string, currency: string) => ({ amount, currency });

beforeEach(() => vi.mocked(apiClient.get).mockReset());

describe('fronteira do consultor preserva a moeda (#314)', () => {
  it('/clients: cada cliente leva a moeda base dele, mesmo com patrimônio ausente', async () => {
    responde(consultantFamily.clients);
    const r = await getConsultantClients();
    expect(r.clients.map((c) => [c.client_name, c.currency, c.balance, c.patrimonio])).toEqual([
      ['Marina Andrade', 'BRL', 4200, 82500],
      ['Rui Teixeira', 'EUR', 2600, null],
    ]);
    expect(r.total).toBe(2);
    expect(r.health_pending).toBe(1);
  });

  it('/clients: patrimônio rotulado responde quando o saldo não traz rótulo', async () => {
    responde({ total: 1, health_pending: 0, clients: [{ client_name: 'X', balance: '10.00', patrimonio: money('5.00', 'USD') }] });
    const r = await getConsultantClients();
    expect(r.clients[0].currency).toBe('USD');
  });

  it('/clients: sem rótulo nenhum, a moeda é null — nunca "BRL"', async () => {
    responde({ total: 1, health_pending: 0, clients: [{ client_name: 'X', balance: '10.00', patrimonio: '5.00' }] });
    const r = await getConsultantClients();
    expect(r.clients[0].currency).toBeNull();
  });

  it('/clients-at-risk: o saldo leva a moeda do cliente', async () => {
    responde(consultantFamily.clients_at_risk);
    const r = await getClientsAtRisk();
    expect(r.clients[0]).toMatchObject({ client_name: 'Rui Teixeira', current_balance: -1450, currency: 'EUR' });
  });

  it('/total-credit-card-debt: preserva o rótulo e a ausência', async () => {
    responde({ total_debt: money('7350.00', 'USD'), organizations_count: 2, as_of_date: '2026-06-30' });
    expect(await getTotalCreditCardDebt()).toMatchObject({ total_debt: 7350, currency: 'USD' });
    responde({ total_debt: null, organizations_count: 2, as_of_date: '2026-06-30' });
    expect(await getTotalCreditCardDebt()).toMatchObject({ total_debt: null, currency: null });
  });

  it('/cash-flow e /expenses-by-category: o rótulo das somas sai em `currency`', async () => {
    responde({
      ...consultantFamily.cash_flow,
      monthly_data: consultantFamily.cash_flow.monthly_data.map((m) => ({
        ...m, total_income: money(m.total_income.amount, 'EUR'), total_expenses: money(m.total_expenses.amount, 'EUR'), balance: money(m.balance.amount, 'EUR'),
      })),
    });
    const fluxo = await getCashFlow();
    expect(fluxo.currency).toBe('EUR');
    expect(fluxo.monthly_data[0].total_income).toBe(7600);

    responde(consultantFamily.expenses_by_category);
    const gastos = await getExpensesByCategory();
    expect(gastos.currency).toBe('BRL');
    expect(gastos.categories[0].total).toBe(12000);
  });

  it('/cash-flow vazio: sem meses, sem rótulo', async () => {
    responde({ monthly_data: [], period_start: '2026-06-01', period_end: '2026-06-30' });
    expect((await getCashFlow()).currency).toBeNull();
  });

  it('/financial-health-index e /summary: a moeda de leitura (convertida)', async () => {
    responde(consultantFamily.financial_health_index);
    expect((await getFinancialHealthIndex()).currency).toBe('BRL');

    responde(consultantFamily.consultant_summary);
    const resumo = await getConsultantSummary();
    expect(resumo).toMatchObject({ currency: 'BRL', total_income: 45000, balance: 6800 });
  });

  it('fincla-api#505: dívida, fluxo e categorias com recibo são `converted`, com a taxa', async () => {
    responde(consultantFamily.total_credit_card_debt);
    const divida = await getTotalCreditCardDebt();
    expect(divida).toMatchObject({ total_debt: 7350, currency: 'BRL', converted: true });
    expect(divida.consolidation?.rates).toEqual([
      { base: 'EUR', quote: 'BRL', rate: '6.1234000000', quoted_on: '2026-06-30' },
    ]);

    responde(consultantFamily.cash_flow);
    expect(await getCashFlow()).toMatchObject({ currency: 'BRL', converted: true });

    responde(consultantFamily.expenses_by_category);
    expect(await getExpensesByCategory()).toMatchObject({ currency: 'BRL', converted: true });
  });

  it('fincla-api#505 sem cotação: valores null, convertido, moeda do recibo', async () => {
    const recibo = { target_currency: 'BRL', rates: [], unavailable: 'USD/BRL: sem cotação' };
    responde({ total_debt: null, organizations_count: 2, as_of_date: '2026-06-30', consolidation: recibo });
    expect(await getTotalCreditCardDebt()).toMatchObject({ total_debt: null, currency: 'BRL', converted: true });

    responde({
      monthly_data: [{ month: '2026-06', year: 2026, month_number: 6, total_income: null, total_expenses: null, balance: null }],
      period_start: '2026-06-01', period_end: '2026-06-30', consolidation: recibo,
    });
    const fluxo = await getCashFlow();
    expect(fluxo).toMatchObject({ currency: 'BRL', converted: true });
    expect(fluxo.monthly_data[0].total_income).toBeNull();

    responde({
      categories: [{ name: 'Moradia', total: null, percentage: null }], total_expenses: null,
      period_start: '2026-01-01', period_end: '2026-06-30', consolidation: recibo,
    });
    const gastos = await getExpensesByCategory();
    expect(gastos).toMatchObject({ total_expenses: null, currency: 'BRL', converted: true });
    expect(gastos.categories[0]).toMatchObject({ total: null, percentage: null });
  });

  it('API anterior à #505 (sem recibo): só rótulo, `converted: false`', async () => {
    responde({ total_debt: money('7350.00', 'BRL'), organizations_count: 2, as_of_date: '2026-06-30' });
    expect(await getTotalCreditCardDebt()).toMatchObject({ currency: 'BRL', converted: false, consolidation: null });
  });

  it('/summary sem cotação: totais null, e a moeda vem do recibo da consolidação', async () => {
    responde({
      ...consultantFamily.consultant_summary,
      total_income: null, total_expenses: null, balance: null,
      consolidation: { target_currency: 'EUR', rates: [], unavailable: 'USD' },
    });
    const r = await getConsultantConsolidatedReport();
    expect(r).toMatchObject({ total_income: null, currency: 'EUR' });
  });
});
