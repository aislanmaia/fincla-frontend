/**
 * E2E UI do estorno: dirige o drawer "Nova transação" para validar
 * o toggle "↺ Isto é um estorno?", o picker "🔗 Linkar à compra
 * estornada" e o reset quando o toggle volta para OFF.
 *
 * Captura screenshots em e2e/screenshots/ pra inspeção manual.
 */
import { test, expect } from "@playwright/test";
import { loginAsE2EOwner } from "./helpers/auth";
import { loginOwnerBearer, fetchFirstCategoriaTagId } from "./helpers/api-owner";
import { resetAndSeedOrganization } from "./helpers/test-org";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(!e2eReady, "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.");

function apiBase(): string {
  return (process.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
}

async function postExpense(
  bearer: string,
  body: Record<string, unknown>,
): Promise<{ id: number }> {
  const url = `${apiBase()}/v1/transactions`;
  console.log("[beforeAll] POST", url, JSON.stringify(body));
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`[beforeAll] response ${res.status}:`, text.slice(0, 200));
  if (!res.ok) throw new Error(`POST /v1/transactions: ${res.status} ${text}`);
  return JSON.parse(text) as { id: number };
}

test.describe("UI refund — drawer + picker", () => {
  test.beforeAll(async () => {
    if (!e2eReady) return;
    const orgId = await resetAndSeedOrganization("empty");
    // Cria uma expense para o picker ter o que listar.
    const bearer = await loginOwnerBearer();
    const tagId = await fetchFirstCategoriaTagId(bearer, orgId);
    // Local date (não UTC) — picker filtra por local date e expense criado com UTC
    // pode cair fora do range no fim do dia em America/Sao_Paulo.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    await postExpense(bearer, {
      type: "expense",
      description: "Compra UI test - mercado",
      value: 250,
      payment_method: "pix",
      date: today,
      organization_id: orgId,
      tag_ids: [tagId],
      status: "confirmed",
      recurring: false,
    });
  });

  test("toggle isEstorno + picker abre/fecha + linka candidata", async ({ page }) => {
    page.on("console", (msg) => console.log(`[browser ${msg.type()}]`, msg.text()));
    page.on("pageerror", (err) => console.log("[browser error]", err.message));
    page.on("requestfailed", (req) => console.log("[req failed]", req.url(), req.failure()?.errorText));
    page.on("response", (resp) => {
      const url = resp.url();
      if (url.includes("/v1/transactions") && resp.request().method() === "GET") {
        console.log(`[resp ${resp.status()}]`, url);
      }
    });
    await loginAsE2EOwner(page);

    // Abre o drawer "Nova transação" via botão na visão geral.
    await page.getByRole("button", { name: /Nova transação/i }).first().click();

    // Tab Despesa já é padrão. Toggle deve estar visível.
    // Regex casa os dois rótulos do toggle (OFF: "Isto é um estorno?", ON: "Lançando como estorno").
    const toggle = page.getByRole("button", { name: /Isto é um estorno\?|Lançando como estorno/i });
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    // Estado inicial: picker invisível.
    await expect(page.getByRole("button", { name: /Qual a compra estornada\?/i })).toHaveCount(0);

    // Liga o toggle.
    await toggle.click();
    await page.screenshot({
      path: "e2e/screenshots/refund-ui-toggle-on.png",
      fullPage: true,
    });

    // Picker fechado mas botão visível.
    const pickerBtn = page.getByRole("button", { name: /Qual a compra estornada\?/i });
    await expect(pickerBtn).toBeVisible();

    // Abre o picker.
    await pickerBtn.click();
    const searchInput = page.getByPlaceholder(/Buscar compra original/i);
    await expect(searchInput).toBeVisible();

    // Digita pra filtrar (debounced 250ms na app).
    await searchInput.fill("Compra UI test");
    await page.waitForTimeout(500);

    // Deve aparecer a candidata criada no beforeAll.
    // CSS locator pega o <button> que contém o texto (mais robusto que getByRole+name
    // quando o button tem múltiplos filhos compondo o nome acessível).
    const candidate = page.locator('button:has-text("Compra UI test - mercado")');
    await expect(candidate).toBeVisible({ timeout: 5_000 });
    await page.screenshot({
      path: "e2e/screenshots/refund-ui-picker-results.png",
      fullPage: true,
    });

    // Seleciona a candidata (role=button garante click no <button>, não em filho).
    await candidate.click();

    // Card "Estornando a compra" deve aparecer com botão Desvincular.
    await expect(page.getByText(/Estornando a compra/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Desvincular/i })).toBeVisible();
    await page.screenshot({
      path: "e2e/screenshots/refund-ui-linked.png",
      fullPage: true,
    });

    // Desvincula.
    await page.getByRole("button", { name: /Desvincular/i }).click();
    await expect(page.getByText(/Estornando a compra/i)).toHaveCount(0);

    // Desliga o toggle — bloco inteiro do refund some.
    await toggle.click();
    await expect(page.getByRole("button", { name: /Qual a compra estornada\?/i })).toHaveCount(0);
  });

  test("submeter estorno linkado persiste refund_of_transaction_id no backend", async ({ page }) => {
    page.on("pageerror", (err) => console.log("[browser error]", err.message));

    const bearer = await loginOwnerBearer();
    const orgIdRes = await fetch(`${apiBase()}/v1/memberships/my-organizations`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    const orgIdJson = (await orgIdRes.json()) as { organizations: Array<{ organization: { id: string } }> };
    const orgId = orgIdJson.organizations[0].organization.id;

    // Reset + recriar a expense original (test anterior já abriu/fechou drawer mas não submeteu).
    await resetAndSeedOrganization("empty");
    const tagId = await fetchFirstCategoriaTagId(bearer, orgId);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const originalRes = await fetch(`${apiBase()}/v1/transactions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "expense",
        description: "Compra UI test - mercado",
        value: 250,
        payment_method: "pix",
        date: today,
        organization_id: orgId,
        tag_ids: [tagId],
        status: "confirmed",
        recurring: false,
      }),
    });
    const original = (await originalRes.json()) as { id: number };
    expect(original.id).toBeGreaterThan(0);

    await loginAsE2EOwner(page);
    await page.getByRole("button", { name: /Nova transação/i }).first().click();

    // Toggle ON
    const toggle = page.getByRole("button", {
      name: /Isto é um estorno\?|Lançando como estorno/i,
    });
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();

    // Abre picker, busca, seleciona
    await page.getByRole("button", { name: /Qual a compra estornada\?/i }).click();
    await page.getByPlaceholder(/Buscar compra original/i).fill("Compra UI test");
    const candidate = page.locator('button:has-text("Compra UI test - mercado")');
    await expect(candidate).toBeVisible({ timeout: 5_000 });
    await candidate.click();

    // FK pré-preenchida na UI
    await expect(page.getByText(/Estornando a compra/i)).toBeVisible();

    // Preenche descrição (textarea desktop / input mobile)
    const descField = page.locator('textarea, input[placeholder*="Mercado"]').first();
    await descField.fill("Estorno parcial mercado");

    // Digita valor R$ 30,00 → "3000" no input que escuta keydown.
    // O input tem placeholder="0,00" e inputMode="numeric".
    const valorInput = page.getByPlaceholder("0,00").first();
    await expect(valorInput).toBeVisible();
    await valorInput.click();
    await page.keyboard.type("3000");

    // Vai pra review
    await page.getByRole("button", { name: /Revisar despesa/i }).click();

    // Confirma estorno
    const confirmBtn = page.getByRole("button", { name: /Confirmar estorno/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();

    // Feedback visual: botão muda pra "Registrado!"
    await expect(page.getByText(/Registrado!/i)).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: "e2e/screenshots/refund-ui-submitted.png",
      fullPage: true,
    });

    // Valida via API que o estorno foi criado com refund_of_transaction_id correto
    const listRes = await fetch(
      `${apiBase()}/v1/transactions?organization_id=${encodeURIComponent(
        orgId,
      )}&type=refund&date_start=${today}&date_end=${today}`,
      { headers: { Authorization: `Bearer ${bearer}` } },
    );
    expect(listRes.ok).toBeTruthy();
    const list = (await listRes.json()) as {
      data: Array<{ id: number; type: string; refund_of_transaction_id: number | null; description: string }>;
    };
    const created = list.data.find((t) => t.description === "Estorno parcial mercado");
    expect(created, "estorno criado deve aparecer na listagem").toBeTruthy();
    expect(created?.type).toBe("refund");
    expect(created?.refund_of_transaction_id).toBe(original.id);
  });
});

test.describe("UI refund — entry point na linha da fatura", () => {
  test("clicar '↺ Lançar estorno desta compra' abre drawer pré-configurado", async ({ page }) => {
    page.on("pageerror", (err) => console.log("[browser error]", err.message));

    // Setup via API: org limpa, cartão, e compra parcelada na fatura aberta.
    const orgId = await resetAndSeedOrganization("empty");
    const bearer = await loginOwnerBearer();
    const tagId = await fetchFirstCategoriaTagId(bearer, orgId);

    const cardRes = await fetch(`${apiBase()}/v1/credit-cards`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_id: orgId,
        last4: "1234",
        brand: "Visa",
        due_day: 10,
        closing_day: 28,
        description: "Cartão Teste E2E",
        credit_limit: 5000,
      }),
    });
    expect(cardRes.status).toBe(201);
    const card = (await cardRes.json()) as { id: number };

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const purchaseRes = await fetch(`${apiBase()}/v1/transactions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "expense",
        description: "Notebook Dell parcelado",
        value: 3000,
        payment_method: "credit_card",
        card_id: card.id,
        modality: "installment",
        installments_count: 10,
        date: today,
        organization_id: orgId,
        tag_ids: [tagId],
        status: "confirmed",
        recurring: false,
      }),
    });
    expect(purchaseRes.status).toBe(201);
    const purchase = (await purchaseRes.json()) as { id: number };
    expect(purchase.id).toBeGreaterThan(0);

    await loginAsE2EOwner(page);

    // Navega pra Cartões via sidebar.
    await page.getByRole("navigation").getByRole("button", { name: "Cartões" }).click();
    // Espera o cartão aparecer (nome ou bandeira).
    const cardTile = page.getByText(/Cartão Teste E2E|Visa/).first();
    await expect(cardTile).toBeVisible({ timeout: 15_000 });

    // Abre o detalhe do cartão.
    await cardTile.click();

    // Espera o badge "1/10×" aparecer, indicando que a parcela foi carregada.
    await expect(page.getByText("1/10×").first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: "e2e/screenshots/refund-ui-invoice-collapsed.png",
      fullPage: true,
    });

    // Pequena espera pra refetch storm assentar (dashboard faz polling).
    await page.waitForLoadState("networkidle").catch(() => {});

    // Expande a linha clicando no badge — alvo estável dentro do row clicável.
    await page.getByText("1/10×").first().click();

    // Botão "Lançar estorno desta compra" no detalhe expandido. force=true pra
    // evitar timing entre re-renders do auto-refresh.
    const lancarBtn = page.getByRole("button", { name: /Lançar estorno desta compra/i });
    await expect(lancarBtn).toBeVisible({ timeout: 5_000 });
    await page.screenshot({
      path: "e2e/screenshots/refund-ui-invoice-expanded.png",
      fullPage: true,
    });
    await lancarBtn.click({ force: true });

    // Card "Estornando a compra" com a descrição da compra original visível.
    await expect(page.getByText(/Estornando a compra/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Notebook Dell parcelado").first()).toBeVisible();
    await page.screenshot({
      path: "e2e/screenshots/refund-ui-invoice-drawer-prefilled.png",
      fullPage: true,
    });

    // Toggle estorno deve estar ON.
    const toggle = page.getByRole("button", {
      name: /Lançando como estorno/i,
    });
    await expect(toggle).toBeVisible();
  });
});
