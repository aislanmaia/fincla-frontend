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
      const header = page.getByRole("status");
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

  test("abrir um filtro não faz a lista sumir", async ({ page }) => {
    // O pior estado medido antes: em 1366×768 o painel da faceta abria inline,
    // empurrava 438 px e a lista ficava com altura ZERO.
    await loginAsE2EOwner(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openTransactions(page);

    const before = await visibleRows(page);
    expect(before).toBeGreaterThan(0);

    await page.getByRole("button", { name: /Período:/i }).first().click();
    await expect(page.getByRole("region", { name: /Filtro: periodo/i })).toBeVisible();

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
    const rowBox = await firstRow.boundingBox();
    const detailBox = await detail.boundingBox();
    expect(rowBox && detailBox).toBeTruthy();
    expect(detailBox!.y).toBeGreaterThanOrEqual(rowBox!.y + rowBox!.height - 2);
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
