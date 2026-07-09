/**
 * E2E do fluxo "Avaliar com IA" (Consultor IA — Entrega A1).
 *
 * O que é **real** aqui: o backend (auth, gating por `consultant_ai`, escopo da
 * carteira, roteamento), o frontend buildado (router, hook, drawer, recharts) e
 * o browser. O consultor e o cliente são provisionados pela API de verdade.
 *
 * O que é **stubbado**: apenas a resposta do endpoint `ai-evaluation`, no
 * boundary de rede. Motivos: uma run real chama OpenAI (custa dinheiro, leva
 * ~30-55s e é não-determinística), e o que este spec precisa provar é o *fluxo*
 * e a *fidelidade de contrato*, não a criatividade do modelo. O payload
 * injetado é a **fixture canônica**, byte a byte igual à do backend, onde um
 * teste valida que ela satisfaz `EvaluateClientOutput`. A run real com LLM foi
 * exercitada à mão no browser antes da entrega.
 *
 * O stack do servidor (orchestrator + MCP + audit + Postgres) tem sua própria
 * cobertura de integração em `fincla-api/tests/integration/interface/
 * test_consultant_ai_evaluation_api.py`.
 */
import { readFileSync } from "node:fs";

import { test, expect, type Page } from "@playwright/test";

// `import ... from "*.json"` exige import attribute no runtime do Playwright.
// Ler o arquivo mantém a fixture como fonte única, sem depender disso.
const fixture = JSON.parse(
  readFileSync(new URL("../src/api/__fixtures__/evaluateClientExample.json", import.meta.url), "utf-8"),
) as {
  summary: string;
  health_read: { score: number; label: string; headline: string };
  action_plan: { title: string }[];
  watch_points: { metric: string; note: string }[];
  charts: { title: string }[];
  disclaimers: string[];
};
import { createClientFor, createConsultant } from "./helpers/consultant";

const e2eReady = Boolean(process.env.TEST_RESET_SECRET && process.env.VITE_API_BASE_URL);

test.skip(!e2eReady, "Defina TEST_RESET_SECRET e VITE_API_BASE_URL para rodar o e2e do Consultor IA.");

const EVAL_URL = "**/v1/consultant/clients/*/ai-evaluation";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByText("Bom ver você de volta")).toBeVisible();
  await page.getByPlaceholder("seu@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: /Entrar na conta/i }).click();

  // Esperar o shell do consultor: navegar antes disto derruba de volta no login.
  await expect(page.getByRole("navigation").getByRole("button", { name: "Clientes" })).toBeVisible({
    timeout: 30_000,
  });
}

async function gotoWallet(page: Page): Promise<void> {
  await page.getByRole("navigation").getByRole("button", { name: "Clientes" }).click();
  await expect(page.getByRole("heading", { name: /Carteira de clientes/i })).toBeVisible({
    timeout: 30_000,
  });
}

const evaluateButton = (page: Page) => page.getByRole("button", { name: /Avaliar com IA/i }).first();

test.describe("Consultor IA — Avaliar com IA", () => {
  test("o drawer roda a avaliação e renderiza a resposta do contrato", async ({ page }) => {
    const consultant = await createConsultant("consultant_pro");
    const { clientName } = await createClientFor(consultant);

    const seenRequests: { requestId: string | undefined; body: string | null }[] = [];
    await page.route(EVAL_URL, async (route) => {
      const request = route.request();
      seenRequests.push({
        requestId: request.headers()["x-request-id"],
        body: request.postData(),
      });
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          correlation_id: request.headers()["x-request-id"],
          session_id: "e2e-session",
          run_id: "8f1e0f0c-0000-4000-8000-000000000000",
          output: fixture,
        }),
      });
    });

    await loginAs(page, consultant.email, consultant.password);
    await gotoWallet(page);

    await expect(page.getByText(clientName)).toBeVisible({ timeout: 30_000 });
    await expect(evaluateButton(page)).toBeEnabled();
    await evaluateButton(page).click();

    const drawer = page.getByRole("dialog", { name: /Avaliação com IA/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(clientName)).toBeVisible();

    // Veredito + resumo, vindos do contrato real.
    await expect(drawer.getByText(fixture.health_read.headline)).toBeVisible({ timeout: 20_000 });
    await expect(drawer.getByText(String(fixture.health_read.score))).toBeVisible();
    await expect(drawer.getByText(fixture.summary)).toBeVisible();

    // Pontos de atenção: são objetos {metric, note} — a regressão que derrubava o drawer.
    for (const wp of fixture.watch_points) {
      await expect(drawer.getByText(wp.note)).toBeVisible();
    }
    await expect(drawer.getByText(/\[object Object\]/)).toHaveCount(0);

    // Plano de ação com prioridade e evidência (o grounding é o que separa análise de chute).
    await expect(drawer.getByText(fixture.action_plan[0].title)).toBeVisible();
    await expect(drawer.getByText("Alta")).toBeVisible();
    await expect(drawer.getByText(/income_commitment/).first()).toBeVisible();

    // Um gráfico por ChartSpec — recharts renderiza de verdade (SVG no DOM).
    for (const chart of fixture.charts) {
      await expect(drawer.getByText(chart.title)).toBeVisible();
    }
    expect(await drawer.locator("svg.recharts-surface").count()).toBeGreaterThanOrEqual(
      fixture.charts.length,
    );
    await expect(drawer.getByText("Gráfico indisponível.")).toHaveCount(0);

    await expect(drawer.getByText(fixture.disclaimers[0])).toBeVisible();

    // Uma única run, com X-Request-Id UUID (o backend devolve 400 se não for).
    expect(seenRequests).toHaveLength(1);
    expect(seenRequests[0].requestId).toMatch(UUID_RE);
    // O escopo do tenant vem do path + sessão, nunca do body.
    expect(JSON.parse(seenRequests[0].body || "{}")).not.toHaveProperty("organization_id");

    await drawer.getByRole("button", { name: "Fechar" }).click();
    await expect(drawer).toBeHidden();
  });

  test("erro do backend vira mensagem acionável, com retry", async ({ page }) => {
    const consultant = await createConsultant("consultant_pro");
    await createClientFor(consultant);

    let attempts = 0;
    await page.route(EVAL_URL, async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 402,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ detail: "limite" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          correlation_id: route.request().headers()["x-request-id"],
          session_id: "s",
          run_id: "8f1e0f0c-0000-4000-8000-000000000000",
          output: fixture,
        }),
      });
    });

    await loginAs(page, consultant.email, consultant.password);
    await gotoWallet(page);
    await evaluateButton(page).click();

    const drawer = page.getByRole("dialog", { name: /Avaliação com IA/i });
    await expect(drawer.getByText("Não foi possível avaliar")).toBeVisible({ timeout: 20_000 });
    await expect(drawer.getByText(/limite de uso da IA/i)).toBeVisible();

    await drawer.getByRole("button", { name: "Tentar novamente" }).click();

    await expect(drawer.getByText(fixture.health_read.headline)).toBeVisible({ timeout: 20_000 });
    expect(attempts).toBe(2);
  });

  test("Escape fecha o drawer", async ({ page }) => {
    const consultant = await createConsultant("consultant_pro");
    await createClientFor(consultant);
    await page.route(EVAL_URL, (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          correlation_id: route.request().headers()["x-request-id"],
          session_id: "s",
          run_id: "8f1e0f0c-0000-4000-8000-000000000000",
          output: fixture,
        }),
      }),
    );

    await loginAs(page, consultant.email, consultant.password);
    await gotoWallet(page);
    await evaluateButton(page).click();

    const drawer = page.getByRole("dialog", { name: /Avaliação com IA/i });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("consultant_basic não tem a feature: o botão fica trancado e nada é chamado", async ({
    page,
  }) => {
    const consultant = await createConsultant("consultant_basic");
    await createClientFor(consultant);

    let called = false;
    await page.route(EVAL_URL, async (route) => {
      called = true;
      await route.abort();
    });

    await loginAs(page, consultant.email, consultant.password);
    await gotoWallet(page);

    const button = evaluateButton(page);
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("title", /plano Pro/i);

    await expect(page.getByRole("dialog", { name: /Avaliação com IA/i })).toHaveCount(0);
    expect(called).toBe(false);
  });
});
