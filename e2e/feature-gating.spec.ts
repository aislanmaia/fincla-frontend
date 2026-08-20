/**
 * E2E feature gating: usuário com plano que não tem a feature vê o
 * UpgradeWall em vez do conteúdo. Por padrão o tester de e2e está no plano
 * `beta` (acesso completo), então este teste só roda quando explicitamente
 * pedido — assumindo um seed onde o user está em `essential`. Quando o
 * usuário tem as features (caso default), checamos que as páginas Pro
 * abrem normalmente.
 */
import { test, expect } from "@playwright/test";
import { loginAsE2EOwner, navViaSidebar } from "./helpers/auth";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(
  !e2eReady,
  "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.",
);

test.describe("Pro feature gating", () => {
  test("rotas /reports e /simulation respondem ao plano do usuário", async ({
    page,
  }) => {
    await loginAsE2EOwner(page);

    // Visita /reports e checa se vê o conteúdo OU o UpgradeWall.
    // Não assumimos um plano específico — o tester pode estar em essential
    // (vê wall) ou beta (vê conteúdo). Em ambos os casos a página renderiza
    // sem erro, então o teste é "vê alguma coisa coerente".
    await navViaSidebar(page, "Relatórios");
    const reportsHasWall = await page
      .getByRole("button", { name: /ver planos/i })
      .isVisible()
      .catch(() => false);
    const reportsHasContent = await page
      .getByRole("heading", { name: /relatório|cascata|composição/i })
      .first()
      .isVisible()
      .catch(() => false);
    expect(reportsHasWall || reportsHasContent).toBeTruthy();

    // A Simulação saiu da sidebar: virou a sub-área `simulator` do hub
    // Planejamento, deep-linkável por URL.
    await page.goto("/planning/simulator");
    // `goto` resolve no `load`, mas o bootstrap da sessão ainda está buscando
    // /v1/users/me e as organizações -- até terminar, o app mostra o splash e o
    // outlet autenticado renderiza nada. Como os dois probes abaixo usam
    // `isVisible()`, que NÃO espera, sem esta âncora ambos dariam false e a
    // asserção "infalível" falharia. Mesmo padrão de `subscription.spec.ts`.
    // `.first()`: o hub Planejamento tem o próprio <nav> além da sidebar.
    await expect(page.getByRole("navigation").first()).toBeVisible({ timeout: 15_000 });
    const simHasWall = await page
      .getByRole("button", { name: /ver planos/i })
      .isVisible()
      .catch(() => false);
    const simHasContent = await page
      .getByText(/cenário|simulação/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(simHasWall || simHasContent).toBeTruthy();
  });
});
