import { describe, expect, it } from "vitest";
import { buildInvoiceCsv } from "../invoiceCsv.js";

describe("buildInvoiceCsv", () => {
  it("mantém o formato histórico: cabeçalho, vírgula decimal, parcela n/t e Sim/Não", () => {
    const csv = buildInvoiceCsv([
      { desc: "Celular", cat: "Compras", val: 269, data: "22/09", parcela: { n: 9, t: 21 }, rec: false },
      { desc: "Netflix", cat: "Assinatura", val: 44.9, data: "20/09", parcela: null, rec: true },
    ]);
    expect(csv.split("\n")).toEqual([
      "Descrição,Categoria,Valor,Data,Parcela,Recorrente",
      '"Celular","Compras","269,00","22/09","9/21","Não"',
      '"Netflix","Assinatura","44,90","20/09","-","Sim"',
    ]);
  });

  it("escapa aspas na descrição em vez de quebrar a linha", () => {
    const csv = buildInvoiceCsv([{ desc: 'Loja "Boa", filial 2', cat: "X", val: 1, data: "01/01", parcela: null, rec: false }]);
    expect(csv.split("\n")[1]).toBe('"Loja ""Boa"", filial 2","X","1,00","01/01","-","Não"');
  });
});
