import { test, expect } from "@playwright/test";
import { loginAsE2EOwner } from "./helpers/auth";
import { resetAndSeedOrganization } from "./helpers/test-org";
import {
  buildDashboardPeriodExpectations,
  DASHBOARD_PERIOD_MIN_DAY_OF_MONTH,
  seedDashboardRecurringPeriodData,
} from "./helpers/dashboard-period-seed";
import {
  expectComprometido,
  expectKpiCard,
  openDashboardPeriodMenu,
  selectDashboardPreset,
  waitForDashboardSummary,
} from "./helpers/dashboard-period-ui";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(!e2eReady, "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.");

test.describe("dashboard — período e recorrências (org limpa)", () => {
  test.beforeEach(async () => {
    if (!e2eReady) return;
    test.skip(
      new Date().getDate() < DASHBOARD_PERIOD_MIN_DAY_OF_MONTH,
      `Requer dia do mês >= ${DASHBOARD_PERIOD_MIN_DAY_OF_MONTH} para ocorrências dos dias 1–3 já materializadas no mês atual.`,
    );
    const orgId = await resetAndSeedOrganization("empty");
    await seedDashboardRecurringPeriodData(orgId);
  });

  test("datepicker Este mês ↔ Mês passado reflete KPIs e Comprometido", async ({ page }) => {
    const exp = buildDashboardPeriodExpectations();

    await loginAsE2EOwner(page);
    await page.getByRole("navigation").getByRole("button", { name: "Visão Geral" }).click();
    await waitForDashboardSummary(page);

    await expect(async () => {
      await expectKpiCard(page, /^Receitas ·/, exp.thisMonth.receitas);
      await expectKpiCard(page, /^Despesas ·/, exp.thisMonth.despesas);
      await expectComprometido(page, exp.thisMonth.comprometido);
    }).toPass({ timeout: 40_000 });

    await openDashboardPeriodMenu(page);
    await selectDashboardPreset(page, "Mês passado");

    await expect(async () => {
      await expectKpiCard(page, /^Receitas ·/, exp.prev.receitas);
      await expectKpiCard(page, /^Despesas ·/, exp.prev.despesas);
      await expectComprometido(page, exp.prev.comprometido);
    }).toPass({ timeout: 40_000 });

    await openDashboardPeriodMenu(page);
    await selectDashboardPreset(page, "Este mês");

    await expect(async () => {
      await expectKpiCard(page, /^Receitas ·/, exp.thisMonth.receitas);
      await expectKpiCard(page, /^Despesas ·/, exp.thisMonth.despesas);
      await expectComprometido(page, exp.thisMonth.comprometido);
    }).toPass({ timeout: 40_000 });
  });
});
