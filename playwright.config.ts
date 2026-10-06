import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  projects: [
    {
      name: "smoke",
      testMatch: "**/smoke.spec.ts",
    },
    {
      name: "recurring-series",
      testMatch: "**/recurring-series.spec.ts",
      dependencies: ["smoke"],
    },
    {
      name: "dashboard-recurring-period",
      testMatch: ["**/dashboard-recurring-period.spec.ts", "**/dashboard-period-custom.spec.ts"],
      dependencies: ["smoke"],
    },
    {
      name: "subscription",
      testMatch: ["**/subscription.spec.ts", "**/feature-gating.spec.ts"],
      dependencies: ["smoke"],
    },
    {
      name: "refund",
      testMatch: "**/refund.spec.ts",
    },
    {
      name: "refund-ui",
      testMatch: "**/refund-ui.spec.ts",
      dependencies: ["smoke"],
    },
    {
      name: "settings-categories-tags",
      testMatch: "**/settings-categories-tags.spec.ts",
    },
    {
      name: "reports-category-isolate",
      testMatch: "**/reports-category-isolate.spec.ts",
    },
    {
      name: "simulation",
      testMatch: "**/simulation.spec.ts",
      dependencies: ["smoke"],
    },
    {
      // Prova do redesenho da tela de Transações em todas as resoluções que o
      // artefato mede — do ultrawide ao 360x740. Depende do seed do owner.
      name: "transactions-redesign",
      testMatch: "**/transactions-redesign.spec.ts",
      dependencies: ["smoke"],
    },
    {
      // Os dois caminhos do épico multi-moeda no navegador. Semeia a própria
      // organização (dois perfis), então não depende do `smoke`.
      //
      // Exige o backend com `QUOTATION_ENABLED=false`: o perfil sem taxa precisa
      // que ninguém saia para a internet buscar a cotação que ele omitiu de
      // propósito — senão o provedor devolve a taxa real e o caminho da ausência
      // nunca é alcançado.
      name: "multi-currency",
      testMatch: "**/multi-currency.spec.ts",
    },
    {
      // Semeia a própria organização (id novo) pela rota de teste, então não
      // depende do `smoke` nem apaga os dados da organização compartilhada.
      name: "cards-request-budget",
      testMatch: "**/cards-request-budget.spec.ts",
    },
    {
      // Hub do cartão (desktop e mobile). Semeia os próprios cartões e faturas
      // via API sobre a organização de e2e, então não depende do `smoke`.
      name: "cards-hub",
      testMatch: "**/cards-hub.spec.ts",
    },
    {
      // Dashboard de uma fatura (desktop e mobile). Semeia a própria organização
      // (id novo), então não depende do `smoke`. Inclui a medição do orçamento de chamadas.
      name: "cards-invoice-dashboard",
      testMatch: "**/cards-invoice-dashboard.spec.ts",
    },
    {
      name: "cards-commitments",
      testMatch: "**/cards-commitments.spec.ts",
    },
    {
      // Provisiona o próprio consultor e cliente via API; não depende do seed
      // do owner, então roda sem `smoke`.
      name: "consultant-ai-evaluation",
      testMatch: "**/consultant-ai-evaluation.spec.ts",
    },
    {
      // Navegador real para o Copiloto agregado; a run da IA é determinística no
      // boundary HTTP, enquanto a composição/ordem das tools é coberta na API.
      name: "consultant-copiloto",
      testMatch: "**/consultant-copiloto.spec.ts",
    },
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        // Em ambientes com CI=1 mas dev já em :3000 (ex.: Cursor), reutiliza o Vite.
        reuseExistingServer: true,
        timeout: 120_000,
        env: { ...process.env },
      },
});
