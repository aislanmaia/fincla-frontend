// @vitest-environment jsdom
import { AxiosError } from "axios";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobre o comportamento VISÍVEL prometido pela política de retry manual de
 * `transactionsAdapter.js` (issue #82 / PR #98): sem esse teste, apagar
 * `setTxCreateFailed(true)` ou os dois rótulos "Tentar novamente" deixava a
 * suíte inteira verde — a entrega real (o que a pessoa vê no formulário)
 * nunca era exercitada, só a contagem de POSTs no adapter.
 *
 * Só `createTransactionForUi` é mockada (o limite de rede) — `formatTransactionsApiError`
 * e `isCreateTransactionErrorMaybePersisted` rodam de verdade, então a
 * classificação segura/ambíguo é testada de ponta a ponta, não simulada.
 */

// Referências ESTÁVEIS entre renders — de propósito. O componente tem um
// `useEffect` (reset de erro ao abrir/trocar de transação) com
// `categoryTagsData.categories` na dependência; um mock que devolvesse um
// array NOVO a cada render faria esse efeito rodar de novo a cada re-render
// (inclusive o causado por `setTxSubmitError` no catch), zerando o erro que
// acabou de aparecer — um hook real (stateful) nunca faria isso.
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
  return {
    ...actual,
    createTransactionForUi: vi.fn(),
  };
});

import { createTransactionForUi } from "../../../data/transactionsAdapter.js";
import { NovaTransacaoModal } from "../NovaTransacaoModal.jsx";

function httpError(status, data = {}) {
  return new AxiosError(`Request failed with status code ${status}`, undefined, {}, undefined, {
    status,
    data,
    statusText: "",
    headers: {},
    config: {},
  });
}

function networkError() {
  return new AxiosError("Network Error", "ERR_NETWORK");
}

async function fillAndReachReview(user) {
  const textarea = document.querySelector("textarea");
  await user.type(textarea, "Uber");

  const amountInput = screen.getByPlaceholderText("0,00");
  await user.type(amountInput, "4200");

  await user.click(screen.getByRole("button", { name: /Revisar despesa/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Confirmar despesa/i })).toBeInTheDocument());
}

describe("NovaTransacaoModal — criação que falha (reenvio manual, sem retry automático)", () => {
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    onTransactionSaved: vi.fn(),
    isMobile: false,
    organizationId: "org-1",
    dataMode: "live",
  };

  beforeEach(() => {
    createTransactionForUi.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("422 (SEGURO — API valida antes de gravar): erro em PT-BR, formulário preenchido e utilizável, botão \"Tentar novamente\" reenvia direto", async () => {
    const user = userEvent.setup();
    createTransactionForUi
      .mockRejectedValueOnce(httpError(422, {}))
      .mockResolvedValueOnce({ id: 1 });

    render(<NovaTransacaoModal {...baseProps} />);
    await fillAndReachReview(user);

    await user.click(screen.getByRole("button", { name: /Confirmar despesa/i }));

    // Erro em PT-BR visível.
    await waitFor(() =>
      expect(screen.getByText(/Não foi possível concluir a operação/i)).toBeInTheDocument(),
    );
    // Formulário permanece preenchido — a revisão continua mostrando os dados
    // digitados (não foi limpo nem voltou pro passo anterior por causa do erro).
    expect(screen.getByText("Uber")).toBeInTheDocument();

    // Botão vira "Tentar novamente" (reenvio explícito, não automático).
    const retryBtn = await screen.findByRole("button", { name: "Tentar novamente" });
    expect(retryBtn).toBeInTheDocument();

    // Reenvio: decisão da pessoa, sem window.confirm (erro seguro de reenviar).
    const confirmSpy = vi.spyOn(window, "confirm");
    await user.click(retryBtn);
    expect(confirmSpy).not.toHaveBeenCalled();

    await waitFor(() => expect(createTransactionForUi).toHaveBeenCalledTimes(2));
  });

  it("erro de REDE (AMBÍGUO — pode já ter gravado): mensagem avisa para conferir o extrato, botão pede confirmação antes de reenviar", async () => {
    const user = userEvent.setup();
    createTransactionForUi.mockRejectedValueOnce(networkError());

    render(<NovaTransacaoModal {...baseProps} />);
    await fillAndReachReview(user);

    await user.click(screen.getByRole("button", { name: /Confirmar despesa/i }));

    await waitFor(() =>
      expect(screen.getByText(/confira seu extrato antes de tentar de novo/i)).toBeInTheDocument(),
    );
    expect(screen.getByText("Uber")).toBeInTheDocument();

    const retryBtn = await screen.findByRole("button", { name: "Tentar novamente mesmo assim" });
    expect(retryBtn).toBeInTheDocument();

    // Clicar sem confirmar: NÃO reenvia (evita duplicar).
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await user.click(retryBtn);
    expect(createTransactionForUi).toHaveBeenCalledTimes(1);

    // Confirmando: reenvia.
    createTransactionForUi.mockResolvedValueOnce({ id: 2 });
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    await user.click(retryBtn);
    await waitFor(() => expect(createTransactionForUi).toHaveBeenCalledTimes(2));
  });

  it("500 (AMBÍGUO): também exige confirmação — não é só a família de rede", async () => {
    const user = userEvent.setup();
    createTransactionForUi.mockRejectedValueOnce(httpError(500));

    render(<NovaTransacaoModal {...baseProps} />);
    await fillAndReachReview(user);
    await user.click(screen.getByRole("button", { name: /Confirmar despesa/i }));

    const retryBtn = await screen.findByRole("button", { name: "Tentar novamente mesmo assim" });
    expect(retryBtn).toBeInTheDocument();
  });

  it("fechar e reabrir o drawer limpa o \"Tentar novamente\" de uma falha anterior (reabrir pra EDITAR não pode herdar a ação de CRIAR)", async () => {
    const user = userEvent.setup();
    createTransactionForUi.mockRejectedValueOnce(httpError(422, {}));

    const { rerender } = render(<NovaTransacaoModal {...baseProps} />);
    await fillAndReachReview(user);
    await user.click(screen.getByRole("button", { name: /Confirmar despesa/i }));
    await screen.findByRole("button", { name: "Tentar novamente" });

    // O drawer nunca desmonta — fechar/reabrir é só a prop `open` variando.
    rerender(<NovaTransacaoModal {...baseProps} open={false} />);
    rerender(<NovaTransacaoModal {...baseProps} open={true} />);

    // Prova forte: navega até a revisão de novo e confirma que o botão
    // voltou a ser "Confirmar despesa" — não basta o botão antigo sumir por
    // estarmos numa etapa diferente do assistente; precisa ter voltado ao
    // estado normal de fato.
    await fillAndReachReview(user);
    expect(screen.queryByRole("button", { name: /Tentar novamente/i })).not.toBeInTheDocument();
  });

  it("sucesso na criação: falha num efeito PÓS-salvamento (cache/callback) nunca mostra \"Tentar novamente\" — a transação já foi criada no servidor, reenviar duplicaria", async () => {
    const user = userEvent.setup();
    createTransactionForUi.mockResolvedValueOnce({ id: 1 });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onTransactionSaved = vi.fn(() => {
      throw new Error("callback do pai quebrou depois do POST ter sido confirmado");
    });

    render(<NovaTransacaoModal {...baseProps} onTransactionSaved={onTransactionSaved} />);
    await fillAndReachReview(user);
    await user.click(screen.getByRole("button", { name: /Confirmar despesa/i }));

    await waitFor(() => expect(onTransactionSaved).toHaveBeenCalledTimes(1));
    expect(createTransactionForUi).toHaveBeenCalledTimes(1);

    // O POST já tinha sucesso confirmado pelo servidor — nenhum botão de
    // reenvio deve aparecer, senão um clique cria uma segunda transação.
    expect(screen.queryByRole("button", { name: /Tentar novamente/i })).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
