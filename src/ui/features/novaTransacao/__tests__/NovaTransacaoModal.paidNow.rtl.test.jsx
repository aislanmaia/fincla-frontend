// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #265 — "Já paguei" promete "Entra no saldo da conta agora", mas `paid_at` saía
 * fixo ao meio-dia: lançado às 08:15, o pagamento só entrava no saldo à tarde.
 * Relógio fixo DE MANHÃ: com o meio-dia fixo este teste falha.
 *
 * Mock só no limite HTTP (`apiClient`): o modal, `buildCreateTransactionPayload`
 * e `createTransactionForUi` rodam de verdade.
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

const MORNING = new Date(2026, 10, 4, 8, 15, 42); // 04/11/2026 08:15:42, hora local

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MORNING);
  apiClient.get.mockImplementation((url) => {
    if (url === "/balances") {
      return Promise.resolve({ data: { as_of: "2026-11-04T08:15:42", total: { amount: "0", currency: "BRL" }, consolidation: null,
        accounts: [{ account_id: "acc-a", name: "Conta A", include_in_total: true, balance: { amount: "0", currency: "BRL" } }] } });
    }
    return Promise.resolve({ data: [] });
  });
  apiClient.post.mockImplementation((url, body) => Promise.resolve({ data: { id: 1, ...body }, headers: {} }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const preConfig = (extra = {}) => ({
  tipo: "despesa", desc: "Padaria", cat: "Alimentação", categoryTagId: "cat-1", method: "pix", valorInicial: 12,
  tags: [], detailTagIds: [], detailTagDisplayById: {}, ...extra,
});

async function confirm(user) {
  await user.click(await screen.findByRole("button", { name: /Revisar despesa/i }));
  await user.click(await screen.findByRole("button", { name: /Confirmar despesa/i }));
  await waitFor(() => expect(apiClient.post.mock.calls.some(([url]) => url === "/transactions")).toBe(true));
  return apiClient.post.mock.calls.find(([url]) => url === "/transactions")[1];
}

describe("NovaTransacaoModal — 'Já paguei' com data de hoje (#265)", () => {
  it("de manhã, paid_at é o instante do lançamento (com fuso), não o meio-dia", async () => {
    const user = userEvent.setup();
    render(<NovaTransacaoModal open onClose={vi.fn()} onTransactionSaved={vi.fn()} isMobile={false} organizationId="org-1" dataMode="live" preConfig={preConfig()} />);
    expect(await screen.findByRole("switch", { name: "Já paguei" })).toHaveAttribute("aria-checked", "true");
    const body = await confirm(user);
    expect(body.paid_at).toMatch(/^2026-11-04T08:15:42[+-]\d{2}:\d{2}$/);
    expect(Date.parse(body.paid_at)).toBe(MORNING.getTime());
  });

  it("data passada mantém a convenção do meio-dia", async () => {
    const user = userEvent.setup();
    render(<NovaTransacaoModal open onClose={vi.fn()} onTransactionSaved={vi.fn()} isMobile={false} organizationId="org-1" dataMode="live" preConfig={preConfig({ dateIso: "2026-11-01" })} />);
    const body = await confirm(user);
    expect(body.paid_at).toBe("2026-11-01T12:00:00");
  });
});
