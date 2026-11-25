// As regras puras dos passos 2 e 3 da fatura (fincla-api#559) e as palavras do que falta num passo
// (QA F4 OBS-03), sobre a fixture de contrato.
import { describe, expect, it } from "vitest";

import { normalizeCardInvoiceImport } from "../../../../api/cardInvoiceImports";
import contract from "../../../../api/__fixtures__/card_invoice_import.example.json";
import { addInvoiceMonths, pickAnswerOf, pickRefusal, takenByOf } from "../InvoiceDoubtStep.jsx";
import { invoiceSummaryRows, stepRemaining } from "../invoiceSteps.js";

const draft = () => normalizeCardInvoiceImport(JSON.parse(JSON.stringify(contract.draft)));
const DECEMBER = { id: 1, year: 2026, month: 12, status: "open" };
const JANUARY = { id: 6, year: 2027, month: 1, status: "open" };

describe("stepRemaining (QA F4 OBS-03)", () => {
  it("separa os sem resposta das escolhas que só faltam confirmar", () => {
    const d = draft();
    expect(stepRemaining(d.entries.filter((e) => e.classification === "doubt"), "compra", "compras")).toMatchObject({
      unanswered: 3, toConfirm: 0, header: "3 sem resposta", footer: "Falta responder 3 compras deste passo",
    });
    expect(stepRemaining(d.entries.filter((e) => e.classification === "other_invoice"), "compra", "compras")).toMatchObject({
      unanswered: 0, toConfirm: 1, header: "1 escolha para confirmar", footer: "Falta confirmar 1 escolha deste passo",
    });
    expect(stepRemaining(d.entries.filter((e) => e.classification === "doubt" || e.classification === "other_invoice"), "compra", "compras").footer)
      .toBe("Falta responder 3 compras e confirmar 1 escolha deste passo");
    const done = d.entries.filter((e) => e.classification === "suggested").map((e) => ({ ...e, confirmed: true }));
    expect(stepRemaining(done)).toMatchObject({ header: null, footer: null });
  });
});

describe("a opção escolhida (#559)", () => {
  const entry = { id: "e", suggested_answer: null, value_locked: false };
  const option = (invoice, extra = {}) => ({ id: 9, invoice, invoice_id: invoice.id, installment: null, ...extra });

  it("nesta fatura é Sim, é esta; na vizinha, Mover; a parcela segue a sugestão do backend, senão só esta", () => {
    expect(pickAnswerOf(entry, option(DECEMBER), DECEMBER)).toBe("pair");
    expect(pickAnswerOf(entry, option(JANUARY), DECEMBER)).toBe("move");
    const installment = option(JANUARY, { installment: { number: 5, count: 10 } });
    expect(pickAnswerOf(entry, installment, DECEMBER)).toBe("move");
    expect(pickAnswerOf({ ...entry, suggested_answer: "move_series" }, installment, DECEMBER)).toBe("move_series");
  });

  it("fatura paga (decisão 1): ligar vale; mover de ou para fatura paga não, com o motivo", () => {
    expect(pickRefusal({ ...entry, value_locked: true }, option(DECEMBER), { ...DECEMBER, status: "paid" })).toBeNull();
    expect(pickRefusal({ ...entry, value_locked: true }, option(JANUARY), { ...DECEMBER, status: "paid" })).toMatch(/^Esta fatura já foi paga/);
    expect(pickRefusal(entry, option({ ...JANUARY, status: "paid" }), DECEMBER)).toMatch(/^A fatura de janeiro\/2027 já foi paga/);
    expect(pickRefusal(entry, option(JANUARY), DECEMBER)).toBeNull();
  });

  it("já escolhida: só pelas respostas de agora de OUTRO lançamento", () => {
    const entries = [
      { id: "a", answer: "pair", paired_transaction_id: 9 },
      { id: "b", answer: "ignore", paired_transaction_id: null },
    ];
    expect(takenByOf(entries, "b", 9)?.id).toBe("a");
    expect(takenByOf(entries, "a", 9)).toBeNull();
    expect(takenByOf([{ id: "a", answer: "create", paired_transaction_id: 9 }], "b", 9)).toBeNull();
  });

  it("o mês da última parcela atravessa o ano", () => {
    expect(addInvoiceMonths(DECEMBER, 5)).toEqual({ year: 2027, month: 5 });
    expect(addInvoiceMonths(JANUARY, -1)).toEqual({ year: 2026, month: 12 });
  });
});

describe("Revisar e concluir: as compras movidas (#559)", () => {
  it("uma linha para a compra (ou a parcela sozinha) que vem para esta fatura, outra para as séries", () => {
    const d = draft();
    const row = (id) => invoiceSummaryRows(d).find((r) => r.testId === id);
    expect(row("summary-moved")).toMatchObject({ count: 1, text: "compra sai de outra fatura e entra nesta", note: null });
    expect(row("summary-moved-series")).toBeUndefined();
    const cafe = d.entries.find((e) => e.classification === "other_invoice");
    cafe.installment = { number: 5, count: 10 };
    expect(row("summary-moved").note).toBe("1 parcela muda sozinha: as outras da compra ficam onde estão");
    cafe.answer = "move_series";
    expect(row("summary-moved")).toBeUndefined();
    expect(row("summary-moved-series")).toMatchObject({ count: 1, text: "série de parcelas volta uma fatura, desta parcela em diante" });
  });
});
