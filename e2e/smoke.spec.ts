import { test, expect } from "@playwright/test";
import { loginAsE2EOwner, navViaSidebar } from "./helpers/auth";
import { resetAndSeedOrganization } from "./helpers/test-org";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(!e2eReady, "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.");

test.describe("smoke autenticado", () => {
  test.beforeAll(async () => {
    if (!e2eReady) return;
    await resetAndSeedOrganization("dashboard_e2e");
  });

  test("login, Visão Geral e Recorrências", async ({ page }) => {
    await loginAsE2EOwner(page);

    await navViaSidebar(page, "Recorrências");
    await expect(page.getByText("Compromissos").first()).toBeVisible();
    await expect(page.getByText("Despesas Fixas").first()).toBeVisible();
  });
});
