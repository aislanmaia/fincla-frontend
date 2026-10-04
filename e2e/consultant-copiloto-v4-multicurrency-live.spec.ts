/** Browser smoke against the isolated EUR-convertible / GBP-unquoted fixture. */
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("shows partial coverage, quote receipt, separate GBP group and PDF", async ({ page }) => {
  test.skip(!process.env.E2E_LIVE_EMAIL || !process.env.E2E_LIVE_PASSWORD, "Local demo credentials are required");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.E2E_LIVE_EMAIL!);
  await page.getByPlaceholder("••••••••").fill(process.env.E2E_LIVE_PASSWORD!);
  await page.getByRole("button", { name: "Entrar na conta" }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Copiloto IA" }).click();
  const analysisResponse = page.waitForResponse((response) => response.url().includes("/expenses-distribution/analysis") && response.status() === 200, { timeout: 90_000 });
  await page.getByRole("button", { name: "Onde meus clientes mais gastam no agregado?" }).click();
  const payload = await (await analysisResponse).json();
  expect(payload.report.client_count).toBe(5);
  expect(payload.report.clients_converted).toBe(4);
  expect(payload.report.clients_not_converted).toBe(1);
  expect(payload.report.conversion_rates.some((rate: { base: string; quote: string }) => rate.base === "EUR" && rate.quote === "BRL")).toBe(true);

  const report = page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" });
  await expect(report.getByText("Conversão aplicada com cobertura parcial")).toBeVisible();
  await expect(report.getByRole("progressbar", { name: "Cobertura da carteira" })).toHaveAttribute("aria-valuenow", "80");
  await expect(report.locator(".portfolio-expense__compare-note")).toHaveCSS("background-color", "rgb(250, 248, 255)");
  await expect(report.getByText("Evolução, alcance e concentração — detalhe individual somente ao explorar")).toBeVisible();
  await expect(page.getByText("Onde meus clientes mais gastam no agregado?", { exact: true })).toBeInViewport();
  await expect(page.getByText("A distribuição agregada dos gastos está resumida no painel abaixo.")).toHaveCount(0);
  await expect(report).toHaveCSS("border-top-style", "none");
  await expect(report.getByText(/4 de 5 clientes foram incluídos no agregado/)).toBeVisible();
  await expect(report.getByText("Gastos identificados em GBP")).toBeVisible();
  await expect(report.getByRole("heading", { name: "Conversões aplicadas" })).toBeVisible();
  await expect(report.locator(".portfolio-expense__rates")).toContainText("EUR → BRL");
  await expect(report.locator(".portfolio-expense__rates")).toContainText("cliente");
  await expect(report.locator(".portfolio-expense__rates")).toContainText("€");
  await expect(report.locator(".portfolio-expense__metric--primary strong")).toContainText(Number(payload.report.total_expenses.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  await page.screenshot({ path: test.info().outputPath("copiloto-v4-multicurrency.png") });

  await report.getByRole("button", { name: "Ver conversões e cobertura" }).click();
  const conversion = page.getByRole("dialog", { name: "Como a moeda foi tratada" });
  await expect(conversion.getByText(/1 EUR = 6 BRL/)).toBeVisible();
  await expect(conversion.getByText("GBP", { exact: true })).toBeVisible();
  await conversion.getByRole("button", { name: "Analisar este grupo em GBP" }).click();
  const cohort = page.getByRole("dialog", { name: "Análise em GBP" });
  await expect(cohort.locator(".portfolio-expense__cohort-total")).toHaveText("£ 50,00");
  await cohort.getByRole("button", { name: "Fechar análise por moeda" }).click();

  const comparisonResponse = page.waitForResponse((response) => response.url().includes("/expenses-distribution/analysis") && response.status() === 200);
  await report.locator(".portfolio-expense__period-control button").click();
  await page.getByRole("tab", { name: "Predefinido" }).click();
  await page.getByRole("menuitemradio", { name: "6 meses" }).click();
  const compared = await (await comparisonResponse).json();
  await expect(report.locator(".portfolio-expense__metric--primary strong")).toContainText(Number(compared.report.total_expenses.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  await expect(report.getByRole("button", { name: "Por que esses gastos subiram?" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("copiloto-v4-multicurrency-comparison.png") });
  await report.screenshot({ path: test.info().outputPath("copiloto-v4-multicurrency-report.png"), animations: "disabled" });

  const downloadPromise = page.waitForEvent("download");
  await report.getByRole("button", { name: /Exportar/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const pdf = execFileSync("pdftotext", [path!, "-"], { encoding: "utf8" });
  for (const section of ["Indicadores do período", "Comparação de períodos", "Ritmo mensal da carteira", "Conversão e cobertura", "Valores fora do agregado"]) expect(pdf).toContain(section);
  expect(pdf).toContain("GBP");
  expect(pdf).toContain("46.833,00");

  await report.getByRole("button", { name: "Por que esses gastos subiram?" }).click();
  await expect(page.getByText(/Compare os gastos de Alimentação e Transporte entre o período atual e o anterior/)).toBeVisible();
  const followUpAnswer = page.locator(".copiloto-message__body").last();
  await expect(followUpAnswer).toContainText("R$ 3.700,00", { timeout: 90_000 });
  await expect(followUpAnswer).toContainText("2025-11-01 a 2026-04-30");
  await expect(followUpAnswer).toContainText("R$ 2.800,00");
});
