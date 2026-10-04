/**
 * Orçamento de requisições da carga de /cards (fincla-api#279).
 *
 * A tela de Cartões chegou a disparar dezenas de chamadas (e dezenas de 404)
 * porque carregava, para CADA cartão, histórico + compromissos futuros + uma
 * caminhada mês a mês atrás da fatura aberta. O problema nunca foi latência: foi
 * a QUANTIDADE de chamadas crescer com o número de cartões.
 *
 * O que este spec prende, num navegador real contra a API real:
 *  1. a carga de /cards cabe no orçamento de chamadas a `/credit-cards*`;
 *  2. a contagem NÃO cresce quando a organização passa de 1 para 5 cartões;
 *  3. nenhuma resposta 4xx (a caminhada antiga fazia 404 virar controle de fluxo);
 *  4. nenhuma URL idêntica pedida duas vezes.
 *
 * Cada cenário semeia a PRÓPRIA organização (id novo, via a rota de teste), então
 * não apaga nem depende dos dados da organização compartilhada do e2e. A sessão
 * abre essa organização pela chave `fincla_active_org_id` do localStorage.
 */
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { loginAsE2EOwner } from "./helpers/auth";
import { fetchFirstCategoriaTagId, loginOwnerBearer, postTransaction } from "./helpers/api-owner";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD &&
    process.env.VITE_API_BASE_URL,
);

test.skip(
  !e2eReady,
  "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL, E2E_TEST_OWNER_PASSWORD e VITE_API_BASE_URL.",
);

/**
 * Lista, matricula e fatura do cartão SELECIONADO: é tudo o que a carga precisa.
 * Os demais cartões só buscam detalhe quando o usuário os seleciona.
 */
const CREDIT_CARDS_BUDGET = 4;

const ACTIVE_ORG_KEY = "fincla_active_org_id";

const apiBase = () => (process.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

interface ApiCall {
  method: string;
  url: string;
  path: string;
  status: number | null;
  failure?: string;
}

interface Measurement {
  calls: ApiCall[];
  cardsCalls: ApiCall[];
}

async function createFreshOrganization(): Promise<string> {
  const res = await fetch(`${apiBase()}/v1/test/reset-organization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Reset-Token": process.env.TEST_RESET_SECRET ?? "",
    },
    body: JSON.stringify({ organization_id: randomUUID(), ensure_fixtures: true }),
  });
  if (!res.ok) throw new Error(`reset-organization: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { organization_id: string }).organization_id;
}

function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00`;
}

/** `cards` cartões; os cinco primeiros ganham perfis diferentes de compra. */
async function seedOrganizationWithCards(cards: number): Promise<string> {
  const organizationId = await createFreshOrganization();
  const bearer = await loginOwnerBearer();
  const tagId = await fetchFirstCategoriaTagId(bearer, organizationId);

  const profiles: Array<{ installments: number | null; amount: number } | null> = [
    { installments: 3, amount: 600 },
    { installments: null, amount: 80 },
    null,
    { installments: 6, amount: 1200 },
    { installments: null, amount: 45 },
  ];

  for (let i = 0; i < cards; i += 1) {
    const cardRes = await fetch(`${apiBase()}/v1/credit-cards`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_id: organizationId,
        last4: String(1111 * (i + 1)).slice(0, 4),
        brand: "Visa",
        due_day: 10 + i,
        closing_day: 3 + i,
        description: `Cartão Orçamento ${i + 1}`,
        credit_limit: 5000,
      }),
    });
    if (cardRes.status !== 201) throw new Error(`credit-cards POST: ${cardRes.status} ${await cardRes.text()}`);
    const card = (await cardRes.json()) as { id: number };

    const profile = profiles[i % profiles.length];
    if (!profile) continue;
    await postTransaction(bearer, {
      type: "expense",
      description: `Compra do cartão ${i + 1}`,
      value: profile.amount,
      payment_method: "credit_card",
      card_id: card.id,
      modality: profile.installments ? "installment" : "cash",
      ...(profile.installments ? { installments_count: profile.installments } : {}),
      date: localDate(-1),
      organization_id: organizationId,
      tag_ids: [tagId],
      status: "confirmed",
      recurring: false,
    });
  }
  return organizationId;
}

async function login(page: Page, organizationId: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* sem storage: a sessão cai na primeira organização */
      }
    },
    [ACTIVE_ORG_KEY, organizationId],
  );
  await loginAsE2EOwner(page);
}

/** Recarrega /cards do zero (bootstrap de sessão incluso) e conta a rede até assentar. */
async function measureCardsLoad(page: Page): Promise<Measurement> {
  const calls: ApiCall[] = [];
  const base = apiBase();
  const byRequest = new Map<unknown, ApiCall>();

  page.on("request", (req) => {
    if (!req.url().startsWith(`${base}/`)) return;
    const url = new URL(req.url());
    const call: ApiCall = {
      method: req.method(),
      url: `${url.pathname}${url.search}`,
      path: url.pathname.replace(/^\/v1/, ""),
      status: null,
    };
    byRequest.set(req, call);
    calls.push(call);
  });
  page.on("response", (res) => {
    const call = byRequest.get(res.request());
    if (call) call.status = res.status();
  });
  page.on("requestfailed", (req) => {
    const call = byRequest.get(req);
    if (call) call.failure = req.failure()?.errorText ?? "failed";
  });

  await page.goto("/cards");
  // O tile "Novo cartão" fecha o carrossel nas duas larguras e só existe com a lista
  // montada (o nome do cartão não aparece no mobile).
  await expect(page.getByText("Novo cartão").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  // O recarregamento por transactionsRefreshToken e afins, se existir, cai aqui.
  await page.waitForTimeout(1500);

  // O Chromium aborta requisições em voo quando o host troca de rede (container
  // subindo/caindo, VPN). Isso reabre chamadas pelo retry do cliente e falseia a
  // contagem: melhor falhar dizendo o motivo do que medir lixo.
  const aborted = calls.filter((c) => c.failure?.includes("ERR_NETWORK_CHANGED"));
  expect(aborted, "a rede do host mudou durante a medição (ERR_NETWORK_CHANGED); repita").toEqual([]);

  return { calls, cardsCalls: calls.filter((c) => c.path.startsWith("/credit-cards")) };
}

function report(label: string, m: Measurement): void {
  const groups = new Map<string, number>();
  for (const c of m.calls) {
    const norm = c.path
      .replace(/\/\d{4}\/\d{1,2}$/, "/{y}/{m}")
      .replace(/\/credit-cards\/\d+/, "/credit-cards/{id}")
      .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/g, "/{uuid}");
    const key = `${c.method} ${norm} [${c.status}]`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const lines = [...groups.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${String(v).padStart(4)}  ${k}`);
  // eslint-disable-next-line no-console
  console.log(`\n[cards-budget] ${label}: ${m.calls.length} chamadas à API, ${m.cardsCalls.length} em /credit-cards*\n${lines.join("\n")}\n`);
}

const viewports = [
  { name: "desktop", size: { width: 1440, height: 900 } },
  { name: "mobile", size: { width: 390, height: 844 } },
] as const;

/** Compara 1 x 5 cartões no mesmo viewport: a contagem total tem de ser idêntica. */
const totals = new Map<string, number>();

test.describe("carga de /cards: orçamento de requisições", () => {
  for (const viewport of viewports) {
    for (const cardCount of [1, 5]) {
      test(`${cardCount} cartão(ões), ${viewport.name}`, async ({ page }) => {
        const organizationId = await seedOrganizationWithCards(cardCount);
        // O helper de login espera a sidebar, que só existe no desktop: entra larga e
        // estreita a janela antes de medir (a carga de /cards recarrega a página).
        await page.setViewportSize(viewports[0].size);
        await login(page, organizationId);
        await page.setViewportSize(viewport.size);

        const m = await measureCardsLoad(page);
        report(`${cardCount} cartão(ões), ${viewport.name}`, m);

        expect(
          m.cardsCalls.length,
          `chamadas a /credit-cards*: ${m.cardsCalls.map((c) => `${c.url} [${c.status}]`).join(", ")}`,
        ).toBeLessThanOrEqual(CREDIT_CARDS_BUDGET);

        const failed = m.calls.filter((c) => c.status != null && c.status >= 400);
        expect(failed, "respostas 4xx/5xx na carga").toEqual([]);

        const seen = new Map<string, number>();
        for (const c of m.calls) {
          const key = `${c.method} ${c.url}`;
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
        const duplicated = [...seen.entries()].filter(([, n]) => n > 1);
        expect(duplicated, "URLs idênticas pedidas mais de uma vez").toEqual([]);

        totals.set(`${viewport.name}:${cardCount}`, m.calls.length);
        const other = totals.get(`${viewport.name}:${cardCount === 1 ? 5 : 1}`);
        if (other != null) {
          expect(
            m.calls.length,
            "a contagem total de chamadas não pode depender do número de cartões",
          ).toBe(other);
        }
      });
    }
  }
});

test("selecionar outro cartão busca só o detalhe dele, uma vez", async ({ page }) => {
  const organizationId = await seedOrganizationWithCards(5);
  await page.setViewportSize(viewports[0].size);
  await login(page, organizationId);
  const m = await measureCardsLoad(page);
  const liveCards = () => m.calls.filter((c) => c.path.startsWith("/credit-cards"));
  const before = liveCards().length;

  await page.getByText(/2222/).first().click();
  await expect.poll(() => liveCards().length, { timeout: 15_000 }).toBeGreaterThan(before);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  const added = liveCards().slice(before);
  // histórico + compromissos futuros + fatura atual do cartão escolhido, mais, no
  // pior caso, UMA confirmação de mês sem fatura (o único 404 tolerado)
  expect(added.length).toBeLessThanOrEqual(4);
  const failed = added.filter((c) => c.status == null || c.status >= 400);
  expect(failed.length).toBeLessThanOrEqual(1);
  expect(failed.every((c) => c.status === 404 && /\/invoices\/\d{4}\/\d+/.test(c.path))).toBe(true);
  const cardIds = new Set(added.map((c) => /\/credit-cards\/(\d+)\//.exec(c.path)?.[1]));
  expect(cardIds.size).toBe(1);

  // Voltar ao primeiro cartão vem do cache: nenhuma chamada nova.
  const afterSwitch = liveCards().length;
  await page.getByText(/1111/).first().click();
  await page.waitForTimeout(1000);
  expect(liveCards().length).toBe(afterSwitch);
});

test("mês seguinte só com parcelas (compra à vista no ciclo atual): a fatura real lista o item", async ({ page }) => {
  // Fechamento daqui a ~10 dias: a compra à vista de hoje fica na fatura atual e o
  // parcelado, lançado NO dia do fechamento, só cai na do mês seguinte. O histórico
  // não enxerga essa fatura futura e os compromissos futuros a mostram sem status.
  const today = new Date();
  test.skip(today.getDate() >= 27, "o cenário precisa de um fechamento no mesmo mês, depois de hoje");
  const closingDay = Math.min(today.getDate() + 10, 28);
  const organizationId = await createFreshOrganization();
  const bearer = await loginOwnerBearer();
  const tagId = await fetchFirstCategoriaTagId(bearer, organizationId);
  const cardRes = await fetch(`${apiBase()}/v1/credit-cards`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      organization_id: organizationId,
      last4: "1001",
      brand: "Visa",
      due_day: 25,
      closing_day: closingDay,
      description: "Cartão Formato A",
      credit_limit: 5000,
    }),
  });
  expect(cardRes.status).toBe(201);
  const card = (await cardRes.json()) as { id: number };
  const purchase = (description: string, value: number, date: string, installments?: number) =>
    postTransaction(bearer, {
      type: "expense",
      description,
      value,
      payment_method: "credit_card",
      card_id: card.id,
      modality: installments ? "installment" : "cash",
      ...(installments ? { installments_count: installments } : {}),
      date,
      organization_id: organizationId,
      tag_ids: [tagId],
      status: "confirmed",
      recurring: false,
    });
  const pad = (n: number) => String(n).padStart(2, "0");
  const ym = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  await purchase("Compra à vista A", 120, `${ym}-${pad(today.getDate())}T12:00:00`);
  await purchase("Parcelado A", 300, `${ym}-${pad(closingDay)}T12:00:00`, 3);

  await page.setViewportSize(viewports[0].size);
  await login(page, organizationId);
  await page.goto("/cards");
  await expect(page.getByText("Compra à vista A").first()).toBeVisible({ timeout: 30_000 });

  await page
    .getByText("Atual", { exact: true })
    .first()
    .locator("xpath=..")
    .locator("xpath=following-sibling::button")
    .click();
  await expect(page.getByText("Parcelado A").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Nenhum lançamento encontrado/)).toHaveCount(0);
});
