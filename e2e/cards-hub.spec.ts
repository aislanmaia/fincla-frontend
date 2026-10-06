/**
 * Hub do cartão no navegador, em desktop e em mobile.
 *
 * Semeia a própria organização pela API (dois cartões: um com fatura paga,
 * fechada, aberta e parcelas futuras; outro sem nenhum lançamento) e prova o
 * que os testes de tela não alcançam: o carrossel nativo no layout de verdade
 * (sem rolagem horizontal da página), as quatro fases da fatura e a anotação
 * relida do servidor depois de um reload.
 *
 * O e2e apaga os dados da organização de teste: rode só contra a API
 * descartável (VITE_API_BASE_URL) e nunca contra um ambiente com dados reais.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAsE2EOwner } from "./helpers/auth";
import { fetchFirstCategoriaTagId, loginOwnerBearer } from "./helpers/api-owner";
import { resetAndSeedOrganization } from "./helpers/test-org";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(!e2eReady, "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.");

const SHOTS = process.env.CARDS_HUB_SHOTS_DIR || "e2e/screenshots";

function apiBase(): string {
  return (process.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Dia 5 de N meses atrás: sempre antes do fechamento (dia 15), então cai na fatura daquele mês. */
const dayFiveMonthsAgo = (n: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - n, 5);
};

let orgId = "";
let bearer = "";
let busyCardId = 0;
let emptyCardId = 0;

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  return res;
}

async function createCard(body: Record<string, unknown>): Promise<number> {
  const res = await api("/v1/credit-cards", { method: "POST", body: JSON.stringify({ organization_id: orgId, ...body }) });
  expect(res.status, await res.clone().text()).toBe(201);
  return ((await res.json()) as { id: number }).id;
}

async function purchase(cardId: number, tagId: string, description: string, value: number, date: Date, installments = 0) {
  const res = await api("/v1/transactions", {
    method: "POST",
    body: JSON.stringify({
      type: "expense",
      description,
      value,
      payment_method: "credit_card",
      card_id: cardId,
      modality: installments > 1 ? "installment" : "cash",
      ...(installments > 1 ? { installments_count: installments } : {}),
      date: ymd(date),
      organization_id: orgId,
      tag_ids: [tagId],
      status: "confirmed",
      recurring: false,
    }),
  });
  expect(res.status, await res.clone().text()).toBe(201);
}

test.beforeAll(async () => {
  if (!e2eReady) return;
  orgId = await resetAndSeedOrganization("empty");
  bearer = await loginOwnerBearer();
  const tagId = await fetchFirstCategoriaTagId(bearer, orgId);

  busyCardId = await createCard({
    last4: "7112", brand: "Visa", due_day: 10, closing_day: 15, description: "Hub Azul", credit_limit: 10000,
  });
  emptyCardId = await createCard({
    last4: "4420", brand: "Mastercard", due_day: 12, closing_day: 20, description: "Hub Vazio", credit_limit: 3000,
  });

  const paidMonth = dayFiveMonthsAgo(2);
  const closedMonth = dayFiveMonthsAgo(1);
  await purchase(busyCardId, tagId, "Compra paga", 300, paidMonth);
  await purchase(busyCardId, tagId, "Compra fechada", 450, closedMonth);
  const paid = await api(
    `/v1/credit-cards/${busyCardId}/invoices/${paidMonth.getFullYear()}/${paidMonth.getMonth() + 1}/mark-paid?organization_id=${orgId}`,
    { method: "PATCH", body: JSON.stringify({}) },
  );
  expect(paid.ok, await paid.clone().text()).toBeTruthy();
  await purchase(busyCardId, tagId, "Compra aberta", 120, new Date());
  await purchase(busyCardId, tagId, "Compra parcelada", 900, new Date(), 3);
});

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
] as const;

async function openHub(page: Page, vp: (typeof VIEWPORTS)[number]) {
  await loginAsE2EOwner(page);
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto("/cards?view=new");
  await expect(page.getByTestId("invoice-carousel")).toBeVisible({ timeout: 30_000 });
}

async function selectCardByName(page: Page, name: string) {
  const label = page.getByText("Cartão selecionado:");
  if (!(await label.innerText()).includes(name)) {
    await page.getByText(name).first().click();
    await expect(label).toContainText(name);
  }
}

const statuses = (page: Page) =>
  page.locator('[data-testid^="invoice-card-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-status")));

for (const vp of VIEWPORTS) {
  test.describe(`Hub do cartão — ${vp.name}`, () => {
    test("caminho feliz: carrossel com os 4 status, seleção e anotação relida do servidor", async ({ page }) => {
      page.on("pageerror", (err) => console.log("[browser error]", err.message));
      await openHub(page, vp);

      // O Hub é a tela padrão de /cards.
      await selectCardByName(page, "Hub Azul");
      await expect(page.locator('[data-testid^="invoice-card-"][data-status="paid"]')).toHaveCount(1);

      // Quatro status, em ordem cronológica: passada paga, fechada, aberta, previstas.
      const list = await statuses(page);
      expect(list).toContain("paid");
      expect(list).toContain("closed");
      expect(list).toContain("open");
      expect(list).toContain("forecast");
      expect(list.indexOf("paid")).toBeLessThan(list.indexOf("closed"));
      expect(list.indexOf("closed")).toBeLessThan(list.indexOf("open"));
      expect(list.indexOf("open")).toBeLessThan(list.indexOf("forecast"));
      expect(list.filter((s) => s === "open")).toHaveLength(1);

      const closed = page.locator('[data-testid^="invoice-card-"][data-status="closed"]').first();
      const open = page.locator('[data-testid^="invoice-card-"][data-status="open"]');
      await expect(closed.getByTestId("invoice-status")).toHaveText("Fechada");
      await expect(open.getByTestId("invoice-status")).toHaveText("Aberta");
      await expect(open).toHaveAttribute("data-selected", "true");

      await page.screenshot({ path: `${SHOTS}/cards-hub-${vp.name}-carousel.png`, fullPage: false });

      // Selecionar a fatura fechada.
      await closed.scrollIntoViewIfNeeded();
      await closed.click();
      await expect(closed).toHaveAttribute("data-selected", "true");
      await expect(open).toHaveAttribute("data-selected", "false");
      // A rolagem suave do toque não pode reescolher o card antigo (seleção que "alterna").
      await page.waitForTimeout(1800);
      await expect(closed).toHaveAttribute("data-selected", "true");
      await expect(open).toHaveAttribute("data-selected", "false");

      if (vp.mobile) {
        await expect(page.getByTestId("invoice-dots")).toBeVisible();
        // O carrossel nativo não pode dar rolagem horizontal à página inteira.
        const overflow = await page.evaluate(() => {
          const main = document.querySelector("[data-fincla-main-scroll]") as HTMLElement | null;
          return {
            doc: document.documentElement.scrollWidth - window.innerWidth,
            main: main ? main.scrollWidth - main.clientWidth : 0,
          };
        });
        expect(overflow.doc).toBeLessThanOrEqual(0);
        expect(overflow.main).toBeLessThanOrEqual(0);
        await page.screenshot({ path: `${SHOTS}/cards-hub-${vp.name}-selected-closed.png`, fullPage: false });
      } else {
        await page.screenshot({ path: `${SHOTS}/cards-hub-${vp.name}-selected-closed.png`, fullPage: true });
      }

      // Todas as faturas: painel no desktop, bottom sheet no mobile.
      await page.getByTestId("all-invoices-open-button").click();
      const dialog = page.getByRole("dialog", { name: "Todas as faturas" });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-testid^="all-invoices-row-"]')).toHaveCount((await statuses(page)).length);
      await page.screenshot({ path: `${SHOTS}/cards-hub-${vp.name}-all-invoices.png`, fullPage: false });
      await dialog.getByRole("button", { name: "Fechar" }).click();
      await expect(dialog).toBeHidden();

      // Anotação: salva, confere no servidor e relê depois de recarregar a página.
      const note = `Nota e2e ${vp.name} ${Date.now()}`;
      await page.getByTestId("card-notes-open").click();
      await page.getByTestId("card-notes-textarea").fill(note);
      await page.screenshot({ path: `${SHOTS}/cards-hub-${vp.name}-notes.png`, fullPage: false });
      await page.getByTestId("card-notes-save").click();
      await expect(page.getByTestId("card-notes-textarea")).toBeHidden();

      const saved = await api(`/v1/credit-cards/${busyCardId}?organization_id=${orgId}`);
      expect(((await saved.json()) as { notes: string | null }).notes).toBe(note);

      await page.reload();
      await expect(page.getByTestId("invoice-carousel")).toBeVisible({ timeout: 30_000 });
      await selectCardByName(page, "Hub Azul");
      await page.getByTestId("card-notes-open").click();
      await expect(page.getByTestId("card-notes-textarea")).toHaveValue(note);
    });

    test("borda: cartão sem fatura aberta mostra estado vazio, sem erro", async ({ page }) => {
      page.on("pageerror", (err) => console.log("[browser error]", err.message));
      await openHub(page, vp);

      await page.getByText("Hub Vazio").first().click();
      await expect(page.getByText("Cartão selecionado:")).toContainText("Hub Vazio");

      const open = page.locator('[data-testid^="invoice-card-"][data-status="open"]');
      await expect(open).toHaveCount(1);
      await expect(open).toContainText("Sem lançamentos ainda");
      await expect(open).not.toContainText("R$");
      await expect(page.getByText(/não puderam ser carregadas/i)).toHaveCount(0);

      await page.screenshot({ path: `${SHOTS}/cards-hub-${vp.name}-empty-open-invoice.png`, fullPage: false });
    });
  });
}

test("o link do dashboard da fatura abre dentro do shell do app", async ({ page }) => {
  await loginAsE2EOwner(page);
  await page.goto("/cards?view=new");
  await expect(page.getByTestId("invoice-carousel")).toBeVisible({ timeout: 30_000 });
  await selectCardByName(page, "Hub Azul");
  await page.locator('[data-testid^="invoice-card-"][data-status="open"]').getByTestId("invoice-dashboard-link").click();
  await expect(page).toHaveURL(new RegExp(`/cards/${busyCardId}/invoices/\\d{4}/\\d{1,2}$`));
  await expect(page.getByText(/em construção/i)).toBeVisible();
  // Barra lateral e topo do app continuam presentes: a página não saiu do shell.
  await expect(page.getByRole("navigation").getByRole("button", { name: "Cartões" })).toBeVisible();
  await expect(page.locator("[data-fincla-main-scroll]")).toBeVisible();
});

test("a tela clássica volta a ser o padrão de /cards", async ({ page }) => {
  await loginAsE2EOwner(page);
  await page.goto("/cards?view=new");
  await expect(page.getByTestId("invoice-carousel")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("classic-view-link").click();
  await expect(page).toHaveURL(/\/cards(?:\?.*)?$/);
  await expect(page.getByTestId("invoice-carousel")).toHaveCount(0);
  await expect(page.getByText("Cartões").first()).toBeVisible();
});

/* ── Orçamento de chamadas de API ao abrir /cards ──────────────────────────
   Requisito do Owner: a carga inicial não pode crescer com o número de cartões
   nem de meses. Só o cartão SELECIONADO carrega detalhe. */
type Seen = { method: string; path: string; status: number };

async function measureLoad(page: Page, url: string, ready: () => Promise<void>): Promise<Seen[]> {
  const seen: Seen[] = [];
  const base = apiBase();
  const onResponse = (res: import("@playwright/test").Response) => {
    const u = res.url();
    if (!u.startsWith(base)) return;
    const parsed = new URL(u);
    seen.push({ method: res.request().method(), path: parsed.pathname + parsed.search.replace(/organization_id=[^&]+&?/, "").replace(/\?$/, ""), status: res.status() });
  };
  page.on("response", onResponse);
  await page.goto(url);
  await ready();
  await page.waitForLoadState("networkidle").catch(() => {});
  page.off("response", onResponse);
  return seen;
}

const summarize = (seen: Seen[]) => {
  const rows = new Map<string, number>();
  for (const r of seen) rows.set(`${r.method} ${r.path.replace(/\/credit-cards\/\d+/, "/credit-cards/:id")} -> ${r.status}`, (rows.get(`${r.method} ${r.path.replace(/\/credit-cards\/\d+/, "/credit-cards/:id")} -> ${r.status}`) ?? 0) + 1);
  return [...rows.entries()].map(([k, n]) => `${n}x ${k}`).join("\n");
};

test.describe("orçamento de chamadas ao abrir /cards", () => {
  test.describe.configure({ mode: "serial" });
  const counts: Record<string, number> = {};

  for (const vp of VIEWPORTS) {
    test(`independe do número de cartões — ${vp.name}`, async ({ page }) => {
      orgId = await resetAndSeedOrganization("empty");
      bearer = await loginOwnerBearer();
      const tagId = await fetchFirstCategoriaTagId(bearer, orgId);
      const firstId = await createCard({ last4: "1001", brand: "Visa", due_day: 10, closing_day: 15, description: "Budget 1", credit_limit: 5000 });
      await purchase(firstId, tagId, "Compra", 100, new Date());
      await purchase(firstId, tagId, "Parcelada", 600, new Date(), 3);

      await loginAsE2EOwner(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const ready = async () => { await expect(page.getByTestId("invoice-carousel")).toBeVisible({ timeout: 30_000 }); };

      const one = await measureLoad(page, "/cards?view=new", ready);

      for (let i = 2; i <= 5; i += 1) {
        const id = await createCard({ last4: String(1000 + i), brand: "Visa", due_day: 10, closing_day: 15, description: `Budget ${i}`, credit_limit: 5000 });
        await purchase(id, tagId, `Compra ${i}`, 50, new Date());
      }
      const five = await measureLoad(page, "/cards?view=new", ready);
      const classicFive = await measureLoad(page, "/cards", async () => { await expect(page.getByText("Meus").first()).toBeVisible({ timeout: 30_000 }); await page.waitForTimeout(4000); });

      const hubCards = (seen: Seen[]) => seen.filter((r) => r.path.startsWith("/v1/credit-cards"));
      console.log(`[calls ${vp.name}] HUB 1 cartão\n${summarize(one)}\n[calls ${vp.name}] HUB 5 cartões\n${summarize(five)}\n[calls ${vp.name}] CLÁSSICA 5 cartões (total ${classicFive.length}, credit-cards ${hubCards(classicFive).length})\n${summarize(classicFive)}`);
      counts[vp.name] = hubCards(five).length;

      expect(hubCards(five).length).toBe(hubCards(one).length);
      expect(hubCards(five).length).toBeLessThanOrEqual(4);
      for (const seen of [one, five]) {
        const bad = seen.filter((r) => r.status >= 400 && !(r.path.includes("/invoices/current") && r.status === 404));
        expect(bad, JSON.stringify(bad)).toEqual([]);
        expect(seen.filter((r) => r.status === 404).length).toBeLessThanOrEqual(1);
        // Só os endpoints do cartão: budgets/goals/transactions vêm do shell do app (checklist de primeiros passos), não do Hub.
        const keys = hubCards(seen).map((r) => `${r.method} ${r.path}`);
        expect(new Set(keys).size, `requisições duplicadas: ${keys.join(" | ")}`).toBe(keys.length);
      }
    });
  }
});
