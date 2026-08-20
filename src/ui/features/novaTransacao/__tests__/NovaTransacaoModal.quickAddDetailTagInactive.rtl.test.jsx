// @vitest-environment jsdom
/**
 * Regressão #100 (rodada 3 de review, achado 7): `addQuickDetailTag` gravava
 * `isActive: true` mesmo quando `ensureDetailTag` resolvia pra uma tag JÁ
 * ARQUIVADA (`is_active: false` na linha de `detailTagRowsForCategory`).
 * Sem repassar o `is_active` da linha resolvida, o chip aparece ativo na
 * tela e a trava de submit de tag inativa nunca dispara pra essa tag.
 *
 * Arquivo separado do resto do quick-add (não `vi.doMock`/`resetModules` no
 * meio do arquivo): cada arquivo de teste tem seu próprio grafo de módulos,
 * então o mock estático de `useNovaTransacaoDetailTags.js` pode ir direto
 * com `is_active: false` na linha, sem gambiarra de remontar mocks.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    ensureDetailTag: vi.fn(async () => "det-arquivada"),
    labelForDetailId: () => "",
    detailTagRowsForCategory: [
      {
        id: "det-arquivada",
        name: "assinatura antiga",
        is_default: false,
        parent_category_tag_id: "cat-1",
        is_active: false,
      },
    ],
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NovaTransacaoModal — quick-add resolve pra tag arquivada (regressão #100, achado 7)", () => {
  it('chip criado via quick-add herda isActive:false da linha resolvida (mostra "indisponível")', async () => {
    const user = userEvent.setup();
    render(
      <NovaTransacaoModal
        open
        onClose={vi.fn()}
        onTransactionSaved={vi.fn()}
        isMobile={false}
        organizationId="org-1"
        dataMode="live"
      />,
    );

    const categorySelect = await screen.findByDisplayValue("Alimentação");
    await user.selectOptions(categorySelect, "cat-1");

    const addButtons = screen.getAllByText("+ nova");
    await user.click(addButtons[0]);
    const input = document.activeElement;
    expect(input?.tagName).toBe("INPUT");
    await user.type(input, "assinatura antiga{Enter}");

    expect(await screen.findByText(/indisponível/)).toBeInTheDocument();
  });
});
