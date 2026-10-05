/** Real browser + API + isolated seeded Postgres; no intercepted requests. */
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("consultant report reconciles, drills down, changes period and exports", async ({ page }) => {
  test.skip(!process.env.E2E_LIVE_EMAIL || !process.env.E2E_LIVE_PASSWORD, "Local demo credentials are required");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByPlaceholder("seu@email.com").fill(process.env.E2E_LIVE_EMAIL!);
  await page.getByPlaceholder("••••••••").fill(process.env.E2E_LIVE_PASSWORD!);
  await page.getByRole("button", { name: "Entrar na conta" }).click();
  await page.getByRole("navigation").getByRole("button", { name: "Copiloto IA" }).click();
  await page.getByRole("button", { name: "Onde meus clientes mais gastam no agregado?" }).click();

  const report = page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" });
  await expect(report.getByRole("heading", { name: "Ritmo mensal da carteira" })).toBeVisible({ timeout: 90_000 });
  await expect(report.locator(".portfolio-expense__metric--primary strong")).toContainText("50.399,60");
  await expect(report.getByRole("button", { name: "Detalhar Alimentação" })).toBeVisible();
  await expect(report.getByText("Cobertura da carteira")).toHaveCount(0);
  await expect(report.getByRole("heading", { name: "Conversões aplicadas" })).toHaveCount(0);

  await report.getByRole("button", { name: "Detalhar Alimentação" }).click();
  const drawer = page.getByRole("dialog", { name: "Detalhes de Alimentação" });
  await expect(drawer.getByText("Carlos Lima")).toBeVisible();
  await expect(drawer.getByText("Mariana Costa")).toBeVisible();
  await expect(drawer.getByText("Ana Souza")).toBeVisible();
  await expect(drawer.getByText("R$ 25.605,00")).toBeVisible();
  await drawer.getByRole("button", { name: "Fechar detalhes da categoria" }).click();

  await report.locator(".portfolio-expense__period-control button").click();
  await page.getByRole("tab", { name: "Predefinido" }).click();
  await page.getByRole("menuitemradio", { name: "6 meses" }).click();
  await expect(report.getByRole("status")).toContainText("Atualizando análise");
  await expect(report.locator(".portfolio-expense__metric--primary strong")).toContainText("55.962,60", { timeout: 30_000 });
  await expect(report.getByText(/6.500,00 no período anterior/)).toBeVisible();
  await expect(report.locator(".portfolio-expense__context-chip").filter({ hasText: /01\/11\/2025.*30\/04\/2026/ })).toBeVisible();
  await expect(report.getByText(/Alimentação e Transporte puxam a alta/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("copiloto-v4-live.png") });

  const downloadPromise = page.waitForEvent("download");
  await report.getByRole("button", { name: /Exportar/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const pdfPath = await download.path();
  expect(pdfPath).toBeTruthy();
  const contents = execFileSync("pdftotext", [pdfPath!, "-"], { encoding: "utf8" });
  for (const section of ["Indicadores do período", "Comparação de períodos", "Onde a carteira mais gasta", "Ritmo mensal da carteira", "Leitura do Copiloto"]) {
    expect(contents).toContain(section);
  }
  expect(contents).toContain("55.962,60");
  expect(contents).toContain("Alimentação");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(report.getByRole("heading", { name: "Distribuição de gastos da carteira" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("copiloto-v4-mobile.png") });
});
