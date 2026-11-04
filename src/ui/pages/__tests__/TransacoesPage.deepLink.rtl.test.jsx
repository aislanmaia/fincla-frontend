/** @vitest-environment jsdom */
/* Sem `{ timeout: N }` por describe: o teto agora é UM só, em `vite.config.ts`
   (45 s), com o porquê escrito lá. Os overrides locais nasceram do mesmo aperto
   — o orçamento cobre o `render`, e um `render` destes custa segundos quando a
   suíte divide o pool —, mas espalhados por arquivo viravam o contrário do que
   prometiam: passaram a REBAIXAR o teto global. */

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

/* Deep link /transactions?fc_*: mocka SÓ a borda HTTP (`api/transactions`) e o router.
   O hook de dados, o adapter e o estado de filtros são os REAIS — mockar o hook esconderia
   exatamente o defeito que importa (o filtro não chegar na requisição). */
let mockSearch = {};
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => mockSearch,
  useRouterState: (opts) =>
    typeof opts?.select === "function"
      ? opts.select({ location: { pathname: "/transactions" } })
      : { location: { pathname: "/transactions" } },
}));

const listTransactionsMock = vi.fn();
const getSummaryMock = vi.fn();
vi.mock("../../../api/transactions", () => ({
  listTransactions: (...a) => listTransactionsMock(...a),
  getTransactionsSummary: (...a) => getSummaryMock(...a),
  getTransactionsFacets: vi.fn().mockResolvedValue({}),
}));

/* Identidades ESTÁVEIS de propósito: com o hook de dados real, um array novo a cada render vira
   query nova a cada render e a página entra em loop de busca. */
const CATEGORY_TAGS = { isLoading: false, categories: [{ id: "cat-alim", labelPt: "Alimentação", color: "#059669" }] };
const TAG_CATALOG = { rows: [], loading: false, error: "" };
vi.mock("../../features/tags/useCategoryTagsData.js", () => ({ useCategoryTagsData: () => CATEGORY_TAGS }));
vi.mock("../../features/transactions/filters/useTransactionsTagCatalog.js", () => ({
  useTransactionsTagCatalog: () => TAG_CATALOG,
}));
vi.mock("../../../api/balanceAdjustments", () => ({ listOrgBalanceAdjustments: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../api/accounts", () => ({ listAccounts: vi.fn().mockResolvedValue([]) }));

import { formatCustomPeriodLabel } from "../../features/transactions/filters/customPeriodLabel.js";
import { TransacoesPage } from "../TransacoesPage.jsx";

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
  listTransactionsMock.mockResolvedValue({ data: [], pagination: { total: 0, page: 1, limit: 20 } });
  getSummaryMock.mockResolvedValue({ total_income: 0, total_expenses: 0, total_refunds: 0, balance: 0 });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  mockSearch = {};
});

function renderPage() {
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
    />,
  );
}

const lastListQuery = () => listTransactionsMock.mock.calls.at(-1)?.[0];

describe("<TransacoesPage> — deep link fc_from/fc_to/fc_type/fc_status", () => {
  it("a PRIMEIRA requisição já sai com período, tipo e situação do link", async () => {
    mockSearch = { fc_from: "2026-10-01", fc_to: "2026-10-31", fc_type: "expense", fc_status: "paid" };
    renderPage();
    await waitFor(() => expect(listTransactionsMock).toHaveBeenCalled());
    const first = listTransactionsMock.mock.calls[0][0];
    expect(first).toMatchObject({
      organization_id: "org-test",
      date_start: "2026-10-01",
      date_end: "2026-10-31",
      type: "expense",
      settled: true,
    });
    expect(getSummaryMock.mock.calls[0][0]).toMatchObject({ date_start: "2026-10-01", date_end: "2026-10-31", type: "expense", settled: true });
  });

  it("fc_type=income e fc_status=to_pay viram type=income e settled=false", async () => {
    mockSearch = { fc_type: "income", fc_status: "to_pay" };
    renderPage();
    await waitFor(() => expect(listTransactionsMock).toHaveBeenCalled());
    expect(lastListQuery()).toMatchObject({ type: "income", settled: false });
  });

  it("o período do link fica VISÍVEL como filtro ativo (chip)", async () => {
    mockSearch = { fc_from: "2026-10-01", fc_to: "2026-10-31" };
    renderPage();
    await waitFor(() => expect(listTransactionsMock).toHaveBeenCalled());
    // O chip descreve o intervalo pelas datas (mesmo formatador da barra), não "Este mês".
    const label = formatCustomPeriodLabel("2026-10-01", "2026-10-31");
    expect(label).not.toMatch(/este m/i);
    expect((await screen.findAllByText((t) => t.includes(label))).length).toBeGreaterThan(0);
  });

  it("não persiste o período do link como padrão do usuário", async () => {
    mockSearch = { fc_from: "2026-10-01", fc_to: "2026-10-31" };
    renderPage();
    await waitFor(() => expect(listTransactionsMock).toHaveBeenCalled());
    const keys = Object.keys(localStorage).filter((k) => localStorage.getItem(k)?.includes("2026-10-01"));
    expect(keys).toEqual([]);
  });

  it("sem params, nada é aplicado: requisição sem type/settled", async () => {
    mockSearch = {};
    renderPage();
    await waitFor(() => expect(listTransactionsMock).toHaveBeenCalled());
    const q = lastListQuery();
    expect(q.type).toBeUndefined();
    expect(q.settled).toBeUndefined();
  });

  it("from > to: período ignorado (nunca meio período), tipo/situação seguem", async () => {
    mockSearch = { fc_from: "2026-10-31", fc_to: "2026-10-01", fc_type: "expense" };
    renderPage();
    await waitFor(() => expect(listTransactionsMock).toHaveBeenCalled());
    const q = lastListQuery();
    expect(q.type).toBe("expense");
    expect(q.date_start).not.toBe("2026-10-31");
    expect(q.date_end).not.toBe("2026-10-01");
  });

  it("só uma ponta do período: ignorada", async () => {
    mockSearch = { fc_from: "2026-10-01" };
    renderPage();
    await waitFor(() => expect(listTransactionsMock).toHaveBeenCalled());
    expect(lastListQuery().date_start).not.toBe("2026-10-01");
  });

  it("valores inválidos não quebram a página nem filtram", async () => {
    mockSearch = { fc_from: "2026-02-31", fc_to: "2026-02-31", fc_type: "transfer", fc_status: "settled" };
    renderPage();
    await waitFor(() => expect(listTransactionsMock).toHaveBeenCalled());
    const q = lastListQuery();
    expect(q.type).toBeUndefined();
    expect(q.settled).toBeUndefined();
    expect(q.date_start).not.toBe("2026-02-31");
  });
});
