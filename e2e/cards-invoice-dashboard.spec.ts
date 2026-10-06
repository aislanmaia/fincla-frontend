/**
 * Dashboard de uma fatura no navegador, desktop e mobile, contra a API real.
 *
 * Semeia a PRÓPRIA organização (id novo) com dois cartões: um com fatura paga,
 * fechada, aberta e parcelas futuras; outro sem nenhum lançamento. Prova o que os
 * testes de tela não alcançam: o carrossel nativo do mobile sem rolagem horizontal
 * da página, pagar/desfazer contra o servidor, o CSV baixado e, sobretudo, o
 * ORÇAMENTO DE CHAMADAS (independente do número de cartões e de meses).
 */
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { loginAsE2EOwner } from "./helpers/auth";
import { fetchFirstCategoriaTagId, loginOwnerBearer, postTransaction } from "./helpers/api-owner";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD &&
    process.env.VITE_API_BASE_URL,
);
test.skip(!e2eReady, "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL, E2E_TEST_OWNER_PASSWORD e VITE_API_BASE_URL.");

const SHOTS = process.env.INVOICE_DASH_SHOTS_DIR || "e2e/screenshots";
const ACTIVE_ORG_KEY = "fincla_active_org_id";
const CREDIT_CARDS_BUDGET = 4;
const apiBase = () => (process.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const ymdAt = (monthsAgo: number, day = 5) => {
  const d = new Date();
  return `${new Date(d.getFullYear(), d.getMonth() - monthsAgo, day).getFullYear()}-${pad(new Date(d.getFullYear(), d.getMonth() - monthsAgo, day).getMonth() + 1)}-${pad(day)}T12:00:00`;
};
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00`;
};

let orgId = "";
let bearer = "";
let tagId = "";
let busyCardId = 0;
let emptyCardId = 0;
const keyOf = (ym: string) => ym.slice(0, 7);

async function api(path: string, init: RequestInit = {}) {
  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

async function freshOrg(): Promise<void> {
  const res = await fetch(`${apiBase()}/v1/test/reset-organization`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Test-Reset-Token": process.env.TEST_RESET_SECRET ?? "" },
    body: JSON.stringify({ organization_id: randomUUID(), ensure_fixtures: true }),
  });
  expect(res.ok, await res.clone().text()).toBeTruthy();
  orgId = ((await res.json()) as { organization_id: string }).organization_id;
  bearer = await loginOwnerBearer();
  tagId = await fetchFirstCategoriaTagId(bearer, orgId);
}

async function createCard(body: Record<string, unknown>): Promise<number> {
  const res = await api("/v1/credit-cards", { method: "POST", body: JSON.stringify({ organization_id: orgId, ...body }) });
  expect(res.status, await res.clone().text()).toBe(201);
  return ((await res.json()) as { id: number }).id;
}

async function purchase(cardId: number, description: string, value: number, date: string, installments = 0) {
  await postTransaction(bearer, {
    type: "expense", description, value, payment_method: "credit_card", card_id: cardId,
    modality: installments > 1 ? "installment" : "cash",
    ...(installments > 1 ? { installments_count: installments } : {}),
    date, organization_id: orgId, tag_ids: [tagId], status: "confirmed", recurring: false,
  });
}

async function currentMonth(cardId: number): Promise<{ year: number; month: number } | null> {
  const res = await api(`/v1/credit-cards/${cardId}/invoices/current?organization_id=${orgId}`);
  if (res.status !== 200) return null;
  const [year, month] = ((await res.json()) as { month: string }).month.split("-").map(Number);
  return { year, month };
}
const shift = (ref: { year: number; month: number }, delta: number) => {
  const idx = ref.year * 12 + ref.month - 1 + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
};
const url = (cardId: number, ref: { year: number; month: number }) => `/cards/${cardId}/invoices/${ref.year}/${ref.month}`;
const keyFor = (ref: { year: number; month: number }) => `${ref.year}-${pad(ref.month)}`;
const parseBRL = (t: string | null) => {
  const m = /(-?[\d.]+,\d{2})/.exec(t ?? "");
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : null;
};

async function login(page: Page, vp: (typeof VIEWPORTS)[number]) {
  await page.addInitScript(([k, v]) => { try { window.localStorage.setItem(k, v); } catch { /* sem storage */ } }, [ACTIVE_ORG_KEY, orgId]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAsE2EOwner(page);
  await page.setViewportSize({ width: vp.width, height: vp.height });
}

const selected = (page: Page) => page.locator('[data-testid^="invoice-card-"][data-selected="true"]');

let openRef = { year: 0, month: 0 };

test.describe.configure({ mode: "serial", retries: 1 });

test.beforeAll(async ({ browser }) => {
  if (!e2eReady) return;
  await freshOrg();
  busyCardId = await createCard({ last4: "7112", brand: "Visa", due_day: 10, closing_day: 31, description: "Dash Azul", credit_limit: 10000 });
  emptyCardId = await createCard({ last4: "4420", brand: "Mastercard", due_day: 12, closing_day: 31, description: "Dash Vazio", credit_limit: 3000 });
  await purchase(busyCardId, "Compra paga", 300, ymdAt(2));
  await purchase(busyCardId, "Compra fechada", 450, ymdAt(1));
  await api(`/v1/credit-cards/${busyCardId}/invoices/${new Date(ymdAt(2)).getFullYear()}/${new Date(ymdAt(2)).getMonth() + 1}/mark-paid?organization_id=${orgId}`, { method: "PATCH", body: JSON.stringify({}) });
  await purchase(busyCardId, "Compra aberta", 120, today());
  await purchase(busyCardId, "Compra parcelada", 900, today(), 3);
  const cur = await currentMonth(busyCardId);
  expect(cur, "o cartão com lançamentos tem fatura aberta").not.toBeNull();
  openRef = cur!;

  // Esquenta o servidor de desenvolvimento nos dois layouts: o primeiro carregamento a
  // frio do Vite pode falhar ao importar o roteador e derrubaria um teste por motivo
  // alheio à tela.
  for (const vp of VIEWPORTS) {
    const warm = await browser.newPage();
    try {
      await login(warm, vp);
      await warm.goto(url(busyCardId, openRef));
      await warm.getByTestId("invoice-count").waitFor({ timeout: 60_000 });
    } catch {
      /* o login de cada teste acusa o problema real */
    } finally {
      await warm.close();
    }
  }
});

for (const vp of VIEWPORTS) {
  test.describe(`Dashboard da fatura — ${vp.name}`, () => {
    test("caminho feliz: fatura aberta, navegação entre faturas e totais iguais aos da API", async ({ page }) => {
      page.on("pageerror", (err) => console.log("[browser error]", err.message));
      await login(page, vp);
      await page.goto(url(busyCardId, openRef));
      await expect(page.getByTestId("invoice-count")).toBeVisible({ timeout: 30_000 });

      const sel = selected(page);
      await expect(sel).toHaveAttribute("data-status", "open");
      await expect(sel.getByTestId("invoice-status")).toHaveText("Aberta");
      await expect(page.getByTestId("card-name-label")).toContainText("Dash Azul");

      const detail = (await (await api(`/v1/credit-cards/${busyCardId}/invoices/${openRef.year}/${openRef.month}?organization_id=${orgId}`)).json()) as {
        total_amount: { amount: string }; items_count: number; category_breakdown: unknown[];
      };
      expect(parseBRL(await page.getByTestId("invoice-total").first().textContent())).toBe(Number(detail.total_amount.amount));
      await expect(page.getByTestId("invoice-count")).toContainText(`${detail.items_count} lançamento`);
      await expect(page.getByTestId("category-breakdown")).toBeVisible();
      await expect(page.getByTestId("recent-items")).toContainText("Compra aberta");
      await expect(page.getByTestId("invoice-timeline")).toBeVisible();
      await expect(page.getByTestId("invoice-limit")).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/dashboard-${vp.name}-open.png`, fullPage: !vp.mobile });

      // Faturas vizinhas: anterior (fechada) e seguinte (prevista).
      const prev = shift(openRef, -1);
      const next = shift(openRef, 1);
      if (vp.mobile) {
        await page.getByTestId(`invoice-card-${keyFor(prev)}`).click();
      } else {
        await page.getByTestId("invoice-prev").click();
      }
      await expect(page).toHaveURL(new RegExp(`${url(busyCardId, prev)}$`));
      await expect(selected(page).getByTestId("invoice-status")).toHaveText("Fechada");
      await expect(page.getByTestId("invoice-count")).toContainText("lançamento");
      await page.waitForTimeout(1500);
      await expect(selected(page)).toHaveAttribute("data-status", "closed");
      await page.screenshot({ path: `${SHOTS}/dashboard-${vp.name}-closed.png`, fullPage: !vp.mobile });

      await page.goto(url(busyCardId, next));
      await expect(selected(page).getByTestId("invoice-status")).toHaveText("Prevista", { timeout: 30_000 });
      const nextDetail = await api(`/v1/credit-cards/${busyCardId}/invoices/${next.year}/${next.month}?organization_id=${orgId}`);
      if (nextDetail.status === 200) {
        const body = (await nextDetail.json()) as { total_amount: { amount: string } };
        await expect(page.getByTestId("invoice-count")).toBeVisible();
        expect(parseBRL(await page.getByTestId("invoice-total").first().textContent())).toBe(Number(body.total_amount.amount));
      }
      await expect(page.getByTestId("pay-controls")).toHaveCount(0);
      await page.screenshot({ path: `${SHOTS}/dashboard-${vp.name}-forecast.png`, fullPage: !vp.mobile });

      if (vp.mobile) {
        const overflow = await page.evaluate(() => {
          const main = document.querySelector("[data-fincla-main-scroll]") as HTMLElement | null;
          return { doc: document.documentElement.scrollWidth - window.innerWidth, main: main ? main.scrollWidth - main.clientWidth : 0 };
        });
        expect(overflow.doc).toBeLessThanOrEqual(0);
        expect(overflow.main).toBeLessThanOrEqual(0);
        await page.goto(url(busyCardId, openRef));
        await expect(page.getByTestId("invoice-dots")).toBeVisible({ timeout: 30_000 });
        await page.getByTestId("category-open-sheet").click();
        await expect(page.getByRole("dialog", { name: "Por categoria" })).toBeVisible();
        await page.screenshot({ path: `${SHOTS}/dashboard-${vp.name}-category-sheet.png` });
      }
    });

    test("pagar e desfazer: o status muda na tela e no servidor, sem voltar para 'Carregando'", async ({ page }) => {
      await login(page, vp);
      const closed = shift(openRef, -1);
      await page.goto(url(busyCardId, closed));
      await expect(page.getByTestId("mark-paid")).toBeVisible({ timeout: 30_000 });
      await expect(selected(page).getByTestId("invoice-status")).toHaveText("Fechada");

      await page.evaluate(() => {
        (window as unknown as { __sawLoading: boolean }).__sawLoading = false;
        new MutationObserver(() => {
          if (document.body.textContent?.includes("Carregando fatura")) (window as unknown as { __sawLoading: boolean }).__sawLoading = true;
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
      });
      await page.getByTestId("mark-paid").click();
      await expect(page.getByTestId("paid-note")).toBeVisible();
      await expect(selected(page).getByTestId("invoice-status")).toHaveText("Paga");
      const after = (await (await api(`/v1/credit-cards/${busyCardId}/invoices/${closed.year}/${closed.month}?organization_id=${orgId}`)).json()) as { status: string };
      expect(after.status).toBe("paid");
      await page.screenshot({ path: `${SHOTS}/dashboard-${vp.name}-paid.png`, fullPage: !vp.mobile });

      await page.getByTestId("unmark-paid").click();
      await expect(page.getByTestId("mark-paid")).toBeVisible();
      await expect(selected(page).getByTestId("invoice-status")).toHaveText("Fechada");
      const reverted = (await (await api(`/v1/credit-cards/${busyCardId}/invoices/${closed.year}/${closed.month}?organization_id=${orgId}`)).json()) as { status: string };
      expect(reverted.status).not.toBe("paid");
      expect(await page.evaluate(() => (window as unknown as { __sawLoading: boolean }).__sawLoading)).toBe(false);
    });

    test("exportar CSV baixa a fatura selecionada", async ({ page }) => {
      await login(page, vp);
      await page.goto(url(busyCardId, openRef));
      await expect(page.getByTestId("export-csv")).toBeVisible({ timeout: 30_000 });
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()]);
      expect(download.suggestedFilename()).toBe(`fatura-Dash Azul-${keyFor(openRef)}.csv`);
      const text = fs.readFileSync((await download.path())!, "utf8");
      expect(text.split("\n")[0]).toBe("Descrição,Categoria,Valor,Data,Parcela,Recorrente");
      expect(text).toContain("Compra aberta");
    });

    test("borda: cartão sem lançamentos mostra estado vazio, nunca erro", async ({ page }) => {
      await login(page, vp);
      const ref = (await currentMonth(emptyCardId)) ?? shift(openRef, 0);
      await page.goto(url(emptyCardId, ref));
      await expect(page.getByTestId("invoice-empty")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("invoice-empty")).toContainText("ainda não recebeu compras");
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(page.getByTestId("pay-controls")).toHaveCount(0);
      await page.screenshot({ path: `${SHOTS}/dashboard-${vp.name}-empty.png`, fullPage: !vp.mobile });
    });

    test("borda: cartão inexistente mostra erro claro com volta ao Hub", async ({ page }) => {
      await login(page, vp);
      await page.goto(url(999999, openRef));
      await expect(page.getByTestId("invoice-dashboard-error")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("alert")).toContainText("Cartão não encontrado ou sem acesso");
      await page.getByTestId("back-to-cards").click();
      await expect(page).toHaveURL(/\/cards$/);
    });
  });
}

/* ── Orçamento de chamadas ─────────────────────────────────────────────── */
interface Seen { method: string; path: string; status: number }

async function measure(page: Page, target: string, ready: () => Promise<void>): Promise<Seen[]> {
  const seen: Seen[] = [];
  const base = apiBase();
  const onResponse = (res: import("@playwright/test").Response) => {
    if (!res.url().startsWith(base)) return;
    const u = new URL(res.url());
    seen.push({ method: res.request().method(), path: u.pathname + u.search.replace(/organization_id=[^&]+&?/, "").replace(/\?$/, ""), status: res.status() });
  };
  page.on("response", onResponse);
  await page.goto(target);
  await ready();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  page.off("response", onResponse);
  return seen;
}

const table = (seen: Seen[]) => {
  const rows = new Map<string, number>();
  for (const r of seen) {
    const k = `${r.method} ${r.path.replace(/\/credit-cards\/\d+/, "/credit-cards/:id")} -> ${r.status}`;
    rows.set(k, (rows.get(k) ?? 0) + 1);
  }
  return [...rows.entries()].map(([k, n]) => `${n}x ${k}`).join("\n");
};
const cardsCalls = (seen: Seen[]) => seen.filter((r) => r.path.startsWith("/v1/credit-cards"));

test.describe("orçamento de chamadas do dashboard da fatura", () => {
  for (const vp of VIEWPORTS) {
    test(`independe do número de cartões e de meses — ${vp.name}`, async ({ page }) => {
      await freshOrg();
      const firstId = await createCard({ last4: "1001", brand: "Visa", due_day: 10, closing_day: 31, description: "Budget 1", credit_limit: 5000 });
      await purchase(firstId, "Compra", 100, today());
      await purchase(firstId, "Parcelada", 600, today(), 3);
      await purchase(firstId, "Antiga", 80, ymdAt(1));
      const ref = (await currentMonth(firstId))!;

      await login(page, vp);
      const ready = async () => { await expect(page.getByTestId("invoice-count")).toBeVisible({ timeout: 30_000 }); };
      const one = await measure(page, url(firstId, ref), ready);

      for (let i = 2; i <= 5; i += 1) {
        const id = await createCard({ last4: String(1000 + i), brand: "Visa", due_day: 10, closing_day: 31, description: `Budget ${i}`, credit_limit: 5000 });
        await purchase(id, `Compra ${i}`, 50, today());
      }
      const five = await measure(page, url(firstId, ref), ready);

      // Selecionar outra fatura: exatamente UMA chamada a mais (o detalhe dela).
      const prev = shift(ref, -1);
      const sel: Seen[] = [];
      const base = apiBase();
      const onResponse = (res: import("@playwright/test").Response) => { if (res.url().startsWith(base)) sel.push({ method: res.request().method(), path: new URL(res.url()).pathname, status: res.status() }); };
      await page.goto(url(firstId, ref));
      await ready();
      await page.waitForLoadState("networkidle").catch(() => {});
      page.on("response", onResponse);
      if (vp.mobile) await page.getByTestId(`invoice-card-${keyFor(prev)}`).click();
      else await page.getByTestId("invoice-prev").click();
      await expect(page).toHaveURL(new RegExp(`${url(firstId, prev)}$`));
      await expect(page.getByTestId("invoice-count")).toContainText("lançamento");
      await page.waitForTimeout(1500);
      page.off("response", onResponse);

      console.log(`\n[calls ${vp.name}] 1 cartão\n${table(one)}\n[calls ${vp.name}] 5 cartões\n${table(five)}\n[calls ${vp.name}] ao selecionar a fatura anterior\n${table(sel)}\n`);

      expect(cardsCalls(five).length).toBe(cardsCalls(one).length);
      expect(cardsCalls(five).length).toBeLessThanOrEqual(CREDIT_CARDS_BUDGET);
      for (const seen of [one, five]) {
        expect(seen.filter((r) => r.status >= 400), "respostas 4xx/5xx na carga").toEqual([]);
        const keys = cardsCalls(seen).map((r) => `${r.method} ${r.path}`);
        expect(new Set(keys).size, `requisições duplicadas: ${keys.join(" | ")}`).toBe(keys.length);
        expect(seen.some((r) => r.path.includes("/invoices/current"))).toBe(false);
      }
      expect(cardsCalls(sel).map((r) => `${r.method} ${r.path}`)).toEqual([`GET /v1/credit-cards/${firstId}/invoices/${prev.year}/${prev.month}`]);
    });
  }
});
