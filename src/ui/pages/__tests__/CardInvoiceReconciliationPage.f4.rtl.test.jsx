/** @vitest-environment jsdom */
// Conciliar fatura, quarta entrega (fincla-api#558): encargos, tarifas e estornos, no nível da página,
// com a fixture de contrato (`draft`, `charge_group_each`, cópia byte a byte da do backend). Confere o
// que a pessoa vê e o que a tela manda: o grupo de encargos como UM item da fila (a Soma, "A soma
// bate", as três respostas pela rota do grupo, o recolher no clique, "Não registrar" cinza listrado
// com a transação do Fincla à vista, o Desfazer escolha); nenhum lançamento do grupo respondido
// sozinho; anuidade, redução, repasse de IOF e estornos com o formulário (crédito vira estorno, com a
// nota); a diferença do topo pelo sinal do estorno; o formulário só leitura quando Adicionar não vale
// (QA F3 OBS-09); e os alvos de toque no celular.
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
const CATEGORIES = [
  { id: "cat-tarifas", name: "tarifas", label: "Tarifas bancárias", allowed_transaction_types: ["expense"], is_fallback: false },
  { id: "cat-fallback", name: "nao-classificado", label: "Não classificado", allowed_transaction_types: ["expense", "income", "refund"], is_fallback: true },
];

const calls = [];
let draft;
const fresh = (key = "draft") => {
  draft = clone(contract[key]);
  // A pessoa já passou pelos passos 1 a 3: o rascunho retoma no passo 4.
  draft.current_step = "charges";
};
fresh();

const byText = (text) => draft.entries.find((e) => e.bank_description === text);
const group = () => draft.charge_groups[0];
const members = () => group().entry_ids.map((id) => draft.entries.find((e) => e.id === id));
const ESTORNO = () => byText("ESTORNO LOJA MODA");
const REDUCAO = () => byText("REDUCAO ANUIDADE");

/**
 * A diferença do topo, como o backend projeta: cada `create` entra no Fincla (o estorno subtrai);
 * `pair_sum` não muda nada. Só o efeito da mudança é aplicado ao que veio gravado na fixture.
 */
const effectOf = (entry) => {
  if (entry.answer !== "create") return 0;
  const value = Math.abs(Number(entry.amount.amount));
  return entry.transaction_type === "refund" ? -value : value;
};
function project(before, after) {
  const now = draft.difference_now;
  const fincla = Number(now.fincla.amount) + (after - before);
  now.fincla.amount = fincla.toFixed(2);
  now.difference.amount = (Number(now.bank.amount) - fincla).toFixed(2);
}

/** O que o backend faz numa resposta de lançamento: responder confirma, a menos que venha `confirmed`. */
function applyBody(entry, body) {
  const before = effectOf(entry);
  if (body.answer !== undefined) entry.answer = body.answer;
  if (body.description !== undefined) entry.description = body.description;
  if (body.category_tag_id !== undefined) entry.category_tag_id = body.category_tag_id;
  if (body.confirmed !== undefined) entry.confirmed = body.confirmed;
  else if (body.answer !== undefined) entry.confirmed = true;
  project(before, effectOf(entry));
}

/** O grupo inteiro: a resposta e o confirmar valem para todos os lançamentos dele. */
function applyGroup(g, body) {
  const before = members().reduce((sum, e) => sum + effectOf(e), 0);
  if (body.answer !== undefined) {
    g.answer = body.answer;
    g.paired_transaction_id = body.answer === "pair_sum" ? g.suggested_transaction_id : null;
  }
  if (body.confirmed !== undefined) g.confirmed = body.confirmed;
  // `{answer: null}` volta a sem resposta, desconfirmado; responder confirma.
  else if (body.answer !== undefined) g.confirmed = body.answer !== null;
  for (const e of members()) Object.assign(e, { answer: g.answer, confirmed: g.confirmed });
  draft.summary.summed_charges = g.answer === "pair_sum" ? g.entry_ids.length : 0;
  project(before, members().reduce((sum, e) => sum + effectOf(e), 0));
}

const memberRefusal = () =>
  HttpResponse.json({ detail: { code: "card_invoice_import.charge_group_member", message: "Este lançamento faz parte do grupo de encargos: responda o grupo inteiro de uma vez." } }, { status: 422 });

const server = setupServer(
  http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: CARD.id, public_id: CARD.public_id, description: CARD.name, brand: "Visa", last4: CARD.last4 }])),
  http.get("*/v1/tags", ({ request }) => HttpResponse.json({ tags: new URL(request.url).searchParams.get("tag_type") === "detalhe" ? [] : CATEGORIES })),
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
    const entry = draft.entries.find((e) => e.id === p.entryId);
    if (entry.charge_group_id && (body.answer !== undefined || body.confirmed !== undefined)) return memberRefusal();
    applyBody(entry, body);
    return HttpResponse.json(entry);
  }),
  // O lote (#558): `entries` e `groups`, tudo ou nada; os grupos depois dos lançamentos.
  http.patch(`${BASE}/:importId/entries`, async ({ request }) => {
    const body = await request.json();
    calls.push({ batch: body.entries ?? [], groups: body.groups ?? [], keys: Object.keys(body).sort() });
    if ((body.entries ?? []).some((item) => draft.entries.find((e) => e.id === item.id).charge_group_id)) return memberRefusal();
    for (const item of body.entries ?? []) applyBody(draft.entries.find((e) => e.id === item.id), item);
    for (const { id, ...rest } of body.groups ?? []) applyGroup(draft.charge_groups.find((g) => g.id === id), rest);
    return HttpResponse.json(draft);
  }),
  http.patch(`${BASE}/:importId/charge-groups/:groupId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ group: p.groupId, body });
    applyGroup(draft.charge_groups.find((g) => g.id === p.groupId), body);
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

const open = async (props = {}) => {
  params = { cardId: CARD.public_id, importId: draft.id };
  render(<CardInvoiceReconciliationPage organizationId={ORG} {...props} />);
  return screen.findByRole("heading", { name: "Encargos, tarifas e estornos" });
};
const groupCard = () => screen.getByRole("article", { name: "Encargos do mês: 4 lançamentos" });
const groupAnswers = () => within(groupCard()).getByRole("group", { name: "Estes encargos já estão no Fincla?" });
const charge = (text) => screen.getByRole("article", { name: new RegExp(`Lançamento de .*: ${text}`) });
const groupPatches = () => calls.filter((c) => c.group);
const rail = () => screen.getByRole("navigation", { name: "Etapas da conciliação da fatura" });
const railButton = (title) => within(rail()).getAllByRole("button").find((b) => within(b).getByTestId("step-title").textContent === title);
/** Sem transação que bata: o grupo começa sem resposta (como o backend grava). */
const noSumMatch = () => {
  Object.assign(group(), { answer: null, confirmed: false, suggested_transaction_id: null, paired_transaction_id: null, fincla_transaction: null });
  for (const e of members()) Object.assign(e, { answer: null, confirmed: false });
};
/** Nenhum lançamento do grupo foi respondido ou confirmado sozinho (nem no lote). */
const noMemberAnswered = () => {
  const ids = new Set(group().entry_ids);
  expect(calls.filter((c) => c.patch && ids.has(c.patch))).toEqual([]);
  expect(calls.filter((c) => c.batch?.some((b) => ids.has(b.id)))).toEqual([]);
};

describe("o grupo de encargos", () => {
  it("abre primeiro, como um item só: os lançamentos e a Soma, a transação que bate e as três respostas", async () => {
    await open();

    const card = groupCard();
    // A lista vive dentro da caixa do banco: sem o respiro e o fundo próprios da soma do extrato.
    const list = within(card).getByRole("list", { name: "Lançamentos do grupo de encargos" });
    expect(list.style.padding).toBe("0px");
    expect(list.style.background).toBe("transparent");
    const lines = within(card).getAllByTestId("summed-entry");
    expect(lines.map((l) => l.textContent)).toEqual([
      expect.stringContaining("JUROS DO ROTATIVO"),
      expect.stringContaining("JUROS DE MORA"),
      expect.stringContaining("MULTA POR ATRASO"),
      expect.stringContaining("IOF DE FINANCIAMENTO"),
    ]);
    // Cobrança sem sinal, como a fatura mostra; a Soma no fim.
    expect(lines[0]).toHaveTextContent("R$ 8,90");
    expect(within(card).getByTestId("summed-total")).toHaveTextContent("SomaR$ 12,59");
    // O lado do Fincla: a transação cujo valor é a soma, com o selo e o que acontece.
    const fincla = within(card).getByTestId("fincla-side");
    expect(within(fincla).getByTestId("sum-matches")).toHaveTextContent("A soma bate");
    expect(fincla).toHaveTextContent("Encargos do cartão");
    expect(within(card).getByTestId("sum-consequences")).toHaveTextContent(
      "Encargos do cartão (R$ 12,59) tem o mesmo valor que a soma destes 4 lançamentos. Se for isso, nada novo é criado: ela fica ligada a todos eles.",
    );
    expect(within(card).getByText("Já está no Fincla, somado · falta confirmar")).toBeInTheDocument();
    const answers = groupAnswers();
    expect(within(answers).getByRole("button", { name: "Sim, somados em Encargos do cartão" })).toHaveAttribute("aria-pressed", "true");
    expect(within(answers).getByRole("button", { name: "Não, adicionar cada um" })).toHaveAttribute("aria-pressed", "false");
    expect(within(answers).getByRole("button", { name: "Não registrar" })).toHaveAttribute("aria-pressed", "false");
    // Só a sugestão intacta tem o Confirmar.
    expect(within(card).getByRole("button", { name: "Confirmar sugestão" })).toBeEnabled();
    expect(within(card).getByTestId("pair-outcome")).toHaveTextContent("Ao concluir: os 4 lançamentos ficam ligados a Encargos do cartão. Nada mais muda nela.");
    // Os outros lançamentos do passo são linhas, cada um o seu: o repasse de IOF nunca entra no grupo.
    expect(within(card).queryByText("Repasse de IOF")).not.toBeInTheDocument();
    const rows = screen.getAllByTestId("entry-row").map((r) => r.textContent);
    expect(rows).toHaveLength(4);
    expect(rows.some((t) => t.includes("Repasse de IOF"))).toBe(true);
    // O grupo conta como UM item: 5 na fila.
    expect(screen.getByTestId("queue-position")).toHaveTextContent("Lançamento 1 de 5");
  });

  it("Confirmar sugestão confirma pela rota do grupo e recolhe no clique: a linha fica parada e o próximo abre", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(within(groupCard()).getByRole("button", { name: "Confirmar sugestão" }));

    await waitFor(() => expect(groupPatches()).toEqual([{ group: group().id, body: { confirmed: true } }]));
    const row = await screen.findByTestId("charge-group-row");
    expect(row).toHaveTextContent("Encargos do mês · 4 lançamentos");
    expect(row).toHaveTextContent("Somados em Encargos do cartão");
    expect(row).toHaveTextContent("Conferido");
    expect(row).toHaveTextContent("R$ 12,59");
    expect(screen.queryByRole("article", { name: "Encargos do mês: 4 lançamentos" })).not.toBeInTheDocument();
    // O próximo da fila abre: o estorno, depois do grupo.
    expect(await screen.findByRole("article", { name: /Lançamento de 30\/11\/2026: ESTORNO LOJA MODA/ })).toBeInTheDocument();
    noMemberAnswered();
  });

  it("Não registrar confirma e recolhe listrado; reaberto, a transação somada fica à vista, cinza listrada; Desfazer escolha volta à soma", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(within(groupAnswers()).getByRole("button", { name: "Não registrar" }));

    await waitFor(() => expect(groupPatches()).toEqual([{ group: group().id, body: { answer: "ignore" } }]));
    const row = await screen.findByTestId("charge-group-row");
    expect(row).toHaveTextContent("Ficam fora do Fincla");
    expect(row.style.background).toContain("repeating-linear-gradient");

    await user.click(within(row).getByRole("button", { name: "Alterar encargos do mês" }));
    const skipped = within(groupCard()).getByTestId("fincla-side-skipped");
    expect(skipped.style.background).toContain("repeating-linear-gradient");
    expect(skipped).toHaveTextContent("Encargos do cartão");
    expect(within(skipped).getByTestId("skip-note")).toHaveTextContent(
      "Estes 4 lançamentos do banco não entram no Fincla. Encargos do cartão continua como está, sem mudança, e a diferença aparece em Conferir o total.",
    );
    expect(within(groupCard()).getByTestId("bank-side").style.background).toContain("repeating-linear-gradient");
    expect(within(groupCard()).queryByRole("button", { name: "Confirmar sugestão" })).not.toBeInTheDocument();

    await user.click(within(groupCard()).getByRole("button", { name: "Desfazer escolha" }));
    await waitFor(() => expect(groupPatches().at(-1)).toEqual({ group: group().id, body: { answer: "pair_sum", confirmed: false } }));
    expect(await within(groupCard()).findByRole("button", { name: "Confirmar sugestão" })).toBeInTheDocument();
    noMemberAnswered();
  });

  it("Não, adicionar cada um: uma transação por lançamento, e a transação somada continua no Fincla", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(within(groupAnswers()).getByRole("button", { name: "Não, adicionar cada um" }));
    await waitFor(() => expect(groupPatches()).toEqual([{ group: group().id, body: { answer: "create" } }]));
    const row = await screen.findByTestId("charge-group-row");
    expect(row).toHaveTextContent("Adicionar cada um");
    expect(row).toHaveTextContent("Entram 4 transações");

    await user.click(within(row).getByRole("button", { name: "Alterar encargos do mês" }));
    const created = within(groupCard()).getByTestId("charge-group-create");
    expect(within(created).getAllByTestId("charge-group-new").map((li) => li.textContent)).toEqual([
      expect.stringContaining("JUROS DO ROTATIVO"),
      expect.stringContaining("JUROS DE MORA"),
      expect.stringContaining("MULTA POR ATRASO"),
      expect.stringContaining("IOF DE FINANCIAMENTO"),
    ]);
    expect(created).toHaveTextContent("Encargos do cartão continua no Fincla como está, sem mudança.");
    noMemberAnswered();
  });

  it("rascunho gravado com Adicionar cada um (charge_group_each): a linha já respondida, e o Repasse de IOF à parte", async () => {
    fresh("charge_group_each");
    await open();

    const row = await screen.findByTestId("charge-group-row");
    expect(row).toHaveTextContent("Adicionar cada um");
    expect(row).toHaveTextContent("Conferido");
    // A diferença do topo projeta as 4 transações criadas além da somada (e a Assinatura que sobra, R$ 61,00).
    expect(screen.getByTestId("invoice-difference-value")).toHaveTextContent("−R$ 73,99");
  });

  it("sem transação que bata: começa sem resposta, Sim desligado com o motivo, e segura o Próximo", async () => {
    noSumMatch();
    const user = userEvent.setup();
    await open();

    const card = groupCard();
    expect(within(card).getByText("Falta responder")).toBeInTheDocument();
    expect(within(card).getByTestId("fincla-side-none")).toHaveTextContent("Nenhuma transação desta fatura no Fincla tem o valor da soma.");
    const yes = within(groupAnswers()).getByRole("button", { name: "Sim, somados numa transação" });
    expect(yes).toBeDisabled();
    expect(yes).toHaveAccessibleDescription("Nenhuma transação desta fatura no Fincla tem o valor da soma.");
    expect(within(card).queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Próximo: Compras novas/ })).toBeDisabled();
    // O grupo conta como um, pelo nome; os 4 lançamentos já vêm com "Adicionar" marcado e só faltam
    // confirmar: o aviso diz isso, como o trilho (QA F4 OBS-03).
    expect(screen.getByTestId("go-to-pending")).toHaveTextContent("Falta responder 1 grupo de encargos e confirmar 4 escolhas deste passo");

    await user.click(within(groupAnswers()).getByRole("button", { name: "Não, adicionar cada um" }));
    await waitFor(() => expect(groupPatches()).toEqual([{ group: group().id, body: { answer: "create" } }]));
  });

  it("sem resposta e recolhido: a linha diz que falta escolher, nunca que fica fora do Fincla", async () => {
    noSumMatch();
    const user = userEvent.setup();
    await open();
    groupCard();

    // Abrir outro item da fila recolhe o grupo ainda sem resposta.
    await user.click(screen.getAllByTestId("entry-row")[0]);

    const row = await screen.findByTestId("charge-group-row");
    expect(row).toHaveTextContent("Falta responder");
    expect(row).toHaveTextContent("Falta escolher o que fazer com estes encargos");
    expect(row).not.toHaveTextContent("Ficam fora do Fincla");
    expect(row).not.toHaveTextContent("Conferido");
    expect(row.style.background).not.toContain("repeating-linear-gradient");
  });

  it("Desfazer escolha da primeira resposta volta o grupo a sem resposta ({answer: null})", async () => {
    noSumMatch();
    const user = userEvent.setup();
    await open();

    await user.click(within(groupAnswers()).getByRole("button", { name: "Não registrar" }));
    const row = await screen.findByTestId("charge-group-row");
    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));

    await waitFor(() => expect(groupPatches().at(-1)).toEqual({ group: group().id, body: { answer: null } }));
    expect(group()).toMatchObject({ answer: null, confirmed: false });
    const card = await screen.findByRole("article", { name: "Encargos do mês: 4 lançamentos" });
    expect(within(card).getByText("Falta responder")).toBeInTheDocument();
    for (const b of within(groupAnswers()).getAllByRole("button")) expect(b).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /Próximo: Compras novas/ })).toBeDisabled();
    noMemberAnswered();
  });

  it("as contagens chamam o grupo pelo nome: o trilho e o resumo concordam", async () => {
    noSumMatch();
    // O backend conta cada lançamento do grupo em `unanswered`, e mais um sem resposta de outro passo.
    Object.assign(draft.summary, { unanswered: 5 });
    Object.assign(draft, { can_conclude: false, blockers: [{ code: "unanswered", count: 5 }] });
    const user = userEvent.setup();
    await open();

    expect(railButton("Encargos, tarifas e estornos")).toHaveTextContent("1 grupo de encargos para responder");
    await user.click(railButton("Revisar e concluir"));
    expect(await screen.findByTestId("conclude-blocked")).toHaveTextContent("Falta responder 1 grupo de encargos e 1 item.");
  });

  it("um grupo de um lançamento só: o singular em todo o cartão", async () => {
    const [first, ...rest] = group().entry_ids;
    group().entry_ids = [first];
    draft.entries = draft.entries.filter((e) => !rest.includes(e.id));
    const user = userEvent.setup();
    await open();

    const card = screen.getByRole("article", { name: "Encargos do mês: 1 lançamento" });
    expect(within(card).getByTestId("sum-consequences")).toHaveTextContent(
      "Encargos do cartão (R$ 12,59) tem o mesmo valor que este lançamento. Se for isso, nada novo é criado: ela fica ligada a ele.",
    );
    expect(within(card).getByTestId("pair-outcome")).toHaveTextContent("Ao concluir: o lançamento fica ligado a Encargos do cartão. Nada mais muda nela.");

    await user.click(within(within(card).getByRole("group", { name: "Estes encargos já estão no Fincla?" })).getByRole("button", { name: "Não registrar" }));
    await user.click(within(await screen.findByTestId("charge-group-row")).getByRole("button", { name: "Alterar encargos do mês" }));
    expect(within(screen.getByTestId("fincla-side-skipped")).getByTestId("skip-note")).toHaveTextContent(
      "Este lançamento do banco não entra no Fincla. Encargos do cartão continua como está",
    );
  });

  it("a dica de atalhos só mostra o S com o grupo aberto", async () => {
    const user = userEvent.setup();
    await open();
    expect(screen.getByTestId("queue-shortcuts")).toHaveTextContent("S sim");

    await user.click(within(groupCard()).getByRole("button", { name: "Confirmar sugestão" }));
    await screen.findByRole("article", { name: /ESTORNO LOJA MODA/ });
    expect(screen.getByTestId("queue-shortcuts")).not.toHaveTextContent("S sim");
    expect(screen.getByTestId("queue-shortcuts")).toHaveTextContent("A adicionar");
  });

  it("fatura já paga: Não, adicionar cada um desligado com o motivo; a soma ainda liga", async () => {
    group().addable = false;
    await open();

    const add = within(groupAnswers()).getByRole("button", { name: "Não, adicionar cada um" });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription("Esta fatura já foi paga. Para corrigir, desmarque o pagamento e volte aqui.");
    expect(within(groupAnswers()).getByRole("button", { name: "Sim, somados em Encargos do cartão" })).toBeEnabled();
  });

  it("atalhos: N não registra o grupo pela rota dele; A não adiciona na fatura paga", async () => {
    group().addable = false;
    const user = userEvent.setup();
    await open();
    groupCard();

    await user.keyboard("a");
    expect(groupPatches()).toEqual([]);
    await user.keyboard("n");
    await waitFor(() => expect(groupPatches()).toEqual([{ group: group().id, body: { answer: "ignore" } }]));
    noMemberAnswered();
  });

  it("Próximo confirma os lançamentos e o grupo numa chamada só (o grupo em groups), sem nenhum lançamento do grupo", async () => {
    const user = userEvent.setup();
    await open();

    expect(screen.getByText("Ao avançar, as 5 escolhas que faltam confirmar ficam confirmadas. Nada muda no Fincla até você concluir.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Próximo: Compras novas/ }));

    await waitFor(() => expect(calls.filter((c) => c.batch)).toHaveLength(1));
    const [{ batch, groups }] = calls.filter((c) => c.batch);
    expect(batch.map((b) => draft.entries.find((e) => e.id === b.id).bank_description).sort()).toEqual(
      ["ANUIDADE DIFERENCIADA", "ESTORNO LOJA MODA", "REDUCAO ANUIDADE", "Repasse de IOF"],
    );
    expect(batch.every((b) => b.confirmed === true && Object.keys(b).length === 2)).toBe(true);
    expect(groups).toEqual([{ id: group().id, confirmed: true }]);
    // Nada pela rota do grupo: tudo ou nada, no lote.
    expect(groupPatches()).toEqual([]);
    noMemberAnswered();
    expect(await screen.findByRole("heading", { name: "Compras novas" })).toBeInTheDocument();
  });

  it("Próximo com só o grupo a confirmar manda só groups no lote", async () => {
    for (const e of draft.entries.filter((x) => x.classification === "charges" && !x.charge_group_id)) e.confirmed = true;
    const user = userEvent.setup();
    await open();

    await user.click(screen.getByRole("button", { name: /Próximo: Compras novas/ }));

    await waitFor(() => expect(calls.filter((c) => c.batch)).toHaveLength(1));
    expect(calls.find((c) => c.batch)).toMatchObject({ keys: ["groups"], groups: [{ id: group().id, confirmed: true }] });
    expect(await screen.findByRole("heading", { name: "Compras novas" })).toBeInTheDocument();
  });
});

describe("anuidade, redução, repasse de IOF e estornos", () => {
  // O grupo já confirmado: o primeiro lançamento do passo abre sozinho.
  const groupDone = () => {
    group().confirmed = true;
    for (const e of members()) e.confirmed = true;
  };

  it("crédito vira estorno: Adicionar com o formulário, o tipo travado em Estorno, a nota e o sinal do estorno", async () => {
    groupDone();
    await open();

    const estorno = charge("ESTORNO LOJA MODA");
    expect(within(estorno).getByTestId("bank-side")).toHaveTextContent("−R$ 45,00");
    expect(within(estorno).getByTestId("locked-type")).toHaveTextContent("Estorno");
    expect(within(estorno).getByTestId("locked-amount")).toHaveTextContent("R$ 45,00");
    expect(within(estorno).getByTestId("refund-note")).toHaveTextContent("Entra como estorno: diminui o total da fatura.");
    const answers = within(estorno).getByRole("group", { name: "Adicionar ao Fincla?" });
    expect(within(answers).getByRole("button", { name: "Adicionar" })).toHaveAttribute("aria-pressed", "true");
    expect(within(estorno).getByRole("button", { name: "Confirmar" })).toBeEnabled();
    expect(within(estorno).getByTestId("pair-outcome")).toHaveTextContent("Ao concluir: entra o estorno “ESTORNO LOJA MODA”");
    expect(within(estorno).getByTestId("pair-outcome")).toHaveTextContent("diminui o total da fatura.");
  });

  it("a diferença do topo segue o sinal do estorno: sem ele, o Fincla fica R$ 45,00 maior", async () => {
    groupDone();
    const user = userEvent.setup();
    await open();
    expect(screen.getByTestId("invoice-difference-value")).toHaveTextContent("−R$ 61,40");

    await user.click(within(charge("ESTORNO LOJA MODA")).getByRole("button", { name: "Não registrar" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: ESTORNO().id, body: { answer: "ignore" } }));
    await waitFor(() => expect(screen.getByTestId("invoice-difference-value")).toHaveTextContent("−R$ 106,40"));
  });

  it("Confirmar grava a confirmação do lançamento e recolhe: a anuidade abre como despesa", async () => {
    groupDone();
    const user = userEvent.setup();
    await open();

    await user.click(within(charge("ESTORNO LOJA MODA")).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: ESTORNO().id, body: { confirmed: true } }));
    const repasse = await screen.findByRole("article", { name: /Lançamento de 10\/11\/2026: Repasse de IOF/ });
    expect(within(repasse).getByTestId("bank-side")).toHaveTextContent("Internacional");
    expect(within(repasse).getByTestId("locked-type")).toHaveTextContent("Despesa");
    expect(within(repasse).queryByTestId("refund-note")).not.toBeInTheDocument();
  });

  it("Adicionar que não vale (addable false, QA F3 OBS-09): o formulário só leitura, sem campo nem convite a escolher a categoria", async () => {
    groupDone();
    for (const e of draft.entries.filter((x) => x.classification === "charges" && !x.charge_group_id)) e.confirmed = true;
    // Um crédito parcelado: o backend só aceita "Não registrar".
    Object.assign(REDUCAO(), { installment: { number: 2, count: 3 }, addable: false, answer: "ignore", confirmed: false });
    await open();

    const reducao = charge("REDUCAO ANUIDADE");
    const form = within(reducao).getByTestId("new-side-read-only");
    expect(form).toHaveTextContent("REDUCAO ANUIDADE");
    expect(form).toHaveTextContent("Estorno");
    expect(within(reducao).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(reducao).queryByRole("combobox")).not.toBeInTheDocument();
    expect(reducao).not.toHaveTextContent("escolha a categoria");
    expect(reducao).not.toHaveTextContent("Pode trocar por um nome seu");
    expect(within(reducao).getByRole("button", { name: "Adicionar" })).toBeDisabled();
    expect(within(reducao).getByTestId("pair-outcome")).toHaveTextContent("Não entra no Fincla.");
  });
});

describe("o resumo: onde escolher a categoria", () => {
  const setCategory = (pred) => { for (const e of draft.entries.filter(pred)) e.category_tag_id = "cat-tarifas"; };

  it("os lançamentos criados pelo grupo (Adicionar cada um) não convidam a escolher a categoria: lá ela é só leitura", async () => {
    fresh("charge_group_each");
    // Só os 4 do grupo ficam sem categoria.
    setCategory((e) => e.answer === "create" && !e.charge_group_id);
    draft.summary.uncategorized = 4;
    const user = userEvent.setup();
    await open();
    await user.click(railButton("Revisar e concluir"));

    const note = await screen.findByTestId("summary-uncategorized");
    expect(note).toHaveTextContent("4 transações novas estão sem categoria e vão para Não classificado ao concluir.");
    expect(note).not.toHaveTextContent("Dá para escolher");
  });

  it("com um lançamento solto do passo 4 sem categoria, o convite aponta só para ele, ao lado dos do grupo", async () => {
    fresh("charge_group_each");
    setCategory((e) => e.answer === "create" && !e.charge_group_id && e.bank_description !== "ANUIDADE DIFERENCIADA");
    draft.summary.uncategorized = 5;
    const user = userEvent.setup();
    await open();
    await user.click(railButton("Revisar e concluir"));

    expect(await screen.findByTestId("summary-uncategorized")).toHaveTextContent(
      "5 transações novas estão sem categoria e vão para Não classificado ao concluir. Dá para escolher a categoria em Encargos, tarifas e estornos.",
    );
  });

  it("\"Não, adicionar agora\" do passo 1 aponta para o passo 1, não para Compras novas", async () => {
    setCategory((e) => e.answer === "create");
    Object.assign(byText("MERCADO BOA VISTA"), { answer: "create", confirmed: true, category_tag_id: null });
    Object.assign(group(), { confirmed: true });
    draft.summary.uncategorized = 1;
    const user = userEvent.setup();
    await open();
    await user.click(railButton("Revisar e concluir"));

    expect(await screen.findByTestId("summary-uncategorized")).toHaveTextContent(
      "Uma compra nova está sem categoria e vai para Não classificado ao concluir. Dá para escolher a categoria em Confirmar compras encontradas.",
    );
  });
});

describe("alvos de toque", () => {
  it("varredura: no celular nenhum controle do grupo (aberto e recolhido) nem do estorno aberto fica abaixo de 44 px", async () => {
    const found = {};
    const user = userEvent.setup();
    await open({ isMobile: true });
    groupCard();
    found.group = smallTouchTargets(document.body);

    await user.click(within(groupAnswers()).getByRole("button", { name: "Não registrar" }));
    await screen.findByRole("article", { name: /ESTORNO LOJA MODA/ });
    found.rowAndRefund = smallTouchTargets(document.body);

    await user.click(within(screen.getByTestId("charge-group-row")).getByRole("button", { name: "Alterar encargos do mês" }));
    within(groupCard()).getByTestId("fincla-side-skipped");
    found.skippedGroup = smallTouchTargets(document.body);

    expect(found).toEqual({ group: [], rowAndRefund: [], skippedGroup: [] });
  });

  it("no computador, as respostas e o Confirmar sugestão do grupo ficam com a altura de antes", async () => {
    await open();
    expect(within(groupCard()).getByRole("button", { name: "Confirmar sugestão" }).style.minHeight).toBe("");
    expect(within(groupAnswers()).getByRole("button", { name: "Não registrar" }).style.minHeight).toBe("32px");
  });
});
