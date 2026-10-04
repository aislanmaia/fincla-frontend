/** Navegador real: Copiloto renderiza o contrato do relatório agregado. */
import { test, expect, type Page } from "@playwright/test";
import { rangeForDashboardPreset } from "../src/ui/features/dashboard/dashboardDateRange.js";

async function installSessionMocks(page: Page) {
  await page.route("**/v1/**", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({}),
  }));
  await page.route("**/v1/auth/login", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ token: "e2e-local-token" }),
  }));
  await page.route("**/v1/users/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: "consultant-e2e", email: "consultant-e2e@test.local", role: "owner",
      is_consultant: true, first_name: "Consultor", last_name: "E2E", avatar_url: null,
      phone: null, onboarding_completed: true, created_at: "2026-01-01T00:00:00Z",
      subscription: {
        plan: "consultant_pro", status: "active", features: ["consultant_ai", "multi_org_dashboard"],
        max_organizations: 50, max_users_per_org: 10,
      },
    }),
  }));
  await page.route("**/v1/memberships/my-organizations", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ organizations: [] }),
  }));
  await page.route("**/v1/consultant/clients", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      clients: [{ organization_id: "client-eur", client_name: "Marina Costa" }], total: 1,
    }),
  }));
}

const report = {
  period_start: "2026-01-01",
  period_end: "2026-01-31",
  reading_currency: "BRL",
  total_expenses: { amount: "1200.00", currency: "BRL" },
  client_count: 4,
  clients_with_expenses: 3,
  clients_without_expenses: 1,
  clients_converted: 2,
  clients_not_converted: 1,
  categories: [
    { name: "Alimentação", total: { amount: "1000.00", currency: "BRL" }, percentage: 83.3333, client_count: 2 },
    { name: "Moradia", total: { amount: "200.00", currency: "BRL" }, percentage: 16.6667, client_count: 1 },
  ],
  original_currency_slices: [
    { organization_id: "client-eur", category_id: "food-eur", category_name: "Alimentação", amount: { amount: "100.00", currency: "EUR" }, included_in_converted_total: false },
  ],
  conversion_issues: [{ organization_id: "client-eur", reason: "Cotação EUR/BRL indisponível" }],
  conversion_rates: [{ base: "USD", quote: "BRL", rate: "5.00", quoted_on: "2026-01-30" }],
  highlights: {
    top_categories: [
      { name: "Alimentação", percentage: 83.3333, client_count: 2 },
      { name: "Moradia", percentage: 16.6667, client_count: 1 },
    ],
    combined_percentage: 100,
  },
};

test("Copiloto exibe agregado, cobertura, taxas e moeda fora do total", async ({ page }, testInfo) => {
  page.on("pageerror", (error) => console.log("[copiloto-pageerror]", error.message));
  page.on("requestfailed", (request) => console.log("[copiloto-requestfailed]", request.url(), request.failure()?.errorText));
  const seenRequests: { body: string | null; requestId?: string }[] = [];
  const reportReads: URL[] = [];
  await installSessionMocks(page);
  await page.route("**/v1/consultant/expenses-distribution?**", async (route) => {
    const url = new URL(route.request().url());
    reportReads.push(url);
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...report,
        period_start: url.searchParams.get("date_start"),
        period_end: url.searchParams.get("date_end"),
        total_expenses: { amount: "900.00", currency: "BRL" },
        categories: [{ name: "Transporte", total: { amount: "900.00", currency: "BRL" }, percentage: 100, client_count: 2 }],
      }),
    });
  });
  await page.route("**/v1/consultant/ai-copiloto", async (route) => {
    const request = route.request();
    seenRequests.push({ body: request.postData(), requestId: request.headers()["x-request-id"] });
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        correlation_id: request.headers()["x-request-id"],
        session_id: "e2e-copilot-session",
        run_id: "8f1e0f0c-0000-4000-8000-000000000000",
        output: {
          answer: "Segue a visão agregada solicitada.",
          blocks: [{ type: "portfolio_expense_distribution", version: 1, ...report }],
          suggested_actions: [],
          disclaimers: ["Análise de apoio ao consultor."],
        },
      }),
    });
  });

  await page.addInitScript(() => localStorage.setItem("auth_token", "e2e-local-token"));
  await page.goto("/consultant/copiloto");
  await page.screenshot({ path: testInfo.outputPath("copiloto-initial-route.png") });
  await expect(page.getByRole("heading", { name: "Copiloto IA" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Mensagem para o Copiloto").fill("Onde meus clientes mais gastam no agregado?");
  await page.getByLabel("Enviar mensagem").click();
  await expect(page.getByRole("status")).toContainText("Preparando sua análise");

  const dashboard = page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" });
  await expect(dashboard).toBeVisible();
  const reportHeaderPosition = await dashboard.locator(".portfolio-expense__header").evaluate((element) => ({
    headerTop: element.getBoundingClientRect().top,
    messageViewportTop: element.closest(".fincla-scroll").getBoundingClientRect().top,
  }));
  expect(reportHeaderPosition.headerTop).toBeGreaterThan(reportHeaderPosition.messageViewportTop + 8);
  await expect(dashboard.getByRole("heading", { name: "Distribuição de gastos da carteira" })).toBeVisible();
  await expect(dashboard.getByText("Análise concluída")).toBeVisible();
  await expect(dashboard.getByText("MOEDA DE LEITURA")).toBeVisible();
  await expect(dashboard.locator(".portfolio-expense__context")).toContainText("BRL · Real brasileiro");
  await expect(dashboard.getByText(/01\/01\/2026.*31\/01\/2026/)).toBeVisible();
  await expect(dashboard.locator(".portfolio-expense__metric--primary strong")).toContainText("1.200,00");
  await expect(dashboard.getByRole("cell", { name: "Alimentação" })).toBeVisible();
  await expect(dashboard.getByRole("cell", { name: "Moradia" })).toBeVisible();
  const highlights = dashboard.getByRole("region", { name: "Leitura do Copiloto" });
  await expect(highlights).toContainText("Alimentação e Moradia concentram 100,0% dos gastos do período");
  await expect(highlights).toContainText("2 clientes");
  const foodRow = dashboard.getByRole("row").filter({ hasText: "Alimentação" });
  await expect(foodRow).toContainText("83,3%");
  await expect(foodRow).toContainText("1.000,00");
  await expect(foodRow).toContainText("2");
  await expect(dashboard.locator(".portfolio-expense__footnote")).toContainText("Percentuais calculados sobre R$ 1.200,00 dos 2 clientes incluídos.");
  await expect(dashboard.getByText("Não foi possível analisar toda a carteira")).toBeVisible();
  await expect(dashboard.getByText("3 de 4 clientes analisados", { exact: true })).toBeVisible();
  await expect(dashboard.getByText(/1 USD = 5 BRL/)).toBeVisible();
  await expect(dashboard.getByText(/100,00/)).toBeVisible();
  await expect(dashboard.getByText(/Cotação EUR\/BRL indisponível/)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("copiloto-aggregate-dashboard.png") });
  await dashboard.evaluate((element) => { element.closest(".fincla-scroll")!.scrollTop = 0; });
  const periodTrigger = dashboard.locator(".portfolio-expense__period-control button");
  await periodTrigger.click();
  const periodPanel = page.getByRole("tabpanel", { name: "Personalizado" });
  await expect(periodPanel).toBeVisible();
  const popover = periodPanel.locator("xpath=../..");
  const triggerBox = await periodTrigger.boundingBox();
  const panelBox = await popover.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.y).toBeGreaterThanOrEqual(triggerBox!.y + triggerBox!.height);
  expect(panelBox!.y - (triggerBox!.y + triggerBox!.height)).toBeLessThan(24);
  await page.screenshot({ path: testInfo.outputPath("copiloto-period-popover-at-chat-top.png") });
  await page.getByRole("tab", { name: "Predefinido" }).click();
  await page.getByRole("menuitemradio", { name: "30 dias" }).click();
  await expect(dashboard.getByRole("status")).toContainText("Atualizando análise");
  await expect(dashboard.getByRole("cell", { name: "Transporte" })).toBeVisible();
  await expect(dashboard.locator(".portfolio-expense__metric--primary strong")).toContainText("900,00");
  expect(reportReads).toHaveLength(1);
  expect(reportReads[0].pathname).toBe("/v1/consultant/expenses-distribution");
  const expectedRange = rangeForDashboardPreset("ultimos_30");
  expect(reportReads[0].searchParams.get("date_start")).toBe(expectedRange.start);
  expect(reportReads[0].searchParams.get("date_end")).toBe(expectedRange.end);
  await dashboard.getByRole("button", { name: "Explorar valores por moeda" }).click();
  await expect(dashboard.getByText("Distribuição em EUR")).toBeVisible();
  await expect(dashboard.getByText("Marina Costa")).toBeVisible();
  await expect(dashboard.getByText("Cotação EUR/BRL indisponível")).toBeVisible();
  await expect(dashboard.getByText("client-eur")).toHaveCount(0);
  await dashboard.getByRole("button", { name: "Analisar em EUR" }).click();
  const cohort = page.getByRole("dialog", { name: "Análise em EUR" });
  await expect(cohort).toContainText("Marina Costa");
  await expect(cohort).toContainText("100,00");
  await page.screenshot({ path: testInfo.outputPath("copiloto-currency-cohort.png") });
  await cohort.getByRole("button", { name: "Voltar ao resumo da carteira" }).click();
  const returnToConversion = page.getByRole("dialog", { name: "Como a moeda foi tratada" });
  await expect(returnToConversion).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(returnToConversion).toHaveCount(0);
  await dashboard.getByRole("button", { name: "Ver conversões e cobertura" }).click();
  const currencyDetails = page.getByRole("dialog", { name: "Como a moeda foi tratada" });
  await expect(currencyDetails).toContainText("EUR");
  await expect(currencyDetails).toContainText("fora do total convertido");
  await page.screenshot({ path: testInfo.outputPath("copiloto-conversion-coverage.png") });
  await page.keyboard.press("Escape");
  await expect(currencyDetails).toHaveCount(0);

  const pdfDownload = page.waitForEvent("download");
  await dashboard.getByRole("button", { name: "Exportar" }).click();
  const download = await pdfDownload;
  expect(download.suggestedFilename()).toMatch(/^fincla-gastos-carteira-.*\.pdf$/);
  expect(await download.path()).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dashboard.getByRole("heading", { name: "Distribuição de gastos da carteira" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("copiloto-aggregate-mobile.png") });
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  expect(seenRequests).toHaveLength(1);
  expect(seenRequests[0].requestId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(JSON.parse(seenRequests[0].body || "{}").message).toContain("Onde meus clientes mais gastam");
});

test("Copiloto permite retentar a pergunta que falhou sem duplicá-la", async ({ page }, testInfo) => {
  const sentMessages: string[] = [];
  let releaseRetry: (() => void) | undefined;
  const retryResponseGate = new Promise<void>((resolve) => { releaseRetry = resolve; });
  await installSessionMocks(page);
  await page.route("**/v1/consultant/ai-copiloto", async (route) => {
    const request = route.request();
    sentMessages.push(JSON.parse(request.postData() || "{}").message);
    if (sentMessages.length === 1) {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "temporary failure" }) });
      return;
    }
    await retryResponseGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        correlation_id: request.headers()["x-request-id"],
        session_id: "e2e-copilot-session",
        run_id: "retry-success",
        output: { answer: "A tentativa funcionou.", blocks: [], suggested_actions: [], disclaimers: [] },
      }),
    });
  });

  await page.addInitScript(() => localStorage.setItem("auth_token", "e2e-local-token"));
  await page.goto("/consultant/copiloto");
  await page.getByLabel("Mensagem para o Copiloto").fill("Onde meus clientes mais gastam no agregado?");
  await page.getByLabel("Enviar mensagem").click();

  const error = page.getByRole("alert");
  await expect(error).toContainText("Não foi possível responder agora. Tente novamente em instantes.");
  await expect(error).not.toContainText("temporary failure");
  await expect(error.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("copiloto-retry-error-state.png") });
  await error.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Preparando sua análise", { exact: true })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("copiloto-retry-loading-replaces-error.png") });
  releaseRetry?.();
  await expect(page.getByText("A tentativa funcionou.")).toBeVisible();
  await expect(page.getByText("Onde meus clientes mais gastam no agregado?", { exact: true })).toHaveCount(1);
  expect(sentMessages).toHaveLength(2);
  expect(sentMessages[0]).toBe(sentMessages[1]);
});

test("Copiloto prioriza os destaques quando toda a carteira está na mesma moeda", async ({ page }) => {
  await installSessionMocks(page);
  await page.route("**/v1/consultant/ai-copiloto", async (route) => {
    const request = route.request();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        correlation_id: request.headers()["x-request-id"],
        session_id: "e2e-copilot-session",
        run_id: "same-currency-report",
        output: {
          answer: "A distribuição agregada dos gastos está resumida no painel abaixo.",
          blocks: [{
            type: "portfolio_expense_distribution",
            version: 1,
            ...report,
            total_expenses: { amount: "57577.40", currency: "BRL" },
            client_count: 3,
            clients_with_expenses: 3,
            clients_without_expenses: 0,
            clients_converted: 3,
            clients_not_converted: 0,
            categories: [
              { name: "Alimentação", total: { amount: "27468.50", currency: "BRL" }, percentage: 47.71, client_count: 3 },
              { name: "Transporte", total: { amount: "25264.50", currency: "BRL" }, percentage: 43.88, client_count: 3 },
            ],
            original_currency_slices: [],
            conversion_issues: [],
            conversion_rates: [],
            highlights: {
              top_categories: [
                { name: "Alimentação", percentage: 47.71, client_count: 3 },
                { name: "Transporte", percentage: 43.88, client_count: 3 },
              ],
              combined_percentage: 91.59,
            },
          }],
          suggested_actions: [],
          disclaimers: ["Análise de apoio ao consultor."],
        },
      }),
    });
  });

  await page.addInitScript(() => localStorage.setItem("auth_token", "e2e-local-token"));
  await page.goto("/consultant/copiloto");
  await page.getByLabel("Mensagem para o Copiloto").fill("Onde meus clientes mais gastam no agregado?");
  await page.getByLabel("Enviar mensagem").click();

  const dashboard = page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" });
  await expect(dashboard.getByRole("heading", { name: "Leitura do Copiloto" })).toBeVisible();
  await expect(dashboard.getByText("Alimentação e Transporte concentram 91,6% dos gastos do período.")).toBeVisible();
  await expect(dashboard.getByText("Valores comparáveis na moeda de leitura")).toHaveCount(0);
  await expect(dashboard.getByText("Cobertura da carteira")).toHaveCount(0);
  await expect(dashboard.getByText("Sem conversão")).toHaveCount(0);
  await expect(dashboard.getByRole("heading", { name: "Conversões aplicadas" })).toHaveCount(0);
});

test("período personalizado consulta exatamente as datas digitadas no relatório", async ({ page }) => {
  await installSessionMocks(page);
  const reportReads: URL[] = [];
  await page.route("**/v1/consultant/expenses-distribution?**", async (route) => {
    const url = new URL(route.request().url());
    reportReads.push(url);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...report,
        period_start: url.searchParams.get("date_start"),
        period_end: url.searchParams.get("date_end"),
      }),
    });
  });
  await page.route("**/v1/consultant/ai-copiloto", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      correlation_id: route.request().headers()["x-request-id"],
      session_id: "custom-period-session",
      run_id: "custom-period-run",
      output: {
        answer: "O relatório está no painel.",
        blocks: [{ type: "portfolio_expense_distribution", version: 1, ...report }],
        suggested_actions: [],
        disclaimers: [],
      },
    }),
  }));

  await page.addInitScript(() => localStorage.setItem("auth_token", "e2e-local-token"));
  await page.goto("/consultant/copiloto");
  await page.getByRole("button", { name: "Onde meus clientes mais gastam no agregado?" }).click();
  const dashboard = page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" });
  await expect(dashboard).toBeVisible();
  await dashboard.locator(".portfolio-expense__period-control button").click();
  await page.getByRole("tab", { name: "Personalizado" }).click();
  const dates = page.getByRole("tabpanel", { name: "Personalizado" }).getByPlaceholder("dd/mm/aaaa");
  await expect(dates).toHaveCount(2);
  await dates.nth(0).fill("10/01/2026");
  await dates.nth(1).fill("20/01/2026");
  await expect.poll(() => reportReads.some((url) =>
    url.searchParams.get("date_start") === "2026-01-10"
    && url.searchParams.get("date_end") === "2026-01-20",
  )).toBe(true);
  await expect(dashboard).toContainText("10/01/2026 – 20/01/2026");
});

test("balão de acompanhamento envia o período e recebe explicação sem repetir o dashboard", async ({ page }) => {
  await installSessionMocks(page);
  const requests: Array<{ message: string; presentation_style: string }> = [];
  await page.route("**/v1/consultant/ai-copiloto", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    requests.push(body);
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        correlation_id: route.request().headers()["x-request-id"], session_id: "followup-session", run_id: "followup-run",
        output: body.presentation_style === "explanation"
          ? { answer: "A categoria aparece em dois clientes; isso não prova gastos uniformes.", blocks: [], suggested_actions: [], disclaimers: [] }
          : { answer: "Veja o relatório.", blocks: [{ type: "portfolio_expense_distribution", version: 1, ...report }], suggested_actions: [], disclaimers: [] },
      }),
    });
  });
  await page.addInitScript(() => localStorage.setItem("auth_token", "e2e-local-token"));
  await page.goto("/consultant/copiloto");
  await page.getByRole("button", { name: "Onde meus clientes mais gastam no agregado?" }).click();
  const dashboard = page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" });
  await expect(dashboard).toHaveCount(1);
  await dashboard.getByRole("button", { name: "Muitos clientes ou poucos?" }).click();
  await expect(page.getByText("A categoria aparece em dois clientes; isso não prova gastos uniformes.")).toBeVisible();
  await expect(dashboard).toHaveCount(1);
  expect(requests).toHaveLength(2);
  expect(requests[1].presentation_style).toBe("explanation");
  expect(requests[1].message).toContain("2026-01-01 a 2026-01-31");
});
