/** @vitest-environment jsdom */
// Conciliar fatura, passo 4 (fincla-api#574): o "Repasse de IOF" somado em vários lançamentos do
// Fincla (`split_pair`, resposta `pair_split`). Confere o lado do Fincla com as transações e a soma,
// as três respostas (só a sugestão intacta tem "Confirmar sugestão"; as outras confirmam e recolhem
// no clique, "Adicionar agora" abre o formulário), o "Não registrar" com a lista cinza listrada, a
// linha recolhida, a contagem em "Revisar e concluir", a linha sem resposta quando nada soma e os
// alvos de toque no celular.
import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import contract from "../../../api/__fixtures__/card_invoice_import.example.json";
import { smallTouchTargets } from "../../../test/touchTargets.js";
import { normalizeCardInvoiceImport } from "../../../api/cardInvoiceImports";
import { invoiceSummaryRows } from "../../features/statementImport/invoiceSteps.js";

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

const iofTx = (id, description, amount) => ({
  id, description, type: "expense", value: { amount, currency: "BRL" }, date: "2026-11-05T00:00:00", purchase_date: "2026-11-05",
  installment: null, invoice_id: 1, status: "confirmed", paid_at: null, category_name: "Impostos e taxas", tag_names: [], differences: [],
});
/** O Repasse de IOF (R$ 1,89) somado em dois IOFs lançados um a um no Fincla. */
const SPLIT = {
  transaction_ids: [41, 42],
  transactions: [iofTx(41, "Iof Internacional - Claude", "1.20"), iofTx(42, "Iof Internacional - Spotify", "0.69")],
  total: { amount: "1.89", currency: "BRL" },
};

const calls = [];
let draft;
const repasse = () => draft.entries.find((e) => e.bank_description === "Repasse de IOF");
function fresh({ split = true } = {}) {
  draft = clone(contract.draft);
  draft.current_step = "charges";
  // O grupo e os outros lançamentos do passo 4 já respondidos: o Repasse é o atual.
  Object.assign(draft.charge_groups[0], { confirmed: true });
  for (const e of draft.entries) e.split_pair = null;
  for (const e of draft.entries.filter((x) => x.classification === "charges")) e.confirmed = true;
  Object.assign(repasse(), split
    ? { split_pair: clone(contract.entry_iof_split?.split_pair ?? SPLIT), answer: "pair_split", confirmed: false }
    : { split_pair: null, answer: null, confirmed: false });
}
fresh();

function applyBody(entry, body) {
  if (body.answer !== undefined) entry.answer = body.answer;
  if (body.confirmed !== undefined) entry.confirmed = body.confirmed;
  else if (body.answer !== undefined) entry.confirmed = body.answer !== null;
}

const server = setupServer(
  http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: CARD.id, public_id: CARD.public_id, description: CARD.name, brand: "Visa", last4: CARD.last4 }])),
  http.get("*/v1/tags", () => HttpResponse.json({ tags: CATEGORIES })),
  http.get(`${BASE}/:importId`, () => HttpResponse.json(draft)),
  http.patch(`${BASE}/:importId`, async ({ request }) => {
    Object.assign(draft, await request.json());
    return HttpResponse.json(draft);
  }),
  http.patch(`${BASE}/:importId/entries/:entryId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ patch: p.entryId, body });
    const entry = draft.entries.find((e) => e.id === p.entryId);
    applyBody(entry, body);
    return HttpResponse.json(entry);
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

const open = async (props = {}) => {
  params = { cardId: CARD.public_id, importId: draft.id };
  render(<CardInvoiceReconciliationPage organizationId={ORG} {...props} />);
  await screen.findByRole("heading", { name: "Encargos, tarifas e estornos" });
  return screen.findByRole("article", { name: /Lançamento de .*: Repasse de IOF/ });
};
const answers = (card) => within(card).getByRole("group", { name: "Já está no Fincla, somado?" });

describe("o Repasse de IOF somado em vários lançamentos do Fincla (#574)", () => {
  it("normaliza split_pair: as transações e a soma em dinheiro", () => {
    const entry = normalizeCardInvoiceImport(draft).entries.find((e) => e.bank_description === "Repasse de IOF");
    expect(entry.answer).toBe("pair_split");
    expect(entry.split_pair.transaction_ids).toEqual(repasse().split_pair.transaction_ids);
    expect(entry.split_pair.transactions[0].value).toBeTypeOf("number");
    expect(entry.split_pair.total.amount).toBeCloseTo(Number(repasse().split_pair.total.amount));
    const plain = normalizeCardInvoiceImport(draft).entries.find((e) => e.bank_description === "ANUIDADE DIFERENCIADA");
    expect(plain.split_pair).toBeNull();
  });

  it("mostra as transações do Fincla e a soma, \"A soma bate\" e o Confirmar sugestão da sugestão intacta", async () => {
    const card = await open();
    const side = within(card).getByTestId("split-pair-side");
    const n = repasse().split_pair.transactions.length;
    expect(side).toHaveTextContent(`Somados no Fincla: ${n} lançamentos`);
    expect(within(side).getByTestId("sum-matches")).toHaveTextContent("A soma bate");
    expect(within(side).getAllByTestId("split-pair-transaction")).toHaveLength(n);
    expect(within(card).queryByRole("textbox")).not.toBeInTheDocument();
    const group = answers(card);
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Sim, somados no Fincla", "Não, adicionar agora", "Não registrar"]);
    expect(within(group).getByRole("button", { name: "Sim, somados no Fincla" })).toHaveAttribute("aria-pressed", "true");
    expect(within(card).getByRole("button", { name: "Confirmar sugestão" })).toBeInTheDocument();
  });

  it("Confirmar sugestão grava a confirmação e recolhe: \"Somado em N lançamentos do Fincla\"", async () => {
    const user = userEvent.setup();
    const card = await open();
    await user.click(within(card).getByRole("button", { name: "Confirmar sugestão" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: repasse().id, body: { confirmed: true } }));
    const row = await screen.findByTestId("split-pair-row");
    expect(row).toHaveTextContent(`Somado em ${repasse().split_pair.transactions.length} lançamentos do Fincla`);
    expect(row).toHaveTextContent("Conferido");
    expect(screen.queryByRole("article", { name: /Repasse de IOF/ })).not.toBeInTheDocument();
  });

  it("Não registrar confirma e recolhe; reaberto, a lista fica à vista cinza listrada, sem Confirmar", async () => {
    const user = userEvent.setup();
    const card = await open();
    await user.click(within(answers(card)).getByRole("button", { name: "Não registrar" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: repasse().id, body: { answer: "ignore" } }));
    const row = await screen.findByRole("group", { name: "Lançamento Repasse de IOF não registrado" });
    await user.click(within(row).getByRole("button", { name: /Alterar/ }));
    const reopened = await screen.findByRole("article", { name: /Repasse de IOF/ });
    expect(within(reopened).getByTestId("split-pair-side-skipped")).toHaveTextContent("Somados no Fincla");
    expect(within(reopened).queryByRole("button", { name: "Confirmar sugestão" })).not.toBeInTheDocument();
  });

  it("Não, adicionar agora abre o formulário, sem confirmar", async () => {
    const user = userEvent.setup();
    const card = await open();
    await user.click(within(answers(card)).getByRole("button", { name: "Não, adicionar agora" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: repasse().id, body: { answer: "create", confirmed: false } }));
    const reopened = await screen.findByRole("article", { name: /Repasse de IOF/ });
    await waitFor(() => expect(within(reopened).queryByTestId("split-pair-side")).not.toBeInTheDocument());
    expect(within(reopened).getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it("\"Revisar e concluir\" conta o lançamento somado como ligado", () => {
    repasse().confirmed = true;
    const rows = invoiceSummaryRows(normalizeCardInvoiceImport(draft));
    const row = rows.find((r) => r.testId === "summary-split-pairs");
    expect(row.text).toBe("lançamento já estava somado no Fincla e fica ligado ao banco");
    expect(row.note).toBe(`ligado a ${repasse().split_pair.transactions.length} lançamentos do Fincla`);
  });

  it("sem soma que bata, a linha vem sem resposta: nada marcado, sem \"Sim, somados\"", async () => {
    fresh({ split: false });
    const card = await open();
    const group = within(card).getByRole("group", { name: "Adicionar ao Fincla?" });
    for (const b of within(group).getAllByRole("button")) expect(b).toHaveAttribute("aria-pressed", "false");
    expect(within(card).queryByText("Sim, somados no Fincla")).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  });

  it("no celular, cartão e linha somada ficam com alvos de toque de 44px", async () => {
    const user = userEvent.setup();
    const found = {};
    const card = await open({ isMobile: true });
    found.card = smallTouchTargets(document.body);
    await user.click(within(card).getByRole("button", { name: "Confirmar sugestão" }));
    await screen.findByTestId("split-pair-row");
    found.row = smallTouchTargets(document.body);
    expect(found).toEqual({ card: [], row: [] });
  });
});
