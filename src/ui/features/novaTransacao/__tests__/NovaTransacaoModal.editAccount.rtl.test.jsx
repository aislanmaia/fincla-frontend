// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #266 — o Editar mostrava a conta PADRÃO em vez da conta gravada, e trocar a conta
 * era ignorado em silêncio.
 *
 * Mock só no limite HTTP (`apiClient`): a hidratação do modal, `buildTxModalPreConfig`,
 * `buildUpdateTransactionPayload`, `getOrgBalances` e `handleApiError`
 * rodam de verdade. Os hooks de categoria/impacto são mockados porque não tocam conta.
 */

vi.mock("../../../../api/client", async () => {
  const actual = await vi.importActual("../../../../api/client");
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});

// Arrays ESTÁVEIS entre renders, como no hook real: uma lista nova a cada render
// redispara o efeito que limpa `txSubmitError` e apagaria a mensagem sob teste.
const MOCK_CATEGORY_OPTIONS = [{ value: "cat-1", label: "Alimentação" }];
const MOCK_CATEGORY_ROWS = [{ id: "cat-1", labelPt: "Alimentação", iconKey: null }];
vi.mock("../../tags/useCategoryTagsData.js", () => ({
  useCategoryTagsData: () => ({ isLoading: false, error: "", options: MOCK_CATEGORY_OPTIONS, categories: MOCK_CATEGORY_ROWS }),
}));
vi.mock("../../tags/useNovaTransacaoDetailTags.js", () => ({
  useNovaTransacaoDetailTags: () => ({
    findByLabel: () => null, ensureDetailTag: vi.fn(), labelForDetailId: () => "", detailTagRowsForCategory: [], error: "",
  }),
}));
vi.mock("../useNovaTransacaoFinancialImpact.js", () => ({
  useNovaTransacaoFinancialImpact: () => ({
    impactLive: false, preview: null, previewLoading: false, previewError: "", spendingLoading: false, spendingError: "",
    chartData: [], refLineDay: null, showProjLine: false, categoryProjectedEom: null, categoryProjectionMeta: null,
  }),
}));
vi.mock("../useNovaTransacaoPeriodSaldo.js", () => ({
  useNovaTransacaoPeriodSaldo: () => ({ periodBalance: null, loading: false, error: "", live: false }),
  projectedBalanceAfterTx: () => null,
  fmtSaldoLine: () => "",
  clearNovaTransacaoSummaryCache: vi.fn(),
}));

import apiClient from "../../../../api/client";
import { NovaTransacaoModal } from "../NovaTransacaoModal.jsx";
import { buildTxModalPreConfig } from "../buildTxModalPreConfig.js";

const ORG = "org-multi";
const ACC_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ACC_B = "bbbbbbbb-0000-4000-8000-000000000002";
const ACC_USD = "cccccccc-0000-4000-8000-000000000003";

const balanceRow = (account_id, name, currency, include_in_total) => ({
  account_id, name, type: "checking", include_in_total,
  balance: { amount: "1000.00", currency }, initial_balance: { amount: "0", currency },
});

/** Lançamento como a lista de /transactions o entrega: gravado na 2ª conta (B). */
const rowInB = {
  id: 501, desc: "Feira", cat: "Alimentação", categoryTagId: "cat-1", categoryTagIsActive: true,
  val: -100, type: "expense", date: "03/11/2026", dateIsoForEdit: "2026-11-03", paymentMethodKey: "pix",
  tags: [], detailTagIds: [], accountId: ACC_B, currency: "BRL", settled: true, settleable: true,
};

let putImpl;
/** Contas ativas por organização, como `GET /balances` devolve. */
let accountsByOrg;
/** Promise que segura a resposta de `/balances` (simula rede lenta); `null` = responde já. */
let balancesGate;
let balancesFail;

const OTHER_ORG = "org-other";
const ACC_X = "dddddddd-0000-4000-8000-000000000004";
const ACC_NEW = "eeeeeeee-0000-4000-8000-000000000005";

beforeEach(() => {
  accountsByOrg = {
    [ORG]: [balanceRow(ACC_A, "Conta A Itaú", "BRL", true), balanceRow(ACC_B, "Conta B Nubank", "BRL", true), balanceRow(ACC_USD, "Wise USD", "USD", false)],
    [OTHER_ORG]: [balanceRow(ACC_X, "Conta X Inter", "BRL", true)],
  };
  balancesGate = null;
  balancesFail = false;
  putImpl = (url, body) => Promise.resolve({ data: { id: 501, account_id: body.account_id ?? ACC_B } });
  apiClient.get.mockImplementation((url, config) => {
    if (url === "/balances") {
      if (balancesFail) return Promise.reject(Object.assign(new Error("500"), { isAxiosError: true, response: { status: 500, data: {} } }));
      const org = config?.params?.organization_id;
      const body = {
        data: {
          as_of: "2026-11-04T09:00:00", total: { amount: "3000", currency: "BRL" }, consolidation: { target_currency: "BRL", rates: [], unavailable: null },
          accounts: accountsByOrg[org] ?? [],
        },
      };
      return balancesGate ? balancesGate.then(() => body) : Promise.resolve(body);
    }
    return Promise.resolve({ data: [] });
  });
  apiClient.put.mockImplementation((url, body) => putImpl(url, body));
  apiClient.post.mockImplementation((url, body) => Promise.resolve({ data: { id: 900, ...body }, headers: {} }));
});

/** Pré-config de um lançamento NOVO (sem identidade de edição). */
const newTxPreConfig = (extra = {}) => ({
  tipo: "despesa", desc: "Mercado", cat: "Alimentação", categoryTagId: "cat-1", method: "pix", valorInicial: 10,
  tags: [], detailTagIds: [], detailTagDisplayById: {}, ...extra,
});
const postedTransactions = () => apiClient.post.mock.calls.filter(([url]) => url === "/transactions").map(([, body]) => body);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseProps = { open: true, onClose: vi.fn(), onTransactionSaved: vi.fn(), isMobile: false, organizationId: ORG, dataMode: "live" };

async function saveEdit(user) {
  await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
  await user.click(await screen.findByRole("button", { name: /Confirmar despesa/i }));
}

describe("NovaTransacaoModal — conta no Editar (#266)", () => {
  it("transação gravada na 2ª conta: o Editar mostra a 2ª conta, não a padrão", async () => {
    render(<NovaTransacaoModal {...baseProps} preConfig={buildTxModalPreConfig(rowInB)} />);
    const select = await screen.findByDisplayValue("Conta B Nubank");
    expect(select.value).toBe(ACC_B);
  });

  it("abrir «Nova transação» depois de editar volta à conta padrão", async () => {
    const { rerender } = render(<NovaTransacaoModal {...baseProps} preConfig={buildTxModalPreConfig(rowInB)} />);
    await screen.findByDisplayValue("Conta B Nubank");
    rerender(<NovaTransacaoModal {...baseProps} open={false} preConfig={null} />);
    rerender(<NovaTransacaoModal {...baseProps} preConfig={null} />);
    const select = await screen.findByDisplayValue("Conta A Itaú");
    expect(select.value).toBe(ACC_A);
  });

  it("trocar a conta no Editar envia account_id (e só ele muda) e mostra a conta na revisão", async () => {
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...baseProps} preConfig={buildTxModalPreConfig(rowInB)} />);
    await user.selectOptions(await screen.findByDisplayValue("Conta B Nubank"), ACC_A);
    await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
    expect(await screen.findByText("CONTA")).toBeInTheDocument();
    expect(screen.getAllByText("Conta A Itaú").length).toBeGreaterThan(0);
    await user.click(await screen.findByRole("button", { name: /Confirmar despesa/i }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    const body = apiClient.put.mock.calls[0][1];
    expect(body.account_id).toBe(ACC_A);
    expect(body).not.toHaveProperty("conversion_rate");
    expect(body).not.toHaveProperty("value");
    expect(await screen.findByText("Despesa registrada!")).toBeInTheDocument();
  });

  it("sem trocar a conta, o PUT não leva account_id", async () => {
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...baseProps} preConfig={buildTxModalPreConfig(rowInB)} />);
    await screen.findByDisplayValue("Conta B Nubank");
    await user.type(document.querySelector("textarea"), " editada");
    await saveEdit(user);
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    expect(apiClient.put.mock.calls[0][1]).not.toHaveProperty("account_id");
  });

  it("422 do servidor ao trocar a conta: a mensagem aparece e não há sucesso", async () => {
    putImpl = () => Promise.reject(Object.assign(new Error("422"), {
      isAxiosError: true,
      response: { status: 422, data: { detail: "Não é possível mudar a conta de uma ocorrência recorrente." } },
    }));
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...baseProps} preConfig={buildTxModalPreConfig(rowInB)} />);
    await user.selectOptions(await screen.findByDisplayValue("Conta B Nubank"), ACC_A);
    await saveEdit(user);
    expect(await screen.findByText(/ocorrência recorrente/i)).toBeInTheDocument();
    expect(screen.queryByText("Despesa registrada!")).toBeNull();
  });
});

describe("NovaTransacaoModal — conta: org, cache, Duplicar, carregamento, legado (review #269)", () => {
  it("trocar de organização: nunca aparece nem é enviada a conta da org anterior", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<NovaTransacaoModal {...baseProps} preConfig={newTxPreConfig()} />);
    await screen.findByDisplayValue("Conta A Itaú");

    rerender(<NovaTransacaoModal {...baseProps} open={false} preConfig={null} />);
    let release;
    balancesGate = new Promise((r) => { release = r; });
    rerender(<NovaTransacaoModal {...baseProps} organizationId={OTHER_ORG} preConfig={newTxPreConfig()} />);
    // Enquanto a lista da org nova não chega, nada da org anterior aparece.
    expect(await screen.findByDisplayValue("Carregando contas…")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Conta A Itaú")).toBeNull();
    release();
    expect(await screen.findByDisplayValue("Conta X Inter")).toBeInTheDocument();

    await saveEdit(user);
    await waitFor(() => expect(postedTransactions().length).toBe(1));
    expect(postedTransactions()[0].account_id).toBe(ACC_X);
  });

  it("cada abertura relê as contas: uma conta criada depois aparece sem recarregar a página", async () => {
    const { rerender } = render(<NovaTransacaoModal {...baseProps} preConfig={newTxPreConfig()} />);
    await screen.findByDisplayValue("Conta A Itaú");
    rerender(<NovaTransacaoModal {...baseProps} open={false} preConfig={null} />);
    accountsByOrg[ORG] = [...accountsByOrg[ORG], balanceRow(ACC_NEW, "Conta Nova C6", "BRL", true)];
    rerender(<NovaTransacaoModal {...baseProps} preConfig={newTxPreConfig()} />);
    expect(await screen.findByRole("option", { name: "Conta Nova C6" })).toBeInTheDocument();
  });

  it("Duplicar um lançamento de conta desativada: a cópia vai para a conta padrão", async () => {
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...baseProps} preConfig={newTxPreConfig({ accountId: "acc-desativada" })} />);
    const select = await screen.findByDisplayValue("Conta A Itaú");
    expect(select.value).toBe(ACC_A);
    expect(screen.queryByRole("option", { name: "Conta desativada" })).toBeNull();
    await saveEdit(user);
    await waitFor(() => expect(postedTransactions().length).toBe(1));
    expect(postedTransactions()[0].account_id).toBe(ACC_A);
  });

  it("contas ainda carregando: select e revisão dizem o mesmo, e salvar espera", async () => {
    const user = userEvent.setup();
    balancesGate = new Promise(() => {});
    render(<NovaTransacaoModal {...baseProps} preConfig={newTxPreConfig()} />);
    expect(await screen.findByDisplayValue("Carregando contas…")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
    expect(screen.getByText("CONTA").nextSibling).toHaveTextContent("Carregando contas…");
    await user.click(await screen.findByRole("button", { name: /Confirmar despesa/i }));
    expect(await screen.findByText(/Aguarde as contas carregarem/)).toBeInTheDocument();
    expect(postedTransactions()).toHaveLength(0);
  });

  it("falha ao carregar contas: aviso claro com «Tentar de novo», e select e revisão não discordam", async () => {
    const user = userEvent.setup();
    balancesFail = true;
    render(<NovaTransacaoModal {...baseProps} preConfig={newTxPreConfig()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar as contas");
    expect(screen.getByLabelText("Conta")).toHaveDisplayValue("Conta padrão");
    expect(screen.getByLabelText("Conta")).toBeDisabled();

    balancesFail = false;
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByDisplayValue("Conta A Itaú")).toBeInTheDocument();
  });

  it("lançamento legado sem conta (account_id null): editar outro campo não inventa account_id", async () => {
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...baseProps} preConfig={buildTxModalPreConfig({ ...rowInB, accountId: null })} />);
    await screen.findByDisplayValue("Conta A Itaú");
    await user.type(document.querySelector("textarea"), " editada");
    await saveEdit(user);
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    expect(apiClient.put.mock.calls[0][1]).not.toHaveProperty("account_id");
  });

  it("'+ Transação' com UMA conta filtrada em Transações (#268): o lançamento novo nasce nela e é gravado nela", async () => {
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...baseProps} preConfig={{ accountId: ACC_B }} />);
    const select = await screen.findByDisplayValue("Conta B Nubank");
    expect(select.value).toBe(ACC_B);
    await user.type(document.querySelector("textarea"), "Café");
    await user.type(screen.getAllByPlaceholderText("0,00")[0], "500");
    await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
    await user.click(await screen.findByRole("button", { name: /Confirmar despesa/i }));
    await waitFor(() => expect(postedTransactions().length).toBe(1));
    expect(postedTransactions()[0].account_id).toBe(ACC_B);
  });

  it("o símbolo do valor segue a moeda da conta escolhida (Wise USD → US$) e muda com a conta", async () => {
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...baseProps} preConfig={{ accountId: ACC_USD }} />);
    await screen.findByDisplayValue("Wise USD");
    expect(screen.getByTestId("amount-currency-symbol")).toHaveTextContent("US$");
    await user.selectOptions(screen.getByLabelText("Conta"), ACC_A);
    expect(screen.getByTestId("amount-currency-symbol")).toHaveTextContent("R$");
    await user.selectOptions(screen.getByLabelText("Conta"), ACC_USD);
    await user.type(document.querySelector("textarea"), "Hotel");
    await user.type(screen.getAllByPlaceholderText("0,00")[0], "500");
    await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
    // A revisão também na moeda da conta.
    expect(await screen.findByText(/US\$\s?5,00/)).toBeInTheDocument();
  });

  it("#284: numa conta em US$ o Valor não lê separador — '1,500' digitado é 1500 centavos, mostrado na hora como US$ 15,00", async () => {
    // O campo é de máquina de somar (cada dígito empurra os centavos): vírgula e ponto
    // não são lidos, em nenhuma moeda — então não existe a leitura errada "1,5". O que
    // foi entendido aparece enquanto se digita, e a revisão confirma na moeda da conta.
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...baseProps} preConfig={{ accountId: ACC_USD }} />);
    await screen.findByDisplayValue("Wise USD");
    await user.type(document.querySelector("textarea"), "Hotel");
    const amount = screen.getAllByPlaceholderText("0,00")[0];
    await user.type(amount, "1,500");
    expect(amount).toHaveValue("15,00");
    await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
    expect(await screen.findByText(/US\$\s?15,00/)).toBeInTheDocument();
  });

  it("celular: passo 1 já mostra US$ com a Wise pré-selecionada", async () => {
    render(<NovaTransacaoModal {...baseProps} isMobile preConfig={{ accountId: ACC_USD }} />);
    await waitFor(() => expect(screen.getByTestId("amount-currency-symbol")).toHaveTextContent("US$"));
  });
});

