// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * O toggle "já paguei?" fala a língua do tipo: receita se RECEBE, não se paga.
 * Hoje (errado) a receita dizia "Já paguei"; esperado: "Já recebi".
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

vi.mock("../useNovaTransacaoPeriodSaldo.js", () => ({
  useNovaTransacaoPeriodSaldo: () => ({ periodBalance: null, loading: false, error: "", live: false }),
  projectedBalanceAfterTx: () => null,
  fmtSaldoLine: () => "",
  clearNovaTransacaoSummaryCache: vi.fn(),
}));

vi.mock("../../../../api/creditCards", () => ({
  listCreditCards: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../api/balances", () => ({
  getOrgBalances: vi.fn().mockResolvedValue({ accounts: [] }),
}));

import { NovaTransacaoModal } from "../NovaTransacaoModal.jsx";

function renderModal(tipo) {
  return render(
    <NovaTransacaoModal
      open onClose={vi.fn()} onTransactionSaved={vi.fn()} isMobile={false} organizationId="org-1" dataMode="live"
      preConfig={{ tipo, desc: "Lançamento", method: "pix", valorInicial: 120, tags: [], detailTagIds: [], detailTagDisplayById: {} }}
    />,
  );
}

describe("NovaTransacaoModal — toggle de liquidação por tipo", () => {
  afterEach(cleanup);

  it("despesa mantém 'Já paguei' / 'Ainda não paguei'", async () => {
    const user = userEvent.setup();
    renderModal("despesa");
    await user.click(await screen.findByText("Já paguei"));
    expect(screen.getByText("Ainda não paguei")).toBeTruthy();
    expect(screen.getByText("Fica como compromisso pendente.")).toBeTruthy();
    expect(screen.queryByText(/recebi/)).toBeNull();
  });

  it("receita mostra 'Já recebi' / 'Ainda não recebi'", async () => {
    const user = userEvent.setup();
    renderModal("receita");
    await user.click(await screen.findByText("Já recebi"));
    expect(screen.getByText("Ainda não recebi")).toBeTruthy();
    expect(screen.getByText("Fica como valor a receber.")).toBeTruthy();
    expect(screen.queryByText(/paguei/)).toBeNull();
  });

  it("trocar de despesa para receita troca o texto", async () => {
    const user = userEvent.setup();
    renderModal("despesa");
    expect(await screen.findByText("Já paguei")).toBeTruthy();
    await user.click(screen.getByText("↓ Receita"));
    await waitFor(() => expect(screen.getByText("Já recebi")).toBeTruthy());
    expect(screen.queryByText("Já paguei")).toBeNull();
  });
});
