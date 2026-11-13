// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #315 — o "Resultado do mês" do formulário escrevia "R$" chapado. Ele vem do resumo
 * da organização (`GET /transactions/summary`), na moeda que o servidor declara — a
 * base. O "Após" soma o lançamento a esse resultado, e isso só é um número quando o
 * lançamento é na MESMA moeda; noutra, a soma seria de moeda nenhuma e sai do ar.
 *
 * Mock só no limite HTTP (`apiClient`): `useNovaTransacaoPeriodSaldo` roda de verdade.
 */
vi.mock("../../../../api/client", async () => {
  const actual = await vi.importActual("../../../../api/client");
  return { ...actual, default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } };
});
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
    impactLive: false, currency: null, preview: null, previewLoading: false, previewError: "", spendingLoading: false, spendingError: "",
    chartData: [], refLineDay: null, showProjLine: false, categoryProjectedEom: null, categoryProjectionMeta: null,
  }),
}));

import apiClient from "../../../../api/client";
import { NovaTransacaoModal } from "../NovaTransacaoModal.jsx";
import { clearNovaTransacaoSummaryCache } from "../useNovaTransacaoPeriodSaldo.js";

const ORG = "org-saldo";
const ACC_BRL = "aaaaaaaa-0000-4000-8000-000000000001";
const ACC_USD = "cccccccc-0000-4000-8000-000000000003";
const balanceRow = (account_id, name, currency) => ({
  account_id, name, type: "checking", include_in_total: true,
  balance: { amount: "1000.00", currency }, initial_balance: { amount: "0", currency },
});
let summaryCurrency;

beforeEach(() => {
  clearNovaTransacaoSummaryCache();
  summaryCurrency = "BRL";
  apiClient.get.mockImplementation((url) => {
    if (url === "/balances") {
      return Promise.resolve({ data: { as_of: "2026-11-04T09:00:00", total: null, consolidation: null,
        accounts: [balanceRow(ACC_BRL, "Conta Itaú", "BRL"), balanceRow(ACC_USD, "Wise USD", "USD")] } });
    }
    if (url === "/transactions/summary") {
      const m = (amount) => ({ amount, currency: summaryCurrency });
      return Promise.resolve({ data: { total_income: m("0.00"), total_expenses: m("201.34"), total_refunds: m("0.00"), balance: m("-201.34"), total_transactions: 1 } });
    }
    if (url === `/organizations/${ORG}`) return Promise.resolve({ data: { id: ORG, base_currency: summaryCurrency } });
    return Promise.resolve({ data: [] });
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderModal = (accountId) =>
  render(
    <NovaTransacaoModal open onClose={vi.fn()} onTransactionSaved={vi.fn()} isMobile={false} organizationId={ORG} dataMode="live"
      preConfig={{ tipo: "despesa", desc: "Mercado", method: "pix", valorInicial: 10, accountId, tags: [], detailTagIds: [], detailTagDisplayById: {} }} />,
  );

describe("NovaTransacaoModal — 'Resultado do mês' na moeda do resumo (#315)", () => {
  it("base e conta em US$: resultado e 'Após' em US$, nenhum R$ na linha", async () => {
    summaryCurrency = "USD";
    const { container } = renderModal(ACC_USD);
    await waitFor(() => expect(container.textContent).toContain("Resultado do mês: −US$ 201,34 · Após: −US$ 211,34"));
    expect(container.textContent).not.toMatch(/Resultado do mês: −R\$/);
  });

  it("base em R$ e lançamento numa conta em US$: o resultado segue em R$ e o 'Após' sai do ar", async () => {
    const { container } = renderModal(ACC_USD);
    await waitFor(() => expect(container.textContent).toContain("Resultado do mês: −R$ 201,34"));
    expect(container.textContent).not.toContain("Após:");
  });

  it("tudo em R$: continua como antes", async () => {
    const { container } = renderModal(ACC_BRL);
    await waitFor(() => expect(container.textContent).toContain("Resultado do mês: −R$ 201,34 · Após: −R$ 211,34"));
  });
});
