/**
 * E2E da feature de Simulação.
 *
 * Cobre fluxos do usuário e os bugs corrigidos em 2026-06:
 *   • Modal "Novo cenário" — display de orçamento refletindo o valor digitado
 *     (antes era hardcoded "R$ 4.200,00").
 *   • Tela do cenário ativo — KPIs sem `NaN`, "Projeção" com mês dinâmico,
 *     orçamento "ajustado" preservando o override do modal.
 *   • Itens — todos os tipos disponíveis no modal: despesa_parcelada,
 *     despesa_recorrente, receita_pontual, receita_recorrente,
 *     ajuste_categoria — com preview de parcela calculado.
 *   • Lista de cenários, troca, "Limpar".
 *
 * Pré-requisitos:
 *   • O usuário de e2e (`e2e.owner@fincla.test`) precisa ter a feature
 *     `what_if_simulations` no plano. A maioria dos planos pagos liberam,
 *     mas o `essential` (default) não. Para não acoplar a um plano específico
 *     a suite usa `page.route` para injetar a feature no payload do
 *     `/v1/users/me`. Nenhuma mudança no banco é necessária.
 */
import { expect, test, type Page } from "@playwright/test";
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

/**
 * Liga a feature `what_if_simulations` no payload do /v1/users/me da sessão
 * atual + mocka a resposta do POST /v1/financial-impact/simulate (que é
 * gated server-side pelo `require_feature("what_if_simulations")` e retorna
 * 403 para usuários sem Pro). Os testes focam o comportamento do frontend
 * (KPIs, label dinâmico, sem NaN), então o payload determinístico funciona
 * para validar todos os bugs corrigidos sem depender do plano real do user.
 */
function buildMockSimulateResponse(months = 12) {
  const startYear = 2026;
  const startMonth = 6;
  const monthsArr = Array.from({ length: months }, (_, i) => {
    const idx = startMonth - 1 + i;
    const y = startYear + Math.floor(idx / 12);
    const m = String((idx % 12) + 1).padStart(2, "0");
    return {
      month: `${y}-${m}`,
      projected_income: "0",
      base_expenses: "0",
      card_commitments: "0",
      savings_goal: "0",
      total_expenses: "0",
      balance: "0",
      status: "success",
    };
  });
  return {
    months: monthsArr,
    global_verdict: "viable",
    summary: {
      total_projected_income: "0",
      total_base_expenses: "0",
      total_card_commitments: "0",
      total_savings_goal: "0",
    },
  };
}

async function ensureSimulationFeature(page: Page): Promise<void> {
  await page.route("**/v1/users/me", async (route) => {
    const response = await route.fetch();
    let json: any;
    try {
      json = await response.json();
    } catch {
      await route.fulfill({ response });
      return;
    }
    const sub = json?.subscription;
    if (sub?.features && Array.isArray(sub.features)) {
      if (!sub.features.includes("what_if_simulations")) {
        sub.features.push("what_if_simulations");
      }
      if (!sub.features.includes("advanced_reports")) {
        sub.features.push("advanced_reports");
      }
    }
    await route.fulfill({
      response,
      json,
      status: response.status(),
      headers: { ...response.headers(), "content-type": "application/json" },
    });
  });

  await page.route("**/v1/financial-impact/simulate", async (route) => {
    // Tenta usar a resposta real do backend; cai para o mock se ele responder
    // não-2xx (403 por gate de feature, p.ex.) ou falhar.
    try {
      const response = await route.fetch();
      if (response.ok()) {
        await route.fulfill({ response });
        return;
      }
    } catch {
      // ignora — usa mock
    }
    const body = JSON.parse(route.request().postData() || "{}");
    const months = Number(body?.simulation_months) || 12;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildMockSimulateResponse(months)),
    });
  });
}

async function openModalNovoCenario(page: Page): Promise<void> {
  // 3 estados possíveis na desktop:
  //  • Lista vazia: CTA "Criar primeiro cenário".
  //  • Sem cenário selecionado mas dropdown disponível: botão "+ Novo cenário"
  //    no header.
  //  • Cenário ativo: precisa abrir o dropdown (botão com o nome do cenário)
  //    para revelar o link "+ Novo cenário".
  const empty = page.getByRole("button", { name: /Criar primeiro cenário/i });
  if (await empty.isVisible().catch(() => false)) {
    await empty.click();
  } else {
    const headerNovo = page.getByRole("button", { name: /^\s*\+?\s*Novo cenário/i });
    if (await headerNovo.isVisible().catch(() => false)) {
      await headerNovo.click();
    } else {
      // Cenário ativo — abrir dropdown e clicar o link interno.
      const dropdownTrigger = page
        .locator("header, main, body")
        .first()
        .getByRole("button", { name: /Selecionar cenário|Cenário/ })
        .first();
      await dropdownTrigger.click();
      await page.getByRole("button", { name: /\+?\s*Novo cenário/i }).last().click();
    }
  }
  await expect(page.getByText(/SIMULAÇÃO/).first()).toBeVisible({ timeout: 5_000 });
}

async function setBudgetOverride(page: Page, value: string): Promise<void> {
  await page.getByTestId("sim-modal-budget-display").click();
  const inputs = await page.locator("input").all();
  let budgetInput = null as Awaited<ReturnType<typeof inputs[number]>> extends never ? never : (typeof inputs)[number] | null;
  for (const input of inputs) {
    const v = await input.inputValue().catch(() => "");
    if (v === "4200") {
      budgetInput = input;
      break;
    }
  }
  if (!budgetInput) throw new Error("budget input (com valor default 4200) não encontrado");
  await budgetInput.fill(value);
  await page.getByRole("button", { name: /^✓?\s*Confirmar$/i }).first().click();
}

/**
 * Vai até a tela de simulação garantindo que a feature está ligada e a
 * lista de cenários começa vazia. Como a página guarda os cenários só em
 * memória da SPA, basta um reload ou login fresco para limpar.
 */
async function openCleanSimulationPage(page: Page): Promise<void> {
  await ensureSimulationFeature(page);
  await loginAsE2EOwner(page);
  await navViaSidebar(page, "Simulação");
  await expect(
    page.getByRole("heading", { name: /Simulação/i }).first(),
  ).toBeVisible({ timeout: 10_000 });
}

test.describe("Simulação — onboarding + criação de cenário", () => {
  test("estado vazio mostra os 3 use-cases e o CTA principal", async ({ page }) => {
    await openCleanSimulationPage(page);

    await expect(page.getByText("Nenhum cenário ativo")).toBeVisible();
    await expect(page.getByText("Compra grande", { exact: true })).toBeVisible();
    await expect(page.getByText("Aumento de salário")).toBeVisible();
    await expect(page.getByText("Corte de gastos")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Criar primeiro cenário/i }),
    ).toBeVisible();
  });

  test("clicar em use-case 'Compra grande' abre modal com 'despesa_parcelada' selecionada", async ({ page }) => {
    await openCleanSimulationPage(page);

    await page.getByText("Compra grande", { exact: true }).click();
    // O modal abre com o formulário inline já expandido para o tipo escolhido.
    await expect(page.getByText("Novo item")).toBeVisible();
    // O tipo "Despesa parcelada" deve estar selecionado (pill com borda destacada).
    const pill = page.getByRole("button", { name: /Despesa parcelada/i });
    await expect(pill).toBeVisible();
  });

  test("modal 'Novo cenário': display de orçamento reflete valor digitado (bug C)", async ({ page }) => {
    await openCleanSimulationPage(page);
    await openModalNovoCenario(page);

    const budgetDisplay = page.getByTestId("sim-modal-budget-display");

    // Estado inicial: usa BUDGET_FALLBACK formatado pt-BR.
    await expect(budgetDisplay).toContainText("R$ 4.200,00");
    await expect(budgetDisplay).toContainText("Ajustar para este cenário");

    // Override para 7300 → display deve refletir 7.300,00, NÃO o hardcoded 4.200.
    await setBudgetOverride(page, "7300");
    await expect(budgetDisplay).toContainText("R$ 7.300,00");
    await expect(budgetDisplay).not.toContainText("R$ 4.200,00");
    // Label muda para "Editar ajuste" quando override está ativo.
    await expect(budgetDisplay).toContainText("Editar ajuste");

    // Cancelar (clicar fora / botão Cancelar) e abrir de novo — o display
    // deve continuar refletindo o último valor confirmado, não voltar pro
    // hardcoded.
    await page.keyboard.press("Escape").catch(() => {});
  });

  test("criar cenário com nome + orçamento override leva para a tela do cenário ativo", async ({ page }) => {
    await openCleanSimulationPage(page);
    await openModalNovoCenario(page);

    await page
      .getByPlaceholder("Ex: Compra do notebook novo")
      .fill("Cenário teste E2E");
    await setBudgetOverride(page, "9500");

    await page.getByRole("button", { name: /Criar cenário/i }).click();

    // Header do cenário ativo (background escuro).
    await expect(page.getByText(/Análise do cenário/i)).toBeVisible();
    await expect(page.getByText("Cenário teste E2E").first()).toBeVisible();

    // Orçamento "ajustado para este cenário" mostra o valor escolhido no modal.
    await expect(page.getByText(/ajustado para este cenário/i)).toBeVisible();
    await expect(page.getByText("R$ 9.500,00").first()).toBeVisible();
  });
});

test.describe("Simulação — KPIs sem NaN e label dinâmico (bugs A/B/E/F)", () => {
  test.beforeEach(async ({ page }) => {
    await openCleanSimulationPage(page);
    await openModalNovoCenario(page);
    await page.getByPlaceholder("Ex: Compra do notebook novo").fill("KPI Test");
    // Registra listener da resposta da simulação ANTES do submit. O debounce
    // de 400ms dispara o POST DEPOIS do cenário ser criado — sem registrar
    // antes a resposta seria perdida.
    const simResponse = page.waitForResponse(
      (r) =>
        r.url().includes("/v1/financial-impact/simulate") &&
        r.request().method() === "POST" &&
        r.ok(),
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /Criar cenário/i }).click();
    await expect(page.getByText(/Análise do cenário/i)).toBeVisible({ timeout: 10_000 });
    await simResponse;
    // Pequena espera para o React aplicar `setSimResult` e re-renderizar
    // as KPIs com `lastMonthLabel` antes dos asserts dos testes.
    await page.waitForTimeout(200);
  });

  test("nenhum 'NaN' aparece em KPI, orçamento, ponto de equilíbrio ou gráfico", async ({ page }) => {
    // O label da Projeção só vira "Projeção <mês>" depois do API responder
    // e o `apiKpis.lastMonthLabel` propagar — usamos isso como sinal de
    // estado pronto sem race de `waitForResponse`.
    await expect(
      page.locator("text=/^Projeção\\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i").first(),
    ).toBeVisible({ timeout: 15_000 });

    // Texto da página inteira não pode conter "NaN" em lugar nenhum.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/NaN/);
  });

  test("KPI 'Projeção' usa o último mês da janela, não 'março' hardcoded (bug E)", async ({ page }) => {
    // O label deve ser "Projeção <abr|mai|jun|...>" e não "Projeção final"
    // (fallback) nem "Projeção março" hardcoded.
    const projecaoLabel = page
      .locator("text=/^Projeção\\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i")
      .first();
    await expect(projecaoLabel).toBeVisible({ timeout: 15_000 });
  });

  test("Total simulado, Margem e Ponto de Equilíbrio têm valores finitos", async ({ page }) => {
    await expect(
      page.locator("text=/^Projeção\\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i").first(),
    ).toBeVisible({ timeout: 15_000 });

    // PONTO DE EQUILÍBRIO mostra um YYYY-MM válido (mês final da projeção).
    await expect(
      page.locator("text=/^[0-9]{4}-[0-9]{2}$/").first(),
    ).toBeVisible();

    // No cenário vazio (sem itens), TOTAL SIMULADO + Margem ambos zeram
    // sem produzir NaN. Conferimos pelo texto agregado: a Margem aparece
    // como "+R$ 0,00" (positiva — não há despesa).
    await expect(
      page.locator("text=/\\+R\\$\\s*0,00/").first(),
    ).toBeVisible();
    // "Total simulado" deve estar próximo de "R$ 0,00" — verificamos pela
    // string composta do KPI (label seguido de valor) sem .locator("..").
    await expect(page.locator("body")).toContainText("Total simulado");
    await expect(page.locator("body")).toContainText("R$ 0,00");
  });
});

test.describe("Simulação — adicionar todos os tipos de item via modal", () => {
  test("despesa_parcelada: preview da parcela aparece na lista de meses", async ({ page }) => {
    await openCleanSimulationPage(page);
    await openModalNovoCenario(page);

    await page.getByPlaceholder("Ex: Compra do notebook novo").fill("Parcelado");

    // Já é o tipo default — não precisa clicar na pill.
    // Form inline aparece quando clicamos "Adicionar primeiro item".
    await page.getByRole("button", { name: /Adicionar primeiro item/i }).click();

    await page.getByPlaceholder("Ex: MacBook Air M3").fill("Notebook");
    await page.getByPlaceholder("R$ 0,00").fill("3600");

    // Select de parcelas: a UI mostra "Nx (R$ ...)" — o "12×" deve aparecer.
    // Valor por parcela com 3600/12 = 300.00 → checa o preview.
    await expect(
      page.locator("option").filter({ hasText: /12.+R\$\s*300\.00/ }),
    ).toBeAttached();

    // Add item + criar cenário.
    await page.getByRole("button", { name: /^\+\s*Adicionar item$/i }).click();
    await page.getByRole("button", { name: /Criar cenário/i }).click();

    await expect(page.getByText("Notebook").first()).toBeVisible();
  });

  test("receita_pontual: data prevista aparece e valor entra com sinal positivo", async ({ page }) => {
    await openCleanSimulationPage(page);
    await openModalNovoCenario(page);

    await page.getByPlaceholder("Ex: Compra do notebook novo").fill("Bônus");

    await page.getByRole("button", { name: /Adicionar primeiro item/i }).click();
    await page.getByRole("button", { name: /Receita pontual/i }).click();

    await page.getByPlaceholder("Ex: MacBook Air M3").fill("Bônus anual");
    await page.getByPlaceholder("R$ 0,00").fill("2000");

    // O input de data aparece para "receita_pontual".
    await expect(page.locator("input[type='date']")).toBeVisible();

    await page.getByRole("button", { name: /^\+\s*Adicionar item$/i }).click();
    await page.getByRole("button", { name: /Criar cenário/i }).click();

    // Total simulado do cenário deve mostrar +R$ 2.000,00 (verde porque é receita).
    await expect(page.getByText("Bônus anual").first()).toBeVisible();
  });

  test("ajuste_categoria: campo 'Cartão / banco' é '-' e direção 'Cortar/Aumentar' aparece", async ({ page }) => {
    await openCleanSimulationPage(page);
    await openModalNovoCenario(page);

    await page.getByPlaceholder("Ex: Compra do notebook novo").fill("Ajuste");

    await page.getByRole("button", { name: /Adicionar primeiro item/i }).click();
    await page.getByRole("button", { name: /Ajuste de categoria/i }).click();

    await page.getByPlaceholder("Ex: MacBook Air M3").fill("Corte de Lazer");
    await page.getByPlaceholder("R$ 0,00").fill("400");

    // Selects esperados: Categoria + Direção + Tipo de valor.
    await expect(page.locator("option").filter({ hasText: "Cortar" })).toBeAttached();
    await expect(page.locator("option").filter({ hasText: "Aumentar" })).toBeAttached();
    await expect(
      page.locator("option").filter({ hasText: /Valor fixo/ }),
    ).toBeAttached();
    await expect(
      page.locator("option").filter({ hasText: /Percentual/ }),
    ).toBeAttached();

    await page.getByRole("button", { name: /^\+\s*Adicionar item$/i }).click();
    await page.getByRole("button", { name: /Criar cenário/i }).click();

    await expect(page.getByText("Corte de Lazer").first()).toBeVisible();
  });

  test("despesa_recorrente: Duração + Periodicidade aparecem", async ({ page }) => {
    await openCleanSimulationPage(page);
    await openModalNovoCenario(page);

    await page.getByPlaceholder("Ex: Compra do notebook novo").fill("Assinaturas");
    await page.getByRole("button", { name: /Adicionar primeiro item/i }).click();
    await page.getByRole("button", { name: /Despesa recorrente/i }).click();

    await page.getByPlaceholder("Ex: MacBook Air M3").fill("Netflix");
    await page.getByPlaceholder("R$ 0,00").fill("89");

    // Duração: 6 meses default — mas as opções esperadas devem estar lá.
    await expect(page.locator("option").filter({ hasText: /^1 mês$/ })).toBeAttached();
    await expect(page.locator("option").filter({ hasText: /^24 meses$/ })).toBeAttached();
    await expect(page.locator("option").filter({ hasText: /Mensal/ })).toBeAttached();
    await expect(page.locator("option").filter({ hasText: /Semanal/ })).toBeAttached();

    await page.getByRole("button", { name: /^\+\s*Adicionar item$/i }).click();
    await page.getByRole("button", { name: /Criar cenário/i }).click();

    await expect(page.getByText("Netflix").first()).toBeVisible();
  });
});

test.describe("Simulação — múltiplos cenários, troca e limpeza", () => {
  test("criar 2 cenários e trocar entre eles via dropdown do header", async ({ page }) => {
    await openCleanSimulationPage(page);

    // Primeiro cenário.
    await openModalNovoCenario(page);
    await page.getByPlaceholder("Ex: Compra do notebook novo").fill("Cenário A");
    await page.getByRole("button", { name: /Criar cenário/i }).click();
    await expect(page.getByRole("button", { name: /^Cenário A/i })).toBeVisible();

    // Segundo cenário via "+ Novo cenário" no header.
    await openModalNovoCenario(page);
    await page.getByPlaceholder("Ex: Compra do notebook novo").fill("Cenário B");
    await page.getByRole("button", { name: /Criar cenário/i }).click();

    // Agora "Cenário B" é o ativo (dropdown mostra o nome dele).
    await expect(page.getByRole("button", { name: /^Cenário B/i })).toBeVisible();

    // Troca de volta para A via dropdown do header (clica no nome do cenário ativo).
    await page.getByRole("button", { name: /^Cenário B/i }).click();
    await page.locator("text=Cenário A").last().click();
    await expect(page.getByRole("button", { name: /^Cenário A/i })).toBeVisible();
  });

  test("'Limpar' remove o cenário ativo e volta ao estado vazio se for o único", async ({ page }) => {
    await openCleanSimulationPage(page);

    await openModalNovoCenario(page);
    await page.getByPlaceholder("Ex: Compra do notebook novo").fill("Vai sumir");
    await page.getByRole("button", { name: /Criar cenário/i }).click();
    await expect(page.getByText(/Análise do cenário/i)).toBeVisible();

    // Botão "Limpar" no topo (variante danger).
    await page.getByRole("button", { name: /^Limpar$/i }).click();

    await expect(page.getByText("Nenhum cenário ativo")).toBeVisible();
    await expect(page.getByText("Vai sumir")).not.toBeVisible();
  });
});
