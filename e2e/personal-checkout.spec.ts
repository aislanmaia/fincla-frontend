import { test, expect } from '@playwright/test';

test('annual signup, real session bootstrap, payment and reload preserve the pending attempt', async ({page}) => {
  let attempt: null | {id:string;status:string;quote:object;has_access?:boolean} = null;
  let payments = 0;
  let orgRequests = 0;
  const quote = {catalog_version:'2026-09-15',selection:{persona:'personal',billing_cycle:'yearly',mode:null,seats:null,package_size:null},total_cents:29900,capacity:null,currency:'BRL'};
  const user = {id:'person',email:'maria@example.com',role:'owner',first_name:'Maria',is_consultant:false,onboarding_completed:false,
    subscription:{plan:'pro',status:'pending_payment',is_entitled:false,gateway_provider:'asaas',billing_cycle:'yearly',features:[],max_organizations:1,max_users_per_org:10}};
  await page.route('**/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/plans/checkout-quote')) return route.fulfill({json:quote});
    if (path.endsWith('/checkout/register')) {
      expect(route.request().postDataJSON().billing_cycle).toBe('yearly');
      return route.fulfill({status:201,json:{id:user.id,status:'pending_payment',billing_cycle:'yearly'}});
    }
    if (path.endsWith('/auth/login')) return route.fulfill({json:{token:'checkout-browser-token',user}});
    if (path.endsWith('/auth/me') || path.endsWith('/users/me')) return route.fulfill({json:user});
    if (path.endsWith('/checkout/current')) return route.fulfill({json:attempt});
    if (path.endsWith('/checkout/pay')) {
      payments++;
      const body = route.request().postDataJSON();
      expect(body.selection.billing_cycle).toBe('yearly');
      expect(body.catalog_version).toBe(quote.catalog_version);
      expect(body).not.toHaveProperty('total_cents');
      attempt = {id:'attempt1',status:'pending_payment',quote};
      return route.fulfill({json:attempt});
    }
    if (path.includes('organizations')) {
      orgRequests++;
      if (user.subscription.is_entitled) return route.fulfill({json:{organizations:[]}});
    }
    return route.fulfill({status:403,json:{detail:{code:'payment_required'}}});
  });
  await page.goto('/checkout?persona=personal&billing_cycle=yearly', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Nome', {exact:true}).fill('Maria');
  await page.getByLabel('Email', {exact:true}).fill(user.email);
  await page.getByLabel('Senha', {exact:true}).fill('Password123!');
  await page.getByRole('button',{name:'Criar conta e continuar'}).click();
  await expect(page.getByRole('heading',{name:'Pague com cartão'})).toBeVisible();
  await expect(page.getByText(/299,00/)).toBeVisible();
  expect(orgRequests).toBe(0);
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
  await page.getByRole('button',{name:'Confirmar pagamento'}).click();
  await expect(page.getByRole('heading',{name:'Aguardando confirmação do pagamento'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Aguardando confirmação do pagamento'})).toBeVisible();
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading',{name:'Aguardando confirmação do pagamento'})).toBeVisible();
  expect(payments).toBe(1);
  const stored = await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));
  expect(stored).not.toContain('5162306219378829');
  await page.getByRole('button',{name:'Sair da conta'}).click();
  await expect(page.getByRole('button',{name:'Entrar na conta',exact:true})).toBeVisible();
  await page.goto('/checkout?persona=personal&billing_cycle=yearly', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button',{name:'Já tenho uma conta'}).click();
  await page.getByLabel('Email',{exact:true}).fill(user.email);
  await page.getByLabel('Senha',{exact:true}).fill('Password123!');
  await page.getByRole('button',{name:'Entrar e continuar'}).click();
  await expect(page.getByRole('heading',{name:'Aguardando confirmação do pagamento'})).toBeVisible();
  user.subscription.status = 'active';
  user.subscription.is_entitled = true;
  attempt = {id:'attempt1',status:'active',quote,has_access:true};
  await page.getByRole('button',{name:'Verificar pagamento'}).click();
  await expect(page.getByRole('heading',{name:'Seu acesso está liberado'})).toBeVisible();
  await page.getByRole('button',{name:'Continuar para o Fincla'}).click();
  await expect(page.getByRole('heading',{name:'Bem-vindo ao Fincla'})).toBeVisible();
  expect(payments).toBe(1);
});
