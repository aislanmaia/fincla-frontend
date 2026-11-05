/** Headed-browser smoke of the report stream contract and rendered dashboard. */
import { expect, test } from '@playwright/test';

test('renders calculated report before the AI reading and keeps it on AI failure', async ({ page }, testInfo) => {
  await page.route('**/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/v1/users/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    id: 'consultant-stream', email: 'consultant-stream@test.local', role: 'owner', is_consultant: true,
    first_name: 'Consultor', last_name: 'Teste', onboarding_completed: true,
    subscription: { plan: 'consultant_pro', status: 'active', features: ['consultant_ai', 'multi_org_dashboard'] },
  }) }));
  await page.route('**/v1/memberships/my-organizations', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"organizations":[]}' }));
  await page.route('**/v1/consultant/clients', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"clients":[],"total":0}' }));
  const report = {
    period_start: '2026-01-01', period_end: '2026-01-31', reading_currency: 'BRL',
    total_expenses: { amount: '1200.00', currency: 'BRL' }, client_count: 3,
    clients_with_expenses: 3, clients_without_expenses: 0, clients_converted: 3, clients_not_converted: 0,
    categories: [{ name: 'Alimentação', total: { amount: '1200.00', currency: 'BRL' }, percentage: 100, client_count: 3 }],
    original_currency_slices: [], conversion_issues: [], conversion_rates: [], converted_cohorts: [],
    highlights: { top_categories: [{ name: 'Alimentação', percentage: 100, client_count: 3 }], combined_percentage: 100 },
  };
  await page.route('**/v1/consultant/ai-copiloto', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    correlation_id: route.request().headers()['x-request-id'], session_id: 'stream-smoke',
    run_id: '8f1e0f0c-0000-4000-8000-000000000000',
    output: { answer: 'A distribuição está no painel.', blocks: [{ type: 'portfolio_expense_distribution', version: 1, ...report }], suggested_actions: [], disclaimers: [] },
  }) }));
  const streamRequests: string[] = [];
  await page.route('**/v1/consultant/expenses-distribution/analysis/stream?**', (route) => {
    streamRequests.push(route.request().url());
    const body = [
      `event: report.ready\ndata: ${JSON.stringify({
        report,
        comparison: { period_start: '2025-12-01', period_end: '2025-12-31', current_total: report.total_expenses, previous_total: { amount: '800.00', currency: 'BRL' }, delta: { amount: '400.00', currency: 'BRL' }, delta_percentage: 50, comparable_client_count: 3, current_client_count: 3, excluded_from_comparison: 0, quotation_policy: 'same_reading_quotation' },
        categories: [{ name: 'Alimentação', current_total: report.total_expenses, previous_total: { amount: '800.00', currency: 'BRL' }, delta: { amount: '400.00', currency: 'BRL' }, delta_percentage: 50, share_delta_pp: 0, client_count: 3, top_client_share: 40 }],
        monthly_trend: [{ period_start: report.period_start, period_end: report.period_end, total: report.total_expenses, categories: { Alimentação: report.total_expenses } }],
        insights: [],
      })}\n\n`,
      'event: insight.started\ndata: {}\n\n',
      'event: insight.failed\ndata: {"message":"provider unavailable"}\n\n',
      'event: completed\ndata: {}\n\n',
    ].join('');
    return route.fulfill({ status: 200, contentType: 'text/event-stream', body });
  });
  await page.addInitScript(() => localStorage.setItem('auth_token', 'stream-smoke-token'));
  await page.goto('/consultant/copiloto');
  await page.getByLabel('Mensagem para o Copiloto').fill('Onde meus clientes mais gastam no agregado?');
  await page.getByLabel('Enviar mensagem').click();
  const dashboard = page.getByRole('region', { name: 'Distribuição agregada de gastos da carteira' });
  await expect(dashboard.getByRole('table', { name: 'Gastos agregados por categoria' })).toBeVisible();
  await expect(dashboard.locator('.portfolio-expense__metric--primary strong')).toContainText('1.200,00');
  await expect(dashboard.getByText('Não foi possível gerar a leitura deste período.')).toBeVisible();
  const retry = dashboard.getByRole('button', { name: 'Tentar leitura novamente' });
  await expect(retry).toHaveCSS('background-color', 'rgb(246, 241, 255)');
  await expect(retry).toHaveCSS('border-radius', '8px');
  expect(streamRequests).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath('consultant-expense-stream-visible.png') });
  if (process.env.E2E_PAUSE === '1') {
    test.setTimeout(0);
    await page.pause();
  }
});
