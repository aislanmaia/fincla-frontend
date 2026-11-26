/** @vitest-environment jsdom */
// Conciliar fatura, sexta entrega (fincla-api#560): "Sobrando no Fincla" (passo 6), "Conferir o total"
// (passo 7) e o concluir seguro pelas compras novas sem confirmar (decisão do Owner de 2026-11-26), no
// nível da página, com a fixture de contrato (`leftovers`, `leftover_kept`, `total_check`,
// `draft_unconfirmed`, `creates_confirmed`; cópia byte a byte da do backend). Confere o que a pessoa vê
// e o que a tela manda: decidir já confirma e recolhe (a linha fica parada, com Conferido, Alterar e
// Desfazer escolha), Excluir listrado em vermelho, fatura paga só com Manter, a dica de cada item, o
// aviso dos candidatos de uma dúvida, o total com "não sabemos" (nunca R$ 0,00) e as causas com "Ir
// para o passo", e o motivo do Concluir desligado com "Confirmar as N de uma vez".
import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import contract from "../../../api/__fixtures__/card_invoice_import.example.json";
import { smallTouchTargets } from "../../../test/touchTargets.js";

const navigate = vi.fn();
let params = {};
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate, useParams: () => params }));
import { CardInvoiceReconciliationPage } from "../CardInvoiceReconciliationPage.jsx";

const ORG = "org";
const CARD = contract.draft.credit_card;
const BASE = `*/v1/credit-cards/${CARD.id}/invoice-imports`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const PAID = "Esta fatura já foi paga. Para corrigir, desmarque o pagamento e volte aqui.";

const calls = [];
let draft;
let leftovers;
let totalCheck;
const fresh = (key = "draft", step = "leftover") => {
  draft = clone(contract[key]);
  draft.current_step = step;
  leftovers = clone(contract.leftovers);
  totalCheck = clone(contract.total_check);
};
fresh();

const server = setupServer(
  http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: CARD.id, public_id: CARD.public_id, description: CARD.name, brand: "Visa", last4: CARD.last4 }])),
  http.get("*/v1/tags", () => HttpResponse.json({ tags: [] })),
  http.get(`${BASE}/:importId/leftovers`, () => {
    calls.push({ leftovers: true });
    return HttpResponse.json(leftovers);
  }),
  http.patch(`${BASE}/:importId/leftovers/:transactionId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ leftover: Number(p.transactionId), body });
    const item = leftovers.items.find((i) => i.transaction.id === Number(p.transactionId));
    item.action = body.action;
    draft.summary.leftovers_undecided = leftovers.items.filter((i) => i.action === null).length;
    return HttpResponse.json(leftovers);
  }),
  http.get(`${BASE}/:importId/total-check`, () => {
    calls.push({ total: true });
    return HttpResponse.json(totalCheck);
  }),
  http.post(`${BASE}/:importId/suggestions/confirm`, async ({ request }) => {
    const body = await request.json();
    calls.push({ confirm: body });
    const next = clone(contract.creates_confirmed);
    next.current_step = draft.current_step;
    draft = next;
    return HttpResponse.json(draft);
  }),
  http.get(`${BASE}/:importId`, () => HttpResponse.json(draft)),
  http.patch(`${BASE}/:importId`, async ({ request }) => {
    const body = await request.json();
    calls.push({ progress: body });
    Object.assign(draft, body);
    return HttpResponse.json(draft);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  fresh();
  server.resetHandlers();
  navigate.mockReset();
});

const TITLE = { leftover: "Sobrando no Fincla", total: "Conferir o total", summary: "Revisar e concluir" };
const open = async (props = {}) => {
  params = { cardId: CARD.public_id, importId: draft.id };
  render(<CardInvoiceReconciliationPage organizationId={ORG} {...props} />);
  await screen.findByRole("heading", { name: TITLE[draft.current_step] });
};
const items = () => screen.getAllByTestId("leftover-item");
const decisions = () => calls.filter((c) => c.leftover !== undefined).map((c) => c.body);

describe("Sobrando no Fincla", () => {
  it("a transação que o banco não cobrou, com a dica, e as três decisões; Manter recolhe e Desfazer escolha volta a sem decisão", async () => {
    const user = userEvent.setup();
    await open();

    const card = await screen.findByRole("group", { name: "Sobrando no Fincla: Assinatura" });
    expect(card).toHaveTextContent("R$ 61,00");
    expect(card).toHaveTextContent("25/11/2026");
    expect(within(card).getByTestId("leftover-hint")).toHaveTextContent("O banco não cobrou isto nesta fatura. Talvez seja da próxima.");
    const answers = within(card).getByRole("group", { name: "O que fazer com este item" });
    expect(within(answers).getAllByRole("button").map((b) => b.textContent)).toEqual(["Manter", "Mover para a próxima fatura", "Excluir"]);
    expect(screen.getByRole("button", { name: /Próximo: Conferir o total/ })).toBeDisabled();

    await user.click(within(answers).getByRole("button", { name: "Manter" }));
    await waitFor(() => expect(decisions()).toEqual([{ action: "keep" }]));
    // Recolhe no clique: a linha fica parada com a decisão, Conferido e Desfazer escolha.
    await waitFor(() => expect(screen.queryByRole("group", { name: "Sobrando no Fincla: Assinatura" })).not.toBeInTheDocument());
    const row = items()[0];
    expect(row).toHaveTextContent("Fica nesta fatura, como está");
    expect(within(row).getByTestId("conferido-badge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Próximo: Conferir o total/ })).toBeEnabled();

    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));
    await waitFor(() => expect(decisions()).toEqual([{ action: "keep" }, { action: null }]));
    expect(await screen.findByRole("group", { name: "Sobrando no Fincla: Assinatura" })).toBeInTheDocument();
  });

  it("Excluir fica listrado em vermelho; Mover diz para qual fatura vai", async () => {
    const user = userEvent.setup();
    await open();

    const card = await screen.findByRole("group", { name: "Sobrando no Fincla: Assinatura" });
    await user.click(within(card).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(decisions()).toEqual([{ action: "delete" }]));
    const row = await waitFor(() => items().find((i) => i.dataset.action === "delete"));
    expect(row).toHaveTextContent("Será excluída ao concluir");
    expect(row.style.background).toContain("repeating-linear-gradient");

    await user.click(within(row).getByRole("button", { name: "Alterar Assinatura" }));
    const reopened = await screen.findByRole("group", { name: "Sobrando no Fincla: Assinatura" });
    await user.click(within(reopened).getByRole("button", { name: "Mover para a próxima fatura" }));
    await waitFor(() => expect(decisions().at(-1)).toEqual({ action: "move_next" }));
    await waitFor(() => expect(items()[0]).toHaveTextContent("Vai para a fatura de janeiro/2027 ao concluir"));
  });

  it("fatura paga (decisão 1): só Manter; mover e excluir desligados com o motivo", async () => {
    Object.assign(leftovers.items[0], {
      movable: false, deletable: false,
      move_refusal: { code: "invoice_paid", message: PAID, invoice_year: null, invoice_month: null },
      delete_refusal: { code: "invoice_paid", message: PAID, invoice_year: null, invoice_month: null },
    });
    await open();

    const card = await screen.findByRole("group", { name: "Sobrando no Fincla: Assinatura" });
    expect(within(card).getByRole("button", { name: "Manter" })).toBeEnabled();
    expect(within(card).getByRole("button", { name: "Mover para a próxima fatura" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Excluir" })).toBeDisabled();
    expect(within(card).getByRole("button", { name: "Excluir" })).toHaveAccessibleDescription(PAID);
    expect(within(card).getAllByTestId("leftover-refusal")).toHaveLength(1);
  });

  it("a opção não escolhida de uma dúvida e os candidatos que ainda esperam resposta", async () => {
    Object.assign(leftovers.items[0].hint, {
      code: "option_not_chosen", entry_bank_description: "UBER *TRIP", entry_date: "2026-11-12", chosen_description: "Uber",
    });
    leftovers.waiting_transactions = 2;
    await open();

    expect(await screen.findByTestId("leftover-hint")).toHaveTextContent("Era uma das opções para “UBER *TRIP” (12/11/2026), mas você escolheu “Uber”.");
    expect(screen.getByTestId("leftover-waiting")).toHaveTextContent("2 itens ainda são candidatos de um caso com dúvida e não aparecem aqui até você responder.");
  });

  it("nada sobrando", async () => {
    leftovers.items = [];
    await open();
    expect(await screen.findByTestId("leftover-empty")).toHaveTextContent("Nada sobrando");
    expect(screen.getByRole("button", { name: /Próximo: Conferir o total/ })).toBeEnabled();
  });

  it("no celular as decisões, Alterar e Desfazer escolha têm 44 px", async () => {
    const user = userEvent.setup();
    await open({ isMobile: true });
    const card = await screen.findByRole("group", { name: "Sobrando no Fincla: Assinatura" });
    const found = { card: smallTouchTargets(card) };
    await user.click(within(card).getByRole("button", { name: "Manter" }));
    const row = await waitFor(() => items().find((i) => i.dataset.action === "keep"));
    found.row = smallTouchTargets(row);
    expect(found).toEqual({ card: [], row: [] });
  });
});

describe("Conferir o total", () => {
  it("banco, Fincla e a diferença; o resumo do PDF como referência; a causa leva ao passo", async () => {
    fresh("draft_unconfirmed", "total");
    const user = userEvent.setup();
    await open();

    expect(await screen.findByTestId("total-bank")).toHaveTextContent("R$ 2.402,92");
    expect(screen.getByTestId("total-fincla")).toHaveTextContent("R$ 2.463,92");
    expect(screen.getByTestId("total-difference")).toHaveTextContent("−R$ 61,00");
    expect(screen.queryByTestId("total-matches")).not.toBeInTheDocument();
    expect(screen.getByTestId("total-payment")).toHaveTextContent("conferido na conciliação da conta corrente");
    expect(screen.getByTestId("total-payment")).toHaveTextContent(/R\$\s2\.900,00/);
    expect(screen.getByTestId("total-financed")).toHaveTextContent("só referência");
    expect(screen.getByTestId("total-pdf")).toHaveTextContent("R$ 2.502,92");
    const cause = screen.getByTestId("total-cause");
    expect(cause).toHaveTextContent("Assinatura");
    expect(cause).toHaveTextContent("Mantido no Fincla sem cobrança do banco");
    expect(within(cause).getByTestId("total-cause-effect")).toHaveTextContent("−R$ 61,00 na diferença");

    await user.click(within(cause).getByRole("button", { name: "Ir para o passo Sobrando no Fincla" }));
    expect(await screen.findByRole("heading", { name: "Sobrando no Fincla" })).toBeInTheDocument();
    await waitFor(() => expect(calls).toContainEqual({ leftovers: true }));
  });

  it("diferença zero: a fatura bate com o banco", async () => {
    fresh("draft_unconfirmed", "total");
    Object.assign(totalCheck, { fincla: totalCheck.bank, difference: { amount: "0.00", currency: "BRL" }, matches: true, causes: [] });
    await open();
    expect(await screen.findByTestId("total-matches")).toHaveTextContent("A fatura bate com o banco. Pode seguir para Revisar e concluir.");
    expect(screen.getByTestId("total-difference")).toHaveTextContent("R$ 0,00");
  });

  it("sem o total do Fincla: não sabemos, nunca R$ 0,00", async () => {
    fresh("draft_unconfirmed", "total");
    Object.assign(totalCheck, { fincla: null, difference: null, matches: false });
    await open();
    expect(await screen.findByTestId("total-fincla")).toHaveTextContent("não sabemos");
    expect(screen.getByTestId("total-difference")).toHaveTextContent("não sabemos");
    expect(screen.getByTestId("total-difference")).not.toHaveTextContent("R$ 0,00");
  });
});

describe("Revisar e concluir: o que segura o concluir (#560)", () => {
  it("compras novas sem confirmar: o motivo com o passo e Confirmar as N de uma vez; confirmadas, o Concluir liga", async () => {
    fresh("draft_unconfirmed", "summary");
    const user = userEvent.setup();
    await open();

    const blockers = screen.getAllByTestId("blocker-unconfirmed-creates");
    expect(blockers.map((b) => b.dataset.step)).toEqual(["charges", "new"]);
    expect(blockers[0]).toHaveTextContent("Falta confirmar 3 transações novas em Encargos, tarifas e estornos.");
    expect(blockers[1]).toHaveTextContent("Falta confirmar 3 compras novas em Compras novas.");
    expect(screen.getByRole("button", { name: "Concluir conciliação da fatura" })).toBeDisabled();

    const ids = contract.draft_unconfirmed.entries.filter((e) => e.classification === "new" && e.answer === "create" && !e.confirmed).map((e) => e.id);
    await user.click(within(blockers[1]).getByRole("button", { name: "Confirmar as 3 de uma vez" }));
    await waitFor(() => expect(calls).toContainEqual({ confirm: { entry_ids: ids, confirmed: true } }));
    await waitFor(() => expect(screen.queryByTestId("step-blockers")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Concluir conciliação da fatura" })).toBeEnabled();
  });

  it("item sobrando sem decisão: Falta decidir em Sobrando no Fincla, com o caminho até o passo", async () => {
    fresh("draft", "summary");
    const user = userEvent.setup();
    await open();

    const blocker = screen.getByTestId("blocker-undecided-leftovers");
    expect(blocker).toHaveTextContent("Falta decidir 1 item em Sobrando no Fincla.");
    await user.click(within(blocker).getByRole("button", { name: "Ir para Sobrando no Fincla" }));
    expect(await screen.findByRole("heading", { name: "Sobrando no Fincla" })).toBeInTheDocument();
  });

  it("o trilho diz quantos itens sobrando faltam decidir", async () => {
    fresh("draft", "summary");
    await open();
    const rail = screen.getByRole("navigation", { name: "Etapas da conciliação da fatura" });
    const step = within(rail).getAllByRole("button").find((b) => within(b).getByTestId("step-title").textContent === "Sobrando no Fincla");
    expect(step).toHaveTextContent("1 item para decidir");
  });
});
