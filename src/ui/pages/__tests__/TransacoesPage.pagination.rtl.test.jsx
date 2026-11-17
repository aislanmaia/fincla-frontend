/** @vitest-environment jsdom */
import React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * fincla-api#535 — o scroll infinito das Transações pelo hook de dados DE
 * VERDADE: só `api/transactions` é dublado, por um servidor que pagina como o
 * real (fatia por `page`/`limit`, recusa `limit` acima de 100). A lista parava
 * em 100 porque a rolagem só aumentava o `limit` do mesmo pedido.
 */

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useRouterState: (opts) =>
    typeof opts?.select === "function"
      ? opts.select({ location: { pathname: "/transactions", search: {} } })
      : { location: { pathname: "/transactions", search: {} } },
}));

/* Referências ESTÁVEIS entre renders, como os hooks de verdade: com o hook de dados
   real, um array novo por render vira consulta nova a cada render — um laço. */
const STABLE = vi.hoisted(() => ({
  categories: { isLoading: false, categories: [{ id: "cat-alim", labelPt: "Alimentação", color: "#059669" }] },
  tags: { rows: [], loading: false, error: "" },
  facets: { counts: null, isLoading: false, total: null, buckets: null, optionCount: () => null, optionCountByLabel: () => null, binaryCount: () => null },
  narrowest: { narrowest: null },
}));
vi.mock("../../features/tags/useCategoryTagsData.js", () => ({ useCategoryTagsData: () => STABLE.categories }));
vi.mock("../../features/transactions/filters/useTransactionsTagCatalog.js", () => ({
  useTransactionsTagCatalog: () => STABLE.tags,
}));
vi.mock("../../features/transactions/useTransactionsFacetCounts.js", () => ({
  useTransactionsFacetCounts: () => STABLE.facets,
}));
vi.mock("../../features/transactions/useNarrowestFilter.js", () => ({ useNarrowestFilter: () => STABLE.narrowest }));
vi.mock("../../../api/balanceAdjustments", () => ({ listOrgBalanceAdjustments: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../api/accounts", () => ({ listAccounts: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../api/transfers", () => ({ listTransfers: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../api/creditCards", async (importOriginal) => ({
  ...(await importOriginal()),
  listCreditCards: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../api/organizations", () => ({
  getOrganization: vi.fn(() => Promise.resolve({ id: "org-test", base_currency: "BRL" })),
}));
vi.mock("../../features/export/saveBlob.js", () => ({ saveBlob: vi.fn() }));
/* A paginação é do hook e da página, não da linha: uma linha mínima no lugar
   do `TxRow` completo tira o custo de desenhar 510 linhas reais no jsdom (o
   teste dos 510 levava ~20 s e estourava o teto com a máquina carregada). */
vi.mock("../../features/transactions/shared/TransactionRow.jsx", async (importOriginal) => ({
  ...(await importOriginal()),
  TxRow: ({ tx }) => <div data-testid="tx-row-stub">{tx.desc}</div>,
}));
const listTransactionsMock = vi.fn();
const summaryApiMock = vi.fn();
vi.mock("../../../api/transactions", async (importOriginal) => ({
  ...(await importOriginal()),
  listTransactions: (...args) => listTransactionsMock(...args),
  getTransactionsSummary: (...args) => summaryApiMock(...args),
}));

import { TransacoesPage } from "../TransacoesPage.jsx";

/* jsdom não tem IntersectionObserver. Este guarda os observadores vivos e deixa
   o teste "rolar até o fim": dispara a entrada da sentinela em quem observa. */
const observers = new Set();
/* Sentinela que continua à vista depois de cada página (tela alta): o
   observador recriado entrega a interseção logo ao observar, como o real. */
let sentinelStaysInView = false;
class ManualIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = [];
  }
  observe(target) {
    this.targets.push(target);
    observers.add(this);
    if (sentinelStaysInView) {
      setTimeout(() => {
        if (observers.has(this)) this.callback([{ isIntersecting: true, target }]);
      }, 0);
    }
  }
  unobserve() {}
  disconnect() {
    observers.delete(this);
  }
}
function scrollToEnd() {
  act(() => {
    for (const io of [...observers]) {
      io.callback(io.targets.map((target) => ({ isIntersecting: true, target })));
    }
  });
}

const apiRow = (n) => ({
  id: n, description: `Compra ${n}`, amount: -1, value: 1, type: "expense", date: "2026-11-10", tags: {},
});
let serverRows;
let failOnce;
const SUMMARY = { total_income: 0, total_expenses: 510, total_refunds: 0, balance: -510, currency: "BRL" };

beforeEach(() => {
  localStorage.clear();
  observers.clear();
  sentinelStaysInView = false;
  vi.stubGlobal("IntersectionObserver", ManualIntersectionObserver);
  serverRows = Array.from({ length: 510 }, (_, i) => apiRow(i + 1));
  failOnce = new Set();
  listTransactionsMock.mockImplementation(async (q) => {
    const page = Number(q.page);
    const limit = Number(q.limit);
    if (limit > 100) throw Object.assign(new Error("422"), { response: { status: 422, data: {} } });
    if (failOnce.has(page)) {
      failOnce.delete(page);
      throw new Error("network down");
    }
    const total = serverRows.length;
    return {
      data: serverRows.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total, pages: Math.ceil(total / limit), has_next: page * limit < total, has_prev: page > 1 },
    };
  });
  summaryApiMock.mockImplementation(() => Promise.resolve(SUMMARY));
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const props = (extra = {}) => ({
  onNav: vi.fn(), onNewTx: vi.fn(), onEditTx: vi.fn(), isMobile: false, dataMode: "live",
  organizationId: "org-test", transactionsRefreshToken: 0, onTransactionsInvalidate: vi.fn(), ...extra,
});
const requests = () => listTransactionsMock.mock.calls.map(([q]) => q);
const pageSize = () => requests()[0].limit;

/** Rola até o fim e espera a página seguinte chegar. */
async function loadNextPage() {
  const before = listTransactionsMock.mock.calls.length;
  await waitFor(() => expect(screen.getByTestId("load-more-sentinel")).toBeInTheDocument());
  scrollToEnd();
  await waitFor(() => expect(listTransactionsMock.mock.calls.length).toBeGreaterThan(before));
  await waitFor(() => expect(screen.queryByText("Carregando mais…")).toBeNull());
}

async function firstPageLoaded() {
  await screen.findByText("Compra 1");
}

describe("<TransacoesPage> — scroll infinito pagina de verdade (fincla-api#535)", () => {
  it("rolar pede page 2 e 3 com o MESMO limit (o tamanho da página) e soma as linhas", async () => {
    render(<TransacoesPage {...props()} />);
    await firstPageLoaded();
    const size = pageSize();
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThanOrEqual(100);

    await loadNextPage();
    await loadNextPage();

    expect(requests().map((q) => [q.page, q.limit])).toEqual([[1, size], [2, size], [3, size]]);
    // As linhas das três páginas estão na tela, a primeira e a última.
    expect(screen.getByText("Compra 1")).toBeInTheDocument();
    expect(screen.getByText(`Compra ${3 * size}`)).toBeInTheDocument();
    expect(screen.queryByText(`Compra ${3 * size + 1}`)).toBeNull();
    // Paginar não repete o resumo.
    expect(summaryApiMock).toHaveBeenCalledTimes(1);
  });

  it("sentinela que continua à vista: as páginas seguem chegando sem nova rolagem, até o fim", async () => {
    serverRows = serverRows.slice(0, 95);
    sentinelStaysInView = true;
    render(<TransacoesPage {...props()} />);
    await firstPageLoaded();
    const size = pageSize();
    const pages = Math.ceil(95 / size);
    await screen.findByText("Compra 95", {}, { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 30));
    expect(requests().map((q) => [q.page, q.limit])).toEqual(
      Array.from({ length: pages }, (_, i) => [i + 1, size]),
    );
    expect(screen.getByText("Fim da lista")).toBeInTheDocument();
  });

  it("com 510 lançamentos carrega os 510, mostra o fim da lista e não pede mais nada", async () => {
    render(<TransacoesPage {...props()} />);
    await firstPageLoaded();
    const size = pageSize();
    const pages = Math.ceil(510 / size);
    for (let i = 1; i < pages; i += 1) await loadNextPage();

    expect(await screen.findByText("Compra 510")).toBeInTheDocument();
    expect(screen.getByText("Fim da lista")).toBeInTheDocument();
    expect(screen.queryByTestId("load-more-sentinel")).toBeNull();
    expect(requests().map((q) => q.page)).toEqual(Array.from({ length: pages }, (_, i) => i + 1));
    for (const q of requests()) expect(q.limit).toBe(size);

    scrollToEnd();
    await new Promise((r) => setTimeout(r, 30));
    expect(listTransactionsMock).toHaveBeenCalledTimes(pages);
  });

  it("trocar o filtro recomeça da página 1", async () => {
    const user = userEvent.setup();
    render(<TransacoesPage {...props()} />);
    await firstPageLoaded();
    // Abre a faceta antes de rolar: com a lista curta as buscas por papel são baratas.
    const btn = screen.queryAllByRole("button", { name: /^(Abrir |Fechar )?Filtros/i })[0];
    if (btn && btn.getAttribute("aria-expanded") !== "true") await user.click(btn);
    const tipo = screen.queryAllByRole("button").find((b) => /Tipo\s*$/i.test(b.textContent || ""));
    await user.click(tipo);
    const despesa = screen.getByRole("button", { name: "Despesa" });
    await loadNextPage();
    await loadNextPage();
    const size = pageSize();

    listTransactionsMock.mockClear();
    await user.click(despesa);

    await waitFor(() => expect(requests().some((q) => q.type === "expense")).toBe(true));
    const filtered = requests().filter((q) => q.type === "expense");
    expect(filtered.map((q) => [q.page, q.limit])).toEqual([[1, size]]);
    // As páginas 2 e 3 do recorte anterior saíram da tela.
    await waitFor(() => expect(screen.queryByText(`Compra ${2 * size}`)).toBeNull());

    await loadNextPage();
    expect(requests().at(-1)).toMatchObject({ type: "expense", page: 2, limit: size });
  });

  it("trocar de organização recomeça da página 1", async () => {
    const { rerender } = render(<TransacoesPage {...props()} />);
    await firstPageLoaded();
    await loadNextPage();
    listTransactionsMock.mockClear();
    rerender(<TransacoesPage {...props({ organizationId: "org-outra" })} />);
    await waitFor(() => expect(requests().some((q) => q.organization_id === "org-outra")).toBe(true));
    for (const q of requests()) expect(q.page).toBe(1);
  });

  it("falha numa página: as linhas lidas ficam e 'Tentar novamente' pede AQUELA página", async () => {
    const user = userEvent.setup();
    render(<TransacoesPage {...props()} />);
    await firstPageLoaded();
    const size = pageSize();
    await loadNextPage();

    failOnce.add(3);
    scrollToEnd();
    const retry = await screen.findByText("Tentar novamente");
    expect(screen.getByText(`Compra ${2 * size}`)).toBeInTheDocument();
    expect(screen.queryByTestId("load-more-sentinel")).toBeNull();

    await user.click(retry);
    await screen.findByText(`Compra ${3 * size}`);
    expect(requests().map((q) => [q.page, q.limit])).toEqual([[1, size], [2, size], [3, size], [3, size]]);
    expect(screen.queryByText("Tentar novamente")).toBeNull();
    expect(screen.getByText("Compra 1")).toBeInTheDocument();
  });

  it("atualizar em segundo plano relê as páginas lidas (mesmo limit) sem duplicar nem perder linhas", async () => {
    const { rerender } = render(<TransacoesPage {...props()} />);
    await firstPageLoaded();
    const size = pageSize();
    await loadNextPage();

    serverRows.unshift(apiRow(9000));
    listTransactionsMock.mockClear();
    rerender(<TransacoesPage {...props({ transactionsRefreshToken: 1 })} />);
    await screen.findByText("Compra 9000");

    expect(requests().map((q) => [q.page, q.limit]).sort()).toEqual([[1, size], [2, size]]);
    expect(screen.getAllByText("Compra 1")).toHaveLength(1);
    expect(screen.getByText(`Compra ${2 * size - 1}`)).toBeInTheDocument();
    expect(screen.queryByText(`Compra ${2 * size}`)).toBeNull();
  });

  it("G3-P-01: uma página da atualização em segundo plano falha — a lista fica, aviso discreto, sem faixa de erro, e a rolagem segue", async () => {
    const { rerender } = render(<TransacoesPage {...props()} />);
    await firstPageLoaded();
    const size = pageSize();
    await loadNextPage();

    serverRows.unshift(apiRow(9000));
    failOnce.add(2);
    rerender(<TransacoesPage {...props({ transactionsRefreshToken: 1 })} />);
    await screen.findByText("Não foi possível atualizar a lista. Mostrando o que já estava carregado.");

    // Nada da releitura entrou pela metade: nem a 9000 nova, nem linha sumida.
    expect(screen.queryByText("Compra 9000")).toBeNull();
    expect(screen.getByText(`Compra ${2 * size}`)).toBeInTheDocument();
    expect(screen.queryByText("network down")).toBeNull();

    await loadNextPage();
    expect(requests().at(-1)).toMatchObject({ page: 3, limit: size });
  });

  it("'Selecionar lançamentos carregados' marca tudo o que já foi lido, acima de 100", async () => {
    const user = userEvent.setup();
    render(<TransacoesPage {...props()} />);
    await firstPageLoaded();
    const size = pageSize();
    const pages = Math.ceil(120 / size);
    for (let i = 1; i < pages; i += 1) await loadNextPage();
    const loaded = pages * size;
    expect(loaded).toBeGreaterThan(100);

    await user.click(screen.getByRole("checkbox", { name: "Selecionar lançamentos carregados" }));
    await user.click(within(screen.getByTestId("bulk-selection-bar")).getByRole("button", { name: "Exportar seleção" }));
    const panel = await screen.findByRole("dialog", { name: "Exportar seleção" });
    expect(within(panel).getByRole("region", { name: "Lançamentos exportados" }))
      .toHaveTextContent(`${loaded} lançamentos selecionados`);
  });
});
