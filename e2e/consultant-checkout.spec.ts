import { test, expect } from '@playwright/test';

for (const offer of [
  { cycle: 'monthly', mode: 'progressive', seats: 25, packageSize: null, total: 54750, price: '547,50' },
  { cycle: 'yearly', mode: 'package', seats: 26, packageSize: 25, total: 517400, price: '5.174,00' },
]) {
  test(`consultant ${offer.mode} ${offer.cycle}: site, account recovery, payment, empty portfolio`, async ({ page }) => {
    const selection = { persona: 'consultant', billing_cycle: offer.cycle, mode: offer.mode, seats: offer.seats, package_size: offer.packageSize };
    const quote = { catalog_version: '2026-09-15', selection, total_cents: offer.total, capacity: offer.seats, currency: 'BRL' };
    let attempt: null | { id: string; status: string; quote: object; has_access: boolean } = null;
    let payments = 0;
    let paidRequestsBeforeAccess = 0;
    const user = { id: 'consultant', email: 'consultora@example.com', role: 'consultant', first_name: 'Maria', is_consultant: true, onboarding_completed: false,
      subscription: { plan: 'consultant_pro', status: 'pending_payment', is_entitled: false, gateway_provider: 'asaas', billing_cycle: offer.cycle, checkout_selection: selection, features: ['multi_org_dashboard'], max_organizations: 0, max_users_per_org: 10 } };
    await page.route('**/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/plans/checkout-quote')) {
        expect(route.request().postDataJSON()).toMatchObject({ persona: 'consultant', billing_cycle: offer.cycle, mode: offer.mode, seats: offer.seats });
        return route.fulfill({ json: quote });
      }
      if (path.endsWith('/checkout/register')) {
        expect(route.request().postDataJSON().selection).toEqual(selection);
        expect(route.request().postDataJSON().persona).toBe('consultant');
        return route.fulfill({ status: 201, json: { id: user.id, persona: 'consultant', status: 'pending_payment', billing_cycle: offer.cycle } });
      }
      if (path.endsWith('/auth/login')) return route.fulfill({ json: { token: 'checkout-browser-token', user } });
      if (path.endsWith('/auth/me') || path.endsWith('/users/me')) return route.fulfill({ json: user });
      if (path.endsWith('/checkout/current')) return route.fulfill({ json: attempt });
      if (path.endsWith('/checkout/pay')) {
        payments++;
        const body = route.request().postDataJSON();
        expect(body.selection).toEqual(selection);
        expect(body.catalog_version).toBe(quote.catalog_version);
        expect(body).not.toHaveProperty('total_cents');
        attempt = { id: 'attempt-consultant', status: 'pending_payment', quote, has_access: false };
        return route.fulfill({ json: attempt });
      }
      if (path.includes('organizations') || path.includes('/consultant/')) {
        if (!user.subscription.is_entitled) paidRequestsBeforeAccess++;
        if (path.endsWith('/my-organizations')) return route.fulfill({ json: { organizations: [] } });
        if (path.endsWith('/quota')) return route.fulfill({ json: { limit: offer.seats, used: 0, remaining: offer.seats } });
        if (path.endsWith('/clients') || path.endsWith('/clients-at-risk')) return route.fulfill({ json: { clients: [], total: 0 } });
      }
      return route.fulfill({ status: 403, json: { detail: { code: 'payment_required' } } });
    });
    await page.goto('http://localhost:3102/para-consultores', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    if (offer.packageSize) await page.getByRole('button', { name: /Plano de 25 clientes/ }).click();
    const slider = page.getByRole('slider', { name: 'Número de clientes atendidos' });
    await slider.focus();
    await slider.press('Home');
    for (let index = 1; index < offer.seats; index++) await slider.press('ArrowRight');
    await page.getByLabel('Período de contratação').selectOption(offer.cycle);
    const target = new URL((await page.getByRole('link', { name: 'Conferir oferta no app' }).getAttribute('href'))!);
    await page.goto(`${target.pathname}${target.search}`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Nome', { exact: true }).fill('Maria');
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Senha', { exact: true }).fill('Password123!');
    await page.getByRole('button', { name: 'Criar conta e continuar' }).click();
    await expect(page.getByRole('heading', { name: 'Pague com cartão' })).toBeVisible();
    // Account exists, but no financial attempt yet. Recover from a fresh login without an offer URL.
    await page.getByRole('button', { name: 'Sair da conta' }).click();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('seu@email.com').fill(user.email);
    await page.getByPlaceholder('••••••••', { exact: true }).fill('Password123!');
    await page.getByRole('button', { name: 'Entrar na conta', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pague com cartão' })).toBeVisible();
    await expect(page.getByText(new RegExp(offer.price))).toBeVisible();
    await expect(page.getByText(new RegExp(`${offer.seats} vagas contratadas`))).toBeVisible();
    expect(payments).toBe(0);
    await page.locator('main').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({path:test.info().outputPath('consultant-checkout-summary.png')});
    await page.getByLabel('Nome do titular').fill('Maria Test');
    await page.getByLabel('Número do cartão').fill('5162306219378829');
    await page.getByLabel('Mês (MM)').fill('05');
    await page.getByLabel('Ano (AAAA)').fill('2030');
    await page.getByLabel('CVV').fill('318');
    await page.getByLabel('CPF/CNPJ').fill('24971563792');
    await page.getByLabel('CEP').fill('89223005');
    await page.getByLabel('Número do endereço').fill('277');
    await page.getByLabel('Telefone com DDD').fill('4738010919');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Confirmar pagamento' }).click();
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação do pagamento' })).toBeVisible();
    await page.goto('/consultant/clients', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Aguardando confirmação do pagamento' })).toBeVisible();
    await expect(page.getByText(new RegExp(`${offer.seats} vagas contratadas`))).toBeVisible();
    expect(paidRequestsBeforeAccess).toBe(0);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(stored).not.toContain('5162306219378829');
    user.subscription.status = 'active';
    user.subscription.is_entitled = true;
    user.subscription.max_organizations = offer.seats;
    attempt = { id: 'attempt-consultant', status: 'active', quote, has_access: true };
    await page.getByRole('button', { name: 'Verificar pagamento' }).click();
    await expect(page.getByRole('heading', { name: 'Seu acesso está liberado' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar para o Fincla' }).click();
    await expect(page).toHaveURL(/\/consultant\/clients$/);
    await expect(page.getByText('Sua carteira está vazia')).toBeVisible();
    await expect(page.getByText(`${offer.seats} vagas restantes`)).toBeVisible();
    expect(payments).toBe(1);
    await expect(page.getByRole('heading', { name: 'Bem-vindo ao Fincla' })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('consultant-portfolio.png'), fullPage: true });
  });
}
