// @vitest-environment jsdom
/**
 * Editar uma série recorrente precisa abrir com as tags de detalhe da série já
 * marcadas. O backend substitui `tag_ids` inteiro no PATCH, então um modal que abre
 * sem elas apaga as tags no próximo "Confirmar recorrência".
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const CATEGORY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DETAIL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SERIES_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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

const updateRecurringSeriesForUiMock = vi.fn().mockResolvedValue({});
vi.mock("../../../data/recurringSeriesAdapter.js", async (importOriginal) => ({
  ...(await importOriginal()),
  updateRecurringSeriesForUi: (...args) => updateRecurringSeriesForUiMock(...args),
}));

import { mapRecurringSeriesToUi } from "../../../data/recurringSeriesAdapter.js";
import { buildEditRecurringPreConfig } from "../buildEditRecurringPreConfig.js";
import { NovaTransacaoModal } from "../NovaTransacaoModal.jsx";

afterEach(() => {
  cleanup();
  updateRecurringSeriesForUiMock.mockClear();
});

const editSeriesPreConfig = {
  tipo: "despesa",
  desc: "Aluguel da casa",
  cat: "Moradia",
  categoryTagId: CATEGORY_ID,
  method: "pix",
  valorInicial: 800,
  recorre: true,
  isEditRecorrencia: true,
  recId: SERIES_ID,
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

  it("salvar sem mexer nas tags mantém a categoria e a tag de detalhe no PATCH", async () => {
    const series = {
      id: SERIES_ID,
      description: "Aluguel da casa",
      type: "expense",
      value: "800.00",
      frequency: "monthly",
      payment_method: "pix",
      is_active: true,
      day_of_month: 26,
      start_date: "2026-05-26",
      tags: [
        { id: CATEGORY_ID, name: "Housing", is_active: true, tag_type: { id: "t1", name: "categoria" } },
        { id: DETAIL_ID, name: "aluguel", is_active: true, tag_type: { id: "t2", name: "detalhe" } },
      ],
    };
    const user = userEvent.setup();
    render(
      <NovaTransacaoModal
        open
        onClose={vi.fn()}
        onTransactionSaved={vi.fn()}
        isMobile={false}
        organizationId="org-1"
        dataMode="live"
        preConfig={buildEditRecurringPreConfig(mapRecurringSeriesToUi(series))}
      />,
    );

    // O painel de recorrência abre sozinho na edição e tem o próprio "Confirmar
    // recorrência" (só fecha o painel). O que salva é o da etapa de revisão.
    await user.click(screen.getByRole("button", { name: /Revisar recorrência/i }));
    const confirmButtons = await screen.findAllByRole("button", { name: /Confirmar recorrência/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(updateRecurringSeriesForUiMock).toHaveBeenCalledTimes(1));
    const [seriesId, , payload] = updateRecurringSeriesForUiMock.mock.calls[0];
    expect(seriesId).toBe(SERIES_ID);
    expect(payload.tag_ids).toEqual([CATEGORY_ID, DETAIL_ID]);
  });
});
