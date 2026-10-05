/** Isolated real-browser/API/DB smoke. Requires the multi-currency fixture and ports 3001/8001. */
import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

test("converte EUR, isola GBP sem cotação e preserva cobertura e valores no PDF", async ({ page }) => {
  test.skip(!process.env.E2E_LIVE_EMAIL || !process.env.E2E_LIVE_PASSWORD, "Credenciais locais não configuradas");
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
  await consultantNavigation.click();
  await page.getByRole("button", { name: "Onde meus clientes mais gastam no agregado?" }).click();

  const dashboard = page.getByRole("region", { name: "Distribuição agregada de gastos da carteira" });
  await expect(dashboard).toBeVisible({ timeout: 90_000 });
  await expect(dashboard.getByText("Não foi possível analisar toda a carteira")).toBeVisible();
  await expect(dashboard.getByText("4 de 5 clientes analisados").first()).toBeVisible();
  await expect(dashboard.getByText("R$ 44.499,60", { exact: true })).toBeVisible();
  await expect(dashboard.getByText("Gastos identificados em GBP")).toBeVisible();
  await expect(dashboard.getByText("£ 50,00")).toBeVisible();
  await expect(dashboard.getByRole("heading", { name: "Conversões aplicadas" })).toBeVisible();
  await dashboard.screenshot({ path: ".playwright-mcp/copiloto-multimoeda-dashboard.png" });

  await dashboard.getByRole("button", { name: "Ver conversões e cobertura" }).click();
  const conversion = page.getByRole("dialog", { name: "Como a moeda foi tratada" });
  await expect(conversion.getByText("EUR → BRL", { exact: true })).toBeVisible();
  await expect(conversion.getByText("1 cliente · EUR → BRL")).toBeVisible();
  await expect(conversion.getByText("€ 100,00 → R$ 600,00")).toBeVisible();
  await expect(conversion.getByText("3 clientes · BRL → BRL")).toBeVisible();
  await expect(conversion.getByText("R$ 43.899,60")).toBeVisible();
  await expect(conversion.getByText(/1 EUR = 6 BRL/)).toBeVisible();
  await expect(conversion.getByText("GBP", { exact: true })).toBeVisible();
  await expect(conversion.getByText("Libra Teste")).toBeVisible();
  await conversion.getByRole("button", { name: "Analisar este grupo em GBP" }).click();
  const cohort = page.getByRole("dialog", { name: "Análise em GBP" });
  await expect(cohort.locator(".portfolio-expense__cohort-total")).toHaveText("£ 50,00");
  await cohort.getByRole("button", { name: "Voltar ao resumo da carteira" }).click();
  await expect(conversion).toBeVisible();
  await conversion.getByRole("button", { name: "Fechar detalhes" }).click();

  await dashboard.getByRole("button", { name: "Analisar em GBP" }).click();
  await expect(cohort.locator(".portfolio-expense__cohort-total")).toHaveText("£ 50,00");
  await cohort.getByRole("button", { name: "Fechar análise por moeda" }).click();

  const downloadPromise = page.waitForEvent("download");
  await dashboard.getByRole("button", { name: "Exportar" }).click();
  const download = await downloadPromise;
  const pdfPath = await download.path();
  expect(pdfPath).toBeTruthy();
  await download.saveAs(".playwright-mcp/copiloto-multimoeda-e2e.pdf");
  const pdfText = execFileSync("pdftotext", [pdfPath!, "-"], { encoding: "utf8" });
  expect(pdfText).toContain("R$ 44.499,60");
  expect(pdfText).toContain("Conversão e cobertura");
  expect(pdfText).toContain("Conversões aplicadas");
  expect(pdfText).toContain("€ 100,00");
  expect(pdfText).toContain("R$ 600,00");
  expect(pdfText).toContain("Valores fora do agregado");
  expect(pdfText).toContain("GBP");
});
