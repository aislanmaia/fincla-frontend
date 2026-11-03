import { describe, expect, it } from "vitest";
import { settlementCopy } from "../settlementCopy.js";

/* Hoje (errado) a torrada de uma receita dizia "marcada como paga";
   esperado: "marcada como recebida". Despesa (e estorno, por ora) não mudam. */
describe("settlementCopy toasts", () => {
  it("income is received", () => {
    expect(settlementCopy("income").settledToast("Salário")).toBe('"Salário" marcada como recebida');
    expect(settlementCopy("income").undoneToast("Salário")).toBe('Recebimento de "Salário" desfeito');
    expect(settlementCopy("receita").settledToast("Salário")).toBe('"Salário" marcada como recebida');
  });
  it.each(["expense", "refund", undefined])("%s keeps the paying wording", (type) => {
    expect(settlementCopy(type).settledToast("Luz")).toBe('"Luz" marcada como paga');
    expect(settlementCopy(type).undoneToast("Luz")).toBe('Pagamento de "Luz" desfeito');
  });
});
