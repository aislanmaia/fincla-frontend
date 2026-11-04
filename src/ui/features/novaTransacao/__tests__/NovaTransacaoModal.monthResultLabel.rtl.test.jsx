// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * O número do topo do formulário é receitas − despesas do mês (o mesmo "Resultado do
 * período" da Visão Geral), NÃO saldo de conta. Com várias contas, "Saldo no mês" era
 * lido como "o meu dinheiro". Hoje (errado) "Saldo no mês"; esperado "Resultado do mês".
 */

const MOCK_CATEGORY_ROWS = [{ id: "cat-1", labelPt: "Alimentação", iconKey: null }];
const MOCK_CATEGORY_OPTIONS = [{ value: "cat-1", label: "Alimentação" }];

vi.mock("../../tags/useCategoryTagsData.js", () => ({
  useCategoryTagsData: () => ({
    isLoading: false,
    error: "",
    options: MOCK_CATEGORY_OPTIONS,
    categories: MOCK_CATEGORY_ROWS,
  }),
}));

vi.mock("../../tags/useNovaTransacaoDetailTags.js", () => ({
  useNovaTransacaoDetailTags: () => ({
    findByLabel: () => null,
    ensureDetailTag: vi.fn(),
    labelForDetailId: () => "",
    detailTagRowsForCategory: [],
    error: "",
  }),
}));

vi.mock("../useNovaTransacaoFinancialImpact.js", () => ({
  useNovaTransacaoFinancialImpact: () => ({
    impactLive: false,
    preview: null,
    previewLoading: false,
    previewError: "",
    spendingLoading: false,
    spendingError: "",
    chartData: [],
    refLineDay: null,
    showProjLine: false,
    categoryProjectedEom: null,
    categoryProjectionMeta: null,
  }),
}));

let periodSaldoMock = { periodBalance: -201.34, loading: false, error: "", live: true };
vi.mock("../useNovaTransacaoPeriodSaldo.js", () => ({
  useNovaTransacaoPeriodSaldo: () => periodSaldoMock,
  projectedBalanceAfterTx: () => null,
  fmtSaldoLine: (v) => (v == null ? "—" : `R$ ${Math.abs(v).toFixed(2).replace(".", ",")}`),
  clearNovaTransacaoSummaryCache: vi.fn(),
}));

vi.mock("../../../../api/creditCards", () => ({
  listCreditCards: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../api/balances", () => ({
  getOrgBalances: vi.fn().mockResolvedValue({ accounts: [] }),
}));

import { NovaTransacaoModal } from "../NovaTransacaoModal.jsx";

const renderModal = (isMobile = false) => render(
  <NovaTransacaoModal open onClose={vi.fn()} onTransactionSaved={vi.fn()} isMobile={isMobile} organizationId="org-1" dataMode="live"
    preConfig={{ tipo: "despesa", desc: "Mercado", method: "pix", valorInicial: 10, tags: [], detailTagIds: [], detailTagDisplayById: {} }} />,
);

describe("NovaTransacaoModal — 'Resultado do mês', não 'Saldo no mês'", () => {
  afterEach(cleanup);

  it.each([false, true])("o rótulo do número do mês é 'Resultado do mês' (celular: %s)", async (isMobile) => {
    periodSaldoMock = { periodBalance: -201.34, loading: false, error: "", live: true };
    const { container } = renderModal(isMobile);
    await waitFor(() => expect(container.textContent).toContain("Resultado do mês:"));
    expect(container.textContent).not.toContain("Saldo no mês");
  });

  it.each([false, true])("sem o número: 'Resultado do mês indisponível' (celular: %s)", async (isMobile) => {
    periodSaldoMock = { periodBalance: null, loading: false, error: "falhou", live: true };
    const { container } = renderModal(isMobile);
    await waitFor(() => expect(container.textContent).toContain("Resultado do mês indisponível"));
    expect(container.textContent).not.toContain("Saldo no mês");
  });
});
