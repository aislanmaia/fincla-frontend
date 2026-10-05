/** Headed browser smoke against the isolated 50-client consultant fixture. */
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("consultant can inspect and export a 50-client spending report", async ({ page }) => {
  test.setTimeout(300_000);
  test.skip(!process.env.E2E_LIVE_EMAIL || !process.env.E2E_LIVE_PASSWORD, "Local demo credentials are required");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.E2E_LIVE_EMAIL!);
  await page.getByPlaceholder("••••••••").fill(process.env.E2E_LIVE_PASSWORD!);
  await page.getByRole("button", { name: "Entrar na conta" }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Copiloto IA" }).click();
  await expect(page.getByRole("button", { name: "Onde meus clientes mais gastam no agregado?" })).toBeVisible();

  const failedReportRequests: string[] = [];
  const uncaughtErrors: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/expenses-distribution") && response.status() >= 400) {
      failedReportRequests.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => uncaughtErrors.push(error.message));

  const analysisResponse = page.waitForResponse(
    (response) => response.url().includes("/expenses-distribution/analysis") && response.status() === 200,
    { timeout: 90_000 },
  );
  await page.getByRole("button", { name: "Onde meus clientes mais gastam no agregado?" }).click();
  const payload = await (await analysisResponse).json();
  expect(payload.report.client_count).toBe(50);
  expect(payload.report.clients_converted).toBe(46);
  expect(payload.report.clients_not_converted).toBe(4);
  expect(payload.report.conversion_rates.some((rate: { base: string; quote: string }) => rate.base === "EUR" && rate.quote === "BRL")).toBe(true);

  const report = page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" });
  await expect(report.getByRole("heading", { name: "Distribuição de gastos da carteira" })).toBeVisible();
  await expect(report.getByRole("progressbar", { name: "Cobertura da carteira" })).toHaveAttribute("aria-valuenow", "92");
  await expect(report.getByText(/46 de 50 clientes foram incluídos/)).toBeVisible();
  await expect(report.locator(".portfolio-expense__metric--primary strong")).toContainText(
    Number(payload.report.total_expenses.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
  );
  await page.screenshot({ path: test.info().outputPath("copiloto-50-initial.png") });

  await report.getByRole("button", { name: "Ver conversões e cobertura" }).click();
  const conversion = page.getByRole("dialog", { name: "Como a moeda foi tratada" });
  await expect(conversion.getByText("16 clientes · EUR → BRL")).toBeVisible();
  await expect(conversion.getByRole("heading", { name: "Sem cotação disponível · 4 clientes" })).toBeVisible();
  await conversion.getByRole("button", { name: "Analisar este grupo em GBP" }).click();
  const cohort = page.getByRole("dialog", { name: "Análise em GBP" });
  await expect(cohort.locator(".portfolio-expense__cohort-total")).toHaveText("£ 191,00");
  await cohort.getByRole("button", { name: "Fechar análise por moeda" }).click();

  await report.getByRole("button", { name: "Detalhar Alimentação" }).click();
  const category = page.getByRole("dialog", { name: "Detalhes de Alimentação" });
  await expect(category.getByText("46 de 46 clientes")).toBeVisible();
  await category.getByRole("button", { name: "Ver mais clientes (10 de 46)" }).click();
  await expect(category.getByRole("button", { name: "Ver mais clientes (20 de 46)" })).toBeVisible();
  await category.getByRole("button", { name: "Fechar detalhes da categoria" }).click();

  const comparisonResponse = page.waitForResponse(
    (response) => response.url().includes("/expenses-distribution/analysis") && response.status() === 200,
  );
  await report.locator(".portfolio-expense__period-control button").click();
  await page.getByRole("tab", { name: "Predefinido" }).click();
  await page.getByRole("menuitemradio", { name: "6 meses" }).click();
  const compared = await (await comparisonResponse).json();
  expect(compared.report.client_count).toBe(50);
  expect(compared.comparison.previous_total.amount).toBe("6500.00");
  await expect(report.locator(".portfolio-expense__metric--primary strong")).toContainText(
    Number(compared.report.total_expenses.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
  );
  await expect(report.getByRole("button", { name: "Por que esses gastos subiram?" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("copiloto-50-six-months.png") });

  const downloadPromise = page.waitForEvent("download");
  await report.getByRole("button", { name: /Exportar/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const pdfPath = await download.path();
  expect(pdfPath).toBeTruthy();
  const pdfText = execFileSync("pdftotext", [pdfPath!, "-"], { encoding: "utf8" });
  for (const section of ["Indicadores do período", "Comparação de períodos", "Ritmo mensal da carteira", "Conversão e cobertura", "Valores fora do agregado"]) {
    expect(pdfText).toContain(section);
  }
  expect(pdfText).toContain("46 de 50 clientes");

  await report.getByRole("button", { name: "Por que esses gastos subiram?" }).click();
  await expect(page.getByText(/Compare os gastos de Alimentação e Transporte entre o período atual e o anterior/)).toBeVisible();
  const followUpAnswer = page.locator(".copiloto-message__body").last();
  await expect(followUpAnswer).toContainText("R$ 3.700,00", { timeout: 90_000 });
  await expect(followUpAnswer).toContainText("R$ 2.800,00");
  expect(failedReportRequests).toEqual([]);
  expect(uncaughtErrors).toEqual([]);
});
