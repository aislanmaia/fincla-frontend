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

beforeEach(() => {
  putImpl = (url, body) => Promise.resolve({ data: { id: 501, account_id: body.account_id ?? ACC_B } });
  apiClient.get.mockImplementation((url) => {
    if (url === "/balances") {
      return Promise.resolve({
        data: {
          as_of: "2026-11-04T09:00:00", total: { amount: "3000", currency: "BRL" }, consolidation: { target_currency: "BRL", rates: [], unavailable: null },
          accounts: [balanceRow(ACC_A, "Conta A Itaú", "BRL", true), balanceRow(ACC_B, "Conta B Nubank", "BRL", true), balanceRow(ACC_USD, "Wise USD", "USD", false)],
        },
      });
    }
    return Promise.resolve({ data: [] });
  });
  apiClient.put.mockImplementation((url, body) => putImpl(url, body));
});

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

  it("servidor que ignora a troca (responde com a conta antiga): nada de 'Despesa registrada!'", async () => {
    putImpl = () => Promise.resolve({ data: { id: 501, account_id: ACC_B } });
    const user = userEvent.setup();
    render(<NovaTransacaoModal {...baseProps} preConfig={buildTxModalPreConfig(rowInB)} />);
    await user.selectOptions(await screen.findByDisplayValue("Conta B Nubank"), ACC_A);
    await saveEdit(user);
    expect(await screen.findByText(/a conta não foi trocada/i)).toBeInTheDocument();
    expect(screen.queryByText("Despesa registrada!")).toBeNull();
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
