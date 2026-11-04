import { describe, expect, it } from "vitest";

import { accountDisplayName, transactionAccountLabel } from "./transactionAccountLabel.js";

const A = { id: "acc-a", name: "Conta A Itaú", currency: "BRL" };
const B = { id: "acc-b", name: "Conta B Nubank", currency: "BRL" };
const W = { id: "acc-w", name: "Wise", currency: "USD" };

describe("transactionAccountLabel (#267)", () => {
  it("com 2+ contas, mostra o nome da conta do lançamento", () => {
    expect(transactionAccountLabel({ accountId: "acc-b", settleable: true }, [A, B])).toBe("Conta B Nubank");
  });
  it("com uma conta só e o lançamento nela, omite", () => {
    expect(transactionAccountLabel({ accountId: "acc-a", settleable: true }, [A])).toBeNull();
  });
  it("com uma conta só e o lançamento numa conta DESATIVADA, mostra", () => {
    expect(transactionAccountLabel({ accountId: "acc-velha", settleable: true }, [A])).toBe("Conta desativada");
  });
  it("compra no cartão: omite (o cartão já aparece no Método)", () => {
    expect(transactionAccountLabel({ accountId: "acc-a", settleable: false }, [A, B])).toBeNull();
  });
  it("contas em moedas diferentes: o código da moeda vai junto", () => {
    expect(transactionAccountLabel({ accountId: "acc-w", settleable: true }, [A, W])).toBe("Wise · USD");
  });
  it("contas não carregadas: não afirma nada", () => {
    expect(transactionAccountLabel({ accountId: "acc-a", settleable: true }, [])).toBeNull();
  });
});

describe("accountDisplayName — a regra única de «Conta desativada»", () => {
  it("aceita as duas formas de lista: `id` (/accounts) e `account_id` (/balances)", () => {
    expect(accountDisplayName("acc-a", [A])).toBe("Conta A Itaú");
    expect(accountDisplayName("acc-a", [{ account_id: "acc-a", name: "Conta A Itaú" }])).toBe("Conta A Itaú");
  });
  it("id fora da lista de ativas → «Conta desativada»; sem id ou sem lista → null", () => {
    expect(accountDisplayName("acc-x", [A])).toBe("Conta desativada");
    expect(accountDisplayName(null, [A])).toBeNull();
    expect(accountDisplayName("acc-a", [])).toBeNull();
  });
});
