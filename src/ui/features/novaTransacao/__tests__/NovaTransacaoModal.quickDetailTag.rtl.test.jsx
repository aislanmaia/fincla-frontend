// @vitest-environment jsdom
/**
 * fincla-frontend#109, achado 5 (revisão da PR #109): `ensureDetailTag`
 * ganhou uma guarda de `loading` (fincla-frontend#101) que pode rejeitar de
 * propósito enquanto o catálogo de tags ainda carrega. O campo "+ nova" do
 * drawer chamava `addQuickDetailTag` sem esperar o resultado e limpava o
 * texto digitado INCONDICIONALMENTE logo em seguida — com a rejeição virando
 * rotina, o texto digitado sumia toda vez, sem nada pra tentar de novo.
 *
 * Só `ensureDetailTag` (via `useNovaTransacaoDetailTags` mockado) controla o
 * sucesso/falha aqui — o resto do drawer roda de verdade.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const ensureDetailTagMock = vi.fn();
vi.mock("../../tags/useNovaTransacaoDetailTags.js", () => ({
  useNovaTransacaoDetailTags: () => ({
    findByLabel: () => null,
    ensureDetailTag: (...args) => ensureDetailTagMock(...args),
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

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onTransactionSaved: vi.fn(),
  isMobile: false,
  organizationId: "org-1",
  dataMode: "live",
};

beforeEach(() => {
  ensureDetailTagMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Acha o input do campo "+ nova" — é o único `<input>` sem placeholder na tela. */
function findNewTagInput() {
  return screen.getAllByRole("textbox").find((el) => el.tagName === "INPUT" && !el.placeholder);
}

async function openQuickTagField(user) {
  await user.click(screen.getByText("+ nova"));
  const input = findNewTagInput();
  expect(input).toBeTruthy();
  return input;
}

describe("NovaTransacaoModal — campo \"+ nova\" tag (fincla-frontend#109 achado 5)", () => {
  it("ensureDetailTag rejeita (catálogo ainda carregando): preserva o texto digitado, não fecha o campo", async () => {
    ensureDetailTagMock.mockRejectedValue(
      new Error("Ainda carregando as tags — tente novamente em instantes."),
    );
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...baseProps} />);

    const input = await openQuickTagField(user);
    await user.type(input, "mensal");
    input.blur();

    await waitFor(() =>
      expect(screen.getByText(/Ainda carregando as tags/i)).toBeInTheDocument(),
    );

    // O texto digitado NÃO pode ter sumido — antes desta correção
    // `setNewTag("")` rodava incondicionalmente, logo após disparar a
    // chamada, sem esperar o resultado.
    const inputAfter = findNewTagInput();
    expect(inputAfter).toBeTruthy();
    expect(inputAfter.value).toBe("mensal");
  });

  it("ensureDetailTag resolve: limpa o campo e mostra o chip novo", async () => {
    ensureDetailTagMock.mockResolvedValue("tag-mensal-id");
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...baseProps} />);

    const input = await openQuickTagField(user);
    await user.type(input, "mensal");
    input.blur();

    // Campo fecha (volta a mostrar o gatilho "+ nova") e o chip aparece.
    await waitFor(() => expect(screen.getByText("+ nova")).toBeInTheDocument());
    expect(screen.queryByDisplayValue("mensal")).not.toBeInTheDocument();
    expect(screen.getByText(/mensal/i)).toBeInTheDocument();
  });
});
