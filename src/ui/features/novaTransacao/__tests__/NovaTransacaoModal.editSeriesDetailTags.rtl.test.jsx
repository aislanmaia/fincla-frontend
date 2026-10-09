// @vitest-environment jsdom
/**
 * Editar uma série recorrente precisa abrir com as tags de detalhe da série já
 * marcadas. O backend substitui `tag_ids` inteiro no PATCH, então um modal que abre
 * sem elas apaga as tags no próximo "Confirmar recorrência".
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const CATEGORY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DETAIL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

vi.mock("../../tags/useCategoryTagsData.js", () => ({
  useCategoryTagsData: () => ({
    isLoading: false,
    error: "",
    options: [{ value: CATEGORY_ID, label: "Moradia" }],
    categories: [{ id: CATEGORY_ID, labelPt: "Moradia", iconKey: null }],
  }),
}));

vi.mock("../../tags/useNovaTransacaoDetailTags.js", () => ({
  useNovaTransacaoDetailTags: () => ({
    findByLabel: () => null,
    ensureDetailTag: vi.fn(),
    labelForDetailId: (id) => String(id),
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

afterEach(cleanup);

const editSeriesPreConfig = {
  tipo: "despesa",
  desc: "Aluguel da casa",
  cat: "Moradia",
  categoryTagId: CATEGORY_ID,
  method: "pix",
  valorInicial: 800,
  recorre: true,
  isEditRecorrencia: true,
  recId: "series-1",
  freqRec: "mensal",
  encRec: "sem-fim",
  firstOccurrenceYmd: "2026-05-26",
};

const renderEditingSeries = (extraPreConfig) =>
  render(
    <NovaTransacaoModal
      open
      onClose={vi.fn()}
      onTransactionSaved={vi.fn()}
      isMobile={false}
      organizationId="org-1"
      dataMode="live"
      preConfig={{ ...editSeriesPreConfig, ...extraPreConfig }}
    />,
  );

describe("NovaTransacaoModal — editar série recorrente", () => {
  it("abre com a tag de detalhe da série marcada", () => {
    renderEditingSeries({
      detailTagIds: [DETAIL_ID],
      detailTagDisplayById: { [DETAIL_ID]: "aluguel" },
      detailTagMetaById: { [DETAIL_ID]: { id: DETAIL_ID, name: "aluguel", isActive: true } },
    });

    expect(screen.getAllByText("+ aluguel").length).toBeGreaterThan(0);
  });

  it("série sem tags de detalhe abre sem chip marcado", () => {
    renderEditingSeries({ detailTagIds: [] });

    expect(screen.queryByText(/^\+ aluguel$/)).not.toBeInTheDocument();
  });
});
