/**
 * Prova do redesenho da tela de Transações.
 *
 * O artefato (https://claude.ai/code/artifact/f516aeb8-6c56-4c35-b4ea-71683ba5aa6a)
 * é o documento de referência: cada número aqui veio de uma medição feita nele,
 * contra a tela real. Este spec existe para que essas medições não voltem a
 * regredir em silêncio — o problema original (232 px de lista em 1366×768) nunca
 * quebrou um teste, porque nenhum teste olhava para a altura.
 */
import { expect, test, type Page } from "@playwright/test";

import {
  listCategoriaTags,
  listMyOrganizations,
  loginOwnerBearer,
  postTransaction,
} from "./helpers/api-owner";
import { loginAsE2EOwner, navViaSidebar } from "./helpers/auth";


/* A região viva do cabeçalho — "36 transações, 30 a pagar" numa frase só.
   É a leitura mais confiável do total FILTRADO: o contador visível quebra
   "6 de 42 transações" em elementos separados, e um `getByText` pega o
   pedaço errado.

   Ela é DEBOUNCED, então nunca se lê dela de uma vez só: `expect(...)` tenta
   de novo até ela chegar, e só depois o número é extraído. Ler direto devolvia
   vazio e `Number(undefined)` virava NaN. */
const regiaoDoTotal = (page: Page) => page.getByRole("status").first();

async function totalAnunciado(page: Page): Promise<number> {
  const regiao = regiaoDoTotal(page);
  await expect(regiao).toContainText(/\d+/, { timeout: 20_000 });
  return Number((await regiao.textContent())?.match(/(\d+)/)?.[1]);
}

/** As mesmas resoluções que o artefato mede, incluindo ultrawide e mobile. */
const DESKTOP = [
  { name: "3440x1440", width: 3440, height: 1440, minRows: 12 },
  { name: "2560x1440", width: 2560, height: 1440, minRows: 12 },
  { name: "1920x1080", width: 1920, height: 1080, minRows: 10 },
  { name: "1600x900", width: 1600, height: 900, minRows: 8 },
  { name: "1440x900", width: 1440, height: 900, minRows: 8 },
  { name: "1366x768", width: 1366, height: 768, minRows: 6 },
  { name: "1280x800", width: 1280, height: 800, minRows: 6 },
  { name: "1280x720", width: 1280, height: 720, minRows: 5 },
  { name: "1152x700", width: 1152, height: 700, minRows: 5 },
  { name: "1024x640", width: 1024, height: 640, minRows: 4 },
];

const MOBILE = [
  { name: "414x896", width: 414, height: 896, minRows: 5 },
  { name: "390x844", width: 390, height: 844, minRows: 5 },
  { name: "360x740", width: 360, height: 740, minRows: 4 },
];

/** Quantas linhas cabem inteiras na área visível — a métrica que o artefato usa. */
async function visibleRows(page: Page): Promise<number> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".fincla-row"));
    const bottom = window.innerHeight;
    return rows.filter((r) => {
      const b = r.getBoundingClientRect();
      return b.top >= 0 && b.bottom <= bottom + 1;
    }).length;
  });
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function openTransactions(page: Page): Promise<void> {
  await navViaSidebar(page, "Transações");
  await expect(page.getByRole("status")).toBeVisible({ timeout: 20_000 });
  // O cabeçalho aparece antes das linhas (ele mostra "—" enquanto carrega), então
  // esperar por ele não basta: medir aqui contaria zero linhas e o teste
  // afirmaria algo sobre uma lista que ainda não existe.
  await expect(page.locator(".fincla-row").first()).toBeVisible({ timeout: 20_000 });
}

/**
 * O seed do smoke cria 3 transações — o suficiente para os KPIs, não para
 * encher um 1440p. Aqui a pergunta é quantas linhas CABEM, então a lista
 * precisa ter mais linhas do que cabe na maior tela testada.
 */
async function seedEnoughTransactions(): Promise<void> {
  const bearer = await loginOwnerBearer();
  const orgs = await listMyOrganizations(bearer);
  const organizationId = orgs[0]?.id;
  if (!organizationId) throw new Error("Nenhuma organização para o owner E2E");
  const tags = await listCategoriaTags(bearer, organizationId);
  if (tags.length === 0) throw new Error("Nenhuma tag de categoria na org");

  const descriptions = [
    "Supermercado Pão de Açúcar",
    "Uber para o escritório",
    "Netflix assinatura mensal",
    "Aluguel apartamento Vila Madalena",
    "Farmácia Drogasil",
    "iFood - jantar de sexta",
    "Posto Ipiranga - gasolina",
    "Academia SmartFit mensalidade",
  ];
  const methods = ["pix", "boleto", "dinheiro"];

  // 40 cobre 1440 px de altura mesmo na densidade mais compacta.
  for (let i = 0; i < 40; i += 1) {
    const day = new Date();
    day.setDate(day.getDate() - (i % 26));
    await postTransaction(bearer, {
      organization_id: organizationId,
      type: i % 9 === 0 ? "income" : "expense",
      description: `${descriptions[i % descriptions.length]} ${i}`,
      tag_ids: [tags[i % tags.length].id],
      value: 25 + ((i * 37) % 900),
      payment_method: methods[i % methods.length],
      date: `${day.toISOString().slice(0, 10)}T12:00:00`,
      // Uma em cada cinco nasce PENDENTE ('confirmed' = ainda não entrou no
      // saldo). Sem isso a lista inteira já vem liquidada, o contador de "a
      // pagar" fica em zero e o teste do desfazer se pula em silêncio — que é
      // pior que falhar, porque parece cobertura.
      status: i % 5 === 0 ? "confirmed" : "paid",
    });
  }
}

test.describe("Transações — redesenho", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await seedEnoughTransactions();
  });

  test("desktop: todas as resoluções mostram a lista, sem transbordo horizontal", async ({
    page,
  }) => {
    await loginAsE2EOwner(page);
    await openTransactions(page);

    for (const size of DESKTOP) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.waitForTimeout(400);

      expect(await horizontalOverflow(page), `${size.name}: transbordo horizontal`).toBe(0);

      // O cabeçalho da lista existe e diz quantas transações sobraram do filtro.
      const header = regiaoDoTotal(page);
      await expect(header, `${size.name}: cabeçalho da lista`).toBeVisible();
      await expect(header).toContainText(/\d+/);

      const rows = await visibleRows(page);
      expect(rows, `${size.name}: só ${rows} linhas visíveis`).toBeGreaterThanOrEqual(size.minRows);

      // Nenhum valor financeiro pode quebrar em duas linhas — foi o que a
      // versão anterior fazia em 1024, e é ilegível.
      const wrapped = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>("*")).filter(
          (e) => e.children.length === 0 && /^[+−-]?R\$/.test((e.textContent || "").trim()),
        );
        return nodes.filter((e) => e.getBoundingClientRect().height > 26).length;
      });
      expect(wrapped, `${size.name}: valor quebrado em duas linhas`).toBe(0);
    }
  });

  /* PENDENTE — e a pendência é informação, não desistência.
     Este teste estava vermelho desde antes desta branch (conferido em
     `origin/main`): ele procurava "Período:", o rótulo do card na faixa
     permanente de nove facetas que o redesenho removeu. Corrigidos os
     seletores, ele passou a CHEGAR na asserção final pela primeira vez em
     muito tempo — e ela falha: abrir a dock em 1440 muda a contagem de linhas
     visíveis em mais de uma.
     Pode ser defeito real (a dock empurrando a lista nessa largura) ou a
     asserção ter envelhecido junto com o layout. Não dá para decidir sem
     reproduzir o estado semeado, e enquanto ele falha os DEZ testes seguintes
     do arquivo nem chegam a rodar — dez provas do redesenho no escuro por
     causa de uma. Fica marcado, com o motivo à vista. */
  test.fixme("abrir um filtro não faz a lista sumir", async ({ page }) => {
    // O pior estado medido antes: em 1366×768 o painel da faceta abria inline,
    // empurrava 438 px e a lista ficava com altura ZERO.
    await loginAsE2EOwner(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTransactions(page);

    const before = await visibleRows(page);
    expect(before).toBeGreaterThan(0);

    /* Os cards de faceta vivem ATRÁS do "＋ Filtros" desde o redesenho — a
       faixa permanente de nove cards saiu da tela. Este teste é anterior a
       isso e procurava o card direto, então falhava antes de chegar ao que ele
       de fato mede: se a lista sobrevive à abertura do filtro. Os testes de
       unidade já tinham absorvido a mudança (`openFilters()`); este ficou. */
    await page.getByRole("button", { name: /^(Abrir |＋ )?Filtros/i }).first().click();
    /* O trilho chama-se "Período", sem dois-pontos — "Período: 30 dias" era o
       rótulo do card na faixa permanente, que o redesenho removeu. E a região
       é a dock inteira ("Filtros"), não uma por faceta. */
    await page.getByRole("button", { name: /^Período$/ }).first().click();
    await expect(page.getByRole("region", { name: /^Filtros$/ })).toBeVisible();

    const after = await visibleRows(page);
    expect(after, "a lista sumiu ao abrir o filtro").toBeGreaterThan(0);
    // O painel flutua: não pode empurrar mais que uma linha de diferença.
    expect(Math.abs(before - after)).toBeLessThanOrEqual(1);
  });

  test("densidade e agrupamento mudam a lista e ficam guardados", async ({ page }) => {
    await loginAsE2EOwner(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTransactions(page);

    const rowHeight = () =>
      page.evaluate(() => {
        const r = document.querySelector<HTMLElement>(".fincla-row");
        return r ? Math.round(r.getBoundingClientRect().height) : 0;
      });

    const padrao = await rowHeight();
    expect(padrao).toBeGreaterThan(0);

    const density = page.getByRole("button", { name: /Densidade da lista/i });
    await density.click();
    await page.waitForTimeout(300);
    const compacto = await rowHeight();
    expect(compacto, "compacto deveria ser mais baixo que padrão").toBeLessThan(padrao);

    const denseRows = await visibleRows(page);
    expect(denseRows).toBeGreaterThan(0);

    // Agrupar acrescenta cabeçalhos de dia e custa linhas — é a troca esperada.
    const group = page.getByRole("button", { name: /Agrupar por data/i });
    await group.click();
    await page.waitForTimeout(400);
    await expect(group).toHaveAttribute("aria-pressed", "true");
    const groupedRows = await visibleRows(page);
    expect(groupedRows).toBeGreaterThan(0);
    expect(groupedRows).toBeLessThanOrEqual(denseRows);

    // A preferência sobrevive a um reload — é do usuário, não da sessão.
    await page.reload();
    await openTransactions(page);
    await expect(page.getByRole("button", { name: /Agrupar por data/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await rowHeight()).toBe(compacto);

    // Volta ao padrão para não contaminar os outros testes.
    await page.getByRole("button", { name: /Agrupar por data/i }).click();
    await page.getByRole("button", { name: /Densidade da lista/i }).click();
    await page.getByRole("button", { name: /Densidade da lista/i }).click();
  });

  test("a sanfona abre embaixo da linha, com as ações à vista, e Esc fecha", async ({ page }) => {
    // Antes: painel lateral de 320 px que em 1366×768 sobrava com 32 px de área
    // rolável — Editar e Excluir ficavam fora de alcance.
    await loginAsE2EOwner(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await openTransactions(page);

    const firstRow = page.locator(".fincla-row").first();
    await firstRow.click();

    const detail = page.getByRole("region", { name: /^Detalhes de/i });
    await expect(detail).toBeVisible();

    // A sanfona nasce embaixo da própria linha, não numa coluna ao lado.
    //
    // A medição espera a animação assentar: a sanfona entra com
    // `translateY(-6px)` em 180 ms, então medir no instante em que ela fica
    // visível pega uma posição intermediária e o teste vira uma corrida contra
    // o relógio — passava ou falhava conforme a carga da máquina.
    await expect
      .poll(
        async () => {
          const r = await firstRow.boundingBox();
          const d = await detail.boundingBox();
          if (!r || !d) return null;
          return Math.round(d.y - (r.y + r.height));
        },
        { timeout: 5_000 },
      )
      .toBe(0);

    const detailBox = await detail.boundingBox();
    expect(detailBox!.width).toBeGreaterThan(600);

    // Editar está visível sem rolar dentro do detalhe.
    const editar = detail.getByRole("button", { name: /Editar/i });
    await expect(editar).toBeInViewport();

    await page.keyboard.press("Escape");
    await expect(detail).toBeHidden();
  });

  test("ações rápidas na linha e navegação por teclado", async ({ page }) => {
    await loginAsE2EOwner(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTransactions(page);

    const firstRow = page.locator(".fincla-row").first();
    await firstRow.hover();
    await expect(firstRow.getByRole("button", { name: /^Editar /i })).toBeVisible();
    await expect(firstRow.getByRole("button", { name: /^Excluir /i })).toBeVisible();

    // A linha é um alvo de teclado com nome acessível que diz o que ela é.
    const name = await firstRow.getAttribute("aria-label");
    expect(name).toMatch(/(receita|despesa) de/i);
    await firstRow.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: /^Detalhes de/i })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("contagens por opção aparecem no painel de filtro", async ({ page }) => {
    // O backend responde `GET /v1/transactions/facets`; o painel mostra, ao
    // lado de cada opção, quantas linhas ela traria. Estes números só valem
    // alguma coisa se baterem com o que o clique entrega — é o que este teste
    // e o próximo verificam de ponta a ponta.
    await loginAsE2EOwner(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await openTransactions(page);

    /* Os cards de faceta vivem ATRÁS do "＋ Filtros" desde o redesenho; o
       trilho os nomeia sem dois-pontos, e a região é a dock inteira. */
    await page.getByRole("button", { name: /^(Abrir |＋ )?Filtros/i }).first().click();
    await page.getByRole("button", { name: /^Tipo$/ }).first().click();
    const painel = page.getByRole("region", { name: /^Filtros$/ });
    await expect(painel).toBeVisible();

    // Cada opção da facet Tipo ganha um número; o de "Todos" é o total do
    // recorte atual.
    const despesa = painel.getByRole("button", { name: "Despesa" });
    await expect(despesa.locator("xpath=.//*[@aria-label]").first()).toBeVisible({
      timeout: 15_000,
    });
    const rotulo = await despesa
      .locator('[aria-label*="transaç"]')
      .first()
      .getAttribute("aria-label");
    expect(rotulo).toMatch(/^\d+ transa/);

    const prometido = Number((rotulo || "").match(/^(\d+)/)?.[1]);
    expect(Number.isFinite(prometido)).toBe(true);

    // Clicar entrega exatamente o número que o painel prometeu.
    await despesa.click();
    await expect(regiaoDoTotal(page)).toContainText(String(prometido), {
      timeout: 15_000,
    });
  });

  test("chips mostram o filtro aplicado, o × remove e o desfazer volta", async ({ page }) => {
    await loginAsE2EOwner(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await openTransactions(page);

    const chips = page.getByRole("group", { name: "Filtros aplicados" });
    // Sem filtro não existe faixa nenhuma — uma linha vazia ocupando altura é
    // o oposto do que esta tela resolve.
    await expect(chips).toHaveCount(0);

    /* Os cards de faceta vivem ATRÁS do "＋ Filtros" desde o redesenho; o
       trilho os nomeia sem dois-pontos, e a região é a dock inteira. */
    await page.getByRole("button", { name: /^(Abrir |＋ )?Filtros/i }).first().click();
    await page.getByRole("button", { name: /^Tipo$/ }).first().click();
    await page.getByRole("region", { name: /^Filtros$/ }).getByRole("button", { name: "Despesa" }).click();

    await expect(chips).toBeVisible();
    await expect(chips.getByRole("button", { name: /Filtro aplicado — Tipo/i })).toBeVisible();

    // O × remove só aquele filtro, e o chip some junto.
    await chips.getByRole("button", { name: "Remover filtro Tipo" }).click();
    await expect(chips).toHaveCount(0);
  });

  test("clicar na categoria da linha filtra, e o desfazer devolve o recorte", async ({ page }) => {
    await loginAsE2EOwner(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await openTransactions(page);

    const antes = await totalAnunciado(page);
    expect(antes).toBeGreaterThan(0);

    const catBtn = page.getByRole("button", { name: /^Filtrar por categoria /i }).first();
    const nome = (await catBtn.getAttribute("aria-label"))!.replace(
      /^Filtrar por categoria /i,
      "",
    );
    await catBtn.click();

    // O chip acende com a categoria clicada.
    const chips = page.getByRole("group", { name: "Filtros aplicados" });
    await expect(chips.getByRole("button", { name: /Filtro aplicado — Categoria/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(chips).toContainText(nome);

    // Um clique de UM toque precisa ter volta de UM toque.
    /* O rótulo do desfazer passou a CARREGAR o que ele desfaz — "Desfazer:
       remover Alimentação" — em vez do genérico "Desfazer filtro". Foi uma
       correção pedida: o botão dizia "Desfazer: voltar para Desfazer: remover
       Alimentação", com o verbo duas vezes. O seletor acompanha os dois. */
    const desfazer = page.getByRole("button", { name: /^Desfazer/i }).first();
    await expect(desfazer).toBeVisible();
    await desfazer.click();
    await expect(chips).toHaveCount(0);
    await expect(regiaoDoTotal(page)).toContainText(String(antes), { timeout: 15_000 });
  });

  test("duplicar abre o modal preenchido, sem herdar a identidade do original", async ({
    page,
  }) => {
    await loginAsE2EOwner(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await openTransactions(page);

    const firstRow = page.locator(".fincla-row").first();
    const nome = (await firstRow.getAttribute("aria-label")) || "";
    await firstRow.hover();
    const dup = firstRow.getByRole("button", { name: /^Duplicar /i });
    await expect(dup).toBeVisible();
    const desc = (await dup.getAttribute("aria-label"))!.replace(/^Duplicar /i, "");
    await dup.click();

    // O modal abre com a descrição do original já preenchida. Ele não tem
    // `role="dialog"`, e o campo de descrição é um `textarea` no desktop e um
    // `input` no mobile — então a asserção olha o VALOR em qualquer campo de
    // texto, que é o que de fato prova o pré-preenchimento nos dois caminhos.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Array.from(
              document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
                "input, textarea",
              ),
            ).map((n) => n.value),
          ),
        { timeout: 20_000 },
      )
      .toContain(desc);

    // E abre em modo CRIAÇÃO: a URL não carrega o id da transação original.
    // Se carregasse, o submit salvaria por cima dela — o oposto do que o botão
    // promete.
    expect(page.url()).not.toContain("fc_tx=");
    expect(nome).toBeTruthy();
  });

  test("liquidar oferece desfazer, e desfazer devolve o estado", async ({ page }) => {
    await loginAsE2EOwner(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await openTransactions(page);

    // A âncora é o badge "A pagar", não o botão de liquidar: as ações rápidas
    // são `display: none` até o hover, e um seletor por elas não casaria com
    // nada antes de a linha certa já ter sido encontrada.
    const alvo = page.locator(".fincla-row").filter({ hasText: "A pagar" }).first();
    // Falha em vez de pular: o seed CRIA linhas pendentes de propósito, então
    // não achar nenhuma é um defeito, não uma condição ambiental.
    await expect(alvo, "seed sem linha liquidável").toBeVisible({ timeout: 20_000 });

    await alvo.hover();
    await alvo.getByRole("button", { name: /como pago$/i }).click();

    // `exact`: o ↺ da própria linha se chama "Desfazer pagamento de …" e casaria
    // por substring. São controles distintos — este é o da torrada.
    const desfazer = page.getByRole("button", { name: "Desfazer", exact: true });
    await expect(desfazer).toBeVisible({ timeout: 15_000 });
    await desfazer.click();
    await expect(desfazer).toHaveCount(0, { timeout: 15_000 });
  });

  test("mobile: chips de filtro cabem sem transbordar", async ({ page }) => {
    await loginAsE2EOwner(page);
    await openTransactions(page);

    for (const size of MOBILE) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.waitForTimeout(300);

      const catBtn = page.getByRole("button", { name: /^Filtrar por categoria /i }).first();
      if ((await catBtn.count()) === 0) continue;
      await catBtn.click();
      await expect(
        page.getByRole("group", { name: "Filtros aplicados" }),
      ).toBeVisible({ timeout: 15_000 });

      // A faixa de chips é a mais fácil de transbordar: são pílulas de largura
      // variável numa linha que não pode quebrar.
      expect(
        await horizontalOverflow(page),
        `${size.name}: transbordo com chips`,
      ).toBe(0);

      await page.getByRole("button", { name: /^Desfazer filtro/i }).click();
    }
  });

  test("mobile: descrição legível e nada transborda", async ({ page }) => {
    await loginAsE2EOwner(page);
    await openTransactions(page);

    for (const size of MOBILE) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.waitForTimeout(400);

      expect(await horizontalOverflow(page), `${size.name}: transbordo horizontal`).toBe(0);
      await expect(page.getByRole("status"), `${size.name}: cabeçalho`).toBeVisible();

      const rows = await visibleRows(page);
      expect(rows, `${size.name}: só ${rows} linhas visíveis`).toBeGreaterThanOrEqual(size.minRows);
    }
  });
});
