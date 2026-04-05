import { test, expect, type Page } from "@playwright/test";
import { loginAsE2EOwner } from "./helpers/auth";
import { resetAndSeedOrganization } from "./helpers/test-org";
import {
  buildDashboardPeriodExpectations,
  DASHBOARD_PERIOD_MIN_DAY_OF_MONTH,
  expectedKpisBillingCycleFiveToFour,
  expectedKpisPrevMonthFirstFiveDays,
  seedDashboardRecurringPeriodData,
} from "./helpers/dashboard-period-seed";
import {
  expectComprometido,
  expectKpiCard,
  fillDashboardCustomRange,
  openDashboardPeriodMenu,
  rangeBillingCycleFiveToFour,
  rangeMesPassado,
  rangePrevMonthInclusiveDays,
  waitForDashboardSummary,
} from "./helpers/dashboard-period-ui";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(!e2eReady, "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.");

async function closePeriodPanelIfOpen(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
}

test.describe("dashboard — período personalizado (org limpa)", () => {
  test.beforeEach(async () => {
    if (!e2eReady) return;
    test.skip(
      new Date().getDate() < DASHBOARD_PERIOD_MIN_DAY_OF_MONTH,
      `Requer dia do mês >= ${DASHBOARD_PERIOD_MIN_DAY_OF_MONTH} para ocorrências dos dias 1–3 já materializadas no mês atual.`,
    );
    const orgId = await resetAndSeedOrganization("empty");
    await seedDashboardRecurringPeriodData(orgId);
  });

  test("intervalo personalizado igual ao mês passado coincide com KPIs e Comprometido", async ({
    page,
  }) => {
    const exp = buildDashboardPeriodExpectations();
    const prev = rangeMesPassado();

    await loginAsE2EOwner(page);
    await page.getByRole("navigation").getByRole("button", { name: "Visão Geral" }).click();
    await waitForDashboardSummary(page);

    await openDashboardPeriodMenu(page);
    await fillDashboardCustomRange(page, prev.start, prev.end);
    await closePeriodPanelIfOpen(page);

    await expect(async () => {
      await expectKpiCard(page, /^Receitas ·/, exp.prev.receitas);
      await expectKpiCard(page, /^Despesas ·/, exp.prev.despesas);
      await expectComprometido(page, exp.prev.comprometido);
    }).toPass({ timeout: 40_000 });
  });

  test("Personalizado — fatia do mês passado (dias 1–5) recalcula KPIs e Comprometido", async ({
    page,
  }) => {
    const expSlice = expectedKpisPrevMonthFirstFiveDays();
    const slice = rangePrevMonthInclusiveDays(new Date(), 1, 5);

    await loginAsE2EOwner(page);
    await page.getByRole("navigation").getByRole("button", { name: "Visão Geral" }).click();
    await waitForDashboardSummary(page);

    await openDashboardPeriodMenu(page);
    await fillDashboardCustomRange(page, slice.start, slice.end);
    await closePeriodPanelIfOpen(page);

    await expect(async () => {
      await expectKpiCard(page, /^Receitas ·/, expSlice.receitas);
      await expectKpiCard(page, /^Despesas ·/, expSlice.despesas);
      await expectComprometido(page, expSlice.comprometido);
    }).toPass({ timeout: 40_000 });
  });

  test("Personalizado — ciclo longo dia 5 ao dia 4 do mês seguinte", async ({ page }) => {
    const anchor = new Date();
    const cycle = rangeBillingCycleFiveToFour(anchor);
    const expCycle = expectedKpisBillingCycleFiveToFour(anchor);

    await loginAsE2EOwner(page);
    await page.getByRole("navigation").getByRole("button", { name: "Visão Geral" }).click();
    await waitForDashboardSummary(page);

    await openDashboardPeriodMenu(page);
    await fillDashboardCustomRange(page, cycle.start, cycle.end);
    await closePeriodPanelIfOpen(page);

    await expect(async () => {
      await expectKpiCard(page, /^Receitas ·/, expCycle.receitas);
      await expectKpiCard(page, /^Despesas ·/, expCycle.despesas);
      await expectComprometido(page, expCycle.comprometido);
    }).toPass({ timeout: 40_000 });
  });
});
