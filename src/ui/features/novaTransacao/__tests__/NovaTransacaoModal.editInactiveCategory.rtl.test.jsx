// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lançamento cuja categoria foi apagada (soft-delete): o backend (#364) deixa editar descrição, valor e data
 * e aceita a categoria apagada de volta em `tag_ids`. A tela mantém a categoria como "indisponível" e salva,
 * em vez de trocá-la em silêncio ou exigir outra categoria.
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

vi.mock("../../../data/transactionsAdapter.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, updateTransactionForUi: vi.fn().mockResolvedValue({ id: 203 }) };
});

import { updateTransactionForUi } from "../../../data/transactionsAdapter.js";
import { NovaTransacaoModal } from "../NovaTransacaoModal.jsx";

const GONE = "6dd9306c-dae1-4f02-8bbf-ea73887f14ff";

describe("NovaTransacaoModal — editar lançamento de categoria apagada", () => {
  const props = {
    open: true, onClose: vi.fn(), onTransactionSaved: vi.fn(), isMobile: false, organizationId: "org-1", dataMode: "live",
    preConfig: { tipo: "despesa", desc: "Feira", cat: "QA Cat", categoryTagId: GONE, categoryTagIsActive: false, method: "pix", valorInicial: 25, editingTransactionId: 203, dateIso: "2026-10-20", tags: [], detailTagIds: [], detailTagDisplayById: {} },
  };
  beforeEach(() => updateTransactionForUi.mockClear());
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("mantém a categoria apagada como 'indisponível' em vez de cair na primeira", async () => {
    render(<NovaTransacaoModal {...props} />);
    const select = await screen.findByDisplayValue(/QA Cat \(indisponível\)/);
    expect(select.value).toBe(GONE);
  });

  it("salva a edição reenviando a categoria apagada, sem pedir outra categoria", async () => {
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...props} />);
    await user.type(document.querySelector("textarea"), " editada");
    await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
    await user.click(await screen.findByRole("button", { name: /Confirmar despesa/i }));
    await waitFor(() => expect(updateTransactionForUi).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Selecione uma nova categoria ativa/i)).not.toBeInTheDocument();
    const payload = updateTransactionForUi.mock.calls[0][2];
    expect(JSON.stringify(payload)).toContain(GONE);
  });

  it("no celular, o passo Detalhes mostra a categoria apagada como chip selecionado e 'indisponível'", async () => {
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...props} isMobile />);
    await user.click(await screen.findByRole("button", { name: /Continuar/i }));
    const chip = await screen.findByRole("button", { name: /QA Cat \(indisponível\)/ });
    expect(chip).toBeInTheDocument();
  });
});
