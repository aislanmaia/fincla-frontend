// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * fincla-api#503 — o preview de orçamento recebia só o número digitado, sem dizer de
 * que conta ele sai; o backend o somava como se fosse da moeda do orçamento. O hook
 * agora manda a conta, e trocar de conta pede um preview novo.
 */
vi.mock("../../../../api/budgets", () => ({ previewTransactionImpact: vi.fn() }));
vi.mock("../../../../api/analytics", () => ({ getSpendingByDay: vi.fn(() => Promise.resolve({ points: [] })) }));

import { previewTransactionImpact } from "../../../../api/budgets";
import { useNovaTransacaoFinancialImpact } from "../useNovaTransacaoFinancialImpact.js";

afterEach(() => vi.clearAllMocks());

const props = (accountId) => ({
  open: true, organizationId: "org", dataMode: "live", novaRecorrencia: false, recorre: false,
  impactPanelOpen: true, txDateYmd: "2026-11-13", categoryTagId: "t", tipo: "despesa",
  valorNum: 100, method: "pix", modalidade: "avista", parcelas: 1, cartao: "", accountId,
});

describe("useNovaTransacaoFinancialImpact — conta do rascunho", () => {
  it("envia account_id e refaz o preview quando a conta muda", async () => {
    previewTransactionImpact.mockResolvedValue({ category: {}, budgets_summary: {}, month_projection: null });
    const { rerender } = renderHook((p) => useNovaTransacaoFinancialImpact(p), { initialProps: props("acc-brl") });
    await waitFor(() => expect(previewTransactionImpact).toHaveBeenCalledTimes(1));
    expect(previewTransactionImpact.mock.calls[0][0]).toMatchObject({ account_id: "acc-brl", value: 100 });

    rerender(props("acc-usd"));
    await waitFor(() => expect(previewTransactionImpact).toHaveBeenCalledTimes(2));
    expect(previewTransactionImpact.mock.calls[1][0]).toMatchObject({ account_id: "acc-usd" });
  });
});
