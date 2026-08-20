// @vitest-environment jsdom
/**
 * Regressão #100 (rodada 3 de review, achado 3): o achado 1 (chip do
 * quick-add mostrando o texto DIGITADO em vez do rótulo canônico) só tinha
 * cobertura no helper puro `resolveQuickAddDetailTagLabel` — nenhum teste
 * exercitava o CALL SITE de verdade (`addQuickDetailTag`, dentro do
 * componente). Reverter só a linha `const name = resolveQuickAddDetailTagLabel(...)`
 * de volta pra `const name = trimmed` mantinha a suíte inteira verde.
 *
 * Este teste renderiza o drawer de verdade: seleciona uma categoria que já
 * tem a linha semeada "grocery" (→ "mercado" via `detailLabelPtForTag`),
 * digita "grocery" no quick-add e confirma que o chip criado lê "mercado" —
 * o mesmo rótulo canônico das sugestões, não o texto digitado.
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

// `ensureDetailTag` simula a resolução real do hook (`findByRawNameThenLabel`
// em `useNovaTransacaoDetailTags.js`): digitar o nome cru do seed OU o
// rótulo PT já traduzido resolve pra tag JÁ EXISTENTE ("det-mercado"), não
// cria uma nova.
vi.mock("../../tags/useNovaTransacaoDetailTags.js", () => ({
  useNovaTransacaoDetailTags: () => ({
    findByLabel: () => null,
    ensureDetailTag: vi.fn(async (label) => {
      const n = String(label || "").trim().toLowerCase();
      if (n === "grocery" || n === "mercado") return "det-mercado";
      return "det-novo";
    }),
    labelForDetailId: () => "",
    detailTagRowsForCategory: [
      {
        id: "det-mercado",
        name: "grocery",
        is_default: true,
        parent_category_tag_id: "cat-1",
        is_active: true,
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

describe("NovaTransacaoModal — quick-add de tag detalhe (regressão #100, achado 1)", () => {
  it('digitar "grocery" no quick-add cria o chip com o rótulo canônico "mercado", não o texto digitado', async () => {
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

    // O input do quick-add não tem placeholder/label — é `autoFocus`, então
    // vira o elemento focado assim que substitui o "+ nova" no DOM.
    const input = document.activeElement;
    expect(input?.tagName).toBe("INPUT");
    await user.type(input, "grocery{Enter}");

    expect(await screen.findByText(/\+ mercado\b/)).toBeInTheDocument();
    expect(screen.queryByText(/\+ grocery\b/i)).not.toBeInTheDocument();
  });
});
