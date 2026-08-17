import { describe, expect, it } from "vitest";
import {
  buildCreateTransactionPayload,
  buildTransactionsQuery,
  buildTransactionsSummaryQuery,
  mapApiTransactionToUi,
} from "../transactionsAdapter.js";

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

function apiTx(overrides = {}) {
  return {
    id: 1,
    description: "Mercado",
    type: "expense",
    value: 50,
    payment_method: "pix",
    date: "2026-06-20T12:00:00",
    status: "confirmed",
    paid_at: null,
    tags: {},
    ...overrides,
  };
}

describe("mapApiTransactionToUi — eixo de liquidação", () => {
  it("status='paid' vira settled=true; 'confirmed' vira false", () => {
    expect(mapApiTransactionToUi(apiTx({ status: "paid", paid_at: "2026-06-20T12:00:00" })).settled).toBe(true);
    expect(mapApiTransactionToUi(apiTx()).settled).toBe(false);
  });

  it("não achata mais 'paid' e 'confirmed' — era isso que escondia o compromisso pendente", () => {
    const paga = mapApiTransactionToUi(apiTx({ status: "paid", paid_at: "2026-06-20T12:00:00" }));
    const aPagar = mapApiTransactionToUi(apiTx());
    // `status` continua igual nos dois (não quebrar quem lê `status === "pendente"`),
    // mas `settled` agora distingue — é o campo que a lista usa para o badge.
    expect(paga.status).toBe(aPagar.status);
    expect(paga.settled).not.toBe(aPagar.settled);
  });

  it("cartão não é liquidável por lançamento (liquida na fatura)", () => {
    expect(mapApiTransactionToUi(apiTx({ payment_method: "credit_card" })).settleable).toBe(false);
    expect(mapApiTransactionToUi(apiTx({ payment_method: "pix" })).settleable).toBe(true);
    expect(mapApiTransactionToUi(apiTx({ payment_method: "cash" })).settleable).toBe(true);
  });

  it("expõe paid_at para a UI mostrar quando o dinheiro saiu", () => {
    expect(mapApiTransactionToUi(apiTx({ status: "paid", paid_at: "2026-06-20T12:00:00" })).paidAt)
      .toBe("2026-06-20T12:00:00");
    expect(mapApiTransactionToUi(apiTx()).paidAt).toBeNull();
  });
});

describe("buildTransactionsQuery / buildTransactionsSummaryQuery — param settled", () => {
  const q = { organizationId: "org-1" };

  it("'todas' OMITE o param (backend lê ausência como 'as duas')", () => {
    expect(buildTransactionsQuery({ ...q, settlement: "todas" })).not.toHaveProperty("settled");
    // Default também omite: nenhuma tela existente passa a chave.
    expect(buildTransactionsQuery(q)).not.toHaveProperty("settled");
  });

  it("'pagas' => settled=true; 'a-pagar' => settled=false", () => {
    expect(buildTransactionsQuery({ ...q, settlement: "pagas" }).settled).toBe(true);
    expect(buildTransactionsQuery({ ...q, settlement: "a-pagar" }).settled).toBe(false);
  });

  it("o summary manda o MESMO param — senão o card de totais e a lista descrevem conjuntos diferentes", () => {
    expect(buildTransactionsSummaryQuery({ ...q, settlement: "a-pagar" }).settled).toBe(false);
    expect(buildTransactionsSummaryQuery({ ...q, settlement: "pagas" }).settled).toBe(true);
    expect(buildTransactionsSummaryQuery({ ...q, settlement: "todas" })).not.toHaveProperty("settled");
  });
});
