import { describe, expect, it } from "vitest";
import { deleteConfirmTx } from "../deleteConfirmTx.js";

const installment = { id: 11, date: "2026-10-02", description: "Notebook", value: 100, type: "expense", installment_info: [{ installment_number: 3, total_installments: 10, amount: 100 }] };

describe("deleteConfirmTx", () => {
  it("parcela leva contagem e total da compra na moeda da linha", () => {
    const tx = deleteConfirmTx({ ...installment, value_currency: "USD" }, "BRL");
    expect(tx.parcela).toEqual({ total: 10, atual: 3, valorTotal: 1000 });
    expect(tx.currency).toBe("USD");
    expect(tx.valorFormatado).toMatch(/US\$/);
  });

  it("moeda desconhecida não vira real: valor \"—\" e total omitido", () => {
    const tx = deleteConfirmTx(installment, null);
    expect(tx.valorFormatado).toBe("—");
    expect(tx.parcela.valorTotal).toBeNull();
  });

  it("o nome que a organização deu à categoria vence o do sistema", () => {
    const tags = { categoria: [{ id: "c1", name: "Food", label: "Alimentação", custom_name: "Mercado", is_default: true, type: "category" }] };
    expect(deleteConfirmTx({ ...installment, value_currency: "BRL", tags }).cat).toBe("Mercado");
  });
});
