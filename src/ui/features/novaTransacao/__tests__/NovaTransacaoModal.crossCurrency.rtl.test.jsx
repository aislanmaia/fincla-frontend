// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mover um lançamento para uma conta de OUTRA moeda (regra do Owner, opção 1): a
 * cotação sugere o valor na moeda nova num campo editável; o PUT leva `account_id`
 * + `value` na moeda nova. Sem cotação, campo vazio — nunca taxa 1.
 *
 * Mock só no limite HTTP (`apiClient`): modal, `buildUpdateTransactionPayload`,
 * `getOrgBalances` e `getQuotation` rodam de verdade.
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

const balanceRow = (account_id, name, currency) => ({
  account_id, name, type: "checking", include_in_total: true,
  balance: { amount: "1000.00", currency }, initial_balance: { amount: "0", currency },
});

/** Gasto de R$ 287,15 gravado na conta B (BRL). */
const rowInB = {
  id: 601, desc: "Hotel", cat: "Alimentação", categoryTagId: "cat-1", categoryTagIsActive: true,
  val: -287.15, type: "expense", date: "03/11/2026", dateIsoForEdit: "2026-11-03", paymentMethodKey: "pix",
  tags: [], detailTagIds: [], accountId: ACC_B, currency: "BRL", settled: true, settleable: true,
};

let quotation;
/** Cotação INVERSA (USD→BRL), só para exibir a taxa como se lê câmbio. `null` = sem resposta útil. */
let reverseQuotation;
let allAccounts;

beforeEach(() => {
  reverseQuotation = null;
  allAccounts = [];
  quotation = () => Promise.resolve({ data: { base: "BRL", quote: "USD", rate: "0.1825", quoted_on: "2026-11-03" } });
  apiClient.get.mockImplementation((url) => {
    if (url === "/balances") {
      return Promise.resolve({ data: { as_of: "2026-11-04T09:00:00", total: { amount: "3000", currency: "BRL" }, consolidation: null,
        accounts: [balanceRow(ACC_A, "Conta A Itaú", "BRL"), balanceRow(ACC_B, "Conta B Nubank", "BRL"), balanceRow(ACC_USD, "Wise USD", "USD")] } });
    }
    if (url === "/quotations/BRL/USD") return quotation();
    if (url === "/quotations/USD/BRL") return reverseQuotation ? reverseQuotation() : Promise.resolve({ data: [] });
    if (url === "/accounts") return Promise.resolve({ data: allAccounts });
    return Promise.resolve({ data: [] });
  });
  apiClient.put.mockImplementation((url, body) => Promise.resolve({ data: { id: 601, account_id: body.account_id ?? ACC_B } }));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const props = { open: true, onClose: vi.fn(), onTransactionSaved: vi.fn(), isMobile: false, organizationId: ORG, dataMode: "live" };

async function openAndMoveTo(user, accountId) {
  render(<NovaTransacaoModal {...props} preConfig={buildTxModalPreConfig(rowInB)} />);
  await user.selectOptions(await screen.findByDisplayValue("Conta B Nubank"), accountId);
}
async function reviewAndConfirm(user) {
  await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
  await user.click(await screen.findByRole("button", { name: /Confirmar despesa/i }));
}
const quotationCalls = () => apiClient.get.mock.calls.filter(([url]) => String(url).startsWith("/quotations"));

describe("NovaTransacaoModal — mover para conta de outra moeda", () => {
  it("pré-preenche o valor convertido pela cotação (HALF_UP, 2 casas) e mostra data e taxa", async () => {
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_USD);
    const box = await screen.findByTestId("account-move-value");
    await waitFor(() => expect(box).toHaveTextContent("Esta conta é em US$. Valor convertido pela cotação de 03/11 (R$ 1 = US$ 0,1825):"));
    expect(screen.getByLabelText("Valor em US$")).toHaveValue("52,40");
    expect(box).toHaveTextContent("Confira com o extrato do banco.");
  });

  it("atalho «usar 287,15 como US$»: mesmo número, moeda nova — e vai no PUT mesmo igual ao valor antigo", async () => {
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_USD);
    await waitFor(() => expect(screen.getByLabelText("Valor em US$")).toHaveValue("52,40"));
    await user.click(screen.getByRole("button", { name: "usar 287,15 como US$" }));
    expect(screen.getByLabelText("Valor em US$")).toHaveValue("287,15");
    await reviewAndConfirm(user);
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    const body = apiClient.put.mock.calls[0][1];
    expect(body.account_id).toBe(ACC_USD);
    expect(body.value).toBe(287.15);
    expect(body.value_currency).toBe("USD");
  });

  it("valor editado vai no PUT; revisão mostra a moeda nova e o original; sucesso mostra o valor gravado", async () => {
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_USD);
    const field = screen.getByLabelText("Valor em US$");
    await waitFor(() => expect(field).toHaveValue("52,40"));
    await user.clear(field);
    await user.type(field, "53,10");
    await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
    expect(await screen.findByText(/US\$ 53,10/)).toBeInTheDocument();
    expect(screen.getByTestId("review-original-amount")).toHaveTextContent("era R$ 287,15");
    expect(screen.getByText("CONTA").nextSibling).toHaveTextContent("Wise USD");
    await user.click(await screen.findByRole("button", { name: /Confirmar despesa/i }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    const body = apiClient.put.mock.calls[0][1];
    expect(body).toMatchObject({ account_id: ACC_USD, value: 53.1, value_currency: "USD" });
    expect(body).not.toHaveProperty("conversion_rate");
    expect(await screen.findByText("Despesa registrada!")).toBeInTheDocument();
    expect(screen.getByText(/US\$ 53,10/)).toBeInTheDocument();
  });

  it("sem cotação: campo vazio e editável, aviso claro, salvar exige o valor (nunca taxa 1)", async () => {
    quotation = () => Promise.reject(Object.assign(new Error("503"), { isAxiosError: true, response: { status: 503, data: {} } }));
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_USD);
    const box = await screen.findByTestId("account-move-value");
    await waitFor(() => expect(box).toHaveTextContent("Sem cotação agora — informe o valor em US$"));
    const field = screen.getByLabelText("Valor em US$");
    expect(field).toHaveValue("");

    await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
    expect(await screen.findByText("Informe o valor em US$")).toBeInTheDocument();
    expect(apiClient.put).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Valor em US$"), "50");
    await reviewAndConfirm(user);
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    expect(apiClient.put.mock.calls[0][1]).toMatchObject({ account_id: ACC_USD, value: 50 });
  });

  it("mesma moeda: nada de valor, nada de cotação — só account_id", async () => {
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_A);
    expect(screen.queryByTestId("account-move-value")).toBeNull();
    await reviewAndConfirm(user);
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    const body = apiClient.put.mock.calls[0][1];
    expect(body.account_id).toBe(ACC_A);
    expect(body).not.toHaveProperty("value");
    expect(quotationCalls()).toHaveLength(0);
  });

  it("cotação que chega DEPOIS de a pessoa digitar não sobrescreve o valor dela", async () => {
    let release;
    quotation = () => new Promise((r) => { release = () => r({ data: { base: "BRL", quote: "USD", rate: "0.1825", quoted_on: "2026-11-03" } }); });
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_USD);
    const field = await screen.findByLabelText("Valor em US$");
    await user.type(field, "60,00");
    release();
    await waitFor(() => expect(screen.getByTestId("account-move-value")).toHaveTextContent("0,1825"));
    expect(screen.getByLabelText("Valor em US$")).toHaveValue("60,00");
  });

  it("mudar o valor original refaz a sugestão enquanto o campo não foi tocado; tocado, mantém", async () => {
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_USD);
    await waitFor(() => expect(screen.getByLabelText("Valor em US$")).toHaveValue("52,40"));
    const original = screen.getAllByPlaceholderText("0,00").find((el) => el.getAttribute("aria-label") !== "Valor em US$");
    await user.type(original, "0"); // 287,15 → 2.871,50
    // 2.871,50 × 0,1825 = 524,04875 → 524,05
    await waitFor(() => expect(screen.getByLabelText("Valor em US$")).toHaveValue("524,05"));

    await user.clear(screen.getByLabelText("Valor em US$"));
    await user.type(screen.getByLabelText("Valor em US$"), "500,00");
    await user.type(original, "{Backspace}"); // volta a 287,15
    expect(screen.getByLabelText("Valor em US$")).toHaveValue("500,00");
  });

  it("Revisar fica bloqueado com o valor vazio, com o aviso no próprio campo", async () => {
    quotation = () => Promise.reject(Object.assign(new Error("503"), { isAxiosError: true, response: { status: 503, data: {} } }));
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_USD);
    await waitFor(() => expect(screen.getByTestId("account-move-value")).toHaveTextContent("Sem cotação agora"));
    await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
    expect(await screen.findByText("Informe o valor em US$")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar despesa/i })).toBeNull();
  });

  it("alternar entre contas não rebusca a cotação nem apaga o valor digitado do mesmo par", async () => {
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_USD);
    const field = await screen.findByLabelText("Valor em US$");
    await waitFor(() => expect(field).toHaveValue("52,40"));
    await user.clear(field);
    await user.type(field, "51,00");
    await user.selectOptions(screen.getByLabelText("Conta"), ACC_A);
    await user.selectOptions(screen.getByLabelText("Conta"), ACC_USD);
    expect(await screen.findByLabelText("Valor em US$")).toHaveValue("51,00");
    expect(quotationCalls().filter(([url]) => url === "/quotations/BRL/USD")).toHaveLength(1);
    expect(quotationCalls().filter(([url]) => url === "/quotations/USD/BRL")).toHaveLength(1);
  });

  it("conta gravada desativada: a moeda vem da lista completa de contas", async () => {
    allAccounts = [{ id: "acc-velha", name: "Conta Velha", currency: "USD", is_active: false }];
    const user = userEvent.setup();
    const row = { ...rowInB, accountId: "acc-velha", currency: null };
    render(<NovaTransacaoModal {...props} preConfig={buildTxModalPreConfig(row)} />);
    await user.selectOptions(await screen.findByDisplayValue("Conta desativada"), ACC_A);
    // USD → BRL: pede o valor em R$ (cotação USD/BRL não mockada → sem cotação).
    expect(await screen.findByTestId("account-move-value")).toHaveTextContent("informe o valor em R$");
  });

  it("moeda de origem desconhecida: bloqueia a troca em vez de mandar PUT sem valor", async () => {
    allAccounts = [];
    const user = userEvent.setup();
    const row = { ...rowInB, accountId: "acc-sumida", currency: null };
    render(<NovaTransacaoModal {...props} preConfig={buildTxModalPreConfig(row)} />);
    await user.selectOptions(await screen.findByDisplayValue("Conta desativada"), ACC_A);
    expect((await screen.findAllByText(/Não foi possível identificar a moeda deste lançamento/)).length).toBeGreaterThan(0);
    await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
    expect(screen.queryByRole("button", { name: /Confirmar despesa/i })).toBeNull();
    expect(apiClient.put).not.toHaveBeenCalled();
  });

  it("lançamento em US$ editado sem trocar de conta: a revisão escreve US$, não R$", async () => {
    const user = userEvent.setup();
    const row = { ...rowInB, accountId: ACC_USD, currency: "USD" };
    render(<NovaTransacaoModal {...props} preConfig={buildTxModalPreConfig(row)} />);
    await screen.findByDisplayValue("Wise USD");
    await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
    expect(await screen.findByText(/US\$ 287,15/)).toBeInTheDocument();
    expect(screen.queryByText(/R\$ 287,15/)).toBeNull();
  });

  it.each([
    ["aporte de meta", "Esta transação é um aporte de meta; mova o aporte pela meta."],
    ["estorno", "Esta transação tem estorno vinculado; não dá para movê-la para uma conta em outra moeda."],
  ])("422 do servidor (%s): a mensagem aparece no campo do valor, sem tela de sucesso", async (_caso, message) => {
    apiClient.put.mockImplementation(() => Promise.reject(Object.assign(new Error("422"), {
      isAxiosError: true,
      response: { status: 422, data: { detail: message } },
    })));
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_USD);
    await waitFor(() => expect(screen.getByLabelText("Valor em US$")).toHaveValue("52,40"));
    await reviewAndConfirm(user);
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText("Despesa registrada!")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Editar$/i }));
    expect(within(await screen.findByTestId("account-move-value")).getByRole("alert")).toHaveTextContent(message);
  });

  it("taxa exibida como se lê câmbio: 'US$ 1 = R$ 5,4914', vinda da cotação inversa da API; o valor continua pela direta", async () => {
    reverseQuotation = () => Promise.resolve({ data: { base: "USD", quote: "BRL", rate: "5.49140000", quoted_on: "2026-11-03" } });
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_USD);
    const box = await screen.findByTestId("account-move-value");
    await waitFor(() => expect(box).toHaveTextContent("Esta conta é em US$. Valor convertido pela cotação de 03/11 (US$ 1 = R$ 5,4914):"));
    expect(box).not.toHaveTextContent("R$ 1 = US$");
    // 287,15 × 0,1825 (direta) = 52,40 — não 287,15 ÷ 5,4914.
    expect(screen.getByLabelText("Valor em US$")).toHaveValue("52,40");
  });

  it("inversa indisponível: cai na direção direta da API, nunca numa inversa calculada", async () => {
    reverseQuotation = () => Promise.reject(Object.assign(new Error("503"), { isAxiosError: true, response: { status: 503, data: {} } }));
    const user = userEvent.setup();
    await openAndMoveTo(user, ACC_USD);
    const box = await screen.findByTestId("account-move-value");
    await waitFor(() => expect(box).toHaveTextContent("(R$ 1 = US$ 0,1825):"));
    expect(box).not.toHaveTextContent("5,48");
    expect(screen.getByLabelText("Valor em US$")).toHaveValue("52,40");
  });
});

