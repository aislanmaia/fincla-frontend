import { test, expect } from "@playwright/test";

import { loginAsE2EOwner } from "./helpers/auth";
import { resetAndSeedOrganization } from "./helpers/test-org";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(!e2eReady, "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.");

test.describe("configurações — categorias e tags", () => {
  test.beforeEach(async () => {
    if (!e2eReady) return;
    await resetAndSeedOrganization("empty");
  });

  test("mantém foco ao digitar nova categoria e nova tag", async ({ page }) => {
    const categoryName = "Categoria Foco E2E";
    const tagName = "tag foco e2e";

    await loginAsE2EOwner(page);
    await page.goto("/profile/categories");

    await expect(page.getByText("Categorias e Tags").first()).toBeVisible();

    await page.getByRole("button", { name: /Nova categoria/i }).click();
    const categoryInput = page.getByLabel("Nome da categoria");
    await expect(categoryInput).toBeFocused();
    await categoryInput.pressSequentially(categoryName);
    await expect(categoryInput).toHaveValue(categoryName);
    await expect(categoryInput).toBeFocused();

    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText(categoryName).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: `Expandir tags de ${categoryName}` }).click();
    const tagInput = page.getByLabel(`Nova tag de ${categoryName}`);
    await expect(tagInput).toBeVisible();
    await tagInput.pressSequentially(tagName);
    await expect(tagInput).toHaveValue(tagName);
    await expect(tagInput).toBeFocused();
  });
});
