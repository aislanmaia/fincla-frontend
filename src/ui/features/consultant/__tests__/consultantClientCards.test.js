import { describe, expect, it } from "vitest";

import { installmentsLabel, selectClientCards, toCardView } from "../consultantClientCards.js";

/** Cartão no formato do `creditCardsAdapter` (`listCreditCardsForUi`). */
function adapterCard(over = {}) {
  return {
    id: 7,
    nome: "Nubank Roxinho",
    dig: "1234",
    bandeira: "Mastercard",
    vencimento: 10,
    fechamento: 3,
    cor1: "#6016A8",
    cor2: "#8B11D4",
    limite: 10000,
    disponivel: 4000,
    itens: [
      { id: 1, desc: "Mercado", data: "10/06", val: 320, icon: "🛒", catColor: "#059669", parcela: null, isRefund: false },
      { id: 2, desc: "Notebook", data: "05/06", val: 500, icon: "💻", catColor: null, parcela: { n: 2, t: 12 }, isRefund: false },
    ],
    analytics: { currentInvoice: { total_amount: 820 } },
    ...over,
  };
}

describe("installmentsLabel", () => {
  it("formata n/tx quando parcelado", () => {
    expect(installmentsLabel({ n: 2, t: 12 })).toBe(" · 2/12x");
  });
  it("vazio para à vista ou ausente", () => {
    expect(installmentsLabel({ n: 1, t: 1 })).toBe("");
    expect(installmentsLabel(null)).toBe("");
    expect(installmentsLabel({ t: 0 })).toBe("");
  });
});

describe("toCardView", () => {
  it("projeta visual + limite a partir do cartão do adapter", () => {
    const v = toCardView(adapterCard());
    expect(v.id).toBe("7");
    expect(v.name).toBe("Nubank Roxinho");
    expect(v.last4).toBe("1234");
    expect(v.brand).toBe("Mastercard");
    expect(v.dueDay).toBe(10);
    expect(v.closingDay).toBe(3);
    expect(v.gradient).toEqual(["#6016A8", "#8B11D4"]);
    expect(v.limit).toBe(10000);
    expect(v.available).toBe(4000);
    // uso = (10000 − 4000) / 10000 = 60%
    expect(v.usagePct).toBe(60);
    // fatura corrente vem de analytics.currentInvoice.total_amount
    expect(v.invoiceTotal).toBe(820);
  });

  it("mapeia os itens da fatura com parcelas e cor", () => {
    const v = toCardView(adapterCard());
    expect(v.items).toHaveLength(2);
    expect(v.items[0]).toMatchObject({ desc: "Mercado", dateLabel: "10/06", installments: "", value: 320, color: "#059669" });
    expect(v.items[1].installments).toBe(" · 2/12x");
  });

  it("é robusto a campos ausentes (sem fatura, sem itens, limite zero)", () => {
    const v = toCardView({ id: 1, nome: "X", dig: "0000", limite: 0, disponivel: 0, analytics: null });
    expect(v.invoiceTotal).toBe(0);
    expect(v.usagePct).toBe(0);
    expect(v.items).toEqual([]);
  });
});

describe("selectClientCards", () => {
  it("mapeia a lista", () => {
    expect(selectClientCards([adapterCard(), adapterCard({ id: 8 })])).toHaveLength(2);
  });
  it("tolera entrada não-array", () => {
    expect(selectClientCards(null)).toEqual([]);
    expect(selectClientCards(undefined)).toEqual([]);
  });
});
