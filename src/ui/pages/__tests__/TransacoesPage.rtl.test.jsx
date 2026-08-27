/** @vitest-environment jsdom */
/* Sem `{ timeout: N }` por describe: o teto agora é UM só, em `vite.config.ts`
   (45 s), com o porquê escrito lá. Os overrides locais nasceram do mesmo aperto
   — o orçamento cobre o `render`, e um `render` destes custa segundos quando a
   suíte divide o pool —, mas espalhados por arquivo viravam o contrário do que
   prometiam: passaram a REBAIXAR o teto global. */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mocks: router (TransacoesPage usa useSearch + useNavigate) ─────────────────
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  /* A página observa o CAMINHO para saber que o modal de edição fechou — o
     modal é uma rota (`/transactions/{-$transactionId}`), e essa é a única
     pista que a página tem. */
  useRouterState: (opts) =>
    typeof opts?.select === "function"
      ? opts.select({ location: { pathname: "/transactions" } })
      : { location: { pathname: "/transactions" } },
}));

// Mocks: hooks de dados ─────────────────────────────────────────────────────
const transactionsDataMock = vi.fn(() => ({
  isLoading: false,
  error: "",
  summary: { total_income: 1000, total_expenses: 300, total_refunds: 0, balance: 700 },
  transactions: [
    {
      id: "tx-1",
      date: "21/05",
      desc: "Almoço",
      cat: "Alimentação",
      val: -42.5,
      method: "Pix",
      type: "expense",
      icon: "🍽",
      status: "confirmado",
      rec: false,
      tags: ["trabalho"],
    },
    {
      id: "tx-2",
      date: "22/05",
      desc: "Salário",
      cat: "Receita",
      val: 5000,
      method: "Transferência",
      type: "income",
      icon: "💸",
      status: "confirmado",
      rec: true,
      tags: [],
    },
    {
      id: "tx-3",
      date: "23/05",
      desc: "Notebook",
      cat: "Compras",
      val: -4299,
      method: "Cartão de crédito",
      paymentMethodKey: "credito",
      type: "expense",
      icon: "💳",
      status: "confirmado",
      rec: false,
      tags: [],
      parcela: {
        atual: 2,
        total: 12,
        valParcela: 358.25,
        cartao: "Nubank •• 1177",
        vencimento: "10/06/2026",
      },
    },
  ],
  total: 3,
  hasMore: false,
  removeTransaction: vi.fn(),
}));
vi.mock("../../features/transactions/useTransactionsData.js", () => ({
  useTransactionsData: (...args) => transactionsDataMock(...args),
}));

const categoryTagsDataMock = vi.fn(() => ({
  isLoading: false,
  categories: [
    { id: "cat-alim", labelPt: "Alimentação", color: "#059669" },
    { id: "cat-trans", labelPt: "Transporte", color: "#2563EB" },
  ],
}));
vi.mock("../../features/tags/useCategoryTagsData.js", () => ({
  useCategoryTagsData: (...args) => categoryTagsDataMock(...args),
}));

// fincla-frontend#78/#96 — catálogo de tags que TransacoesPage usa para
// resolver o RÓTULO que a facet Tags guarda em um `tag_id` de verdade (o
// backend só filtra por id, nunca por nome). Sem mockar, o hook dispara um
// fetch real (`GET /tags`) em todo teste que renderiza a página em modo live.
const tagCatalogMock = vi.fn(() => ({
  rows: [
    { id: "tag-uuid-trabalho", name: "trabalho", parent_category_tag_id: "cat-trans" },
    { id: "tag-uuid-casa", name: "casa", parent_category_tag_id: "cat-alim" },
  ],
  loading: false,
  error: "",
}));
vi.mock("../../features/transactions/filters/useTransactionsTagCatalog.js", () => ({
  useTransactionsTagCatalog: (...args) => tagCatalogMock(...args),
}));

const listOrgBalanceAdjustmentsMock = vi.fn().mockResolvedValue([]);
vi.mock("../../../api/balanceAdjustments", () => ({
  listOrgBalanceAdjustments: (...args) => listOrgBalanceAdjustmentsMock(...args),
}));

const listAccountsMock = vi.fn().mockResolvedValue([]);
vi.mock("../../../api/accounts", () => ({
  listAccounts: (...args) => listAccountsMock(...args),
}));

import { TransacoesPage } from "../TransacoesPage.jsx";

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1440,
  });
  // A barra completa passou a depender também da ALTURA: o jsdom nasce com
  // innerHeight 768, que hoje cai no modo compacto (é a tela que motivou a
  // mudança). Os testes que exercitam a barra completa precisam declarar as
  // duas dimensões.
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: 900,
  });
  window.dispatchEvent(new Event("resize"));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

function renderPage(overrides = {}) {
  return render(
    <TransacoesPage
      onNav={vi.fn()}
      onNewTx={vi.fn()}
      onEditTx={vi.fn()}
      isMobile={false}
      dataMode="live"
      organizationId="org-test"
      transactionsRefreshToken={0}
      onTransactionsInvalidate={vi.fn()}
      {...overrides}
    />,
  );
}

/**
 * Abre o painel de filtros.
 *
 * A faixa permanente de nove cards de faceta saiu da tela: o artefato a
 * substitui por uma linha de busca + chips + "+ Filtros", e os cards agora
 * vivem atrás desse botão em TODAS as larguras. Os testes escritos quando a
 * faixa era permanente continuam válidos — só precisam abrir o painel antes de
 * procurar um card, que é o que uma pessoa faz agora.
 */
/**
 * Abre a superfície de filtros, seja qual for.
 *
 * No desktop o mesmo botão alterna entre "Abrir filtros" e "Fechar filtros" —
 * o rótulo diz o que o clique FAZ, não em que estado se está. No mobile ele
 * mantém o nome "Filtros" e sinaliza por `aria-expanded`, porque com o sheet
 * aberto ele fica atrás do backdrop. Então
 * procurar só pelo primeiro rótulo dava um no-op silencioso quando o painel já
 * estava aberto — e o teste seguia procurando conteúdo que nunca abriu.
 */
/**
 * Abre o painel de uma faceta pelo NOME.
 *
 * O painel ancorado substituiu os cards de faceta por um trilho: onde havia um
 * botão "Tipo: Todos" — rótulo mais valor no mesmo alvo — há agora um item
 * "Tipo" no trilho e o valor dentro do painel. Os testes que procuravam o
 * formato antigo por regex não achavam nada e falhavam em bloco.
 */
async function abrirFaceta(nome) {
  await openFilters();
  // Duas formas, uma por superfície: no trilho o ícone vem colado ao nome
  // (`⇅Tipo`), e no card antigo o nome vem seguido do valor (`Tipo: Todos`).
  const noTrilho = new RegExp(`${nome}\\s*$`, "i");
  const noCard = new RegExp(`^\\s*${nome}\\s*:`, "i");
  const alvo = screen
    .queryAllByRole("button")
    .find((b) => noTrilho.test(b.textContent || "") || noCard.test(b.textContent || ""));
  if (alvo) await userEvent.click(alvo);
  return alvo;
}

/**
 * A região onde o painel da faceta aberta vive.
 *
 * A barra antiga rotulava uma region POR faceta ("Filtro: tag"); o painel
 * ancorado tem uma só ("Filtros"), porque o trilho já diz qual está aberta.
 * Os testes usam isto só para escopar as buscas, então aceitar as duas mantém
 * o que eles protegem sem depender da superfície.
 */
/**
 * Afirma que a faceta está aplicada com aquele valor, na superfície que existir.
 *
 * O card antigo carregava rótulo e valor no mesmo botão ("Tipo: Despesa"). No
 * desenho novo o trilho mostra só o nome e o VALOR aparece como chip do que
 * está filtrando. É o mesmo fato observável — "o filtro pegou" — e é isso que
 * estes testes protegem.
 */
function esperaFacetaAplicada(nome, valor) {
  const card = screen.queryByRole("button", { name: new RegExp(`${nome}:\\s*${valor}`, "i") });
  if (card) return card;
  const chips = screen.queryByRole("group", { name: /Filtros aplicados/i });
  if (chips) {
    const achado = within(chips).queryByText(new RegExp(valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    if (achado) return achado;
  }
  return screen.getByText(new RegExp(valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
}

/**
 * A superfície de filtros, seja qual for: a barra antiga se anunciava como
 * `toolbar`, o painel ancorado como `region`. Os testes só querem afirmar que
 * ela existe.
 */
function superficieDeFiltros() {
  return (
    screen.queryByRole("toolbar", { name: /Filtros de transações/i }) ||
    screen.getByRole("region", { name: /^Filtros$/i })
  );
}

/** Limpar tudo: "Limpar todos os filtros" na barra antiga, "Limpar tudo" no painel. */
/**
 * Abre o menu do chip de visualizações.
 *
 * "＋ Salvar atual" e "Atualizar esta" existem com o mesmo rótulo de sempre —
 * o que mudou foi o LUGAR: saíram da faixa e entraram no menu do chip, que
 * precisa ser aberto antes de eles existirem no documento.
 */
async function abrirMenuDeViews() {
  // Pelo `aria-haspopup`, não pelo nome: "Visualização" aparece também no
  // rótulo do botão de EXCLUIR cada view, e pegar o primeiro por nome caía
  // nele em vez de no chip.
  const chip = screen
    .queryAllByRole("button")
    .find((b) => b.getAttribute("aria-haspopup") === "menu");
  if (chip && chip.getAttribute("aria-expanded") !== "true") await userEvent.click(chip);
  return chip;
}

/**
 * Aplica um filtro de tipo e salva o recorte como uma view nova.
 *
 * São dois botões DIFERENTES no caminho: "＋ Salvar atual", que abre o
 * formulário de dentro do menu do chip, e "Salvar como nova visualização",
 * que confirma. Trocar um pelo outro apaga metade do fluxo.
 */
async function salvarViewDoTipo(tipo, nome) {
  await abrirFaceta("Tipo");
  await userEvent.click(screen.getByRole("button", { name: tipo }));
  await abrirMenuDeViews();
  await userEvent.click(screen.getByRole("button", { name: /^\+ Salvar atual$/ }));
  await userEvent.type(screen.getByLabelText(/Nome da visualização/i), nome);
  await userEvent.click(screen.getByRole("button", { name: /Salvar como nova visualização/i }));
  await abrirMenuDeViews();
  return screen.getByRole("menuitemradio", { name: new RegExp(`^${nome}\\b`) });
}

async function limparTudo() {
  const btn =
    screen.queryByRole("button", { name: /Limpar todos os filtros/i }) ||
    screen.queryAllByRole("button", { name: /^Limpar tudo$/i })[0];
  if (btn) await userEvent.click(btn);
  return btn;
}

function painelDaFaceta(nome) {
  const porFaceta = screen.queryByRole("region", { name: new RegExp(`Filtro: ${nome}`, "i") });
  return porFaceta || screen.getByRole("region", { name: /^Filtros$/i });
}

async function openFilters() {
  // Desktop: "Abrir filtros" / "Fechar filtros". Mobile: "Filtros" + a contagem
  // — lá o estado vai no `aria-expanded`, porque o botão fica atrás do backdrop.
  const btn = screen.queryAllByRole("button", { name: /^(Abrir |Fechar )?Filtros/i })[0];
  if (btn && btn.getAttribute("aria-expanded") !== "true") await userEvent.click(btn);
}

describe("<TransacoesPage> — integração da Variação C", () => {
  it("as ações rápidas ficam ANTES do valor na ordem do DOM", async () => {
    // O valor é o que fecha a linha lendo da esquerda para a direita. Antes as
    // ações vinham depois dele, deixando o valor no meio de quatro botões.
    //
    // Testar a ORDEM e não a posição em px é o que faz o teste valer em jsdom:
    // as ações são absolutas, ancoradas ao `right: 100%` da célula do valor —
    // logo elas moram DENTRO dessa célula, e é essa contenção que garante que
    // aparecer no hover não desloca o valor. Se alguém as devolver para uma
    // coluna própria, esta asserção cai.
    renderPage();
    const acao = (await screen.findAllByRole("button", { name: /^Editar / }))[0];
    const celula = acao.closest("div[style]");
    expect(celula).not.toBeNull();
    expect(celula.textContent).toMatch(/R\$/);
  });

  it("o rótulo da ação só existe quando há vão para ele crescer", async () => {
    // O rótulo abre para a ESQUERDA, para dentro do vão. Abaixo de 1200 px não
    // há para onde crescer e ele invadiria a descrição — ali o botão volta a ser
    // só o ícone. O `aria-label` continua completo nos dois casos: quem usa
    // leitor de tela precisa saber QUAL linha vai excluir, com vão ou sem.
    window.innerWidth = 1000;
    window.dispatchEvent(new Event("resize"));
    renderPage();
    const estreito = (await screen.findAllByRole("button", { name: /^Excluir / }))[0];
    expect(estreito.className).toContain("fincla-qa-mute");
    expect(estreito.getAttribute("aria-label")).toMatch(/^Excluir .+/);

    cleanup();
    window.innerWidth = 1500;
    window.dispatchEvent(new Event("resize"));
    renderPage();
    const largo = (await screen.findAllByRole("button", { name: /^Excluir / }))[0];
    expect(largo.className).not.toContain("fincla-qa-mute");
    expect(largo).toHaveTextContent("Excluir");
  });

  it("Enter numa ação rápida executa a ação, não abre a sanfona", async () => {
    // Os botões de ação são descendentes da linha `role="button"`: sem guarda de
    // alvo no keydown, o preventDefault da linha cancelava o clique sintetizado
    // e toda ação rápida ficava inalcançável por teclado.
    const onNewTx = vi.fn();
    renderPage({ onEditTx: onNewTx });
    await openFilters();
    const editar = (await screen.findAllByRole("button", { name: /^Editar / }))[0];
    editar.focus();
    await userEvent.keyboard("{Enter}");
    expect(onNewTx).toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: /^Detalhes de/i })).toBeNull();
  });

  it("a linha é operável por teclado e Esc fecha a sanfona", async () => {
    // A linha era um `div` com onClick: invisível para teclado e para leitor de
    // tela, e quem abrisse o detalhe não tinha como sair sem tabular por ele.
    renderPage();
    await openFilters();
    const row = (await screen.findAllByRole("button", { name: /despesa de|receita de/i }))[0];
    expect(row).toHaveAttribute("tabIndex", "0");
    expect(row).toHaveAttribute("aria-expanded", "false");

    row.focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("region", { name: /^Detalhes de/i })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: /^Detalhes de/i })).toBeNull();
  });

  /* Os três controles da barra existem em TODA largura de desktop, e nesta
     ordem. Eles só eram montados no desktop largo, e o gate para "largo" é
     `largura < 1280 OU altura < 820` — num laptop 1366×768 é a ALTURA que
     dispara, com largura de sobra. Sumiam por um motivo que não tem nada a ver
     com caberem, e sumiam sem saída: não há menu de estouro nem `⋯` para onde
     tivessem ido. Nenhum teste olhava para isso, então ninguém reclamou. */
  it("densidade, agrupar e recarregar existem no desktop compacto, nessa ordem", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1366 });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 768 });
    window.dispatchEvent(new Event("resize"));
    renderPage();

    const densidade = await screen.findByRole("button", { name: /Densidade da lista/i });
    const agrupar = screen.getByRole("button", { name: /^Agrupar por data$/i });
    const recarregar = screen.getByRole("button", { name: /^Recarregar a lista$/i });
    const ajuda = screen.getByRole("button", { name: /Atalhos de teclado/i });

    // Ordem do DOM: recarregar DEPOIS do par densidade+agrupar, colado na
    // ajuda. Entre os dois ele quebrava o par e lia como um terceiro ajuste de
    // exibição, que não é o que ele faz.
    const pos = (a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(pos(densidade, agrupar)).toBeTruthy();
    expect(pos(agrupar, recarregar)).toBeTruthy();
    expect(pos(recarregar, ajuda)).toBeTruthy();
  });

  it("a densidade alterna e fica guardada", async () => {
    renderPage();
    await openFilters();
    const btn = await screen.findByRole("button", { name: /Densidade da lista/i });
    expect(btn).toHaveAccessibleName(/Padrão/i);
    await userEvent.click(btn);
    expect(btn).toHaveAccessibleName(/Compacto/i);
    expect(JSON.parse(localStorage.getItem("fincla:transactions:list-prefs")).density).toBe(
      "compacto",
    );
  });

  it("agrupar por data desliga quando a ordenação não é por data", async () => {
    // Ordenado por valor, cada "grupo" viraria um item só — o pior dos dois
    // mundos. O botão fica desabilitado e diz por quê.
    renderPage();
    await openFilters();
    const group = await screen.findByRole("button", { name: /Agrupar por data/i });
    expect(group).toBeEnabled();
    expect(group).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(group);
    expect(group).toHaveAttribute("aria-pressed", "true");
  });

  it("1366x768 recebe a barra compacta, não a completa", async () => {
    // O corte era só de largura, e isso invertia o resultado: 1366×768 passava
    // do corte e recebia a barra completa (230 px, 2 transações visíveis),
    // enquanto 1152×700 — mais estreita E mais baixa — recebia a compacta e
    // mostrava 3. A altura é a restrição real num laptop.
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1366 });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 768 });
    renderPage();
    // SEM abrir: o que a regra de altura protege é o estado de REPOUSO. A
    // 768 px de altura a barra completa custaria 230 px e sobrariam duas
    // transações, então ela nasce recolhida atrás do botão.
    expect(await screen.findByRole("button", { name: /(Abrir|Fechar) filtros/i })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: /Filtros de transações/i })).toBeNull();
    expect(screen.queryByRole("region", { name: /^Filtros$/i })).toBeNull();
  });

  it("1366x900 mantém a barra completa (só a altura mudou)", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1366 });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
    renderPage();
    await openFilters();
    expect(
      await superficieDeFiltros(),
    ).toBeInTheDocument();
  });

  it("monta a página com TransactionsFilterBar (desktop)", async () => {
    renderPage();
    await openFilters();
    expect(screen.getByText("Transações")).toBeInTheDocument();
    expect(screen.getByLabelText(/Buscar transações/i)).toBeInTheDocument();
    // O chip de visualizações é PERMANENTE na barra de comando: uma view salva
    // é um atalho, e escondê-la até haver filtro esconde exatamente de quem
    // já tem views. O que muda sem nenhuma salva é o conteúdo do chip, que
    // passa a oferecer criar a primeira.
    expect(screen.getByRole("button", { name: /Visualizações/i })).toBeInTheDocument();
    expect(superficieDeFiltros()).toBeInTheDocument();
  });

  it("o chip de visualizações é permanente; a oferta de salvar é que depende de filtro", async () => {
    renderPage();
    await openFilters();

    // O CHIP existe desde sempre — ele é permanente porque uma view salva é um
    // atalho, e esconder o acesso a ela até haver filtro esconde exatamente de
    // quem já tem views. Sem filtro, porém, não há recorte para guardar.
    await abrirMenuDeViews();
    expect(screen.queryByRole("button", { name: /^\+ Salvar atual$/ })).not.toBeInTheDocument();

    // Com filtro aplicado a oferta aparece.
    await abrirFaceta("Tipo");
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    await abrirMenuDeViews();
    expect(screen.getByRole("button", { name: /^\+ Salvar atual$/ })).toBeInTheDocument();
  });

  it("atalho na FacetBar abre o formulário para salvar como nova visualização", async () => {
    renderPage();
    await openFilters();
    await abrirFaceta("Tipo");
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    await abrirMenuDeViews();
    await userEvent.click(screen.getByRole("button", { name: /^\+ Salvar atual$/ }));
    expect(screen.getByText("Nova visualização")).toBeInTheDocument();
  });

  it("exibe visualizações salvas por padrão quando já existem views persistidas", async () => {
    localStorage.setItem(
      "fincla.transactions.savedViews.v1",
      JSON.stringify({
        version: 1,
        orgs: {
          "org-test": [
            {
              id: "v1",
              label: "Minha view",
              icon: "bookmark",
              color: "#2563EB",
              filters: { period: "mes", type: "todos" },
              createdAt: 1,
            },
          ],
        },
      }),
    );
    renderPage();
    await openFilters();
    // O chip anuncia a view ATIVA; a lista de views mora no menu dele, e é lá
    // que "Minha view" existe. Antes elas eram cards soltos na faixa.
    expect(screen.getByRole("button", { name: /Visualiza(ções|ção)/i })).toBeInTheDocument();
    await abrirMenuDeViews();
    expect(screen.getByRole("menuitemradio", { name: /^Minha view\b/ })).toBeInTheDocument();
  });

  it("todas as facetas ficam alcançáveis, e nenhum valor padrão polui a tela", async () => {
    renderPage();
    await openFilters();

    // Todas alcançáveis: o trilho lista as nove.
    for (const nome of [
      "Período", "Tipo", "Categoria", "Tags",
      "Pagamento", "Cartão", "Valor", "Recorrência", "Situação",
    ]) {
      expect(
        screen.queryAllByRole("button").some((b) => new RegExp(`${nome}\\s*$`, "i").test(b.textContent || "")),
      ).toBe(true);
    }

    // E nenhum valor PADRÃO aparece. Os cards antigos ficavam permanentemente
    // abertos anunciando "Todos", "Todas", "—" — o maior bloco da tela e o de
    // menor informação. Só filtro ATIVO vira texto agora, como chip.
    expect(screen.queryByRole("group", { name: /Filtros aplicados/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Todas$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Qualquer$/)).not.toBeInTheDocument();
  });

  it("expande o painel inline da facet Tipo e a seleção atualiza o card e fecha o painel", async () => {
    renderPage();
    await openFilters();
    await abrirFaceta("Tipo");
    expect(painelDaFaceta("tipo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    expect(esperaFacetaAplicada("Tipo", "Despesa")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Filtro: tipo/i })).not.toBeInTheDocument();
  });

  it("ordenação multi-nível é acessível via SortButton da SearchBar", async () => {
    renderPage();
    await openFilters();
    const sortBtn = screen.getByRole("button", { name: /Ordenar transações: Data ↓/i });
    await userEvent.click(sortBtn);
    expect(screen.getByRole("dialog", { name: /Editor de ordenação/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Ordenar por Valor/i }));
    expect(
      screen.getByRole("button", { name: /Ordenar transações: Valor ↓ · Data ↓/i }),
    ).toBeInTheDocument();
  });

  it("Limpar tudo zera os filtros aplicados", async () => {
    renderPage();
    await openFilters();
    await abrirFaceta("Tipo");
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    expect(esperaFacetaAplicada("Tipo", "Despesa")).toBeInTheDocument();
    await limparTudo();
    expect(esperaFacetaAplicada("Tipo", "Todos")).toBeInTheDocument();
  });

  it("renderiza KPIs (Receitas/Despesas/Resultado) a partir do summary", async () => {
    renderPage();
    await openFilters();
    expect(screen.getByText("Receitas")).toBeInTheDocument();
    expect(screen.getByText("Despesas")).toBeInTheDocument();
    // Era "Saldo"; renomeado na S2 porque colidia com o saldo da conta.
    expect(screen.getByText("Resultado")).toBeInTheDocument();
  });

  // Também é o teste de regressão do modo live: a API já aplicou período, tipo,
  // categorias etc. Quando a página passou a refiltrar tudo no cliente, o
  // `periodFilter` descartava a lista inteira (as linhas de apresentação trazem
  // `date` = "21/05", sem ano) — tela vazia com dados no banco.
  it("renderiza lista de transações vinda do hook mockado", async () => {
    renderPage();
    await openFilters();
    expect(screen.getAllByText("Almoço").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Salário").length).toBeGreaterThan(0);
  });

  it("mostra crédito inline com cartão quando paymentMethodKey indica crédito", async () => {
    renderPage();
    await openFilters();
    // "Crédito" e os 4 dígitos são UM texto só na linha ("Crédito ●● 1177"):
    // colados de propósito, porque os dígitos só fazem sentido junto ao
    // método que os explica.
    expect(screen.getByText(/Crédito/)).toBeInTheDocument();
    expect(screen.getByText(/1177/)).toBeInTheDocument();
  });

  it("mobile: mostra search compacto + botão Filtros que abre o sheet com a Variação C", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 375 });
    window.dispatchEvent(new Event("resize"));
    renderPage({ isMobile: true });
    await openFilters();
    expect(screen.getByPlaceholderText(/Buscar por descrição, categoria ou tag/i)).toBeInTheDocument();
    // O sheet já está aberto por `openFilters()`. No mobile o botão da barra
    // mantém o nome "Filtros" e sinaliza o estado por `aria-expanded` — ele fica
    // atrás do backdrop, e rótulo de fechar num controle coberto é ruído.
    expect(superficieDeFiltros()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filtros/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // O ✕ do cabeçalho é o único controle de fechar visível.
    await userEvent.click(screen.getByRole("button", { name: /Fechar filtros/i }));
    await waitFor(() => {
      expect(screen.queryByRole("toolbar", { name: /Filtros de transações/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: /^Filtros$/i })).not.toBeInTheDocument();
    });
  });

  it("mobile: o ✕ do cabeçalho do sheet fecha o sheet", async () => {
    // Cobertura que não existia em lugar nenhum: o teste acima apontava para o
    // ✕ por acidente (ele se chamava "Fechar filtros") e passou a apontar para o
    // botão da barra quando o nome mudou, sem que nada acusasse.
    window.innerWidth = 500;
    window.dispatchEvent(new Event("resize"));
    renderPage({ isMobile: true });
    await openFilters();
    expect(superficieDeFiltros()).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Fechar filtros/i }));
    await waitFor(() => {
      expect(screen.queryByRole("toolbar", { name: /Filtros de transações/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: /^Filtros$/i })).not.toBeInTheDocument();
    });
  });

  it("criar saved view persiste em localStorage por org", async () => {
    renderPage();
    await openFilters();
    // Salvar FECHA o menu — é o comportamento certo, a tarefa acabou. Para
    // afirmar que a view existe é preciso abri-lo de novo.
    await salvarViewDoTipo("Despesa", "Minha view");
    expect(screen.getByRole("menuitemradio", { name: /^Minha view\b/ })).toBeInTheDocument();
    const raw = localStorage.getItem("fincla.transactions.savedViews.v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw);
    expect(parsed.orgs["org-test"]).toBeDefined();
    expect(parsed.orgs["org-test"][0].label).toBe("Minha view");
  });

  it("clicar na view ativa desaplica filtros e desseleciona o item", async () => {
    renderPage();
    await openFilters();
    // Sem filtro nenhum não há chip: "Todos" é o padrão e padrão não vira
    // texto na tela.
    expect(screen.queryByRole("group", { name: /Filtros aplicados/i })).not.toBeInTheDocument();

    const item = await salvarViewDoTipo("Receita", "receitas");
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(esperaFacetaAplicada("Tipo", "Receita")).toBeInTheDocument();

    await userEvent.click(item);
    // Clicar na view ativa desaplica: o filtro sai e o chip some com ele.
    await abrirMenuDeViews();
    expect(
      screen.getByRole("menuitemradio", { name: /^receitas\b/ }),
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("group", { name: /Filtros aplicados/i })).not.toBeInTheDocument();
  });

  /* 30 s, não 15: isolado este teste leva ~14,7 s — cada `userEvent` percorre a
     árvore inteira da página, que tem 4 mil linhas, e são seis interações.
     Sob a suíte cheia ele estourava o padrão por margem de segundos. O limite
     maior é sobre o custo do jsdom nesta página, não sobre esperar bug passar. */
  it("view dirty: card mostra Filtros alterados; Limpar tudo desseleciona", async () => {
    renderPage();
    await openFilters();
    const item = await salvarViewDoTipo("Receita", "receitas");
    expect(item).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{Escape}");

    await abrirFaceta("Categoria");
    await userEvent.click(screen.getByRole("button", { name: "Alimentação" }));
    expect(screen.getByText(/alterada|Filtros alterados/i)).toBeInTheDocument();

    await limparTudo();
    await abrirMenuDeViews();
    expect(
      screen.getByRole("menuitemradio", { name: /^receitas\b/ }),
    ).toHaveAttribute("aria-checked", "false");
  }, 30000);

  /* O desktop compacto abre A MESMA DOCK do largo. Antes ele abria a faixa
     permanente de nove cards — o painel que o redesenho aposentou —, e o teste
     aceitava qualquer uma das duas superfícies. Aceitar as duas foi o que
     deixou a faixa antiga sobreviver em produção abaixo de 1280 px sem nenhum
     teste reclamar: a dock não é um recurso de tela grande. */
  it("desktop compacto: filtros recolhidos por padrão; botão Filtros abre a dock", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1200 });
    window.dispatchEvent(new Event("resize"));
    renderPage();
    // Em repouso, nada de facets — este teste É sobre o padrão recolhido,
    // então ele não pode abrir antes de afirmar.
    expect(screen.queryByRole("toolbar", { name: /Filtros de transações/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^(Abrir |Fechar )?Filtros/i })).toBeInTheDocument();

    await openFilters();
    expect(screen.getByRole("region", { name: /^Filtros$/i })).toBeInTheDocument();
    // E é a dock mesmo: o trilho de facetas só existe nela.
    expect(screen.getByRole("button", { name: /^Período$/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Fechar filtros/i }));
    expect(screen.queryByRole("toolbar", { name: /Filtros de transações/i })).not.toBeInTheDocument();
    /* `waitForElementToBeRemoved`, não uma asserção seca: a dock ADIA o
       desmonte pelo tempo da animação de fechamento — desmontar na hora tira o
       elemento antes de ele ter para onde encolher, e a lista salta os 360 px
       de uma vez. A faixa antiga sumia no mesmo tique; a dock não. */
    await waitForElementToBeRemoved(() => screen.queryByRole("region", { name: /^Filtros$/i }));
  });

  // Regressão do bug relatado: selecionar 2+ formas de pagamento fazia a lista
  // sumir. A causa era o recorte client-side por página — a API devolvia uma
  // página sem filtro de forma e a página descartava as linhas que não casavam
  // com `paymentMethodKey`. Agora a API filtra por todas as formas (param
  // repetido) e a página confia no resultado, sem refiltrar.
  it("modo live: selecionar várias formas de pagamento não esvazia a lista", async () => {
    renderPage();
    await openFilters();
    // Todas as linhas do hook aparecem antes de qualquer filtro.
    expect(screen.getAllByText("Almoço").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Salário").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Notebook").length).toBeGreaterThan(0);

    // A faceta se chamava "Forma de pagamento" no card; no trilho é
    // "Pagamento" — o painel ao lado já diz de que forma se trata.
    await abrirFaceta("Pagamento");
    const panel = painelDaFaceta("forma");
    await userEvent.click(within(panel).getByRole("button", { name: "Pix" }));
    await userEvent.click(within(panel).getByRole("button", { name: "Crédito" }));

    // Duas formas marcadas — a lista continua com todas as linhas do backend.
    expect(screen.getAllByText("Almoço").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Salário").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Notebook").length).toBeGreaterThan(0);

    // E o hook recebeu as duas formas mapeadas para os valores da API.
    const lastCall = transactionsDataMock.mock.calls.at(-1)[0];
    expect(lastCall.filters.filterMethod).toEqual(["pix", "credit_card"]);
  });
});

describe("<TransacoesPage> — liquidação (S1)", () => {
  /** Uma pendente (pix), uma paga (pix) e uma de cartão. */
  function seedSettlement(setTransactionSettled = vi.fn()) {
    transactionsDataMock.mockReturnValue({
      isLoading: false,
      error: "",
      summary: { total_income: 0, total_expenses: 100, total_refunds: 0, balance: -100 },
      transactions: [
        { id: "tx-pend", date: "21/05", desc: "Boleto luz", cat: "Casa", val: -100, method: "Pix",
          type: "expense", icon: "💡", status: "confirmado", rec: false, tags: [],
          settled: false, settleable: true, paidAt: null },
        { id: "tx-paga", date: "22/05", desc: "Mercado", cat: "Alimentação", val: -50, method: "Pix",
          type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [],
          settled: true, settleable: true, paidAt: "2026-05-22T12:00:00" },
        { id: "tx-cartao", date: "23/05", desc: "Notebook", cat: "Compras", val: -4299,
          method: "Cartão de crédito", paymentMethodKey: "credito", type: "expense", icon: "💳",
          status: "confirmado", rec: false, tags: [], settled: false, settleable: false, paidAt: null },
      ],
      total: 3,
      hasMore: false,
      removeTransaction: vi.fn(),
      setTransactionSettled,
      reload: recarregarMock,
    });
  }

  /** O `reload` do hook, para os testes de recarga verem que foi chamado. */
  let recarregarMock = vi.fn();
  beforeEach(() => { recarregarMock = vi.fn(); });

  it("duplicar manda a transação para o consumidor, sem a identidade do original", async () => {
    const onDuplicateTx = vi.fn();
    seedSettlement();
    renderPage({ onDuplicateTx });
    await openFilters();

    await userEvent.click(
      (await screen.findAllByRole("button", { name: /^Duplicar Boleto luz$/ }))[0],
    );
    expect(onDuplicateTx).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tx-pend", desc: "Boleto luz" }),
    );
  });

  it("sem consumidor que saiba duplicar, o botão não existe", async () => {
    // Um botão que não faz nada é pior que um botão ausente.
    seedSettlement();
    renderPage();
    await openFilters();
    await screen.findAllByText("Boleto luz");
    expect(screen.queryByRole("button", { name: /^Duplicar / })).toBeNull();
  });

  it("liquidar oferece desfazer, e desfazer reverte pela API", async () => {
    const setTransactionSettled = vi.fn().mockResolvedValue({ settled: true });
    seedSettlement(setTransactionSettled);
    renderPage();
    await openFilters();

    await userEvent.click(
      (await screen.findAllByRole("button", { name: /^Marcar Boleto luz como pago$/ }))[0],
    );
    /* No DESKTOP a liquidação passa pelo modal: ela muda o saldo, a mesma
       classe de consequência da exclusão. A diferença é ser reversível, e é o
       próprio modal que diz isso. */
    await userEvent.click(
      await screen.findByRole("button", { name: /Confirmar pagamento/i }),
    );

    expect(
      await screen.findByText(/"Boleto luz" marcada como paga/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    // Reverte pela API, não só na tela: o saldo da conta só conta status=paid,
    // então um rollback local deixaria lista e saldo contando coisas diferentes.
    expect(setTransactionSettled).toHaveBeenLastCalledWith("tx-pend", false);
  });

it("cancelar no modal NÃO liquida", async () => {
    // A rede só serve se ela puder ser puxada: um modal cujo cancelar executa
    // mesmo assim é pior que nenhum, porque ensina a pessoa a não ler.
    const setTransactionSettled = vi.fn().mockResolvedValue({ settled: true });
    seedSettlement(setTransactionSettled);
    renderPage();
    await openFilters();

    await userEvent.click(
      (await screen.findAllByRole("button", { name: /^Marcar Boleto luz como pago$/ }))[0],
    );
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(setTransactionSettled).not.toHaveBeenCalled();
  });

  it("o modal mostra QUAL transação — não só o verbo", async () => {
    // Sem o cartão, confirmar depende da memória de qual linha foi clicada.
    const setTransactionSettled = vi.fn().mockResolvedValue({ settled: true });
    seedSettlement(setTransactionSettled);
    renderPage();
    await openFilters();

    await userEvent.click(
      (await screen.findAllByRole("button", { name: /^Marcar Boleto luz como pago$/ }))[0],
    );
    const modal = await screen.findByRole("alertdialog");
    expect(modal).toHaveTextContent("Boleto luz");
    // E diz que é reversível: é o que separa esta pergunta da exclusão.
    expect(modal).toHaveTextContent(/desfazer depois/i);
  });

  it("fechar a torrada não desfaz nada", async () => {
    const setTransactionSettled = vi.fn().mockResolvedValue({ settled: true });
    seedSettlement(setTransactionSettled);
    renderPage();
    await openFilters();

    await userEvent.click(
      (await screen.findAllByRole("button", { name: /^Marcar Boleto luz como pago$/ }))[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Confirmar pagamento/i }),
    );
    await screen.findByRole("button", { name: "Fechar aviso" });
    await userEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));

    expect(setTransactionSettled).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Desfazer" })).toBeNull();
  });

  it("marca com badge 'A pagar' só o que está pendente", async () => {
    seedSettlement();
    renderPage();
    await openFilters();
    // Texto exato do badge: /A pagar/i casaria também com a linha-ponte e com o
    // botão "Ver só os a pagar", que não são badges de linha.
    // A ampulheta saiu: dizia "processando", mas o lançamento existe e só não
    // entrou no saldo. A marca agora é um anel vazado (decorativo), então o
    // texto do badge é só "A pagar".
    expect(screen.getAllByText("A pagar").length).toBe(1);
  });

  it("cartão NÃO ganha badge 'A pagar' — ele liquida pela fatura, não por lançamento", async () => {
    seedSettlement();
    renderPage();
    await openFilters();
    const badges = screen.getAllByText("A pagar");
    // Se o cartão entrasse, seriam dois. O badge mentiria sobre o que o usuário controla.
    expect(badges.length).toBe(1);
    expect(screen.getAllByText("Notebook").length).toBeGreaterThan(0);
  });

  it("'Marcar como pago' chama o hook com settled=true", async () => {
    const setTransactionSettled = vi.fn().mockResolvedValue({ settled: true });
    seedSettlement(setTransactionSettled);
    renderPage();
    await openFilters();

    await userEvent.click(screen.getAllByText("Boleto luz")[0]);
    await userEvent.click(await screen.findByRole("button", { name: /Marcar como pago/i }));
    /* A sanfona no DESKTOP também pergunta antes: liquidar mexe no saldo, e o
       artefato pede a mesma confirmação venha ela da ação rápida ou de dentro
       do item. Sem este passo o teste media o clique, não a liquidação. */
    await userEvent.click(await screen.findByRole("button", { name: /Confirmar pagamento/i }));

    expect(setTransactionSettled).toHaveBeenCalledWith("tx-pend", true);
  });

  it("reconcilia lista e summary depois de liquidar", async () => {
    const onTransactionsInvalidate = vi.fn();
    const setTransactionSettled = vi.fn().mockResolvedValue({ settled: true });
    seedSettlement(setTransactionSettled);
    renderPage({ onTransactionsInvalidate });
    await openFilters();

    await userEvent.click(screen.getAllByText("Boleto luz")[0]);
    await userEvent.click(await screen.findByRole("button", { name: /Marcar como pago/i }));
    /* A sanfona no DESKTOP também pergunta antes: liquidar mexe no saldo, e o
       artefato pede a mesma confirmação venha ela da ação rápida ou de dentro
       do item. Sem este passo o teste media o clique, não a liquidação. */
    await userEvent.click(await screen.findByRole("button", { name: /Confirmar pagamento/i }));

    // Sem isto, com Situação = "A pagar" a linha recém-paga continuaria visível sob
    // um filtro que a exclui, e o card "Resultado" somaria um conjunto que a lista
    // não mostra — a divergência que esta própria fatia existe para evitar.
    expect(onTransactionsInvalidate).toHaveBeenCalled();
  });

  it("mostra o erro ao lado da ação, não só na faixa do topo", async () => {
    const setTransactionSettled = vi.fn().mockRejectedValue(new Error("Servidor recusou"));
    seedSettlement(setTransactionSettled);
    renderPage();
    await openFilters();

    await userEvent.click(screen.getAllByText("Boleto luz")[0]);
    await userEvent.click(await screen.findByRole("button", { name: /Marcar como pago/i }));
    /* A sanfona no DESKTOP também pergunta antes: liquidar mexe no saldo, e o
       artefato pede a mesma confirmação venha ela da ação rápida ou de dentro
       do item. Sem este passo o teste media o clique, não a liquidação. */
    await userEvent.click(await screen.findByRole("button", { name: /Confirmar pagamento/i }));

    // No mobile o botão vive dentro do bottom sheet e a faixa global fica coberta:
    // uma falha pareceria "não aconteceu nada".
    expect(await screen.findByText("Servidor recusou")).toBeInTheDocument();
  });


  /* ── §29 · recarregar a lista ────────────────────────────────────────── */

  it("o botão de recarregar pede recarga ao hook — não recarrega a página", async () => {
    seedSettlement();
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: /Recarregar a lista/i }));
    expect(recarregarMock).toHaveBeenCalledTimes(1);
  });

  it("a tecla R recarrega, e martelar não enfileira buscas", async () => {
    seedSettlement();
    renderPage();
    /* A guarda de voo é SÍNCRONA (um ref), porque `isLoading` só vira `true` no
       render seguinte — sem ela, dois toques rápidos escapavam pela janela. */
    await userEvent.keyboard("rrrr");
    expect(recarregarMock).toHaveBeenCalledTimes(1);
  });

  it("o card de falha oferece a saída, em vez de exigir F5", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false,
      error: "Falha de rede",
      summary: null,
      transactions: [],
      total: 0,
      hasMore: false,
      removeTransaction: vi.fn(),
      setTransactionSettled: vi.fn(),
      reload: recarregarMock,
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /Tentar de novo/i }));
    expect(recarregarMock).toHaveBeenCalledTimes(1);
  });

  /* ── §09 · a linha que sai do recorte ────────────────────────────────── */

  it("liquidar sob o filtro 'A pagar' DIZ que a linha saiu, e oferece ver", async () => {
    seedSettlement(vi.fn().mockResolvedValue({ settled: true }));
    renderPage();
    await openFilters();
    await abrirFaceta("Situação");
    await userEvent.click(screen.getByRole("button", { name: /^A pagar$/ }));
    await userEvent.keyboard("{Escape}");

    await userEvent.click(
      (await screen.findAllByRole("button", { name: /^Marcar Boleto luz como pago$/ }))[0],
    );
    await userEvent.click(await screen.findByRole("button", { name: /Confirmar pagamento/i }));

    /* Sem esta frase a transação recém-paga simplesmente sumia, e o único
       palpite disponível era que algo tinha dado errado. */
    expect(await screen.findByText(/Saiu do filtro "A pagar"/)).toBeInTheDocument();
    // "Ver" desfaz o RECORTE, não o pagamento — quem pagou quis pagar.
    expect(screen.getByRole("button", { name: "Ver" })).toBeInTheDocument();
  });

  it("sem filtro de situação a linha FICA, e não há frase de saída", async () => {
    seedSettlement(vi.fn().mockResolvedValue({ settled: true }));
    renderPage();
    await openFilters();

    await userEvent.click(
      (await screen.findAllByRole("button", { name: /^Marcar Boleto luz como pago$/ }))[0],
    );
    await userEvent.click(await screen.findByRole("button", { name: /Confirmar pagamento/i }));

    expect(await screen.findByText(/marcada como paga/)).toBeInTheDocument();
    expect(screen.queryByText(/Saiu do filtro/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver" })).not.toBeInTheDocument();
  });

  it("numa transação já paga a ação é desfazer, com settled=false", async () => {
    const setTransactionSettled = vi.fn().mockResolvedValue({ settled: false });
    seedSettlement(setTransactionSettled);
    renderPage();
    await openFilters();

    await userEvent.click(screen.getAllByText("Mercado")[0]);
    // A ação existe em dois lugares agora — na sanfona e como ação rápida da
    // linha. Este teste cobre a da sanfona, então a busca é escopada nela.
    const detail = await screen.findByRole("region", { name: /^Detalhes de/i });
    await userEvent.click(within(detail).getByRole("button", { name: /Desfazer pagamento/i }));
    // Desfazer o pagamento também mexe no saldo — mesma pergunta, verbo trocado.
    const modal = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(modal).getByRole("button", { name: /^↺ Desfazer pagamento$/ }),
    );

    expect(setTransactionSettled).toHaveBeenCalledWith("tx-paga", false);
  });

  it("transação de cartão não oferece a ação de liquidar no detalhe", async () => {
    seedSettlement();
    renderPage();
    await openFilters();

    await userEvent.click(screen.getAllByText("Notebook")[0]);

    expect(screen.queryByRole("button", { name: /Marcar como pago/i })).not.toBeInTheDocument();
    const cardDetail = await screen.findByRole("region", { name: /^Detalhes de/i });
    expect(
      within(cardDetail).queryByRole("button", { name: /Desfazer pagamento/i }),
    ).not.toBeInTheDocument();
    // E também não como ação rápida DESTA linha: cartão liquida pela FATURA,
    // não por lançamento. (Escopado à linha; outras linhas da lista têm a ação.)
    const cardRow = screen.getAllByText("Notebook")[0].closest(".fincla-row");
    expect(within(cardRow).queryByRole("button", { name: /como pago/i })).not.toBeInTheDocument();
  });

  it("o facet Situação chega ao hook de dados como settlement", async () => {
    seedSettlement();
    renderPage();
    await openFilters();

    await abrirFaceta("Situação");
    const panel = painelDaFaceta("situa");
    await userEvent.click(within(panel).getByRole("button", { name: /^A pagar$/i }));

    const lastCall = transactionsDataMock.mock.calls.at(-1)[0];
    expect(lastCall.filters.settlement).toBe("a-pagar");
  });

  it("fincla-frontend#78: marcar uma tag chega ao hook de dados como filterCat (tag_id)", async () => {
    seedSettlement();
    renderPage();
    await openFilters();

    await abrirFaceta("Tags");
    const panel = painelDaFaceta("tag");
    await userEvent.click(within(panel).getByRole("button", { name: "Tag trabalho" }));

    // Antes da correção `filter.tags` nunca chegava a `filtersToLegacyParams`:
    // o `filterCat` continuava "todas" mesmo com a tag marcada, e por isso a
    // listagem não mudava. Com a correção, o nome marcado é resolvido para o
    // id real (via `useTransactionsTagCatalog`, mockado acima) e mandado no
    // MESMO slot que a categoria usa — é o `tag_id` que o backend entende.
    const lastCall = transactionsDataMock.mock.calls.at(-1)[0];
    expect(lastCall.filters.filterCat).toEqual(["tag-uuid-trabalho"]);
  });

  // fincla-frontend#96 — revisão adversarial da PR #96, achado 2: Categoria e
  // Tags disputam o mesmo slot de filtro no backend. Decisão: IMPEDIR as duas
  // ativas ao mesmo tempo (não só avisar) — provado aqui no nível da UI real,
  // não só no hook de estado isolado.
  it("categoria e tag ativas ao mesmo tempo continuam as DUAS acesas e as duas filtram", async () => {
    seedSettlement();
    renderPage();
    await openFilters();

    await abrirFaceta("Tags");
    await userEvent.click(
      within(painelDaFaceta("tag")).getByRole("button", {
        name: "Tag trabalho",
      }),
    );
    expect(esperaFacetaAplicada("Tags", "#trabalho")).toBeInTheDocument();

    await abrirFaceta("Categoria");
    await userEvent.click(
      within(painelDaFaceta("categoria")).getByRole("button", {
        name: "Alimentação",
      }),
    );

    // O achado 2 era: as duas acesas e a tag descartada em silêncio pelo
    // backend, que só aceitava um `tag_id`. A correção da época foi apagar
    // uma delas. Agora os params são repetíveis e combinam por AND, então as
    // duas podem ficar acesas — desde que as DUAS cheguem à query. É essa
    // última parte que este teste guarda.
    expect(esperaFacetaAplicada("Categoria", "Alimentação")).toBeInTheDocument();
    expect(esperaFacetaAplicada("Tags", "#trabalho")).toBeInTheDocument();
    const lastCall = transactionsDataMock.mock.calls.at(-1)[0];
    expect(lastCall.filters.filterCat).toEqual(["cat-alim", "tag-uuid-trabalho"]);
  });

  // fincla-frontend#96 — segunda rodada da revisão adversarial, prioridade 1:
  // "Todas" no painel de Categoria chamava `setCats(todosOsIds)` — um array
  // NÃO VAZIO, que não é o mesmo que "sem filtro de categoria". "Todas" tem
  // que se comportar como "Limpar", e nada mais na tela pode se mexer.
  it("fincla-frontend#96 prioridade 1: 'Todas' na Categoria NÃO apaga uma tag ativa", async () => {
    seedSettlement();
    renderPage();
    await openFilters();

    await abrirFaceta("Tags");
    await userEvent.click(
      within(painelDaFaceta("tag")).getByRole("button", {
        name: "Tag trabalho",
      }),
    );
    expect(esperaFacetaAplicada("Tags", "#trabalho")).toBeInTheDocument();

    await abrirFaceta("Categoria");
    await userEvent.click(
      within(painelDaFaceta("categoria")).getByRole("button", {
        name: "Todas",
      }),
    );

    // A implementação anterior (`setCats(categories.map(c => c.id))`) teria
    // apagado a tag aqui — este chip precisa continuar aceso.
    expect(esperaFacetaAplicada("Tags", "#trabalho")).toBeInTheDocument();
    const lastCall = transactionsDataMock.mock.calls.at(-1)[0];
    expect(lastCall.filters.filterCat).toEqual(["tag-uuid-trabalho"]);
  });

  // Prioridade 5: a revisão provou que revertendo
  // `enabled: shouldUseRealData && !tagFilterBlocked` para
  // `enabled: shouldUseRealData` (e desligando o banner) a suíte inteira desta
  // página continuava 37/37 verde — a tese central da correção (fail closed)
  // não tinha rede nenhuma. Este teste força um estado "unresolved" de verdade
  // (a tag some do catálogo DEPOIS de selecionada — visão salva antiga, tag
  // renomeada/apagada) e prova as duas pontas: o hook de dados recebe
  // `enabled:false` (nunca dispara com um filtro "esquecido") e o aviso
  // visível aparece.
  it("fincla-frontend#96 prioridade 2/4/5: tag que deixou de existir no catálogo trava a busca (fail closed) e avisa", async () => {
    seedSettlement();
    renderPage();
    await openFilters();

    await abrirFaceta("Tags");
    await userEvent.click(
      within(painelDaFaceta("tag")).getByRole("button", {
        name: "Tag trabalho",
      }),
    );
    // Resolveu normalmente enquanto a tag existe no catálogo.
    expect(transactionsDataMock.mock.calls.at(-1)[0].enabled).toBe(true);

    // Simula a tag sumindo do catálogo (renomeada/apagada) — próxima chamada
    // ao hook (qualquer re-render) já não a encontra mais.
    tagCatalogMock.mockImplementation(() => ({
      rows: [{ id: "tag-uuid-casa", name: "casa", parent_category_tag_id: "cat-alim" }],
      loading: false,
      error: "",
    }));
    // Dispara um novo render de `TransacoesPageBody` sem mexer na seleção de
    // tag (troca de Situação é um state setter qualquer, só pra empurrar).
    await abrirFaceta("Situação");
    const situacaoPanel = painelDaFaceta("situa");
    await userEvent.click(within(situacaoPanel).getByRole("button", { name: /^Pagas$/i }));

    const lastCall = transactionsDataMock.mock.calls.at(-1)[0];
    // Nunca "esquece" o filtro e busca tudo — a implementação antiga faria
    // isso (`filterCat: "todas"`); a correta trava a busca.
    expect(lastCall.enabled).toBe(false);
    expect(screen.getByText(/não foi encontrada/i)).toBeInTheDocument();

    // Restaura o mock pro estado default, pra não vazar pros testes seguintes.
    tagCatalogMock.mockImplementation(() => ({
      rows: [
        { id: "tag-uuid-trabalho", name: "trabalho", parent_category_tag_id: "cat-trans" },
        { id: "tag-uuid-casa", name: "casa", parent_category_tag_id: "cat-alim" },
      ],
      loading: false,
      error: "",
    }));
  });

  // fincla-frontend#101, achado 2: `displayLabel` (o que a facet Tags guarda e
  // resolve) depende de `categoryLabelById` — enquanto CATEGORIAS ainda
  // carregam, duas tags com o MESMO nome ("trabalho" em duas categorias
  // diferentes) caem em "sem categoria" pros dois e colidem DE NOVO, ganhando
  // o sufixo do id inteiro como desempate (ver tagCatalogResolution.js). Esse
  // rótulo PROVISÓRIO é diferente do rótulo FINAL, estável ("trabalho ·
  // Vendas"), que só existe depois que as categorias terminam de carregar.
  // Uma view salva com o rótulo final, avaliada contra o catálogo ainda
  // parcial, batia contra o provisório e virava "unresolved" — falso.
  it("fincla-frontend#101: view salva com tag colidente não trava 'não encontrada' enquanto categorias ainda carregam", async () => {
    localStorage.setItem(
      "fincla.transactions.savedViews.v1",
      JSON.stringify({
        version: 1,
        orgs: {
          "org-test": [
            {
              id: "v-tag-view",
              label: "Trabalho (Vendas)",
              icon: "bookmark",
              color: "#2563EB",
              filters: { tags: ["trabalho · Vendas"] },
              createdAt: 1,
            },
          ],
        },
      }),
    );

    // Duas tags "trabalho" colidentes — categorias AINDA carregando
    // (`categoryLabelById` chega vazio no 1º render).
    tagCatalogMock.mockImplementation(() => ({
      rows: [
        { id: "tag-trabalho-vendas", name: "trabalho", parent_category_tag_id: "cat-vendas" },
        { id: "tag-trabalho-rh", name: "trabalho", parent_category_tag_id: "cat-rh" },
      ],
      loading: false,
      error: "",
    }));
    categoryTagsDataMock.mockReturnValue({ isLoading: true, categories: [] });

    renderPage();
    await openFilters();
    await abrirMenuDeViews();
    await userEvent.click(screen.getByRole("menuitemradio", { name: /^Trabalho \(Vendas\)/ }));

    // Enquanto as categorias carregam, o filtro fica em "loading" — nunca
    // "não encontrada" (falso) nem resolvido contra um rótulo provisório.
    expect(screen.queryByText(/não foi encontrada/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Carregando tags/i)).toBeInTheDocument();
    expect(transactionsDataMock.mock.calls.at(-1)[0].enabled).toBe(false);

    // Categorias terminam de carregar — o rótulo final bate com o da view salva.
    categoryTagsDataMock.mockReturnValue({
      isLoading: false,
      categories: [
        { id: "cat-vendas", labelPt: "Vendas", color: "#2563EB" },
        { id: "cat-rh", labelPt: "RH", color: "#7C3AED" },
      ],
    });
    await abrirFaceta("Situação");
    await userEvent.click(
      within(painelDaFaceta("situa")).getByRole("button", {
        name: /^Pagas$/i,
      }),
    );

    expect(screen.queryByText(/não foi encontrada/i)).not.toBeInTheDocument();
    const lastCall = transactionsDataMock.mock.calls.at(-1)[0];
    expect(lastCall.enabled).toBe(true);
    expect(lastCall.filters.filterCat).toEqual(["tag-trabalho-vendas"]);

    // Restaura os mocks pro estado default, pra não vazar pros testes seguintes.
    tagCatalogMock.mockImplementation(() => ({
      rows: [
        { id: "tag-uuid-trabalho", name: "trabalho", parent_category_tag_id: "cat-trans" },
        { id: "tag-uuid-casa", name: "casa", parent_category_tag_id: "cat-alim" },
      ],
      loading: false,
      error: "",
    }));
    categoryTagsDataMock.mockReturnValue({
      isLoading: false,
      categories: [
        { id: "cat-alim", labelPt: "Alimentação", color: "#059669" },
        { id: "cat-trans", labelPt: "Transporte", color: "#2563EB" },
      ],
    });
  });
});

describe("<TransacoesPage> — desambiguação de nomes (S2)", () => {
  it('o card chama-se "Resultado", não "Saldo" — o nome antigo colidia com o saldo da conta', async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "",
      summary: { total_income: 100, total_expenses: 40, total_refunds: 0, balance: 60 },
      transactions: [
        { id: "t1", date: "21/05", desc: "Almoço", cat: "Alimentação", val: -40, method: "Pix",
          type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [],
          settled: true, settleable: true, paidAt: "2026-05-21T12:00:00" },
      ],
      total: 1, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    expect(screen.getByText("Resultado")).toBeInTheDocument();
    // "Saldo" sozinho não pode mais aparecer como rótulo de card nessa tela.
    expect(screen.queryByText(/^Saldo$/)).not.toBeInTheDocument();
  });

  it("oferece o caminho para os pendentes quando há algum fora do saldo", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "",
      summary: { total_income: 0, total_expenses: 100, total_refunds: 0, balance: -100 },
      transactions: [
        { id: "t-pend", date: "21/05", desc: "Boleto luz", cat: "Casa", val: -100, method: "Pix",
          type: "expense", icon: "💡", status: "confirmado", rec: false, tags: [],
          settled: false, settleable: true, paidAt: null },
      ],
      total: 1, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    // O aviso de 16 px numa faixa própria virou o contador do cabeçalho da
    // lista: mesma função, encostado no que ele descreve, e zero altura extra.
    await userEvent.click(
      screen.getByRole("button", { name: /Ainda não entraram no saldo da conta/i }),
    );

    const lastCall = transactionsDataMock.mock.calls.at(-1)[0];
    expect(lastCall.filters.settlement).toBe("a-pagar");
  });

  it("não polui a tela quando está tudo pago", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "",
      summary: { total_income: 0, total_expenses: 40, total_refunds: 0, balance: -40 },
      transactions: [
        { id: "t-ok", date: "21/05", desc: "Almoço", cat: "Alimentação", val: -40, method: "Pix",
          type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [],
          settled: true, settleable: true, paidAt: "2026-05-21T12:00:00" },
      ],
      total: 1, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    expect(screen.queryByRole("button", { name: /Ver só os a pagar/i })).not.toBeInTheDocument();
  });
});

// fincla-frontend#106 — na 1ª carga, `transactions` já é [] antes da resposta
// chegar: sem distinguir os estados, a lista renderizava
// `CardEmptyWithCta("Nenhuma transação encontrada")` — uma afirmação sobre
// uma busca que nem terminou (ou que falhou). `hasLoaded` (ver
// useTransactionsData) separa "nunca carregou com sucesso" de "carregou e
// está mesmo vazio".
describe("<TransacoesPage> — estado de carregamento da lista (issue #106)", () => {
  it("1ª carga em voo: mostra 'Carregando…', nunca 'Nenhuma transação encontrada'", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: true, error: "", hasLoaded: false,
      summary: null, transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    // O sinal de carregando é o ESQUELETO da lista, não um texto centralizado:
    // ele ocupa a mesma grade das linhas, então quando o dado chega nada muda
    // de lugar. O cabeçalho segue dizendo "Carregando…".
    expect(screen.getByTestId("transactions-skeleton")).toBeInTheDocument();
    expect(screen.getAllByText("Carregando…").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Nenhuma transação encontrada/i)).not.toBeInTheDocument();
  });

  it("1ª carga falhou: mostra aviso de erro na lista, nunca 'Nenhuma transação encontrada'", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "Falha ao carregar transações.", hasLoaded: false,
      summary: null, transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    expect(screen.getByText(/Não foi possível carregar as transações/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma transação encontrada/i)).not.toBeInTheDocument();
  });

  it("vazio de verdade (já carregou com sucesso, sem resultados): mostra 'Nenhuma transação encontrada'", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "", hasLoaded: true,
      summary: { total_income: 0, total_expenses: 0, total_refunds: 0, balance: 0 },
      transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    expect(screen.getByText(/Nenhuma transação encontrada/i)).toBeInTheDocument();
  });

  // fincla-frontend#109 achado 2 (revisão da PR #109): o quadro EXATO em que
  // `enabled` acabou de virar `true` (1ª montagem, ou logo que o filtro de
  // tag desbloqueia a busca) — o efeito do hook ainda não teve chance de
  // ligar `isLoading`. Nunca carregou (`hasLoaded:false`) e ainda não há
  // erro (`error:""`) — só pode ser "em voo".
  it("hasLoaded=false, error='', isLoading AINDA false (quadro entre habilitar e o efeito ligar isLoading): mostra 'Carregando…', nunca 'Nenhuma transação encontrada'", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "", hasLoaded: false,
      summary: null, transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    // O sinal de carregando é o ESQUELETO da lista, não um texto centralizado:
    // ele ocupa a mesma grade das linhas, então quando o dado chega nada muda
    // de lugar. O cabeçalho segue dizendo "Carregando…".
    expect(screen.getByTestId("transactions-skeleton")).toBeInTheDocument();
    expect(screen.getAllByText("Carregando…").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Nenhuma transação encontrada/i)).not.toBeInTheDocument();
  });

  // fincla-frontend#109 rodada 2, achado 4: a faixa de KPI (Receitas/
  // Despesas/Resultado) só tratava `tagFilterBlocked` como "ainda não sei
  // responder" — em `listLoading`/`listLoadFailed` ela continuava afirmando
  // "+R$ 0,00" e "0 lançamentos"/"0 transações no filtro", contradizendo o
  // card da lista logo abaixo. É o mesmo "zero confiante" que o #106 corrigiu
  // na lista, só que no componente vizinho.
  it("KPI: em listLoading mostra '—' e 'Carregando…', nunca 'R$' nem contagem de lançamentos", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: true, error: "", hasLoaded: false,
      summary: null, transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    // 3 valores da faixa de estatísticas + a contagem do cabeçalho da lista.
    // Eram 5 enquanto existia o chip "Tags: —": o card de faceta carregava
    // rótulo e valor juntos. No painel ancorado o trilho mostra só o nome, e o
    // "—" da facet sem seleção vive dentro do painel dela.
    expect(screen.getAllByText("—").length).toBe(4);
    // O motivo agora aparece UMA vez, ao lado do número que ele explica, em vez
    // de repetido na terceira linha de cada um dos três cards.
    expect(screen.getAllByText("Carregando…").length).toBe(1);
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lançamento/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/transaç.*no filtro/i)).not.toBeInTheDocument();
  });

  it("KPI: em listLoadFailed mostra '—' e 'Não foi possível carregar', nunca 'R$'", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "Falha ao carregar transações.", hasLoaded: false,
      summary: null, transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    expect(screen.getAllByText("—").length).toBe(4);
    expect(screen.getAllByText("Não foi possível carregar").length).toBe(1);
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("KPI: vazio de verdade (hasLoaded=true) volta a mostrar valores e contagem normais", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "", hasLoaded: true,
      summary: { total_income: 0, total_expenses: 0, total_refunds: 0, balance: 0 },
      transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    // Com dados carregados NENHUM "—" sobra: os três KPIs e a contagem voltam
    // a mostrar número. O único que restava era o do chip "Tags: —", que saiu
    // junto com os cards de faceta.
    expect(screen.queryAllByText("—").length).toBe(0);
    expect(screen.getAllByText(/R\$/).length).toBeGreaterThan(0);
  });

  // fincla-frontend#109 rodada 3, achado 4: o CTA "Ver N transações" (bottom
  // sheet mobile e `FacetApplyFooter` no painel inline do desktop) usava
  // `transactionsData.isLoading` cru pra decidir `resultsLoading` — o MESMO
  // booleano que este arquivo já documentou como não confiável no 1º quadro
  // (issue #109 achado 2). Com `hasLoaded:false` e `isLoading` AINDA `false`
  // (o quadro entre habilitar e o efeito ligar `isLoading`), o CTA afirmava
  // "Ver 0 transações" — a mesma mentira que a lista e a faixa de KPI já
  // foram corrigidas pra não fazer.
  it("CTA desktop (FacetApplyFooter): 'Atualizando…' quando a lista nunca carregou, nunca 'Ver 0 transações'", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "", hasLoaded: false,
      summary: null, transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    await abrirFaceta("Tipo");

    expect(screen.getByText("Atualizando…")).toBeInTheDocument();
    expect(screen.queryByText(/Ver 0 transaç/i)).not.toBeInTheDocument();
  });

  it("CTA mobile (bottom sheet): 'Atualizando…' quando a lista nunca carregou, nunca 'Ver 0 transações'", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 375 });
    window.dispatchEvent(new Event("resize"));
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "", hasLoaded: false,
      summary: null, transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage({ isMobile: true });
    await openFilters();

    await userEvent.click(screen.getByRole("button", { name: /(Abrir|Fechar) filtros/i }));

    expect(screen.getByRole("button", { name: "Atualizando…" })).toBeInTheDocument();
    expect(screen.queryByText(/Ver 0 transaç/i)).not.toBeInTheDocument();
  });

  it("CTA volta ao normal ('Ver N transações') quando hasLoaded=true", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "", hasLoaded: true,
      summary: { total_income: 0, total_expenses: 0, total_refunds: 0, balance: 0 },
      transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    await abrirFaceta("Tipo");

    expect(screen.getByText(/Ver 0 transaç/i)).toBeInTheDocument();
    expect(screen.queryByText("Atualizando…")).not.toBeInTheDocument();
  });

  // fincla-frontend#109 rodada 4, achado 5: a correção da rodada 3 (achado
  // 4) trocou `transactionsData.isLoading` cru por `listNeverLoaded` — mas
  // `listNeverLoaded` continua `true` PRA SEMPRE em dois casos que não são
  // "carregando": a 1ª carga FALHOU (`hasLoaded` só liga num sucesso) e o
  // filtro de tag está BLOQUEADO (`enabled:false` trava o hook em
  // `EMPTY_STATE` pra sempre). O CTA ficava "Atualizando…" desabilitado
  // pra sempre — uma afirmação falsa, já que nada estava em andamento.
  it("1ª carga FALHOU (hasLoaded=false, error setado): CTA mostra a contagem real, nunca fica 'Atualizando…' pra sempre", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "Falha ao carregar transações.", hasLoaded: false,
      summary: null, transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    await abrirFaceta("Tipo");

    expect(screen.getByText(/Ver 0 transaç/i)).toBeInTheDocument();
    expect(screen.queryByText("Atualizando…")).not.toBeInTheDocument();
  });

  it("filtro de tag BLOQUEADO (tag salva não existe mais): CTA mostra a contagem real, nunca fica 'Atualizando…' pra sempre", async () => {
    localStorage.setItem(
      "fincla.transactions.savedViews.v1",
      JSON.stringify({
        version: 1,
        orgs: {
          "org-test": [
            {
              id: "v-tag-sumida",
              label: "Tag sumida",
              icon: "bookmark",
              color: "#2563EB",
              filters: { tags: ["tag-que-nao-existe-mais"] },
              createdAt: 1,
            },
          ],
        },
      }),
    );
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "", hasLoaded: false,
      summary: null, transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    await abrirMenuDeViews();
    await userEvent.click(screen.getByRole("menuitemradio", { name: /^Tag sumida/ }));
    expect(screen.getAllByText(/não foi encontrada/i).length).toBeGreaterThan(0);

    await abrirFaceta("Tipo");
    expect(screen.getByText(/Ver 0 transaç/i)).toBeInTheDocument();
    expect(screen.queryByText("Atualizando…")).not.toBeInTheDocument();
  });

  // fincla-frontend#109 rodada 4, achado 6: o CTA do sheet mobile é o
  // controle de FECHAR o sheet em tela cheia — o mais óbvio pra sair. Não
  // pode ficar desabilitado (mesmo achando que é transitório): o X e o
  // backdrop já fecham de qualquer jeito, mas travar o botão MAIOR é uma
  // saída a menos se o estado "carregando" persistir de verdade (falha,
  // bloqueio).
  it("CTA mobile: NUNCA fica desabilitado (só o rótulo muda) — é o controle de fechar o sheet", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 375 });
    window.dispatchEvent(new Event("resize"));
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "", hasLoaded: false,
      summary: null, transactions: [], total: 0, hasMore: false,
      removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
    renderPage({ isMobile: true });
    await openFilters();

    await userEvent.click(screen.getByRole("button", { name: /(Abrir|Fechar) filtros/i }));

    const closeBtn = screen.getByRole("button", { name: "Atualizando…" });
    expect(closeBtn).not.toBeDisabled();
  });
});

// fincla-frontend#109 rodada 4, achado 1 (CRÍTICO) — mecanismo real do bug:
// uma falha ao "carregar mais" não setava mais `error` (achado 2 da rodada
// 3), então `hasMore` continuava `true`, a sentinela seguia montada, e
// `tryLoadMore` (`useCallback` chaveado em `isLoading`, que alterna a cada
// tentativa) recriava o `IntersectionObserver` — cuja entrega inicial (MDN)
// dispara o callback assim que `observe()` roda de novo, redisparando
// `tryLoadMore` sozinho. Isso virava uma tempestade de requisições sem fim,
// com `limit` crescendo, sem NENHUMA ação da pessoa. A garantia central da
// correção é estrutural: a sentinela precisa SUMIR do DOM assim que
// `pageError` liga — sem o nó observado, o efeito que cria o
// `IntersectionObserver` nem roda (`if (!sentinel || !hasMore) return;`), o
// que interrompe o mecanismo na raiz, sem depender de simular tempo real
// nem o `IntersectionObserver` de verdade (indisponível em jsdom).
describe("<TransacoesPage> — scroll infinito não vira tempestade de requisições (fincla-frontend#109 rodada 4, achado 1)", () => {
  // jsdom não implementa `IntersectionObserver` — os outros testes deste
  // arquivo nunca esbarram nisso porque sempre mockam `hasMore:false`. Aqui
  // `hasMore:true` é o cenário que importa, então um stub NO-OP (nunca
  // dispara o callback) evita o `ReferenceError` sem arriscar nenhum loop —
  // este describe testa a PRESENÇA da sentinela no DOM, não o
  // comportamento dinâmico do observer.
  class NoopIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function transactionsMockValue({ pageError = "", hasMore = true } = {}) {
    return {
      isLoading: false,
      error: "",
      pageError,
      hasLoaded: true,
      summary: { total_income: 0, total_expenses: 300, total_refunds: 0, balance: 300 },
      transactions: Array.from({ length: 10 }, (_, i) => ({
        id: `tx-${i}`,
        date: "21/05",
        desc: `Item ${i}`,
        cat: "Alimentação",
        val: -30,
        method: "Pix",
        type: "expense",
        icon: "🍽",
        status: "confirmado",
        rec: false,
        tags: [],
      })),
      total: 30,
      hasMore,
      removeTransaction: vi.fn(),
      setTransactionSettled: vi.fn(),
    };
  }

  it("sem pageError: sentinela presente (scroll infinito ativo, sem aviso de falha)", async () => {
    transactionsDataMock.mockReturnValue(transactionsMockValue());
    renderPage();
    await openFilters();

    expect(screen.getByTestId("load-more-sentinel")).toBeInTheDocument();
    expect(screen.queryByText("Tentar novamente")).not.toBeInTheDocument();
  });

  it("pageError liga (falha ao 'carregar mais'): sentinela SOME do DOM — nada re-dispara sozinho — e mostra 'Tentar novamente'", () => {
    transactionsDataMock.mockReturnValue(transactionsMockValue());
    const { rerender } = render(
      <TransacoesPage
        onNav={vi.fn()}
        onNewTx={vi.fn()}
        onEditTx={vi.fn()}
        isMobile={false}
        dataMode="live"
        organizationId="org-test"
        transactionsRefreshToken={0}
        onTransactionsInvalidate={vi.fn()}
      />,
    );
    expect(screen.getByTestId("load-more-sentinel")).toBeInTheDocument();

    // O hook ainda reporta `hasMore: true` (há mais páginas no backend) —
    // é exatamente o cenário do bug: só o `pageError` liga.
    transactionsDataMock.mockReturnValue(
      transactionsMockValue({ pageError: "network down", hasMore: true }),
    );
    rerender(
      <TransacoesPage
        onNav={vi.fn()}
        onNewTx={vi.fn()}
        onEditTx={vi.fn()}
        isMobile={false}
        dataMode="live"
        organizationId="org-test"
        transactionsRefreshToken={0}
        onTransactionsInvalidate={vi.fn()}
      />,
    );

    // A garantia central: a sentinela some — sem ela, o `IntersectionObserver`
    // nunca é recriado/observado de novo, o que interrompe o mecanismo da
    // tempestade na raiz.
    expect(screen.queryByTestId("load-more-sentinel")).not.toBeInTheDocument();
    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
  });

  it("clicar 'Tentar novamente' não derruba a lista já carregada", async () => {
    transactionsDataMock.mockReturnValue(
      transactionsMockValue({ pageError: "network down", hasMore: true }),
    );
    renderPage();
    await openFilters();

    expect(screen.getByText("Tentar novamente")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    // As 10 linhas já carregadas continuam na tela — clicar não some com
    // nada (o retry é uma revalidação suave da MESMA consulta).
    expect(screen.getAllByText(/Item 0/i).length).toBeGreaterThan(0);
  });
});

describe("<TransacoesPage> — lançamentos cobertos por âncora (S4)", () => {
  function seed(anchors, accounts = []) {
    listOrgBalanceAdjustmentsMock.mockResolvedValue(anchors);
    if (accounts.length) listAccountsMock.mockResolvedValue(accounts);
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "",
      summary: { total_income: 0, total_expenses: 150, total_refunds: 0, balance: -150 },
      transactions: [
        { id: "t-antigo", date: "10/08/2026", desc: "Compra antiga", cat: "Casa", val: -100,
          method: "Pix", type: "expense", icon: "🏠", status: "confirmado", rec: false, tags: [],
          settled: true, settleable: true, paidAt: "2026-08-10T12:00:00", accountId: "acc-1" },
        { id: "t-novo", date: "20/08/2026", desc: "Compra nova", cat: "Casa", val: -50,
          method: "Pix", type: "expense", icon: "🏠", status: "confirmado", rec: false, tags: [],
          settled: true, settleable: true, paidAt: "2026-08-20T12:00:00", accountId: "acc-1" },
      ],
      total: 2, hasMore: false, removeTransaction: vi.fn(), setTransactionSettled: vi.fn(),
    });
  }

  it("marca só o que é anterior ao acerto de saldo", async () => {
    seed([
      { id: "a1", account_id: "acc-1", amount: 0, asserted_balance: 300,
        date: "2026-08-13T12:00:00", reason: "conciliação", created_at: "2026-08-13T12:00:00" },
    ]);
    renderPage();
    await openFilters();

    // "Já no acerto" só na linha de 10/08; a de 20/08 é posterior e conta normalmente.
    expect(await screen.findByText("Já no acerto")).toBeInTheDocument();
    expect(screen.getAllByText("Já no acerto").length).toBe(1);
  });

  it("não marca nada quando a conta não tem acerto", async () => {
    seed([]);
    renderPage();
    await openFilters();

    expect(await screen.findByText("Compra antiga")).toBeInTheDocument();
    expect(screen.queryByText("Já no acerto")).not.toBeInTheDocument();
  });

  it("marca lançamento anterior ao saldo de ABERTURA declarado da conta", async () => {
    // Achado 10 (#72): essas contas não têm linha em balance_adjustments — a âncora
    // mora na própria conta. Sem isto, o lançamento anterior sumia do saldo em
    // silêncio, que é o que esta feature existe para impedir.
    listAccountsMock.mockResolvedValue([
      { id: "acc-1", initial_balance: 1000, initial_date: "2026-08-13" },
    ]);
    seed([]);
    renderPage();
    await openFilters();

    // 10/08 é anterior à abertura em 13/08 -> marcado; 20/08 é posterior -> não.
    expect(await screen.findByText("Antes da abertura")).toBeInTheDocument();
    expect(screen.getAllByText("Antes da abertura").length).toBe(1);
  });

  it("saldo de abertura ZERO não marca nada — não é afirmação nenhuma", async () => {
    listAccountsMock.mockResolvedValue([
      { id: "acc-1", initial_balance: 0, initial_date: "2026-08-13" },
    ]);
    seed([]);
    renderPage();
    await openFilters();

    expect(await screen.findByText("Compra antiga")).toBeInTheDocument();
    expect(screen.queryByText(/⚓/)).not.toBeInTheDocument();
  });

  it("não marca nada quando o feed de âncoras falha — avisar no escuro seria pior", async () => {
    listOrgBalanceAdjustmentsMock.mockRejectedValue(new Error("backend fora"));
    seed([]);
    listOrgBalanceAdjustmentsMock.mockRejectedValue(new Error("backend fora"));
    renderPage();
    await openFilters();

    expect(await screen.findByText("Compra antiga")).toBeInTheDocument();
    expect(screen.queryByText("Já no acerto")).not.toBeInTheDocument();
  });
});

describe("<TransacoesPage> — estabilidade das linhas (issue #66)", () => {
  it("a linha NÃO é remontada quando a página re-renderiza", async () => {
    // Semeia o próprio conjunto: `mockReturnValue` de outro describe sobrevive ao
    // clearAllMocks (ele zera chamadas, não implementações).
    transactionsDataMock.mockReturnValue({
      isLoading: false,
      error: "",
      summary: { total_income: 0, total_expenses: 90, total_refunds: 0, balance: -90 },
      transactions: [
        { id: "row-a", date: "21/05", desc: "Almoço", cat: "Alimentação", val: -40, method: "Pix",
          type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [],
          settled: true, settleable: true, paidAt: "2026-05-21T12:00:00" },
        { id: "row-b", date: "22/05", desc: "Salário", cat: "Receita", val: 5000,
          method: "Transferência", type: "income", icon: "💸", status: "confirmado", rec: false,
          tags: [], settled: true, settleable: true, paidAt: "2026-05-22T12:00:00" },
      ],
      total: 2,
      hasMore: false,
      removeTransaction: vi.fn(),
      setTransactionSettled: vi.fn(),
    });
    renderPage();
    await openFilters();

    const before = screen.getAllByText("Almoço")[0].closest(".fincla-row");
    expect(before).toBeTruthy();

    // Re-render do corpo da página sem mexer na lista: selecionar OUTRA linha muda
    // `selected` (estado da página) e as transações continuam exatamente as mesmas.
    await userEvent.click(screen.getAllByText("Salário")[0]);

    const after = screen.getAllByText("Almoço")[0].closest(".fincla-row");

    // Se `TxRow`/`Tip` forem definidos dentro do corpo do componente, cada render
    // cria um TIPO novo e o React descarta a subárvore inteira em vez de atualizá-la:
    // o nó do DOM é outro objeto. Além do desperdício de CPU numa lista parada, é o
    // que faz o elemento nunca ficar "stable" para um clique automatizado — a caixa
    // que se mede num frame pertence a um nó que já não existe no seguinte.
    expect(after).toBe(before);
  });

  it("o drawer de detalhe também não é remontado", async () => {
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "",
      summary: { total_income: 0, total_expenses: 40, total_refunds: 0, balance: -40 },
      transactions: [
        { id: "row-a", date: "21/05", desc: "Almoço", cat: "Alimentação", val: -40, method: "Pix",
          type: "expense", icon: "🍽", status: "confirmado", rec: false, tags: [],
          settled: false, settleable: true, paidAt: null },
      ],
      total: 1, hasMore: false, removeTransaction: vi.fn(),
      setTransactionSettled: vi.fn().mockResolvedValue({ settled: true }),
    });
    renderPage();
    await openFilters();

    await userEvent.click(screen.getAllByText("Almoço")[0]);
    const before = screen.getByRole("button", { name: /Marcar como pago/i }).closest("div");

    // Abrir um facet re-renderiza a página com o drawer aberto. Se `DetailPanel`
    // fosse redefinido a cada render, todo o subárvore do drawer seria remontada —
    // inclusive a cada transição de `settlingId`, que o próprio botão dispara.
    await abrirFaceta("Recorrência");

    const after = screen.getByRole("button", { name: /Marcar como pago/i }).closest("div");
    expect(after).toBe(before);
  });
});

// Regressão #100 (rodada 4 de review, achado 4): a desambiguação por índice
// de ocorrência pode alongar o rótulo da tag (ex.: "mensal (1)") — o pill de
// 11px na linha da transação não tem largura garantida, então precisa
// truncar com reticências (`title` dá o texto completo no hover/a11y) em
// vez de estourar o layout.
describe("chip de tag na linha — truncagem (achado 4, rodada 4)", () => {
  it("o pill de tag tem title e estilo de truncagem (maxWidth/ellipsis)", async () => {
    // Não depende do mock default do topo do arquivo (outros testes deste
    // arquivo reconfiguram `transactionsDataMock.mockReturnValue` e
    // `vi.clearAllMocks()` não restaura o valor de retorno) — define a
    // própria transação com tag pra não ficar dependente de ordem.
    transactionsDataMock.mockReturnValue({
      isLoading: false, error: "",
      summary: { total_income: 0, total_expenses: 42.5, total_refunds: 0, balance: -42.5 },
      transactions: [
        { id: "tx-truncagem", date: "21/05", desc: "Almoço", cat: "Alimentação", val: -42.5,
          method: "Pix", type: "expense", icon: "🍽", status: "confirmado", rec: false,
          tags: ["trabalho"] },
      ],
      total: 1, hasMore: false, removeTransaction: vi.fn(),
      setTransactionSettled: vi.fn(),
    });
    // A pílula de tag existe a partir de 1200 px: abaixo disso a linha já
    // disputa largura entre descrição, categoria e valor, e o vão que financia
    // a coluna já não existe. (Era 2100 px até a coluna sair do fim da linha e
    // ir para o vão, colada na categoria.) E o texto perdeu o `#` — o fundo e o
    // formato já dizem que é tag, e o `#` roubava dois dos 78 px úteis.
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1500 });
    renderPage();
    await openFilters();

    const chip = await screen.findByText("trabalho");
    expect(chip).toHaveAttribute("title", "trabalho");
    expect(chip.style.textOverflow).toBe("ellipsis");
    expect(chip.style.whiteSpace).toBe("nowrap");
    expect(chip.style.maxWidth).not.toBe("");
  });
});
