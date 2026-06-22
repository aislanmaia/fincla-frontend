import { describe, expect, it } from "vitest";
import { buildCreateTransactionPayload } from "../transactionsAdapter.js";

const base = {
  organizationId: "org-1",
  tipo: "despesa",
  description: "Mercado",
  value: 50,
  paymentMethodKey: "pix",
  categoryTagId: "tag-1",
  dateIso: "2026-06-20T12:00:00",
};

describe("buildCreateTransactionPayload — Fase 0 settlement (account_id / paid_at)", () => {
  it("inclui account_id e paid_at quando fornecidos (já paguei)", () => {
    const p = buildCreateTransactionPayload({ ...base, accountId: "acc-1", paidAt: "2026-06-20T12:00:00" });
    expect(p.account_id).toBe("acc-1");
    expect(p.paid_at).toBe("2026-06-20T12:00:00");
  });

  it("omite account_id e paid_at quando ausentes (usa default do backend)", () => {
    const p = buildCreateTransactionPayload(base);
    expect(p).not.toHaveProperty("account_id");
    expect(p).not.toHaveProperty("paid_at");
  });

  it("paidAt null => omitido (compromisso pendente), mas mantém account_id", () => {
    const p = buildCreateTransactionPayload({ ...base, accountId: "acc-1", paidAt: null });
    expect(p.account_id).toBe("acc-1");
    expect(p).not.toHaveProperty("paid_at");
  });
});
