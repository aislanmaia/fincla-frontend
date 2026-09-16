import { test, expect } from '@playwright/test';

test('personal annual choice reaches the public app summary', async ({ page }) => {
  await page.route('**/v1/plans/checkout-quote', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ persona: 'personal', billing_cycle: 'yearly' });
    await route.fulfill({ json: { catalog_version: '2026-09-15', selection: { persona: 'personal', billing_cycle: 'yearly' }, total_cents: 29900, capacity: null, currency: 'BRL' } });
  });
  await page.goto('http://localhost:3102/preco', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Anual/ }).click();
  await expect(page.getByRole('button', { name: /Anual/ })).toHaveAttribute('aria-pressed', 'true');
  const target = new URL((await page.getByRole('link', { name: 'Continuar no app' }).getAttribute('href'))!);
  expect(target.origin).toBe('https://app.fincla.com');
  await page.goto(`${target.pathname}${target.search}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Fincla Pessoal', { exact: true })).toBeVisible();
  await expect(page.getByText(/299,00/)).toBeVisible();
  await expect(page).toHaveURL(/checkout.*yearly/);
});

test('consultant package extras and annual cycle survive the journey', async ({ page }) => {
  await page.route('**/v1/plans/checkout-quote', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ persona: 'consultant', billing_cycle: 'yearly', mode: 'package', seats: 26, package_size: 25 });
    await route.fulfill({ json: { catalog_version: '2026-09-15', selection: { persona: 'consultant', billing_cycle: 'yearly', mode: 'package', seats: 26, package_size: 25 }, total_cents: 517400, capacity: 26, currency: 'BRL' } });
  });
  await page.goto('http://localhost:3102/para-consultores', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Plano de 25 clientes/ }).click();
  await expect(page.getByRole('button', { name: /Plano de 25 clientes/ })).toHaveAttribute('aria-pressed', 'true');
  const slider = page.getByRole('slider', { name: 'Número de clientes atendidos' });
  await slider.focus();
  await slider.press('Home');
  for (let index = 0; index < 25; index++) await slider.press('ArrowRight');
  await page.getByLabel('Período de contratação').selectOption('yearly');
  await expect(page.getByText(/5.174,00/)).toBeVisible();
  const target = new URL((await page.getByRole('link', { name: 'Conferir oferta no app' }).getAttribute('href'))!);
  expect(target.searchParams.get('mode')).toBe('package');
  expect(target.searchParams.get('seats')).toBe('26');
  await page.goto(`${target.pathname}${target.search}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Fincla Consultor', { exact: true })).toBeVisible();
  await expect(page.getByText(/26 vagas contratadas/)).toBeVisible();
  await expect(page.getByText(/5.174,00/)).toBeVisible();
});
