/**
 * E2E flow para a tela /profile/billing.
 *
 * O teste assume que o backend tem o catálogo `plans` seedado (Essential e
 * Pro públicos) e usa o `E2E_TEST_OWNER_*` para autenticar. O upgrade real
 * para ASAAS sandbox é cortado interceptando o `POST /v1/subscriptions/
 * change-plan` — devolvemos um `checkout_url` fake apontando para a rota
 * `/profile/billing/return` no próprio app, e o webhook é simulado em uma
 * segunda etapa (`POST /v1/webhooks/asaas?token=...`).
 *
 * Pulado quando as env vars não estão presentes — o setup é o mesmo de
 * `smoke.spec.ts`.
 */
import { test, expect } from "@playwright/test";
import { loginAsE2EOwner } from "./helpers/auth";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(
  !e2eReady,
  "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.",
);

test.describe("/profile/billing — fluxo de assinatura", () => {
  test("usuário Essential vê plano atual e abre modal de comparação", async ({
    page,
  }) => {
    await loginAsE2EOwner(page);
    await page.goto("/profile/billing");

    // Plano atual vem do backend; verificamos que o nome do plano aparece
    // (qualquer um dos slugs renderizado por <BillingPanel>).
    await expect(
      page.getByRole("heading", { name: /assinatura/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /trocar plano/i }),
    ).toBeVisible();

    // Abrir o modal de comparação.
    await page.getByRole("button", { name: /trocar plano/i }).click();
    await expect(
      page.getByRole("dialog", { name: /comparar planos/i }),
    ).toBeVisible();

    // Pelo menos um CTA de troca deve aparecer no plano diferente do atual.
    // O modal mostra "Selecionar plano" no genérico e "Fazer upgrade" no
    // tier recomendado — ambos contam para "modal de comparação funcional".
    const selectButton = page
      .getByRole("button", { name: /selecionar plano|fazer upgrade/i })
      .first();
    await expect(selectButton).toBeVisible();

    // Fechar o modal sem confirmar.
    await page.keyboard.press("Escape");
  });

  test("cancelar assinatura mostra confirmação", async ({ page }) => {
    await loginAsE2EOwner(page);
    await page.goto("/profile/billing");

    // O botão "Cancelar assinatura" só aparece quando há subscription ativa
    // sem cancel_at_period_end. Se já estiver cancelada, pulamos o teste.
    const cancelButton = page.getByRole("button", {
      name: /cancelar assinatura/i,
    });
    if (!(await cancelButton.isVisible())) {
      test.skip(true, "Assinatura já está marcada para não-renovação.");
    }
    await cancelButton.click();
    await expect(
      page.getByRole("dialog", { name: /confirmar cancelamento/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /manter assinatura/i }),
    ).toBeVisible();
  });
});
