import { describe, expect, it } from "vitest";

import { transactionAccountLabel } from "./transactionAccountLabel.js";

const A = { id: "acc-a", name: "Conta A Itaú", currency: "BRL" };
const B = { id: "acc-b", name: "Conta B Nubank", currency: "BRL" };
const W = { id: "acc-w", name: "Wise", currency: "USD" };

describe("transactionAccountLabel (#267)", () => {
  it("com 2+ contas, mostra o nome da conta do lançamento", () => {
    expect(transactionAccountLabel({ accountId: "acc-b", settleable: true }, [A, B])).toBe("Conta B Nubank");
  });
  it("com uma conta só, omite", () => {
    expect(transactionAccountLabel({ accountId: "acc-a", settleable: true }, [A])).toBeNull();
  });
  it("compra no cartão: omite (o cartão já aparece no Método)", () => {
    expect(transactionAccountLabel({ accountId: "acc-a", settleable: false }, [A, B])).toBeNull();
  });
  it("contas em moedas diferentes: o código da moeda vai junto", () => {
    expect(transactionAccountLabel({ accountId: "acc-w", settleable: true }, [A, W])).toBe("Wise · USD");
  });
  it("conta fora da lista de ativas aparece como desativada, não some", () => {
    expect(transactionAccountLabel({ accountId: "acc-x", settleable: true }, [A, B])).toBe("Conta desativada");
  });
});
