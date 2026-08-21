/**
 * Isolar uma categoria em "Evolução por categoria" precisa reescalar o eixo Y
 * para a categoria. Empilhado (bug), o traço de uma categoria de R$ 100 ficava
 * na posição acumulada e o eixo continuava na escala do total.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAsE2EOwner, navViaSidebar } from "./helpers/auth";
import { resetAndSeedOrganization } from "./helpers/test-org";
import {
  listCategoriaTags,
  listMyOrganizations,
  loginOwnerBearer,
  postTransaction,
} from "./helpers/api-owner";
import { categoryLabelPtForTag } from "../src/ui/data/categoryLabels.js";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(!e2eReady, "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.");

/** Ordens de grandeza propositalmente distantes: é o que expõe a escala errada. */
const BIG_VALUE = 5000;
const SMALL_VALUE = 100;

let organizationId = "";
let bigCategory = "";
let smallCategory = "";

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** O card exige `advanced_reports`; o plano da org de teste não é o assunto aqui. */
async function ensureAdvancedReports(page: Page): Promise<void> {
  await page.route("**/v1/users/me", async (route) => {
    const response = await route.fetch();
    let json: any;
    try {
      json = await response.json();
    } catch {
      await route.fulfill({ response });
      return;
    }
    const features = json?.subscription?.features;
    if (Array.isArray(features) && !features.includes("advanced_reports")) {
      features.push("advanced_reports");
    }
    await route.fulfill({
      response,
      json,
      status: response.status(),
      headers: { ...response.headers(), "content-type": "application/json" },
    });
  });
}

/** Ticks do eixo Y do gráfico, em reais ("5.1k" → 5100). */
async function yAxisMax(page: Page): Promise<number> {
  const ticks = await page
    .locator('[data-testid="reports-drift-chart"] .recharts-yAxis .recharts-cartesian-axis-tick-value')
    .allTextContents();
  const values = ticks
    .map((t) => (t ?? "").trim())
    .filter(Boolean)
    .map((t) => (t.endsWith("k") ? Number(t.slice(0, -1)) * 1000 : Number(t)))
    .filter((n) => Number.isFinite(n));
  expect(values.length).toBeGreaterThan(1);
  return Math.max(...values);
}

test.describe("Relatórios — isolar categoria", () => {
  test.beforeAll(async () => {
    if (!e2eReady) return;
    const bearer = await loginOwnerBearer();
    // A SPA abre a primeira org do owner; é essa que precisa receber o seed.
    const orgs = await listMyOrganizations(bearer);
    expect(orgs.length).toBeGreaterThan(0);
    organizationId = await resetAndSeedOrganization("empty", orgs[0].id);
    const tags = await listCategoriaTags(bearer, organizationId);
    expect(tags.length).toBeGreaterThan(1);
    // O chip mostra o rótulo PT da tag, não o `name` cru da API.
    bigCategory = categoryLabelPtForTag(tags[0]);
    smallCategory = categoryLabelPtForTag(tags[1]);

    const now = new Date();
    const months = [
      new Date(now.getFullYear(), now.getMonth() - 1, 10),
      new Date(now.getFullYear(), now.getMonth(), Math.min(10, now.getDate())),
    ];
    for (const day of months) {
      for (const [tag, value] of [
        [tags[0], BIG_VALUE],
        [tags[1], SMALL_VALUE],
      ] as const) {
        await postTransaction(bearer, {
          organization_id: organizationId,
          type: "expense",
          description: `E2E drift — ${tag.name}`,
          tag_ids: [tag.id],
          value,
          payment_method: "cash",
          date: `${ymd(day)}T12:00:00`,
        });
      }
    }
  });

  test("o eixo Y passa a ser o da categoria isolada, não o do total", async ({ page }) => {
    await ensureAdvancedReports(page);
    await loginAsE2EOwner(page);
    await navViaSidebar(page, "Relatórios");

    const chart = page.locator('[data-testid="reports-drift-chart"]');
    await expect(chart).toBeVisible();
    await expect(chart.locator(".recharts-area")).toHaveCount(2);

    // Pilha completa: o eixo cobre o total dos dois gastos do mês.
    expect(await yAxisMax(page)).toBeGreaterThanOrEqual(BIG_VALUE);

    await page.getByRole("button", { name: smallCategory, exact: true }).click();

    // Isolado: só a categoria é desenhada e o eixo cabe nela.
    await expect(chart.locator(".recharts-area")).toHaveCount(1);
    const isolatedMax = await yAxisMax(page);
    expect(isolatedMax).toBeGreaterThanOrEqual(SMALL_VALUE);
    expect(isolatedMax).toBeLessThan(BIG_VALUE);
  });
});
