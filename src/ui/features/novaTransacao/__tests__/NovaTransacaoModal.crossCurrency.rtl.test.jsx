// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

beforeEach(() => {
  quotation = () => Promise.resolve({ data: { base: "BRL", quote: "USD", rate: "0.1825", quoted_on: "2026-11-03" } });
  apiClient.get.mockImplementation((url) => {
    if (url === "/balances") {
      return Promise.resolve({ data: { as_of: "2026-11-04T09:00:00", total: { amount: "3000", currency: "BRL" }, consolidation: null,
        accounts: [balanceRow(ACC_A, "Conta A Itaú", "BRL"), balanceRow(ACC_B, "Conta B Nubank", "BRL"), balanceRow(ACC_USD, "Wise USD", "USD")] } });
    }
    if (url === "/quotations/BRL/USD") return quotation();
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
    await waitFor(() => expect(box).toHaveTextContent("Esta conta é em US$. Valor convertido pela cotação de 03/11/2026 (US$ 1 = R$ 5,48):"));
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
    expect(body).toMatchObject({ account_id: ACC_USD, value: 53.1 });
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

    await reviewAndConfirm(user);
    expect(await screen.findByText("Informe o valor em US$ para mover para esta conta.")).toBeInTheDocument();
    expect(apiClient.put).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^Editar$/i }));
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
});
