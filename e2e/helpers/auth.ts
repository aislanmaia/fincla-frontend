import { expect, type Page } from "@playwright/test";

export async function loginAsE2EOwner(page: Page): Promise<void> {
  const email = process.env.E2E_TEST_OWNER_EMAIL;
  const password = process.env.E2E_TEST_OWNER_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_TEST_OWNER_EMAIL / E2E_TEST_OWNER_PASSWORD ausentes");
  }

  await page.goto("/");
  await expect(page.getByText("Bom ver você de volta")).toBeVisible();
  await page.getByPlaceholder("seu@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /Entrar na conta/i }).click();
  await expect(
    page.getByRole("navigation").getByRole("button", { name: "Visão Geral" }),
  ).toBeVisible({
    timeout: 30_000,
  });
}

export async function navViaSidebar(
  page: Page,
  label: "Visão Geral" | "Recorrências",
): Promise<void> {
  await page.getByRole("navigation").getByRole("button", { name: label }).click();
}
