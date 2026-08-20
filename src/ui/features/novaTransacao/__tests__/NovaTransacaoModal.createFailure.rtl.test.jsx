// @vitest-environment jsdom
import { AxiosError } from "axios";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobre o comportamento VISÍVEL prometido pela política de reenvio de
 * `transactionsAdapter.js` (issues #82/#102/#103): sem esse teste, apagar
 * `setTxCreateFailed(true)` ou os rótulos "Tentar novamente" deixava a suíte
 * inteira verde — a entrega real (o que a pessoa vê no formulário) nunca era
 * exercitada, só a contagem de POSTs no adapter.
 *
 * Com `Idempotency-Key`, reenviar o MESMO lançamento não pode duplicar, então
 * a confirmação inline saiu do caminho comum. Ela sobrou só onde ainda
 * protege: erro AMBÍGUO seguido de EDIÇÃO dos dados — aí vai chave nova, e o
 * lançamento anterior pode existir no servidor.
 *
 * Só `createTransactionForUi` é mockada (o limite de rede). `formatTransactionsApiError`,
 * `isCreateTransactionErrorMaybePersisted` e `createTransactionPayloadFingerprint`
 * rodam de verdade, então a classificação segura/ambíguo e a comparação de
 * payload são testadas de ponta a ponta, não simuladas.
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

// `request: {}` (truthy) simula que a requisição de fato saiu do navegador —
// é isso que faz o erro contar como potencialmente-persistido em
// `isCreateTransactionErrorMaybePersisted` (real, não mockada, neste teste).
function httpError(status, data = {}) {
  return new AxiosError(`Request failed with status code ${status}`, undefined, {}, {}, {
    status,
    data,
    statusText: "",
    headers: {},
    config: {},
  });
}

function networkError() {
  return new AxiosError("Network Error", "ERR_NETWORK", {}, {});
}

async function fillAndReachReview(user) {
  const textarea = document.querySelector("textarea");
  await user.type(textarea, "Uber");

  const amountInput = screen.getByPlaceholderText("0,00");
  await user.type(amountInput, "4200");

  await user.click(screen.getByRole("button", { name: /Revisar despesa/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Confirmar despesa/i })).toBeInTheDocument());
}

describe("NovaTransacaoModal — criação que falha (reenvio manual protegido por Idempotency-Key)", () => {
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

  it("422 (SEGURO — API valida antes de gravar): erro em PT-BR, formulário preenchido e utilizável, botão \"Tentar novamente\" reenvia direto (sem confirmação)", async () => {
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

    // Reenvio direto: SEM faixa de confirmação inline (erro seguro).
    await user.click(retryBtn);
    expect(screen.queryByText(/Confira seu extrato/i)).not.toBeInTheDocument();

    await waitFor(() => expect(createTransactionForUi).toHaveBeenCalledTimes(2));
  });

  it("erro de REDE (AMBÍGUO): reenviar o MESMO lançamento vai DIRETO — a chave de idempotência já garante que não duplica", async () => {
    const user = userEvent.setup();
    createTransactionForUi.mockRejectedValueOnce(networkError());

    render(<NovaTransacaoModal {...baseProps} />);
    await fillAndReachReview(user);

    await user.click(screen.getByRole("button", { name: /Confirmar despesa/i }));

    // A mensagem passou a explicar a garantia, em vez de mandar conferir o
    // extrato antes de qualquer reenvio.
    await waitFor(() =>
      expect(screen.getByText(/não duplica o lançamento/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Confira seu extrato/i)).not.toBeInTheDocument();
    expect(screen.getByText("Uber")).toBeInTheDocument();

    // Rótulo único: acabou o "mesmo assim" cheio de dedos.
    const retryBtn = await screen.findByRole("button", { name: "Tentar novamente" });
    createTransactionForUi.mockResolvedValueOnce({ id: 2 });
    await user.click(retryBtn);

    // Um clique, um POST — sem faixa de confirmação no meio.
    await waitFor(() => expect(createTransactionForUi).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Confira seu extrato/i)).not.toBeInTheDocument();
    // E o payload reenviado é IDÊNTICO ao que falhou: é isso que faz o
    // adapter reaproveitar a chave em vez de gerar uma nova.
    expect(createTransactionForUi.mock.calls[1][0]).toEqual(createTransactionForUi.mock.calls[0][0]);
  });

  it("erro AMBÍGUO + dados EDITADOS: aí sim volta a confirmação inline, porque a chave muda e o lançamento anterior pode existir", async () => {
    // Confirmação inline, não `window.confirm`: o Playwright descarta
    // diálogos por padrão, o Chrome trava diálogos repetidos, e em jsdom a
    // chamada nem existe — um teste que dependesse de `window.confirm`
    // passaria aqui e falharia nesses ambientes reais.
    const user = userEvent.setup();
    createTransactionForUi.mockRejectedValueOnce(networkError());

    render(<NovaTransacaoModal {...baseProps} />);
    await fillAndReachReview(user);
    await user.click(screen.getByRole("button", { name: /Confirmar despesa/i }));
    await screen.findByRole("button", { name: "Tentar novamente" });

    // Volta, muda a descrição e revisa de novo: outro lançamento.
    await user.click(screen.getByRole("button", { name: /Editar/i }));
    await user.type(document.querySelector("textarea"), " para o aeroporto");
    await user.click(screen.getByRole("button", { name: /Revisar despesa/i }));

    // 1º clique arma a confirmação inline — NÃO reenvia ainda.
    await user.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText(/Confira seu extrato antes de continuar/i)).toBeInTheDocument();
    expect(createTransactionForUi).toHaveBeenCalledTimes(1);

    // Cancelar: volta ao normal, sem reenviar.
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(createTransactionForUi).toHaveBeenCalledTimes(1);
    await screen.findByRole("button", { name: "Tentar novamente" });

    // Arma de novo e confirma: reenvia (com o texto editado).
    createTransactionForUi.mockResolvedValueOnce({ id: 2 });
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await user.click(await screen.findByRole("button", { name: "Registrar assim mesmo" }));
    await waitFor(() => expect(createTransactionForUi).toHaveBeenCalledTimes(2));
    expect(createTransactionForUi.mock.calls[1][0].description).toMatch(/aeroporto/);
  });

  it("500 (AMBÍGUO): também reenvia direto — a garantia não é só da família de rede", async () => {
    const user = userEvent.setup();
    createTransactionForUi.mockRejectedValueOnce(httpError(500));

    render(<NovaTransacaoModal {...baseProps} />);
    await fillAndReachReview(user);
    await user.click(screen.getByRole("button", { name: /Confirmar despesa/i }));

    const retryBtn = await screen.findByRole("button", { name: "Tentar novamente" });
    createTransactionForUi.mockResolvedValueOnce({ id: 3 });
    await user.click(retryBtn);

    await waitFor(() => expect(createTransactionForUi).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Confira seu extrato/i)).not.toBeInTheDocument();
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
    // reenvio deve aparecer, senão um clique cria uma segunda transação. Isso
    // sozinho NÃO prova a separação dos dois try/catch: `successOverlay`
    // desmonta o formulário inteiro (`{!successOverlay && <>…}`) assim que a
    // criação termina, então esse `queryByRole` acharia "nada" tanto no
    // código certo quanto numa regressão que reintroduzisse
    // `setTxCreateFailed(true)` no catch pós-salvamento — as duas mudanças de
    // estado ficam no mesmo commit do React, batched, e a árvore some antes
    // de qualquer diferença aparecer. A asserção que realmente distingue os
    // dois catches é a de baixo: só o catch pós-salvamento (correto) loga
    // exatamente esta mensagem; uma regressão que trocasse esse log por
    // `setTxCreateFailed(true)` reprovaria aqui mesmo com o botão ausente.
    expect(screen.queryByRole("button", { name: /Tentar novamente/i })).not.toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Falha em efeito pós-salvamento (cache/callback) — a transação já foi salva no servidor:",
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
