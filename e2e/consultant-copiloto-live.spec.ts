/** Smoke com navegador, API e banco locais reais. Rode com E2E_LIVE_EMAIL/PASSWORD. */
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

test("consultor consulta o agregado, recalcula o período e exporta o PDF real", async ({ page }) => {
  test.skip(!process.env.E2E_LIVE_EMAIL || !process.env.E2E_LIVE_PASSWORD, "Credenciais locais não configuradas");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const consultantNavigation = page.getByRole("navigation").getByRole("button", { name: "Copiloto IA" });
  const emailInput = page.getByPlaceholder("seu@email.com");
  const firstScreen = await Promise.race([
    consultantNavigation.waitFor({ state: "visible", timeout: 30_000 }).then(() => "consultant" as const),
    emailInput.waitFor({ state: "visible", timeout: 30_000 }).then(() => "login" as const),
  ]);
  if (firstScreen === "login") {
    await emailInput.fill(process.env.E2E_LIVE_EMAIL!);
    await page.getByPlaceholder("••••••••").fill(process.env.E2E_LIVE_PASSWORD!);
    await page.getByRole("button", { name: "Entrar na conta" }).click();
  }
  await expect(page.getByRole("navigation").getByRole("button", { name: "Copiloto IA" })).toBeVisible();
  await page.getByRole("navigation").getByRole("button", { name: "Copiloto IA" }).click();

  await page.getByRole("button", { name: "Onde meus clientes mais gastam no agregado?" }).click();
  const dashboard = page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" });
  await expect(dashboard, "o LLM deve chamar a tool e o guardrail montar o dashboard").toBeVisible({ timeout: 90_000 });
  await expect(dashboard.getByRole("heading", { name: "Distribuição de gastos da carteira" })).toBeVisible();
  await expect(dashboard.getByRole("table", { name: "Gastos agregados por categoria" })).toBeVisible();
  const initialTotal = await dashboard.locator(".portfolio-expense__metric--primary strong").textContent();

  await dashboard.locator(".portfolio-expense__period-control button").click();
  await page.getByRole("tab", { name: "Predefinido" }).click();
  await page.getByRole("menuitemradio", { name: "6 meses" }).click();
  await expect(dashboard.locator(".portfolio-expense__metric--primary strong")).not.toHaveText(initialTotal || "", { timeout: 30_000 });
  await expect(dashboard.getByRole("cell", { name: "Alimentação" })).toBeVisible();
  await expect(dashboard.getByRole("cell", { name: "Food & Groceries" })).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await dashboard.getByRole("button", { name: "Exportar" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^fincla-gastos-carteira-.*\.pdf$/);
  const pdfPath = await download.path();
  expect(pdfPath).toBeTruthy();
  const pdfText = execFileSync("pdftotext", [pdfPath!, "-"], { encoding: "utf8" });
  expect(pdfText).toContain("Indicadores do período");
  expect(pdfText).toContain("Onde a carteira mais gasta");
  expect(pdfText).toContain("Leitura do Copiloto");
  expect(pdfText).not.toContain("Conversões aplicadas");
  expect(pdfText).not.toContain("Cobertura da carteira");

  await dashboard.getByRole("button", { name: "Muitos clientes ou poucos?" }).click();
  await expect(page.getByText(/A concentração dessas categorias vem de muitos clientes ou de poucos\?/)).toBeVisible();
  await expect(page.locator(".copiloto-message__body")).toHaveCount(2, { timeout: 90_000 });
  await expect(page.locator(".copiloto-message__body").last()).not.toContainText(/(?:poucos|muitos|apenas alguns) clientes/i);
  await expect(page.locator(".copiloto-message__body").last()).toContainText(/3 clientes|três clientes|3 contribuíram|três clientes contribuíram|contribuíram 3/);
  await expect(page.getByLabel("Mensagem para o Copiloto")).toBeEnabled();
  await expect(page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" })).toHaveCount(1, { timeout: 90_000 });

  await dashboard.getByRole("button", { name: "Contribuição por cliente" }).click();
  await expect(page.locator(".copiloto-message__body")).toHaveCount(3, { timeout: 90_000 });
  await expect(page.locator(".copiloto-message__body").last()).toContainText(/Ana Souza|Carlos Lima|Mariana Costa/, { timeout: 90_000 });
  await expect(page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" })).toHaveCount(1);

  await dashboard.getByRole("button", { name: "Comparar com período anterior" }).click();
  await expect(page.locator(".copiloto-message__body")).toHaveCount(4, { timeout: 90_000 });
  await expect(page.locator(".copiloto-message__body").last()).not.toContainText("Não foi possível responder");
  await expect(page.locator(".copiloto-message__body").last()).toContainText("3.700,00");
  await expect(page.locator(".copiloto-message__body").last()).toContainText("2.800,00");
  await expect(page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" })).toHaveCount(1);
});
