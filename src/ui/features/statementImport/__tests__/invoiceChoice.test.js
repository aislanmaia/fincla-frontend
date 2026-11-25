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
  const option = (invoice, extra = {}) => ({ id: 9, invoice, invoice_id: invoice.id, installment: null, movable: false, series_movable: false, suggested_answer: null, move_refusal: null, ...extra });
  // As parcelas vizinhas da busca, como o backend as grava (search_neighbours): a 06/12 numa série uma
  // fatura à frente, a 05/12 nesta fatura e a 04/12 numa série uma atrás. A busca parte de um lançamento à
  // vista, então nenhuma oferece a série (QA F5 BUG-02); `aheadSeries` é a 06/12 como a opção de um
  // lançamento que é parcela do banco a traria (série sugerida e valendo).
  const neighbours = contract.search_neighbours.results.map((r) => normalizeCardInvoiceImport({
    ...JSON.parse(JSON.stringify(contract.draft)), entries: [{ ...JSON.parse(JSON.stringify(contract.entry_doubt)), candidates: [r] }],
  }).entries[0].candidates[0]);
  const [ahead, here, behind] = neighbours;
  const aheadSeries = { ...ahead, suggested_answer: "move_series", series_movable: true };

  it("nesta fatura é Sim, é esta; na vizinha, a sugestão da própria opção: a série só quando ela vale", () => {
    expect(pickAnswerOf(option(DECEMBER), DECEMBER)).toBe("pair");
    expect(pickAnswerOf(option(JANUARY, { movable: true, suggested_answer: "move" }), DECEMBER)).toBe("move");
    expect(ahead).toMatchObject({ suggested_answer: "move", series_movable: false });
    expect(pickAnswerOf(ahead, DECEMBER)).toBe("move");
    expect(pickAnswerOf(aheadSeries, DECEMBER)).toBe("move_series");
    expect(pickAnswerOf(here, DECEMBER)).toBe("pair");
    // Série uma fatura atrás: "esta e as próximas" nunca vale (sem motivo), a opção move só esta.
    expect(behind).toMatchObject({ suggested_answer: "move", series_movable: false, move_refusal: null });
    expect(pickAnswerOf(behind, DECEMBER)).toBe("move");
    // Série sugerida mas recusada agora: só esta.
    expect(pickAnswerOf({ ...aheadSeries, series_movable: false }, DECEMBER)).toBe("move");
  });

  it("mover vale pelo movable da opção, com o motivo pronto do backend; ligar vale sempre", () => {
    expect(pickRefusal(option(DECEMBER), { ...DECEMBER, status: "paid" })).toBeNull();
    expect(pickRefusal(ahead, DECEMBER)).toBeNull();
    expect(pickRefusal(behind, DECEMBER)).toBeNull();
    const message = "A fatura de janeiro/2027 já foi paga. Para mover esta compra, desmarque o pagamento dela e volte aqui.";
    expect(pickRefusal(option(JANUARY, { move_refusal: { code: "other_invoice_paid", message, invoice_year: 2027, invoice_month: 1 } }), DECEMBER)).toBe(message);
    // O status da fatura não decide: só movable/move_refusal.
    expect(pickRefusal(option({ ...JANUARY, status: "paid" }, { movable: true }), DECEMBER)).toBeNull();
    expect(pickRefusal(option(JANUARY), DECEMBER)).toBe("Não dá para mover esta compra para esta fatura agora.");
  });

  it("uma opção sem fatura conhecida (invoice: null) não quebra e diz que não sabemos", () => {
    const unknown = { id: 9, invoice: null, invoice_id: 99, installment: null, movable: false, series_movable: false, suggested_answer: null, move_refusal: null };
    expect(pickAnswerOf(unknown, DECEMBER)).toBe("move");
    expect(pickRefusal(unknown, DECEMBER)).toMatch(/^Não sabemos em que fatura/);
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
