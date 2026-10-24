// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Modalidade Parcelado: o texto está em português e os valores por parcela usam vírgula decimal.
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

describe("NovaTransacaoModal — Parcelado em português", () => {
  afterEach(cleanup);

  it("mostra 'Dividir em parcelas' e valores com vírgula", async () => {
    const user = userEvent.setup();
    render(
      <NovaTransacaoModal
        open onClose={vi.fn()} onTransactionSaved={vi.fn()} isMobile={false} organizationId="org-1" dataMode="live"
        preConfig={{ tipo: "despesa", desc: "Sofá", method: "credito", valorInicial: 120, tags: [], detailTagIds: [], detailTagDisplayById: {} }}
      />,
    );
    await user.click(await screen.findByText("Parcelado"));
    expect(await screen.findByText("Dividir em parcelas")).toBeTruthy();
    expect(screen.queryByText(/installments/i)).toBeNull();
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll("style").forEach((n) => n.remove());
    const visible = clone.textContent;
    expect(visible).toMatch(/R\$ 120,00 total/);
    expect(visible).toMatch(/3×40,00/);
    expect(visible).not.toMatch(/\d\.\d{2}\b/);
  });
});
