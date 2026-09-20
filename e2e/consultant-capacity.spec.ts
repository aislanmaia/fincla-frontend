import { test, expect } from '@playwright/test';

test('releases a client only after review and reuses the paid seat without changing billing', async ({ page }) => {
  const user = { id: 'consultant', email: 'consultora@example.com', role: 'consultant', first_name: 'Maria', is_consultant: true, onboarding_completed: false,
    subscription: { plan: 'consultant_pro', status: 'active', is_entitled: true, gateway_provider: 'asaas', features: ['multi_org_dashboard'], max_organizations: 1, max_users_per_org: 10 } };
  let clients = [{ organization_id: '11111111-1111-4111-8111-111111111111', organization_name: 'Família de Ana', client_name: 'Ana Beatriz', role: 'consultant', health: null, patrimonio: null, savings_pct: 0, debt_pct: 0, trend: 'flat', last_active: null }];
  let quotaFailure = false;
  let releases = 0;
  let billingMutations = 0;
  await page.addInitScript(() => localStorage.setItem('auth_token', 'consultant-browser-token'));
  await page.route('**/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method !== 'GET' && (path.includes('/checkout/') || path.includes('/subscriptions/'))) billingMutations++;
    if (path.endsWith('/auth/me') || path.endsWith('/users/me')) return route.fulfill({ json: user });
    if (path.endsWith('/my-organizations')) return route.fulfill({ json: { organizations: [] } });
    if (path.endsWith('/consultant/quota') && quotaFailure) {
      quotaFailure = false;
      return route.fulfill({status:503,json:{detail:{message:'Unavailable'}}});
    }
    if (path.endsWith('/consultant/quota')) return route.fulfill({ json: { limit: 1, used: clients.length, remaining: clients.length ? 0 : 1 } });
    if (path.endsWith('/consultant/clients') && method === 'GET') return route.fulfill({ json: { clients, total: clients.length } });
    if (path.endsWith('/consultant/clients-at-risk')) return route.fulfill({ json: { clients: [], total: 0 } });
    if (path.endsWith('/consultant/clients/11111111-1111-4111-8111-111111111111') && method === 'DELETE') {
      releases++;
      quotaFailure = true;
      clients = [];
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith('/consultant/clients') && method === 'POST') {
      expect(clients).toHaveLength(0);
      const body = route.request().postDataJSON();
      expect(body.email).toBe('carla@example.com');
      clients = [{ organization_id: '22222222-2222-4222-8222-222222222222', organization_name: body.org_name, client_name: 'Carla Dias', role: 'consultant', health: null, patrimonio: null, savings_pct: 0, debt_pct: 0, trend: 'flat', last_active: null }];
      return route.fulfill({ status: 201, json: { organization_id: clients[0].organization_id, client_name: 'Carla Dias', set_password_link: 'https://app.fincla.com/reset-password?token=browser-fixture' } });
    }
    return route.fulfill({ status: 403, json: { detail: { code: 'access_denied' } } });
  });
  await page.goto('/consultant/clients', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Limite do plano atingido')).toBeVisible();
  await page.getByRole('button', { name: 'Liberar vaga de Ana Beatriz' }).click();
  const dialog = page.getByRole('dialog', { name: 'Liberar vaga de Ana Beatriz' });
  await expect(dialog.getByText(/sem apagar/i)).toBeVisible();
  await expect(dialog.getByText(/acesso patrocinado/i)).toBeVisible();
  expect(releases).toBe(0);
  await page.screenshot({path:test.info().outputPath('release-client-review.png')});
  await dialog.getByRole('button', { name: 'Manter cliente' }).click();
  await expect(page.getByText('Ana Beatriz', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await page.getByRole('button', { name: 'Liberar vaga de Ana Beatriz' }).click();
  await dialog.getByRole('button', { name: 'Liberar vaga', exact: true }).click();
  await expect(page.getByText('Sua carteira está vazia')).toBeVisible();
  await expect(page.getByText('Não foi possível atualizar as vagas.')).toBeVisible();
  await page.getByRole('button',{name:'Atualizar vagas'}).click();
  await expect(page.getByText('1 vaga restante')).toBeVisible();
  expect(releases).toBe(1);
  await page.getByRole('button', { name: 'Adicionar cliente', exact: true }).last().click();
  const clientName = page.getByPlaceholder('Ex.: Mariana Torres');
  expect((await clientName.boundingBox())!.width).toBeGreaterThan(200);
  await page.screenshot({path:test.info().outputPath('add-client.png')});
  await clientName.fill('Carla Dias');
  await page.getByPlaceholder('mariana@email.com').fill('carla@example.com');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByPlaceholder('Ex.: Finanças de Mariana').fill('Finanças de Carla');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Não, pular', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Não, pular', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Criar cliente', exact: true }).click();
  await expect(page.getByText('Cliente adicionado!')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à carteira' }).click();
  await expect(page.getByText('Carla Dias', { exact: true })).toBeVisible();
  await expect(page.getByText('Limite do plano atingido')).toBeVisible();
  expect(billingMutations).toBe(0);
  await page.screenshot({ path: test.info().outputPath('reused-seat.png'), fullPage: true });
});

test('a detached sponsored client keeps the account without paid access or automatic personal checkout', async ({ page }) => {
  let paidRequests = 0;
  let payments = 0;
  const user = { id: 'client', email: 'cliente@example.com', first_name: 'Ana', is_consultant: false, onboarding_completed: true,
    subscription: { plan: 'pro', status: 'active', is_entitled: false, gateway_provider: 'sponsored', sponsor_user_id: 'consultant', sponsor_organization_id: 'org', features: [], max_organizations: 1 } };
  await page.addInitScript(() => localStorage.setItem('auth_token', 'sponsored-browser-token'));
  await page.route('**/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me') || path.endsWith('/users/me')) return route.fulfill({ json: user });
    if (path.includes('/checkout/')) payments++;
    if (path.includes('organizations') || path.includes('/transactions')) paidRequests++;
    return route.fulfill({ status: 403, json: { detail: { code: 'access_denied' } } });
  });
  for (const destination of ['/dashboard', '/checkout?persona=personal&billing_cycle=monthly']) {
    await page.goto(destination, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Seu acesso patrocinado está indisponível' })).toBeVisible();
    await expect(page.getByText(/dados permanecem preservados/)).toBeVisible();
    await expect(page.getByLabel('Número do cartão')).toHaveCount(0);
    await page.getByRole('button', { name: 'Verificar acesso' }).click();
    await expect(page.getByRole('button', { name: 'Sair da conta' })).toBeVisible();
  }
  expect(paidRequests).toBe(0);
  expect(payments).toBe(0);
});
