import { test, expect } from '@playwright/test';

test('an expired access period exposes the existing invoice and reviewed cancellation without a new subscription', async ({ page }) => {
  const quote = { catalog_version: '2026-09-15', selection: { persona: 'consultant', billing_cycle: 'yearly', mode: 'package', seats: 50, package_size: 50 }, capacity: 50, total_cents: 845000, currency: 'BRL' };
  const user = { id: 'consultant', email: 'consultora@example.com', is_consultant: true, onboarding_completed: true,
    subscription: { plan: 'consultant_pro', status: 'active', is_entitled: false, gateway_provider: 'asaas', billing_cycle: 'yearly', features: ['multi_org_dashboard'] } };
  let cancellations = 0;
  let financialAttempts = 0;
  await page.addInitScript(() => localStorage.setItem('auth_token', 'renewal-browser-token'));
  await page.route('**/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/users/me') || path.endsWith('/auth/me')) return route.fulfill({ json: user });
    if (path.endsWith('/checkout/current')) return route.fulfill({ json: { id: 'historical', status: 'active', has_access: false, quote } });
    if (path.endsWith('/invoices')) return route.fulfill({ json: { items: [{ id: 'renewal', description: 'Renovação anual', status: 'overdue', amount_cents: 845000, currency: 'BRL', due_date: '2026-09-01', invoice_url: 'https://sandbox.asaas.com/i/browser-fixture' }], limit: 20, offset: 0 } });
    if (path.endsWith('/subscriptions/cancel')) {
      cancellations++;
      return route.fulfill({ json: { effective_until: null, status: 'cancelled' } });
    }
    if (path.endsWith('/checkout/pay') || path.endsWith('/subscriptions/change-plan')) financialAttempts++;
    return route.fulfill({ status: 403, json: { detail: { code: 'payment_required' } } });
  });
  await page.goto('/consultant/clients', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Verifique a renovação da sua assinatura' })).toBeVisible();
  await expect(page.getByText(/50 vagas contratadas/)).toBeVisible();
  await expect(page.getByLabel('Número do cartão')).toHaveCount(0);
  await page.getByRole('button', { name: 'Consultar faturas' }).click();
  await expect(page.getByText('Renovação anual · Em atraso')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir fatura' })).toHaveAttribute('href', 'https://sandbox.asaas.com/i/browser-fixture');
  await page.getByRole('button', { name: 'Cancelar assinatura', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirmar cancelamento' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/reativar a qualquer momento/)).toHaveCount(0);
  expect(cancellations).toBe(0);
  await dialog.getByRole('button', { name: 'Confirmar cancelamento', exact: true }).click();
  await expect(page.getByText(/Assinatura cancelada/)).toBeVisible();
  expect(cancellations).toBe(1);
  expect(financialAttempts).toBe(0);
});

test('new consultant profiles manage their accepted subscription while legacy accounts keep their personal entry', async ({ page, isMobile }) => {
  const selection = { persona: 'consultant', billing_cycle: 'yearly', mode: 'package', seats: 26, package_size: 25 };
  const quote = { catalog_version: '2026-09-15', selection, capacity: 26, total_cents: 517400, currency: 'BRL' };
  let isLegacy = false;
  let cancelled = false;
  const user = { id: 'consultant', email: 'consultora@example.com', first_name: 'Maria', is_consultant: true, onboarding_completed: true,
    subscription: { plan: 'consultant_pro', status: 'active', is_entitled: true, gateway_provider: 'asaas', billing_cycle: 'yearly', features: ['multi_org_dashboard'] } };
  await page.addInitScript(() => localStorage.setItem('auth_token', 'profile-browser-token'));
  await page.route('**/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/users/me') || path.endsWith('/auth/me')) return route.fulfill({ json: { ...user, subscription: { ...user.subscription, checkout_selection: isLegacy ? null : selection } } });
    if (path.endsWith('/my-organizations')) return route.fulfill({ json: { organizations: [] } });
    if (path.endsWith('/consultant/clients')) return route.fulfill({ json: { clients: [], total: 0 } });
    if (path.endsWith('/consultant/quota')) return route.fulfill({ json: { limit: 26, used: 0, remaining: 26 } });
    if (path.endsWith('/checkout/current')) return route.fulfill({ json: { id: 'accepted', status: 'active', has_access: true, quote } });
    if (path.endsWith('/subscriptions/me')) return route.fulfill({ json: { id: 'subscription', status: 'active', is_entitled: true, max_organizations: 26, current_period_end: '2027-09-15T12:00:00Z', cancel_at_period_end: cancelled, plan: { name: 'Consultor Pro', price_yearly_cents: 999 } } });
    if (path.endsWith('/subscriptions/cancel')) {
      cancelled = true;
      return route.fulfill({ json: { effective_until: '2027-09-15T12:00:00Z' } });
    }
    return route.fulfill({ status: 403, json: { detail: { code: 'access_denied' } } });
  });
  await page.goto('/consultant/profile', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/5.174,00/)).toBeVisible();
  await expect(page.getByText(/26 vagas contratadas/)).toBeVisible();
  await expect(page.getByText(/9,99/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancelar renovação' }).click();
  await page.getByRole('dialog', { name: 'Confirmar cancelamento' }).getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByText(/Renovação cancelada/)).toBeVisible();
  await expect(page.getByText(/15\/09\/2027/)).toBeVisible();
  await page.screenshot({path:test.info().outputPath('consultant-subscription.png')});
  if (isMobile) await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.getByRole('button', { name: /Você está em/ })).toHaveCount(0);
  await page.goto('/profile/billing', {waitUntil:'domcontentloaded'});
  await expect(page.getByText(/5.174,00/)).toBeVisible();
  await expect(page.getByText(/Renovação cancelada/)).toBeVisible();
  isLegacy = true;
  await page.goto('/consultant/profile', { waitUntil: 'domcontentloaded' });
  if (isMobile) await page.getByRole('button', { name: 'Abrir menu' }).click();
  const switcher = page.getByRole('button', { name: /Você está em/ });
  await switcher.click();
  await expect(page.getByRole('menuitem', { name: 'Minha conta' })).toBeVisible();
});
