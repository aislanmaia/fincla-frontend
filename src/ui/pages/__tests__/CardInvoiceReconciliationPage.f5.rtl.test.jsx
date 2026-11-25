/** @vitest-environment jsdom */
// Conciliar fatura, quinta entrega (fincla-api#559): dúvidas, a busca "Procure no Fincla" e as
// compras em outra fatura, no nível da página, com a fixture de contrato (`draft`, `entry_doubt`,
// `search`, `entry_move`, `new_purchases_draft`, `stale_draft`; cópia byte a byte da do backend).
// Confere o que a pessoa vê e o que a tela manda: nada marcado na dúvida, clicar numa opção já
// responde (`pair` nesta fatura, `move` na vizinha), as outras esmaecidas com "Fica de fora… vai
// para Sobrando no Fincla", a opção já escolhida por outro lançamento sem clique, a diferença de
// valor em destaque, "Não registrar" listrado com as opções à vista, a busca nas faturas vizinhas,
// a troca "Mover só esta" ⇄ "Mover esta e as próximas" ali mesmo; no passo 2, a sugestão marcada com
// "Confirmar sugestão", as respostas de mover e o motivo quando a fatura está paga (decisão 1); a
// leitura desatualizada (QA F4 OBS-01); as palavras do que falta (OBS-03); e os alvos de toque.
// As parcelas vizinhas vêm de `search_neighbours` (a 06/12 numa série uma fatura à frente, a 05/12
// nesta fatura, a 04/12 numa série uma fatura atrás), como o backend as grava.
import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import contract from "../../../api/__fixtures__/card_invoice_import.example.json";
import { smallTouchTargets } from "../../../test/touchTargets.js";
import { beyondDoubtTolerance } from "../../features/statementImport/invoiceSteps.js";

const navigate = vi.fn();
let params = {};
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate, useParams: () => params }));
import { CardInvoiceReconciliationPage } from "../CardInvoiceReconciliationPage.jsx";

const ORG = "org";
const CARD = contract.draft.credit_card;
const BASE = `*/v1/credit-cards/${CARD.id}/invoice-imports`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const CATEGORIES = [
  { id: "cat-fallback", name: "nao-classificado", label: "Não classificado", allowed_transaction_types: ["expense", "income", "refund"], is_fallback: true },
];
const JANUARY = { id: 6, year: 2027, month: 1, status: "open" };
const PAID_REASON = "Esta fatura já foi paga. Para corrigir, desmarque o pagamento e volte aqui.";
const SERIES_REFUSAL = "Uma parcela seguinte desta compra já foi conferida: só dá para mover esta.";
const neighbours = () => clone(contract.search_neighbours.results);

const calls = [];
let draft;
let searchResults;
const fresh = (key = "draft", step = "doubt") => {
  draft = clone(contract[key]);
  draft.current_step = step;
  searchResults = clone(contract.search.results);
};
fresh();

const doubts = () => draft.entries.filter((e) => e.classification === "doubt");
const UBER_1 = () => doubts()[0];
const UBER_2 = () => doubts()[1];
const POSTO = () => doubts()[2];
const CAFE = () => draft.entries.find((e) => e.bank_description === "CAFETERIA AROMA");

/** As transações que o backend conhece: as opções das dúvidas, a compra da outra fatura e as da busca. */
const known = () => [
  ...draft.entries.flatMap((e) => e.candidates ?? []),
  ...searchResults,
  ...draft.entries.filter((e) => e.fincla_transaction).map((e) => ({ ...e.fincla_transaction, invoice: e.other_invoice })),
];

/**
 * O que o backend faz com uma resposta (#559): `pair`/`move`/`move_series` com `transaction_id` liga a
 * escolhida (a já escolhida por outro lançamento → 409 `pair_taken`); mover traz a fatura de onde ela
 * vem e o que dá para mover agora. Responder confirma, a menos que venha `confirmed`.
 */
function applyBody(entry, body) {
  if (body.answer === null) {
    // "Desfazer escolha" da primeira resposta: volta a sem resposta (nunca com transaction_id).
    if (body.transaction_id !== undefined || body.confirmed === true) return HttpResponse.json({ detail: "answer null" }, { status: 422 });
    Object.assign(entry, {
      answer: null, confirmed: false, paired_transaction_id: null, fincla_transaction: null, other_invoice: null,
      movable: false, series_movable: false, move_refusal: null,
    });
    return HttpResponse.json(entry);
  }
  if (body.transaction_id !== undefined) {
    const other = draft.entries.find((e) => e.id !== entry.id && e.paired_transaction_id === body.transaction_id
      && ["pair", "move", "move_series"].includes(e.answer));
    if (other) {
      return HttpResponse.json(
        { detail: { code: "conflict", message: `Esta transação já é a resposta do lançamento de 12/11 (${other.bank_description}).` } },
        { status: 409 },
      );
    }
    const chosen = known().find((t) => t.id === body.transaction_id);
    const {
      invoice, taken_by_entry_id: _taken, movable, series_movable: seriesMovable, move_refusal: refusal,
      suggested_answer: _suggested, suggestion_basis: _basis, ...transaction
    } = chosen;
    entry.paired_transaction_id = chosen.id;
    entry.fincla_transaction = transaction;
    const neighbour = invoice && invoice.id !== draft.invoice.id;
    entry.other_invoice = neighbour ? invoice : null;
    // O que dá para mover agora é o da opção escolhida (calculado para ela, #559).
    entry.movable = movable ?? Boolean(neighbour);
    entry.series_movable = seriesMovable ?? Boolean(neighbour && transaction.installment);
    entry.move_refusal = refusal ?? null;
  }
  if (body.answer !== undefined) {
    entry.answer = body.answer;
    if (body.answer === "ignore" || body.answer === "create") entry.paired_transaction_id = null;
  }
  if (body.confirmed !== undefined) entry.confirmed = body.confirmed;
  else if (body.answer !== undefined) entry.confirmed = true;
  return HttpResponse.json(entry);
}

const server = setupServer(
  http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: CARD.id, public_id: CARD.public_id, description: CARD.name, brand: "Visa", last4: CARD.last4 }])),
  http.get("*/v1/tags", ({ request }) => HttpResponse.json({ tags: new URL(request.url).searchParams.get("tag_type") === "detalhe" ? [] : CATEGORIES })),
  http.get(`${BASE}/:importId/entries/:entryId/search`, ({ request, params: p }) => {
    calls.push({ search: p.entryId, q: new URL(request.url).searchParams.get("q") });
    return HttpResponse.json({ results: searchResults });
  }),
  http.get(`${BASE}/:importId`, () => HttpResponse.json(draft)),
  http.patch(`${BASE}/:importId`, async ({ request }) => {
    const body = await request.json();
    calls.push({ progress: body });
    Object.assign(draft, body);
    return HttpResponse.json(draft);
  }),
  http.patch(`${BASE}/:importId/entries/:entryId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ patch: p.entryId, body });
    return applyBody(draft.entries.find((e) => e.id === p.entryId), body);
  }),
  http.patch(`${BASE}/:importId/entries`, async ({ request }) => {
    const body = await request.json();
    calls.push({ batch: body.entries ?? [], groups: body.groups ?? [] });
    for (const item of body.entries ?? []) applyBody(draft.entries.find((e) => e.id === item.id), item);
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

const STEP_TITLE = { doubt: "Decidir casos com dúvida", other_invoice: "Compras em outra fatura", summary: "Revisar e concluir" };
const open = async (props = {}) => {
  params = { cardId: CARD.public_id, importId: draft.id };
  render(<CardInvoiceReconciliationPage organizationId={ORG} {...props} />);
  await screen.findByRole("heading", { name: STEP_TITLE[draft.current_step] });
};
const article = (text) => screen.getByRole("article", { name: new RegExp(text.replace(/[*/]/g, ".")) });
const options = (card) => within(card).getAllByTestId("candidate-option");
const option = (card, description) => options(card).find((o) => o.textContent.includes(description));
const answers = (card, name) => within(card).getByRole("group", { name });
const patches = (entry) => calls.filter((c) => c.patch === entry.id).map((c) => c.body);
const rowOf = (text) => screen.getAllByTestId("pair-row").find((r) => r.textContent.includes(text));
const alter = (text) => screen.getAllByRole("button", { name: new RegExp(`Alterar o lançamento de .*: ${text.replace(/[*/]/g, ".")}`) });

describe("o passo Decidir casos com dúvida", () => {
  it("nada vem marcado: várias opções e a pergunta de qual é; sem Confirmar", async () => {
    await open();

    const card = article("UBER .TRIP");
    expect(within(card).getByText("Falta responder")).toBeInTheDocument();
    expect(within(card).getByTestId("doubt-prompt")).toHaveTextContent("Qual destas é a mesma compra? Clique para escolher.");
    expect(options(card)).toHaveLength(2);
    expect(options(card).every((o) => o.dataset.pressed === "false")).toBe(true);
    expect(within(answers(card, "Esta compra do banco já está no Fincla?")).getAllByRole("button").every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(within(card).queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
    // O que falta, pelas mesmas palavras do trilho (QA F4 OBS-03).
    expect(screen.getByTestId("queue-pending")).toHaveTextContent("3 sem resposta");
    expect(screen.getByTestId("go-to-pending")).toHaveTextContent("Falta responder 3 compras deste passo");
  });

  it("clicar numa opção já responde e recolhe: a linha fica parada; na outra dúvida, a já escolhida fica sem clique", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(within(option(article("UBER .TRIP"), "Uber 1")).getByRole("button", { name: /^Sim, é esta: Uber 1, 12\/11\/2026/ }));

    await waitFor(() => expect(patches(UBER_1())).toEqual([{ answer: "pair", transaction_id: 25 }]));
    const row = await waitFor(() => rowOf("É Uber 1"));
    expect(row).toHaveTextContent("Conferido");
    // A primeira resposta também tem "Desfazer escolha": volta a sem resposta.
    expect(within(row).getByRole("button", { name: "Desfazer escolha" })).toBeInTheDocument();
    // A segunda corrida abre: a Uber 1 já é a resposta da primeira, sem clique e com o motivo.
    const second = article("UBER .TRIP");
    const taken = option(second, "Uber 1");
    expect(taken).toHaveAttribute("aria-disabled", "true");
    expect(within(taken).getByTestId("candidate-taken")).toHaveTextContent("Já é a resposta do lançamento de 12/11/2026 (UBER *TRIP)");
    expect(within(taken).queryByRole("button")).not.toBeInTheDocument();
    expect(within(second).getByTestId("doubt-prompt")).toHaveTextContent("Confira e clique nela se for a mesma.");
  });

  it("reaberta: a escolhida em azul e a outra esmaecida com Fica de fora; trocar responde, e Desfazer escolha volta à anterior", async () => {
    Object.assign(UBER_1(), { answer: "pair", confirmed: true, paired_transaction_id: 25, fincla_transaction: { ...UBER_1().candidates[0] } });
    const user = userEvent.setup();
    await open();

    await user.click(alter("UBER .TRIP")[0]);
    let card = article("UBER .TRIP");
    expect(option(card, "Uber 1").dataset.pressed).toBe("true");
    const other = option(card, "Uber 2");
    expect(other.dataset.faded).toBe("true");
    expect(within(other).getByTestId("left-out-note")).toHaveTextContent("Fica de fora");
    expect(within(other).getByTestId("left-out-note")).toHaveTextContent("vai para Sobrando no Fincla");
    expect(within(card).getByTestId("doubt-prompt")).toHaveTextContent("Você escolheu a compra em azul. Clique em outra para trocar.");

    await user.click(within(other).getByRole("button", { name: /^Sim, é esta: Uber 2/ }));
    await waitFor(() => expect(patches(UBER_1()).at(-1)).toEqual({ answer: "pair", transaction_id: 26 }));

    await user.click(await within(await waitFor(() => rowOf("É Uber 2"))).findByRole("button", { name: "Desfazer escolha" }));
    await waitFor(() => expect(patches(UBER_1()).at(-1)).toEqual({ answer: "pair", confirmed: true, transaction_id: 25 }));
    card = await screen.findByRole("article", { name: /UBER .TRIP/ });
    expect(option(card, "Uber 1").dataset.pressed).toBe("true");
  });

  it("Desfazer escolha da primeira resposta volta a sem resposta (answer: null), sem transaction_id", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(within(option(article("UBER .TRIP"), "Uber 1")).getByRole("button", { name: /^Sim, é esta: Uber 1/ }));
    const row = await waitFor(() => rowOf("É Uber 1"));
    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));

    await waitFor(() => expect(patches(UBER_1()).at(-1)).toEqual({ answer: null, confirmed: false }));
    const card = await waitFor(() => {
      const reopened = screen.getAllByRole("article").find((a) => within(a).queryByText("Falta responder") && options(a).some((o) => o.textContent.includes("Uber 1")));
      expect(reopened).toBeTruthy();
      return reopened;
    });
    expect(options(card).every((o) => o.dataset.pressed === "false")).toBe(true);
    expect(UBER_1().answer).toBeNull();
    expect(screen.getByTestId("queue-pending")).toHaveTextContent("3 sem resposta");
  });

  it("uma opção com valor parecido: a pergunta e a diferença em destaque", async () => {
    for (const e of [UBER_1(), UBER_2()]) Object.assign(e, { answer: "ignore", confirmed: true });
    await open();

    const card = article("POSTO CENTRAL");
    expect(within(card).getByTestId("doubt-prompt")).toHaveTextContent("Valor parecido: confira e clique nela se for a mesma.");
    const posto = option(card, "Posto");
    expect(within(posto).getByTestId("candidate-difference")).toHaveTextContent("Diferença de R$ 0,40: o banco cobrou R$ 150,00. Se for esta, ao concluir vale o valor do banco.");
    expect(within(posto).getAllByTestId("match-highlight").length).toBeGreaterThan(0);
  });

  it("Sim, é esta com uma opção livre a escolhe; com várias, pede para escolher; sem nenhuma, abre a busca", async () => {
    const user = userEvent.setup();
    await open();

    const card = article("UBER .TRIP");
    await user.click(within(answers(card, "Esta compra do banco já está no Fincla?")).getByRole("button", { name: "Sim, é esta" }));
    expect(calls.filter((c) => c.patch)).toEqual([]);
    expect(within(card).getByText("Escolha ao lado qual compra é.")).toBeInTheDocument();

    for (const e of [UBER_1(), UBER_2()]) Object.assign(e, { answer: "ignore", confirmed: true });
    POSTO().candidates = [];
    cleanup();
    await open();
    await user.click(within(answers(article("POSTO CENTRAL"), "Esta compra do banco já está no Fincla?")).getByRole("button", { name: "Sim, é esta" }));
    expect(await screen.findByRole("dialog", { name: "Procure no Fincla" })).toBeInTheDocument();
  });

  it("Não registrar recolhe no clique; reaberta, as opções continuam à vista, listradas, com Fica de fora", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(within(answers(article("UBER .TRIP"), "Esta compra do banco já está no Fincla?")).getByRole("button", { name: "Não registrar" }));
    await waitFor(() => expect(patches(UBER_1())).toEqual([{ answer: "ignore" }]));
    const row = await waitFor(() => rowOf("Fica fora do Fincla"));
    await user.click(within(row).getByRole("button", { name: /Alterar/ }));

    const card = article("UBER .TRIP");
    const skipped = within(card).getAllByTestId("fincla-side-skipped");
    expect(skipped).toHaveLength(2);
    expect(within(card).getByTestId("skip-note")).toHaveTextContent("elas vão para Sobrando no Fincla");
    expect(within(card).queryAllByTestId("candidate-option")).toHaveLength(0);
  });

  it("Não, adicionar agora abre o formulário da compra nova, com Confirmar", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(within(answers(article("UBER .TRIP"), "Esta compra do banco já está no Fincla?")).getByRole("button", { name: "Não, adicionar agora" }));
    await waitFor(() => expect(patches(UBER_1())).toEqual([{ answer: "create", confirmed: false }]));
    const card = article("UBER .TRIP");
    expect(await within(card).findByRole("textbox", { name: "Descrição" })).toHaveValue("UBER *TRIP");
    await user.click(within(card).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(patches(UBER_1()).at(-1)).toEqual({ confirmed: true }));
  });

  it("fatura já paga (decisão 1): adicionar desligado com o motivo; uma opção da fatura vizinha não pode ser escolhida", async () => {
    draft.invoice.status = "paid";
    const posto = POSTO();
    Object.assign(posto, { value_locked: true, addable: false });
    // Como o backend a calcula com esta fatura paga (decisão 1): mover desligado, com o motivo.
    posto.candidates = [{
      ...posto.candidates[0], id: 99, description: "Posto (janeiro)", invoice: JANUARY, invoice_id: JANUARY.id,
      movable: false, move_refusal: { code: "invoice_paid", message: PAID_REASON, invoice_year: 2026, invoice_month: 12 },
    }];
    for (const e of [UBER_1(), UBER_2()]) Object.assign(e, { answer: "ignore", confirmed: true });
    await open();

    const card = article("POSTO CENTRAL");
    const add = within(answers(card, "Esta compra do banco já está no Fincla?")).getByRole("button", { name: "Não, adicionar agora" });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription(PAID_REASON);
    const neighbour = option(card, "Posto (janeiro)");
    expect(neighbour).toHaveAttribute("aria-disabled", "true");
    expect(within(neighbour).getByTestId("candidate-refusal")).toHaveTextContent(PAID_REASON);
    expect(within(neighbour).getByTestId("other-invoice-badge")).toHaveTextContent("Na fatura de janeiro/2027");
  });
});

describe("Está no Fincla com outros dados… (a busca)", () => {
  it("procura nas faturas vizinhas do cartão; a já escolhida por outro lançamento fica sem clique; escolher responde e fecha", async () => {
    Object.assign(UBER_1(), { answer: "pair", confirmed: true, paired_transaction_id: 25, fincla_transaction: { ...UBER_1().candidates[0] } });
    const user = userEvent.setup();
    await open();

    const card = article("UBER .TRIP");
    await user.click(within(card).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const dialog = await screen.findByRole("dialog", { name: "Procure no Fincla" });
    expect(dialog).toHaveTextContent("Na fatura do banco: 12/11/2026 · UBER *TRIP · R$ 23,47");
    expect(dialog).toHaveTextContent("Mostra os itens deste cartão na fatura conciliada, na anterior e na seguinte");
    await waitFor(() => expect(within(dialog).getAllByTestId("candidate-option")).toHaveLength(2));
    await waitFor(() => expect(calls.filter((c) => c.search)).toEqual([{ search: UBER_2().id, q: null }]));

    const taken = within(dialog).getAllByTestId("candidate-option").find((o) => o.textContent.includes("Uber 1"));
    expect(within(taken).getByTestId("candidate-taken")).toBeInTheDocument();

    await user.type(within(dialog).getByRole("textbox", { name: "Buscar por descrição, valor ou dia" }), "23,47");
    await waitFor(() => expect(calls.filter((c) => c.search).at(-1).q).toBe("23,47"));

    await user.click(within(dialog).getByRole("button", { name: /^Sim, é esta: Uber 2/ }));
    await waitFor(() => expect(patches(UBER_2())).toEqual([{ answer: "pair", transaction_id: 26 }]));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("uma parcela da série uma fatura à frente responde pela sugestão dela (esta e as próximas); a troca fica no cartão", async () => {
    searchResults = neighbours();
    const user = userEvent.setup();
    await open();

    await user.click(within(article("UBER .TRIP")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const dialog = await screen.findByRole("dialog", { name: "Procure no Fincla" });
    await waitFor(() => expect(within(dialog).getAllByTestId("candidate-option")).toHaveLength(3));
    const ahead = within(dialog).getAllByTestId("candidate-option").find((o) => o.textContent.includes("janeiro/2027"));
    expect(within(ahead).getByTestId("other-invoice-badge")).toHaveTextContent("Na fatura de janeiro/2027");
    await user.click(within(ahead).getByRole("button", { name: /^Mover esta e as próximas parcelas: Loja/ }));
    await waitFor(() => expect(patches(UBER_1())).toEqual([{ answer: "move_series", transaction_id: 8 }]));

    await user.click((await waitFor(() => alter("UBER .TRIP")))[0]);
    const how = within(article("UBER .TRIP")).getByRole("group", { name: "Como mover a parcela" });
    expect(within(how).getByRole("button", { name: "Mover esta e as próximas parcelas" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(how).getByRole("button", { name: "Mover só esta" }));
    await waitFor(() => expect(patches(UBER_1()).at(-1)).toEqual({ answer: "move", transaction_id: 8 }));
  });

  it("uma parcela da série uma fatura atrás move só esta: sem a série, nem a troca no cartão", async () => {
    searchResults = neighbours();
    const user = userEvent.setup();
    await open();

    await user.click(within(article("UBER .TRIP")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const dialog = await screen.findByRole("dialog", { name: "Procure no Fincla" });
    await waitFor(() => expect(within(dialog).getAllByTestId("candidate-option")).toHaveLength(3));
    expect(within(dialog).queryByRole("button", { name: /^Mover esta e as próximas parcelas: .*novembro\/2026/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^Mover esta parcela: Loja, .*na fatura de novembro\/2026/ }));
    await waitFor(() => expect(patches(UBER_1())).toEqual([{ answer: "move", transaction_id: 6 }]));

    await user.click((await waitFor(() => alter("UBER .TRIP")))[0]);
    expect(within(article("UBER .TRIP")).queryByRole("group", { name: "Como mover a parcela" })).not.toBeInTheDocument();
  });

  it("uma compra à vista da fatura vizinha escolhida na dúvida diz o mesmo que o passo 2: a data fica e a outra fatura diminui (QA F5 OBS-02)", async () => {
    searchResults = [{
      ...clone(contract.search.results[0]),
      id: 99, description: "Posto Janeiro", value: { amount: "150.00", currency: "BRL" }, date: "2026-11-20T00:00:00", purchase_date: "2026-11-20",
      invoice_id: JANUARY.id, invoice: JANUARY, differences: ["date"], suggested_answer: "move", movable: true, series_movable: false,
    }];
    for (const e of [UBER_1(), UBER_2()]) Object.assign(e, { answer: "ignore", confirmed: true });
    const user = userEvent.setup();
    await open();

    await user.click(within(article("POSTO CENTRAL")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const dialog = await screen.findByRole("dialog", { name: "Procure no Fincla" });
    await user.click(await within(dialog).findByRole("button", { name: /^Mover para esta fatura: Posto Janeiro/ }));
    await waitFor(() => expect(patches(POSTO())).toEqual([{ answer: "move", transaction_id: 99 }]));

    await user.click((await waitFor(() => alter("POSTO CENTRAL")))[0]);
    expect(within(article("POSTO CENTRAL")).getByTestId("move-consequences")).toHaveTextContent(
      "Ao concluir, a compra sai da fatura de janeiro/2027 e entra na de dezembro/2026, com a data da compra. A fatura de janeiro/2027 no Fincla fica R$ 150,00 menor.",
    );
  });

  it("um resultado da busca com valor além da folga da dúvida: os dois valores antes de escolher e ao responder (QA F5 OBS-03)", async () => {
    searchResults = neighbours();
    for (const e of [UBER_1(), UBER_2()]) Object.assign(e, { answer: "ignore", confirmed: true });
    const user = userEvent.setup();
    await open();

    // A opção da própria dúvida (R$ 0,40, dentro da folga) continua com o texto de antes.
    expect(within(option(article("POSTO CENTRAL"), "Posto")).getByTestId("candidate-difference")).not.toHaveAttribute("data-beyond");
    await user.click(within(article("POSTO CENTRAL")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const dialog = await screen.findByRole("dialog", { name: "Procure no Fincla" });
    await waitFor(() => expect(within(dialog).getAllByTestId("candidate-option")).toHaveLength(3));
    const ahead = within(dialog).getAllByTestId("candidate-option").find((o) => o.textContent.includes("janeiro/2027"));
    const difference = within(ahead).getByTestId("candidate-difference");
    expect(difference).toHaveAttribute("data-beyond", "true");
    expect(difference).toHaveTextContent("Valor diferenteO Fincla tem R$ 108,33, o banco R$ 150,00 (diferença de R$ 41,67). Se for esta, ao concluir vale o do banco.");
    const pick = within(ahead).getByRole("button", { name: /^Mover esta e as próximas parcelas: Loja/ });
    expect(pick).toHaveAccessibleName(/, valor diferente: o Fincla tem R\$\s108,33, o banco R\$\s150,00$/);
    await user.click(pick);
    await waitFor(() => expect(patches(POSTO())).toEqual([{ answer: "move_series", transaction_id: 8 }]));

    // Respondida, o cartão diz os dois valores e que vale o do banco (nunca uma troca calada).
    await user.click((await waitFor(() => alter("POSTO CENTRAL")))[0]);
    const consequences = within(article("POSTO CENTRAL")).getByTestId("pair-consequences");
    expect(consequences).toHaveTextContent("Valor diferente");
    expect(consequences).toHaveTextContent("O banco cobrou R$ 150,00; no Fincla está R$ 108,33 (diferença de R$ 41,67).");
  });

  it("a folga de uma compra internacional é 5% do valor do banco", () => {
    expect(beyondDoubtTolerance({ amount: -100, section: "international" }, 104.99)).toBe(false);
    expect(beyondDoubtTolerance({ amount: -100, section: "international" }, 105.5)).toBe(true);
    expect(beyondDoubtTolerance({ amount: -100, section: "purchases" }, 101)).toBe(false);
    expect(beyondDoubtTolerance({ amount: -100, section: "purchases" }, 101.01)).toBe(true);
  });

  it("a série recusada (parcela seguinte conferida): a opção move só esta, e a troca mostra a série desligada com o motivo", async () => {
    const [ahead] = neighbours();
    searchResults = [{ ...ahead, series_movable: false, move_refusal: { code: "series_reconciled", message: SERIES_REFUSAL, invoice_year: null, invoice_month: null } }];
    const user = userEvent.setup();
    await open();

    await user.click(within(article("UBER .TRIP")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const dialog = await screen.findByRole("dialog", { name: "Procure no Fincla" });
    await user.click(await within(dialog).findByRole("button", { name: /^Mover só esta: Loja/ }));
    await waitFor(() => expect(patches(UBER_1())).toEqual([{ answer: "move", transaction_id: 8 }]));

    await user.click((await waitFor(() => alter("UBER .TRIP")))[0]);
    const card = article("UBER .TRIP");
    const how = within(card).getByRole("group", { name: "Como mover a parcela" });
    expect(within(how).getByRole("button", { name: "Mover esta e as próximas parcelas" })).toBeDisabled();
    expect(within(card).getByTestId("move-choice-note")).toHaveTextContent(SERIES_REFUSAL);
  });

  it("uma da fatura vizinha que não pode ser movida (movable: false): o motivo do backend, sem clique", async () => {
    const message = "A fatura de novembro/2026 já foi paga. Para mover esta compra, desmarque o pagamento dela e volte aqui.";
    const behind = neighbours()[2];
    searchResults = [{
      ...behind, invoice: { ...behind.invoice, status: "paid" }, movable: false,
      move_refusal: { code: "other_invoice_paid", message, invoice_year: 2026, invoice_month: 11 },
    }];
    const user = userEvent.setup();
    await open();

    await user.click(within(article("UBER .TRIP")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const result = await within(await screen.findByRole("dialog")).findByTestId("candidate-option");
    expect(within(result).getByTestId("candidate-refusal")).toHaveTextContent(message);
    expect(within(result).queryByRole("button")).not.toBeInTheDocument();
  });

  it("uma opção sem fatura conhecida (invoice: null) não quebra: diz que não sabemos, sem clique", async () => {
    searchResults = [{ ...neighbours()[2], invoice: null, invoice_id: null, movable: false, suggested_answer: null, move_refusal: null, suggestion_basis: null }];
    const user = userEvent.setup();
    await open();

    await user.click(within(article("UBER .TRIP")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const result = await within(await screen.findByRole("dialog")).findByTestId("candidate-option");
    expect(within(result).getByTestId("other-invoice-badge")).toHaveTextContent("Fatura: não sabemos");
    expect(within(result).getByTestId("candidate-refusal")).toHaveTextContent("Não sabemos em que fatura esta compra está");
    expect(within(result).queryByRole("button")).not.toBeInTheDocument();
  });

  it("a transação já escolhida por outro lançamento (409): o motivo aparece na busca, que continua aberta", async () => {
    // A tela leu antes de outro lançamento escolher a Uber 2: o backend recusa e nomeia o outro.
    server.use(http.patch(`${BASE}/:importId/entries/:entryId`, () => HttpResponse.json(
      { detail: { code: "conflict", message: "Esta transação já é a resposta do lançamento de 12/11 (UBER *TRIP)." } }, { status: 409 },
    )));
    const user = userEvent.setup();
    await open();

    await user.click(within(article("UBER .TRIP")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const dialog = await screen.findByRole("dialog", { name: "Procure no Fincla" });
    await waitFor(() => expect(within(dialog).getAllByTestId("candidate-option")).toHaveLength(2));
    await user.click(within(dialog).getByRole("button", { name: /^Sim, é esta: Uber 2/ }));
    expect(await within(dialog).findByText("Esta transação já é a resposta do lançamento de 12/11 (UBER *TRIP).")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("409 numa resposta relê o rascunho; o erro de antes não aparece na busca aberta depois", async () => {
    let reads = 0;
    server.use(
      http.get(`${BASE}/:importId`, () => {
        reads += 1;
        return HttpResponse.json(draft);
      }),
      http.patch(`${BASE}/:importId/entries/:entryId`, () => HttpResponse.json(
        { detail: { code: "conflict", message: "Esta transação já é a resposta do lançamento de 12/11 (UBER *TRIP)." } }, { status: 409 },
      )),
    );
    const user = userEvent.setup();
    await open();
    expect(reads).toBe(1);

    await user.click(within(option(article("UBER .TRIP"), "Uber 1")).getByRole("button", { name: /^Sim, é esta: Uber 1/ }));
    expect(await screen.findByText("Esta transação já é a resposta do lançamento de 12/11 (UBER *TRIP).")).toBeInTheDocument();
    await waitFor(() => expect(reads).toBe(2));

    await user.click(within(article("UBER .TRIP")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const dialog = await screen.findByRole("dialog", { name: "Procure no Fincla" });
    expect(within(dialog).queryByText(/já é a resposta do lançamento de 12\/11/)).not.toBeInTheDocument();
    expect(screen.queryByText("Esta transação já é a resposta do lançamento de 12/11 (UBER *TRIP).")).not.toBeInTheDocument();
  });
});

describe("o passo Compras em outra fatura", () => {
  it("à vista: a sugestão marcada com o selo da outra fatura, as notas e Confirmar sugestão, que recolhe", async () => {
    fresh("draft", "other_invoice");
    const user = userEvent.setup();
    await open();

    const card = article("CAFETERIA AROMA");
    expect(within(card).getByTestId("other-invoice-badge")).toHaveTextContent("Na fatura de janeiro/2027");
    expect(within(card).getByTestId("move-suggestion")).toHaveTextContent("SugestãoMover para esta fatura. Compra à vista: só esta compra muda de fatura.");
    expect(within(card).getByTestId("other-invoice-note")).toHaveTextContent("No Fincla esta compra está na fatura de janeiro/2027. O banco cobrou na de dezembro/2026.");
    expect(within(card).getByTestId("move-consequences")).toHaveTextContent(
      "Ao concluir, a compra sai da fatura de janeiro/2027 e entra na de dezembro/2026, com a data da compra. A fatura de janeiro/2027 no Fincla fica R$ 18,00 menor.",
    );
    const row = answers(card, "Mover esta compra para a fatura de dezembro/2026?");
    expect(within(row).getAllByRole("button").map((b) => b.textContent)).toEqual(["Mover para esta fatura", "Adicionar como nova", "Não registrar"]);
    expect(within(row).getByRole("button", { name: "Mover para esta fatura" })).toHaveAttribute("aria-pressed", "true");
    // O que falta é confirmar, não responder (QA F4 OBS-03).
    expect(screen.getByTestId("go-to-pending")).toHaveTextContent("Falta confirmar 1 escolha deste passo");
    expect(screen.getByTestId("queue-pending")).toHaveTextContent("1 escolha para confirmar");

    await user.click(within(card).getByRole("button", { name: "Confirmar sugestão" }));
    await waitFor(() => expect(patches(CAFE())).toEqual([{ answer: "move" }]));
    const done = await waitFor(() => rowOf("Mover Cafeteria"));
    expect(done).toHaveTextContent("Mover Cafeteria da fatura de janeiro/2027 para esta fatura");
    expect(done).toHaveTextContent("Conferido");
    expect(screen.queryByTestId("go-to-pending")).not.toBeInTheDocument();
  });

  /** A compra em outra fatura como uma parcela gravada em search_neighbours (o que dá para mover e as vizinhas). */
  const asInstallment = (recorded, extra = {}) => {
    const cafe = CAFE();
    Object.assign(cafe, {
      bank_description: `LOJA ${String(recorded.installment.number).padStart(2, "0")}/12`, installment: recorded.installment,
      suggested_answer: recorded.suggested_answer, answer: recorded.suggested_answer, movable: recorded.movable,
      series_movable: recorded.series_movable, move_refusal: recorded.move_refusal, suggestion_basis: recorded.suggestion_basis,
      other_invoice: recorded.invoice, ...extra,
    });
    cafe.fincla_transaction.installment = recorded.installment;
    return cafe;
  };

  it("parcela da série uma fatura à frente: as quatro respostas e a sugestão pelos meses reais das vizinhas", async () => {
    fresh("draft", "other_invoice");
    const cafe = asInstallment(neighbours()[0]);
    const user = userEvent.setup();
    await open();

    const card = article("LOJA 06/12");
    const row = answers(card, "Mover esta compra para a fatura de dezembro/2026?");
    expect(within(row).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Mover esta e as próximas parcelas", "Mover só esta", "Adicionar como nova", "Não registrar",
    ]);
    expect(within(card).getByTestId("move-suggestion")).toHaveTextContent(
      "Mover esta e as próximas parcelas. No Fincla, a parcela 05/12 está nesta fatura (dezembro/2026) e a parcela 07/12 está na fatura de fevereiro/2027. A série está uma fatura à frente do banco: esta e as próximas voltam uma fatura.",
    );
    expect(within(card).getByTestId("move-consequences")).toHaveTextContent(
      "Ao concluir, as parcelas 06 a 12/12 voltam uma fatura: a 06 entra em dezembro/2026 e a última termina em junho/2027, como no banco. As anteriores não mudam.",
    );
    expect(within(card).getByRole("button", { name: "Confirmar sugestão" })).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Mover só esta" }));
    await waitFor(() => expect(patches(cafe)).toEqual([{ answer: "move" }]));
  });

  it("parcela da série uma fatura atrás: sem a série; Mover esta parcela, com as vizinhas nos meses reais", async () => {
    fresh("draft", "other_invoice");
    asInstallment(neighbours()[2]);
    await open();

    const card = article("LOJA 04/12");
    const row = answers(card, "Mover esta compra para a fatura de dezembro/2026?");
    expect(within(row).getAllByRole("button").map((b) => b.textContent)).toEqual(["Mover esta parcela", "Adicionar como nova", "Não registrar"]);
    expect(within(row).getByRole("button", { name: "Mover esta parcela" })).toHaveAttribute("aria-pressed", "true");
    expect(within(card).getByTestId("move-suggestion")).toHaveTextContent(
      "Mover esta parcela. No Fincla, a parcela 03/12 está na fatura de outubro/2026 e a parcela 05/12 está nesta fatura (dezembro/2026). Só esta parcela muda de fatura; as outras ficam onde estão.",
    );
    expect(within(card).getByRole("button", { name: "Confirmar sugestão" })).toBeInTheDocument();
  });

  it("série sugerida mas recusada: a sugestão mostrada é só esta (nunca a desligada), a série com o motivo", async () => {
    fresh("draft", "other_invoice");
    asInstallment(neighbours()[0], {
      answer: "move", series_movable: false,
      move_refusal: { code: "series_reconciled", message: SERIES_REFUSAL, invoice_year: null, invoice_month: null },
    });
    await open();

    const card = article("LOJA 06/12");
    const row = answers(card, "Mover esta compra para a fatura de dezembro/2026?");
    const series = within(row).getByRole("button", { name: "Mover esta e as próximas parcelas" });
    expect(series).toBeDisabled();
    expect(series).toHaveAccessibleDescription(SERIES_REFUSAL);
    expect(within(row).getByRole("button", { name: "Mover só esta" })).toHaveAttribute("aria-pressed", "true");
    const suggestion = within(card).getByTestId("move-suggestion");
    expect(suggestion).toHaveTextContent(/^SugestãoMover só esta\./);
    expect(suggestion).toHaveTextContent("Mover a série não dá agora: só esta parcela muda de fatura.");
    expect(within(card).getByRole("button", { name: "Confirmar sugestão" })).toBeInTheDocument();
  });

  it("a outra fatura já paga: começa sem resposta, mover desligado com o motivo, Não registrar responde", async () => {
    fresh("new_purchases_draft", "other_invoice");
    const user = userEvent.setup();
    await open();

    const card = article("MERCADO BOA VISTA");
    expect(within(card).getByText("Falta responder")).toBeInTheDocument();
    const row = answers(card, "Mover esta compra para a fatura de janeiro/2027?");
    const move = within(row).getByRole("button", { name: "Mover para esta fatura" });
    expect(move).toBeDisabled();
    expect(move).toHaveAccessibleDescription("A fatura de dezembro/2026 já foi paga. Para mover esta compra, desmarque o pagamento dela e volte aqui.");
    expect(within(row).getByRole("button", { name: "Adicionar como nova" })).toBeEnabled();
    expect(within(card).queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Não registrar" }));
    const mercado = draft.entries.find((e) => e.bank_description === "MERCADO BOA VISTA");
    await waitFor(() => expect(patches(mercado)).toEqual([{ answer: "ignore" }]));
    await user.click((await waitFor(() => alter("MERCADO BOA VISTA")))[0]);
    const skipped = within(article("MERCADO BOA VISTA")).getByTestId("fincla-side-skipped");
    expect(skipped).toHaveTextContent("Na fatura de dezembro/2026");
    expect(within(skipped).getByTestId("skip-note")).toHaveTextContent("Continua na fatura de dezembro/2026, sem mudança.");
  });

  it("esta fatura já paga: só Não registrar, já marcado; clicar nele confirma", async () => {
    fresh("draft", "other_invoice");
    Object.assign(CAFE(), {
      answer: "ignore", confirmed: false, value_locked: true, addable: false, movable: false,
      move_refusal: { code: "invoice_paid", message: PAID_REASON, invoice_year: 2026, invoice_month: 12 },
    });
    const user = userEvent.setup();
    await open();

    const row = answers(article("CAFETERIA AROMA"), "Mover esta compra para a fatura de dezembro/2026?");
    expect(within(row).getByRole("button", { name: "Mover para esta fatura" })).toBeDisabled();
    expect(within(row).getByRole("button", { name: "Adicionar como nova" })).toBeDisabled();
    expect(within(row).getByRole("button", { name: "Mover para esta fatura" })).toHaveAccessibleDescription(PAID_REASON);
    await user.click(within(row).getByRole("button", { name: "Não registrar" }));
    await waitFor(() => expect(patches(CAFE())).toEqual([{ answer: "ignore" }]));
  });

  it("Próximo confirma a sugestão que falta confirmar, num lote só", async () => {
    fresh("draft", "other_invoice");
    const user = userEvent.setup();
    await open();

    await user.click(screen.getByRole("button", { name: "Próximo: Decidir casos com dúvida →" }));
    await screen.findByRole("heading", { name: "Decidir casos com dúvida" });
    expect(calls.find((c) => c.batch).batch).toEqual([{ id: CAFE().id, confirmed: true }]);
  });
});

describe("a leitura desatualizada (QA F4 OBS-01)", () => {
  it("o aviso diz para descartar e reenviar, e o Concluir fica desligado com o motivo", async () => {
    fresh("stale_draft", "summary");
    const user = userEvent.setup();
    await open();

    const notice = screen.getByTestId("stale-draft-notice");
    expect(notice).toHaveTextContent("Esta leitura ficou desatualizada: descarte e envie o PDF de novo.");
    expect(within(notice).getByRole("button", { name: "Descartar e enviar o PDF de novo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir conciliação da fatura" })).toBeDisabled();
    expect(screen.getByTestId("conclude-blocked")).toHaveTextContent("Esta leitura ficou desatualizada: descarte o rascunho e envie o PDF de novo.");

    server.use(http.delete(`${BASE}/:importId`, () => new HttpResponse(null, { status: 204 })));
    await user.click(within(notice).getByRole("button", { name: "Descartar e enviar o PDF de novo" }));
    await user.click(within(notice).getByRole("button", { name: "Sim, descartar" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/reconcile` }));
  });

  it("um rascunho em dia não tem o aviso", async () => {
    await open();
    expect(screen.queryByTestId("stale-draft-notice")).not.toBeInTheDocument();
  });
});

describe("atalhos S/A/N", () => {
  it("passo 3: N não registra, A abre a compra nova e confirma, S escolhe a única opção livre", async () => {
    const user = userEvent.setup();
    await open();
    article("UBER .TRIP");

    await user.keyboard("n");
    await waitFor(() => expect(patches(UBER_1())).toEqual([{ answer: "ignore" }]));
    await waitFor(() => rowOf("Fica fora do Fincla"));

    await user.keyboard("a");
    await waitFor(() => expect(patches(UBER_2())).toEqual([{ answer: "create", confirmed: false }]));
    await within(article("UBER .TRIP")).findByRole("textbox", { name: "Descrição" });
    await user.keyboard("a");
    await waitFor(() => expect(patches(UBER_2()).at(-1)).toEqual({ confirmed: true }));

    await waitFor(() => article("POSTO CENTRAL"));
    await user.keyboard("s");
    await waitFor(() => expect(patches(POSTO())).toEqual([{ answer: "pair", transaction_id: 27 }]));
  });

  it("passo 3: S com várias opções livres pede a escolha, sem responder", async () => {
    const user = userEvent.setup();
    await open();
    const card = article("UBER .TRIP");

    await user.keyboard("s");
    expect(await within(card).findByText("Escolha ao lado qual compra é.")).toBeInTheDocument();
    expect(calls.filter((c) => c.patch)).toEqual([]);
  });

  it("passo 2: S confirma a sugestão; A adiciona como nova; N não registra", async () => {
    for (const [key, body] of [["s", { answer: "move" }], ["a", { answer: "create", confirmed: false }], ["n", { answer: "ignore" }]]) {
      cleanup();
      calls.length = 0;
      fresh("draft", "other_invoice");
      const user = userEvent.setup();
      await open();
      article("CAFETERIA AROMA");

      await user.keyboard(key);
      await waitFor(() => expect(patches(CAFE())).toEqual([body]));
    }
  });

  it("passo 2: S não aponta para uma resposta desligada (mover recusado: nada acontece)", async () => {
    fresh("new_purchases_draft", "other_invoice");
    const user = userEvent.setup();
    await open();
    article("MERCADO BOA VISTA");

    await user.keyboard("s");
    expect(calls.filter((c) => c.patch)).toEqual([]);
  });
});

describe("celular e computador", () => {
  it("os atalhos de teclado só aparecem no computador", async () => {
    await open();
    expect(screen.getByTestId("queue-shortcuts")).toBeInTheDocument();
    cleanup();
    await open({ isMobile: true });
    expect(screen.queryByTestId("queue-shortcuts")).not.toBeInTheDocument();
  });

  it("varredura: no celular nenhum controle da dúvida, da busca, da troca de mover nem da outra fatura fica abaixo de 44 px", async () => {
    const found = {};
    searchResults = [...neighbours(), ...searchResults];
    const user = userEvent.setup();
    await open({ isMobile: true });
    article("UBER .TRIP");
    found.doubt = smallTouchTargets(document.body);

    await user.click(within(article("UBER .TRIP")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const dialog = await screen.findByRole("dialog", { name: "Procure no Fincla" });
    await waitFor(() => expect(within(dialog).getAllByTestId("candidate-option")).toHaveLength(5));
    found.search = smallTouchTargets(document.body);

    await user.click(within(dialog).getByRole("button", { name: /^Mover esta e as próximas parcelas: Loja/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click((await waitFor(() => alter("UBER .TRIP")))[0]);
    within(article("UBER .TRIP")).getByRole("group", { name: "Como mover a parcela" });
    found.moveChoice = smallTouchTargets(document.body);

    cleanup();
    fresh("draft", "other_invoice");
    await open({ isMobile: true });
    article("CAFETERIA AROMA");
    found.otherInvoice = smallTouchTargets(document.body);

    expect(found).toEqual({ doubt: [], search: [], moveChoice: [], otherInvoice: [] });
  });

  it("no computador, as respostas e a troca de mover ficam com a altura de antes", async () => {
    fresh("draft", "other_invoice");
    await open();
    const row = answers(article("CAFETERIA AROMA"), "Mover esta compra para a fatura de dezembro/2026?");
    expect(within(row).getByRole("button", { name: "Não registrar" }).style.minHeight).toBe("32px");
    expect(within(article("CAFETERIA AROMA")).getByRole("button", { name: "Confirmar sugestão" }).style.minHeight).toBe("");
  });
});
