/**
 * A hora da verdade do épico multi-moeda: os dois caminhos, no navegador.
 *
 * Toda a suíte de unidade e de integração prova o cálculo. O que ela NÃO prova é
 * que a pessoa vê a coisa certa — foi exatamente aí que os defeitos apareceram
 * nesta entrega: o backend mandava `null` e a tela desenhava "R$ 0,00", ou a
 * moeda sumia na fronteira e trezentos dólares viravam trezentos reais.
 *
 * Os dois perfis de seed são o MESMO dado com uma diferença só — a cotação do dia
 * existir ou não. É essa diferença que separa o caminho que converte do caminho
 * da ausência. Nenhum dos dois sai para a internet: o com-taxa acha a cotação no
 * cache, e o sem-taxa exige `QUOTATION_ENABLED=false` no backend do e2e.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAsE2EOwner, navViaSidebar } from "./helpers/auth";
import { resetAndSeedOrganization } from "./helpers/test-org";

const e2eReady = Boolean(
  process.env.TEST_RESET_SECRET &&
    process.env.E2E_TEST_OWNER_EMAIL &&
    process.env.E2E_TEST_OWNER_PASSWORD,
);

test.skip(!e2eReady, "Defina TEST_RESET_SECRET, E2E_TEST_OWNER_EMAIL e E2E_TEST_OWNER_PASSWORD.");

/** O saldo grande da tela de Contas — o número que a pessoa lê primeiro. */
function saldoDisponivel(page: Page) {
  return page.getByText("Saldo disponível").locator("xpath=following-sibling::div[1]");
}

test.describe("organização com real e euro, COM cotação do dia", () => {
  test.beforeAll(async () => {
    if (!e2eReady) return;
    await resetAndSeedOrganization("multi_currency_e2e");
  });

  test("Contas mostra o total convertido e a taxa que o produziu", async ({ page }) => {
    await loginAsE2EOwner(page);
    await navViaSidebar(page, "Contas & Saldo");

    // As duas contas existem — sem isso a organização é de moeda única e o teste
    // não estaria exercitando nada.
    await expect(page.getByText("Conta em euro").first()).toBeVisible();

    // O recibo é obrigatório: mostrar o total convertido sem a taxa e a data é
    // dar ao número uma autoridade que ele não tem.
    await expect(page.getByText(/Convertido com/)).toBeVisible();
    await expect(page.getByText(/1 EUR = R\$\s*6,00/)).toBeVisible();

    // E o total existe — não é o travessão do caminho da ausência.
    await expect(saldoDisponivel(page)).not.toHaveText("—");
  });

  test("o histograma de valor separa as moedas em abas", async ({ page }) => {
    await loginAsE2EOwner(page);
    await navViaSidebar(page, "Transações");

    // O painel de filtros começa fechado nesta largura: o chip de Valor só existe
    // depois de abri-lo.
    await page.getByRole("button", { name: /Abrir filtros/i }).click();
    await page.getByRole("button", { name: /^Valor/i }).first().click();

    // A faceta é a única família que NÃO converte: cada barra vale numa moeda, e
    // é por isso que existem abas. Uma organização de moeda única não as mostra.
    await expect(page.getByRole("tab", { name: "BRL" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "EUR" })).toBeVisible();
  });

  test("Relatórios desenha os gráficos, sem o aviso de ausência", async ({ page }) => {
    await loginAsE2EOwner(page);
    await navViaSidebar(page, "Relatórios");

    await expect(page.getByText(/Não foi possível converter/)).toHaveCount(0);
  });
});

test.describe("organização com real e euro, SEM cotação", () => {
  test.beforeAll(async () => {
    if (!e2eReady) return;
    await resetAndSeedOrganization("multi_currency_no_rate_e2e");
  });

  test("Contas mostra travessão e diz que os saldos por conta seguem certos", async ({ page }) => {
    await loginAsE2EOwner(page);
    await navViaSidebar(page, "Contas & Saldo");

    // O defeito que este teste existe para pegar: um "R$ 0,00" aqui afirmaria
    // que a pessoa não tem dinheiro, quando nós é que não conseguimos converter.
    await expect(saldoDisponivel(page)).toHaveText("—");
    await expect(page.getByText(/Não deu para somar as moedas agora/)).toBeVisible();
    await expect(page.getByText(/R\$\s*0,00/)).toHaveCount(0);
  });

  test("Relatórios explica o motivo e mostra a quebra por moeda", async ({ page }) => {
    await loginAsE2EOwner(page);
    await navViaSidebar(page, "Relatórios");

    await expect(page.getByText(/Não foi possível converter para uma moeda só/)).toBeVisible();
    // A quebra é a resposta que existe sem depender de cotação de terceiro.
    await expect(page.getByText("BRL", { exact: true })).toBeVisible();
    await expect(page.getByText("EUR", { exact: true })).toBeVisible();
  });

  test("o resumo de Transações mostra travessão, e a linha em euro diz euro", async ({
    page,
  }) => {
    await loginAsE2EOwner(page);
    await navViaSidebar(page, "Transações");

    await expect(page.getByText(/E2E gasto em euro/).first()).toBeVisible({ timeout: 30_000 });

    /* Dois defeitos que só apareceram aqui, e nenhum teste de unidade podia ver:
       ambos são sobre o que está ESCRITO na tela, não sobre o número.

       1) Os KPIs somavam `null` e mostravam "R$ 0,00" para quem acabou de gastar.
       2) A linha de 100 EUR era desenhada "R$ 100,00" — número certo, unidade
          errada, que é pior que número faltando porque parece conferível. */
    await expect(
      page.getByRole("button", { name: /E2E gasto em euro.*€\s*100,00/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /E2E gasto em euro.*R\$\s*100,00/ }),
    ).toHaveCount(0);

    // E a linha em real continua em real.
    await expect(
      page.getByRole("button", { name: /E2E gasto em real.*R\$\s*100,00/ }).first(),
    ).toBeVisible();
  });

  /* A tela de Simulação fica de fora deste e2e, e o motivo não é moeda: ela é
     gated por `what_if_simulations`, e o usuário de e2e não tem o plano — a spec
     de simulação que já existe MOCKA a resposta por isso. Um e2e que mocasse a
     resposta do backend não provaria nada sobre a conversão, que é o que está em
     jogo aqui.

     O caminho está coberto duas vezes, e as duas verificadas por mutação:
     `test_simulation_currency_api.py` prova que o endpoint devolve valores nulos
     e veredito `unknown` sem cotação, e `SimulacaoPage.absence.rtl.test.jsx`
     prova que a tela avisa e para de recomendar. */
});
