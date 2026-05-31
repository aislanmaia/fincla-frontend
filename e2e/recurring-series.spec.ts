import { test, expect, type Page } from "@playwright/test";
import { loginAsE2EOwner, navViaSidebar } from "./helpers/auth";
import { resetAndSeedOrganization } from "./helpers/test-org";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(!e2eReady, "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.");

/** Nome único para localizar linhas e o card Próximos Débitos */
const REC_DESCRIPTION = "E2E Playwright — assinatura teste";

async function openNovaRecorrenciaModal(page: Page) {
  await page.getByRole("button", { name: /Nova Recorrência/i }).click();
  await expect(page.getByText("↑ Despesa")).toBeVisible();
}

/**
 * Valor “estilo banco”: dígitos shiftam centavos (ex.: 4,2,5,0 → R$ 42,50).
 */
async function typeValorCentavos(page: Page, keys: string) {
  const input = page.locator('input[placeholder="0,00"]').first();
  await input.click();
  for (const ch of keys) {
    if (ch >= "0" && ch <= "9") {
      await page.keyboard.press(ch);
    }
  }
}

async function submitNovaRecorrenciaDesktop(page: Page) {
  await openNovaRecorrenciaModal(page);
  await typeValorCentavos(page, "4250");

  await page.locator("textarea").first().fill(REC_DESCRIPTION);

  const catSelect = page.locator("select").first();
  await expect(async () => {
    const n = await catSelect.locator("option").count();
    if (n < 2) throw new Error("categorias ainda não carregaram");
  }).toPass({ timeout: 20_000 });
  await catSelect.selectOption({ index: 1 });

  await page.getByRole("button", { name: /^Pix$/ }).click();

  await page.getByRole("button", { name: /Revisar recorrência/i }).click();
  await page.getByRole("button", { name: /Confirmar recorrência/i }).click();

  await expect(page.getByText(REC_DESCRIPTION).first()).toBeVisible({ timeout: 25_000 });
}

/**
 * Espera o modal fechar (fc_modal sai da URL), localiza a linha da série
 * via `.fincla-row` + REC_DESCRIPTION (evita pegar a descrição no overlay
 * de sucesso) e expande para liberar os botões Editar/Pausar/Excluir.
 */
async function expandRecurringRow(page: Page) {
  await page.waitForURL((url) => !url.searchParams.has("fc_modal"), { timeout: 15_000 });

  const row = page.locator(".fincla-row", { hasText: REC_DESCRIPTION }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible({ timeout: 15_000 });
}

test.describe("recorrências — org limpa a cada teste", () => {
  test.beforeEach(async () => {
    if (!e2eReady) return;
    await resetAndSeedOrganization("empty");
  });

  test("cria despesa recorrente mensal pela UI e lista na tela", async ({ page }) => {
    await loginAsE2EOwner(page);
    await navViaSidebar(page, "Recorrências");
    await expect(page.getByText("Compromissos").first()).toBeVisible();

    await submitNovaRecorrenciaDesktop(page);

    await expect(page.getByText("Despesas Fixas").first()).toBeVisible();
    await expect(page.getByText(REC_DESCRIPTION).first()).toBeVisible();
  });

  test("pausa e reativa a série na lista", async ({ page }) => {
    await loginAsE2EOwner(page);
    await navViaSidebar(page, "Recorrências");
    await submitNovaRecorrenciaDesktop(page);

    await expandRecurringRow(page);
    await page.getByRole("button", { name: "Pausar" }).click();
    await expect(page.getByText("PAUSADA").first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Reativar" }).click();
    await expect(page.getByText("PAUSADA")).toHaveCount(0);
  });

  test("série permanece listada após Visão Geral e volta para Recorrências", async ({ page }) => {
    await loginAsE2EOwner(page);
    await navViaSidebar(page, "Recorrências");
    await submitNovaRecorrenciaDesktop(page);

    await navViaSidebar(page, "Visão Geral");
    await expect(page.getByText("Geral").first()).toBeVisible();

    await navViaSidebar(page, "Recorrências");
    await expect(page.getByText(REC_DESCRIPTION).first()).toBeVisible();
  });
});
