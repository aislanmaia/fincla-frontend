/** @vitest-environment jsdom */
// Conciliar extrato: lançamentos novos completos, somar e não registrar (fincla-api#513).
// A página é alimentada pela fixture canônica do backend (`statement_import.example.json`):
// dois rendimentos somados em "Rendimentos da conta", três lançamentos novos e um "Não registrar".
// O servidor falso imita as regras do backend (soma, lote, etiquetas da categoria); a gravação de
// verdade é garantida pelos testes de API. Aqui: o que a pessoa vê e o que a tela manda.
import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import contract from "../../../api/__fixtures__/statement_import.example.json";

const navigate = vi.fn();
let params = {};
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate, useParams: () => params }));
import { StatementReconciliationPage } from "../StatementReconciliationPage.jsx";

const ORG = "org";
const ACCOUNT = contract.draft.account_id;
const IMPORT = contract.draft.id;
const BASE = `*/v1/accounts/${ACCOUNT}/statement-imports`;
const clone = (value) => JSON.parse(JSON.stringify(value));

const FOOD = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const BREAKFAST = contract.draft.entries[0].detail_tag_ids[0];
const CATEGORIES = [
  { id: FOOD, name: "Food", label: "Alimentação", is_active: true, is_fallback: false, allowed_transaction_types: ["expense"] },
  { id: "cat-home", name: "Home", label: "Casa", is_active: true, is_fallback: false, allowed_transaction_types: ["expense"] },
  { id: "cat-yield", name: "Yield", label: "Rendimentos", is_active: true, is_fallback: false, allowed_transaction_types: ["income"] },
  { id: "cat-unclassified", name: "Unclassified", label: "Não classificado", is_active: true, is_fallback: true, allowed_transaction_types: ["income", "expense"] },
];
const DETAILS = [
  { id: BREAKFAST, name: "Breakfast", label: "Café da manhã", is_active: true, parent_category_tag_id: FOOD },
  { id: "det-snack", name: "Snack", label: "Lanche", is_active: true, parent_category_tag_id: FOOD },
  { id: "det-repair", name: "Repair", label: "Manutenção", is_active: true, parent_category_tag_id: "cat-home" },
];

const E = Object.fromEntries(contract.draft.entries.map((e) => [e.bank_description.split(" ")[0] + e.position, e.id]));
const BAKERY = contract.draft.entries[0].id;
const SALARY = contract.draft.entries[1].id;
const ENERGY = contract.draft.entries[2].id;
const YIELD_A = contract.draft.entries[3].id;
const YIELD_B = contract.draft.entries[4].id;
const FEE = contract.draft.entries[5].id;
const GROUP = contract.draft.groups[0].id;

// --- servidor falso com as regras do backend que a tela depende ---------------------------
let draft;
const calls = [];
const entry = (id) => draft.entries.find((e) => e.id === id);
const entryBefore = (id) => contract.draft.entries.find((e) => e.id === id);
const money = (n) => ({ amount: n.toFixed(2), currency: "BRL" });

function recompute() {
  const live = new Set(draft.entries.filter((e) => e.answer === "group").map((e) => e.group_id));
  draft.groups = draft.groups.filter((g) => live.has(g.id)).map((g) => {
    const members = draft.entries.filter((e) => e.group_id === g.id).sort((a, b) => a.date.localeCompare(b.date));
    return {
      ...g,
      entry_ids: members.map((m) => m.id),
      amount: money(members.reduce((s, m) => s + Number(m.amount.amount), 0)),
      date: members[members.length - 1].date,
    };
  });
  const create = draft.entries.filter((e) => e.answer === "create");
  draft.summary = {
    total: draft.entries.length,
    to_create: create.length,
    missing_description: create.filter((e) => !(e.description || "").trim()).length,
    unanswered: draft.entries.filter((e) => e.answer == null).length,
    to_pair: draft.entries.filter((e) => e.answer === "pair").length,
    ignored: draft.entries.filter((e) => e.answer === "ignore").length,
    grouped: draft.entries.filter((e) => e.answer === "group").length,
    groups: draft.groups.length,
    unclassified: create.filter((e) => !e.category_tag_id).length + draft.groups.filter((g) => !g.category_tag_id).length,
  };
}

function applyEntry(target, body) {
  if (body.answer) {
    target.answer = body.answer;
    target.group_id = null;
    target.confirmed = "confirmed" in body ? body.confirmed : true;
  }
  if ("category_tag_id" in body) {
    target.category_tag_id = body.category_tag_id;
    // Trocar a categoria tira as etiquetas que não são dela (regra do backend).
    target.detail_tag_ids = target.detail_tag_ids.filter((d) => DETAILS.find((x) => x.id === d)?.parent_category_tag_id === body.category_tag_id);
  }
  if (body.detail_tag_ids) target.detail_tag_ids = body.detail_tag_ids;
  for (const k of ["description", "transaction_type", "payment_method"]) if (k in body) target[k] = body[k];
}

const server = setupServer(
  http.get("*/v1/accounts", () =>
    HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true, initial_balance: { amount: "0.00", currency: "BRL" } }]),
  ),
  http.get("*/v1/tags", ({ request }) =>
    HttpResponse.json({ tags: new URL(request.url).searchParams.get("tag_type") === "detalhe" ? DETAILS : CATEGORIES }),
  ),
  http.get(`${BASE}/${IMPORT}`, () => HttpResponse.json(draft)),
  http.patch(`${BASE}/${IMPORT}`, async ({ request }) => {
    Object.assign(draft, await request.json());
    return HttpResponse.json(draft);
  }),
  http.patch(`${BASE}/${IMPORT}/entries`, async ({ request }) => {
    const body = await request.json();
    calls.push({ batch: body.entries });
    for (const { id, ...change } of body.entries) applyEntry(entry(id), change);
    recompute();
    return HttpResponse.json(draft);
  }),
  http.patch(`${BASE}/${IMPORT}/entries/:entryId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ patch: p.entryId, body });
    applyEntry(entry(p.entryId), body);
    recompute();
    return HttpResponse.json(entry(p.entryId));
  }),
  http.post(`${BASE}/${IMPORT}/groups`, async ({ request }) => {
    const body = await request.json();
    calls.push({ group: body });
    const id = `group-${calls.length}`;
    draft.groups.push({ ...clone(contract.draft.groups[0]), id, description: body.description, category_tag_id: null });
    // Como o backend: cada somado guarda a resposta (e o "confirmado") de antes.
    body.entry_ids.forEach((eid) => {
      const e = entry(eid);
      e._before = { answer: e.answer, confirmed: e.confirmed };
      e.answer = "group";
      e.group_id = id;
    });
    recompute();
    return HttpResponse.json(draft, { status: 201 });
  }),
  http.patch(`${BASE}/${IMPORT}/groups/:groupId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ patchGroup: p.groupId, body });
    Object.assign(draft.groups.find((g) => g.id === p.groupId), body);
    recompute();
    return HttpResponse.json(draft);
  }),
  http.delete(`${BASE}/${IMPORT}/groups/:groupId`, ({ params: p }) => {
    calls.push({ ungroup: p.groupId });
    // "Desfazer soma" devolve a cada um a resposta de antes (G3-2-03).
    draft.entries.filter((e) => e.group_id === p.groupId).forEach((e) => {
      e.answer = e._before?.answer ?? "create";
      if (e._before) e.confirmed = e._before.confirmed;
      delete e._before;
      e.group_id = null;
    });
    recompute();
    return HttpResponse.json(draft);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  server.resetHandlers();
});

const rail = () => screen.getByRole("navigation", { name: "Passos da conciliação" });
const railStep = (title) => within(rail()).getAllByRole("button").find((b) => within(b).getByTestId("step-title").textContent === title);

const openDraft = async ({ step = null, setup = () => {} } = {}) => {
  draft = clone(contract.draft);
  setup(draft);
  recompute();
  params = { accountId: ACCOUNT, importId: IMPORT };
  render(<StatementReconciliationPage organizationId={ORG} />);
  await screen.findByRole("navigation", { name: "Passos da conciliação" });
  const user = userEvent.setup();
  if (step) await user.click(railStep(step));
  return user;
};
const card = (bankText) => screen.getAllByTestId("statement-entry").find((c) => within(c).queryByText(bankText));
const markBox = (date) => screen.getByRole("checkbox", { name: `Marcar lançamento de ${date}` });

describe("revisar rendimentos pequenos: somar em um só lançamento", () => {
  it("abre nos rendimentos: a soma mostra os lançamentos somados, a soma exata e a data do último", async () => {
    await openDraft();

    expect(screen.getByRole("heading", { name: "Revisar rendimentos pequenos" })).toBeInTheDocument();
    const group = screen.getByTestId("statement-group");
    expect(within(group).getByLabelText("Descrição")).toHaveValue("Rendimentos da conta");
    expect(within(group).getByTestId("group-amount")).toHaveTextContent("0,03");
    expect(within(group).getAllByTestId("summed-entry").map((r) => r.textContent)).toEqual([
      expect.stringContaining("06/10/2026"),
      expect.stringContaining("15/10/2026"),
    ]);
    expect(within(group).getByTestId("entry-outcome")).toHaveTextContent("será adicionado “Rendimentos da conta” em Não classificado, +R$ 0,03, em 15/10/2026");
    expect(screen.getByText("Todos os rendimentos foram somados.")).toBeInTheDocument();
  });

  it("o total dos rendimentos fora da soma concorda com a quantidade: valor de 1, soma das N (BUG-02)", async () => {
    const outside = (d, ids) => ids.forEach((id) => Object.assign(d.entries.find((e) => e.id === id), { answer: "create", group_id: null }));
    const total = () => screen.getByText((_, el) => el?.tagName === "SPAN" && /^(valor|soma das \d+): /.test(el.textContent)).textContent;

    await openDraft({ setup: (d) => outside(d, [YIELD_B]) });
    expect(total()).toMatch(/^valor: \+R\$\s0,0\d$/);
    cleanup();

    await openDraft({ setup: (d) => outside(d, [YIELD_A, YIELD_B]) });
    expect(total()).toMatch(/^soma das 2: \+R\$\s0,0\d$/);
  });

  it("Tirar da soma volta o lançamento a ser adicionado sozinho, e a soma diminui", async () => {
    const user = await openDraft();
    const group = screen.getByTestId("statement-group");

    await user.click(within(group).getAllByRole("button", { name: "Tirar da soma" })[1]);

    await waitFor(() => expect(calls).toContainEqual({ patch: YIELD_B, body: { answer: "create" } }));
    await waitFor(() => expect(within(screen.getByTestId("statement-group")).getAllByTestId("summed-entry")).toHaveLength(1));
    expect(within(screen.getByTestId("statement-group")).getByTestId("group-amount")).toHaveTextContent("0,01");
    expect(screen.getAllByTestId("statement-entry")).toHaveLength(1);
  });

  it("Desfazer soma devolve todos os lançamentos, um por um", async () => {
    const user = await openDraft();

    await user.click(screen.getByRole("button", { name: "Desfazer soma" }));

    await waitFor(() => expect(calls).toContainEqual({ ungroup: GROUP }));
    await waitFor(() => expect(screen.queryByTestId("statement-group")).toBeNull());
    expect(screen.getAllByTestId("statement-entry")).toHaveLength(2);
  });

  it("Desfazer soma no cartão tem barra de desfazer que refaz a soma com o que ela tinha (G3-2-04)", async () => {
    const user = await openDraft({ setup: (d) => {
      Object.assign(d.groups[0], { category_tag_id: "cat-yield", payment_method: "pix", detail_tag_ids: [] });
    } });

    await user.click(screen.getByRole("button", { name: "Desfazer soma" }));

    await waitFor(() => expect(screen.queryByTestId("statement-group")).toBeNull());
    const bar = screen.getByTestId("undo-bar");
    expect(bar).toHaveTextContent("Soma “Rendimentos da conta” desfeita");

    await user.click(within(bar).getByRole("button", { name: "Desfazer" }));

    await waitFor(() => expect(calls).toContainEqual({ group: { entry_ids: [YIELD_A, YIELD_B], description: "Rendimentos da conta" } }));
    const recreated = calls.find((c) => c.group);
    const newId = `group-${calls.indexOf(recreated) + 1}`;
    await waitFor(() => expect(calls).toContainEqual({
      patchGroup: newId,
      body: { transaction_type: "income", payment_method: "pix", category_tag_id: "cat-yield", detail_tag_ids: [] },
    }));
    const group = await screen.findByTestId("statement-group");
    expect(within(group).getByLabelText("Descrição")).toHaveValue("Rendimentos da conta");
    expect(within(group).getByLabelText("Categoria")).toHaveValue("cat-yield");
    expect(within(group).getByLabelText("Forma de pagamento")).toHaveValue("pix");
    expect(screen.queryByTestId("undo-bar")).toBeNull();
  });

  it("Desfazer da barra depois de Somar devolve o Não registrar como Não registrar (G3-2-03)", async () => {
    const user = await openDraft({ setup: (d) => {
      d.entries.forEach((e) => { if (e.group_id) { e.answer = "create"; e.group_id = null; } });
      d.entries.find((e) => e.id === YIELD_A).answer = "ignore";
    } });

    await user.click(screen.getByRole("button", { name: "Marcar todas (2)" }));
    await user.click(screen.getByRole("button", { name: /Somar em um só lançamento/ }));
    await user.type(screen.getByLabelText("Descrição da transação (obrigatória)"), "Rendimentos");
    await user.click(screen.getByRole("button", { name: "Somar 2 lançamentos" }));
    await screen.findByTestId("statement-group");

    await user.click(within(screen.getByTestId("undo-bar")).getByRole("button", { name: "Desfazer" }));

    await waitFor(() => expect(screen.queryByTestId("statement-group")).toBeNull());
    expect(screen.getAllByTestId("ignored-entry").map((r) => r.textContent)).toEqual([expect.stringContaining("06/10/2026")]);
    expect(within(card("REND PAGO APLIC AUT MAIS")).getByRole("button", { name: /Não, adicionar agora/ })).toHaveAttribute("aria-pressed", "true");
    expect(entry(YIELD_A).answer).toBe("ignore");
  });

  it("somar pede a descrição, manda os marcados e a barra de desfazer desfaz a soma", async () => {
    const user = await openDraft({ setup: (d) => {
      d.entries.forEach((e) => { if (e.group_id) { e.answer = "create"; e.group_id = null; } });
    } });

    await user.click(screen.getByRole("button", { name: "Marcar todas (2)" }));
    expect(screen.getByRole("region", { name: "Lançamentos marcados" })).toHaveTextContent("2 marcados · soma +R$ 0,03");
    await user.click(screen.getByRole("button", { name: /Somar em um só lançamento/ }));
    const confirm = screen.getByRole("button", { name: "Somar 2 lançamentos" });
    expect(confirm).toBeDisabled();
    expect(screen.getByText(/vira um lançamento só em outubro/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Descrição da transação (obrigatória)"), "Rendimentos de outubro");
    await user.click(confirm);

    await waitFor(() => expect(calls).toContainEqual({ group: { entry_ids: [YIELD_A, YIELD_B], description: "Rendimentos de outubro" } }));
    expect(await screen.findByTestId("statement-group")).toHaveAccessibleName("Lançamento somado Rendimentos de outubro");
    const bar = screen.getByTestId("undo-bar");
    expect(bar).toHaveTextContent("2 lançamentos somados em “Rendimentos de outubro”");

    await user.click(within(bar).getByRole("button", { name: "Desfazer" }));

    await waitFor(() => expect(calls.some((c) => c.ungroup?.startsWith("group-"))).toBe(true));
    await waitFor(() => expect(screen.queryByTestId("statement-group")).toBeNull());
    expect(screen.queryByTestId("undo-bar")).toBeNull();
  });

  it("a soma tem categoria, etiquetas e forma de pagamento próprias", async () => {
    const user = await openDraft();
    const group = screen.getByTestId("statement-group");

    await user.selectOptions(within(group).getByLabelText("Categoria"), "Rendimentos");
    await user.selectOptions(within(group).getByLabelText("Forma de pagamento"), "Pix");

    await waitFor(() => {
      expect(calls).toContainEqual({ patchGroup: GROUP, body: { category_tag_id: "cat-yield" } });
      expect(calls).toContainEqual({ patchGroup: GROUP, body: { payment_method: "pix" } });
    });
    expect(within(screen.getByTestId("statement-group")).getByTestId("entry-outcome")).toHaveTextContent("em Rendimentos");
  });
});

describe("adicionar lançamentos novos", () => {
  it("entradas e saídas misturadas não somam: diz o motivo e não deixa somar", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });

    await user.click(markBox("02/10/2026"));
    await user.click(markBox("05/10/2026"));

    expect(screen.getByRole("note")).toHaveTextContent("Só dá para somar lançamentos do mesmo tipo: todos entradas ou todos saídas.");
    expect(screen.getByRole("button", { name: /Somar em um só lançamento/ })).toBeDisabled();
  });

  it("a categoria do histórico diz de onde veio; escolher outra vira escolha sua", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });
    const bakery = card("PIX QRS PADARIA 02 10");

    expect(within(bakery).getByText("Sugerida pelo seu histórico")).toBeInTheDocument();
    expect(within(card("REMUNERACAO SALARIO")).getByText("Sem categoria: vai para Não classificado")).toBeInTheDocument();

    await user.selectOptions(within(bakery).getByLabelText("Categoria"), "Casa");

    await waitFor(() => expect(within(card("PIX QRS PADARIA 02 10")).getByText("Escolhida por você")).toBeInTheDocument());
  });

  it("etiquetas são só da categoria; trocar a categoria tira as que não são dela", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });
    const tags = () => within(card("PIX QRS PADARIA 02 10")).getByRole("group", { name: "Etiquetas de Alimentação" });

    expect(within(tags()).getAllByRole("button").map((b) => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([
      ["Café da manhã", "true"],
      ["Lanche", "false"],
    ]);
    await user.click(within(tags()).getByRole("button", { name: "Lanche" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: BAKERY, body: { detail_tag_ids: [BREAKFAST, "det-snack"] } }));
    expect(within(card("PIX QRS PADARIA 02 10")).getByTestId("entry-outcome")).toHaveTextContent("com Café da manhã, Lanche");

    await user.selectOptions(within(card("PIX QRS PADARIA 02 10")).getByLabelText("Categoria"), "Casa");

    await waitFor(() => expect(calls).toContainEqual({ patch: BAKERY, body: { category_tag_id: "cat-home" } }));
    const home = await within(card("PIX QRS PADARIA 02 10")).findByRole("group", { name: "Etiquetas de Casa" });
    expect(within(home).getAllByRole("button").map((b) => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([["Manutenção", "false"]]);
    expect(within(card("REMUNERACAO SALARIO")).getByText("Escolha uma categoria para ver as etiquetas dela.")).toBeInTheDocument();
  });

  it("Não registrar tem selo e fundo próprios, fica minimizado e visível, com Alterar e Desfazer", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });

    const fee = screen.getByTestId("ignored-entry");
    expect(fee).toHaveTextContent("TARIFA PACOTE");
    expect(fee).toHaveTextContent("Não registrar");
    expect(fee.style.background).toContain("repeating-linear-gradient");

    await user.click(within(fee).getByRole("button", { name: "Alterar" }));
    const opened = card("TARIFA PACOTE");
    expect(within(opened).getByTestId("entry-not-recorded")).toHaveTextContent("Este lançamento não entra no Fincla");
    await user.click(within(opened).getByRole("button", { name: "Minimizar" }));
    expect(screen.getByTestId("ignored-entry")).toHaveTextContent("TARIFA PACOTE");

    await user.click(within(screen.getByTestId("ignored-entry")).getByRole("button", { name: "Desfazer" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: FEE, body: { answer: "create" } }));
    await waitFor(() => expect(screen.queryByTestId("ignored-entry")).toBeNull());
    // Voltou aberto, como "Não, adicionar agora" (e não "Não registrar").
    const back = within(card("TARIFA PACOTE"));
    expect(back.getByRole("button", { name: /Não, adicionar agora/ })).toHaveAttribute("aria-pressed", "true");
    expect(back.getByRole("button", { name: /Não registrar/ })).toHaveAttribute("aria-pressed", "false");
    expect(back.getByTestId("entry-outcome")).toHaveTextContent("Ao concluir");
  });

  it("a linha Não registrar só responde aos botões, não a um clique solto (G3-2-11)", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });
    const fee = screen.getByTestId("ignored-entry");

    await user.click(within(fee).getByText("fica fora do Fincla"));

    expect(screen.getByTestId("ignored-entry")).toBe(fee);
    expect(card("TARIFA PACOTE")).toBeUndefined();
    await user.click(markBox("20/10/2026"));
    expect(markBox("20/10/2026")).toBeChecked();
    expect(screen.getByTestId("ignored-entry")).toBe(fee);
  });

  it("Não registrar no cartão leva o foco ao Alterar da linha que fica no lugar (G3-2-10)", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });

    await user.click(within(card("PAG BOLETO ENERGIA")).getByRole("button", { name: "Não registrar" }));

    const row = await waitFor(() => {
      const found = screen.getAllByTestId("ignored-entry").find((r) => within(r).queryByText("PAG BOLETO ENERGIA"));
      expect(found).toBeTruthy();
      return found;
    });
    await waitFor(() => expect(within(row).getByRole("button", { name: "Alterar" })).toHaveFocus());
  });

  it("responder Não registrar no cartão minimiza o lançamento, sem sumir", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });

    await user.click(within(card("PAG BOLETO ENERGIA")).getByRole("button", { name: "Não registrar" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: ENERGY, body: { answer: "ignore" } }));
    await waitFor(() => expect(screen.getAllByTestId("ignored-entry").map((r) => r.textContent)).toEqual([
      expect.stringContaining("PAG BOLETO ENERGIA"),
      expect.stringContaining("TARIFA PACOTE"),
    ]));
  });

  it("aplica uma categoria aos marcados de uma vez, e Desfazer devolve o que cada um tinha", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });

    await user.click(markBox("02/10/2026"));
    await user.click(markBox("07/10/2026"));
    await user.selectOptions(screen.getByLabelText("Categoria", { selector: "#bulk-category" }), "Casa");
    await user.click(screen.getByRole("button", { name: "Aplicar aos 2 marcados" }));

    await waitFor(() => expect(calls).toContainEqual({ batch: [
      { id: BAKERY, category_tag_id: "cat-home" },
      { id: ENERGY, category_tag_id: "cat-home" },
    ] }));
    const bar = await screen.findByTestId("undo-bar");
    expect(bar).toHaveTextContent("Categoria Casa aplicada a 2 lançamentos");

    await user.click(within(bar).getByRole("button", { name: "Desfazer" }));

    await waitFor(() => expect(calls).toContainEqual({ batch: [
      { id: BAKERY, category_tag_id: FOOD, detail_tag_ids: [BREAKFAST] },
      { id: ENERGY, category_tag_id: null, detail_tag_ids: [] },
    ] }));
    await waitFor(() => expect(within(card("PIX QRS PADARIA 02 10")).getByLabelText("Categoria")).toHaveValue(FOOD));
    expect(within(card("PIX QRS PADARIA 02 10")).getByText("Sugerida pelo seu histórico")).toBeInTheDocument();
  });

  it("com só Não registrar marcados, a categoria em lote fica desligada e diz por quê (G3-2-07)", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });

    await user.click(markBox("20/10/2026"));

    expect(screen.getByLabelText("Categoria", { selector: "#bulk-category" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Aplicar aos 0 a adicionar" })).toBeDisabled();
    expect(screen.getByTestId("bulk-category-note")).toHaveTextContent("Os marcados estão como “Não registrar”: a categoria só vale para lançamentos que vão ser adicionados.");
    expect(calls.some((c) => c.batch)).toBe(false);
  });

  it("marcados mistos: a categoria vai só para os que vão ser adicionados", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });

    await user.click(markBox("07/10/2026"));
    await user.click(markBox("20/10/2026"));
    await user.selectOptions(screen.getByLabelText("Categoria", { selector: "#bulk-category" }), "Casa");
    await user.click(screen.getByRole("button", { name: "Aplicar ao 1 a adicionar" }));

    await waitFor(() => expect(calls).toContainEqual({ batch: [{ id: ENERGY, category_tag_id: "cat-home" }] }));
  });

  it("com um marcado só, o botão de categoria fala no singular (BUG-02)", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });

    await user.click(markBox("07/10/2026"));
    await user.selectOptions(screen.getByLabelText("Categoria", { selector: "#bulk-category" }), "Casa");
    await user.click(screen.getByRole("button", { name: "Aplicar ao 1 marcado" }));

    await waitFor(() => expect(calls).toContainEqual({ batch: [{ id: ENERGY, category_tag_id: "cat-home" }] }));
    expect(await screen.findByTestId("undo-bar")).toHaveTextContent("Categoria Casa aplicada a 1 lançamento");
  });

  it("só oferece em lote as categorias que aceitam todos os marcados", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });

    await user.click(markBox("02/10/2026"));
    const expenseOnly = within(screen.getByLabelText("Categoria", { selector: "#bulk-category" })).getAllByRole("option").map((o) => o.textContent);
    expect(expenseOnly).toEqual(["Escolha…", "Alimentação", "Casa"]);
  });

  it("Marcar as N sem categoria marca exatamente os que vão para Não classificado", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });

    expect(screen.getByText("2 lançamentos vão para Não classificado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Marcar as 2 sem categoria" }));

    expect(markBox("05/10/2026")).toBeChecked();
    expect(markBox("07/10/2026")).toBeChecked();
    expect(markBox("02/10/2026")).not.toBeChecked();
    expect(markBox("20/10/2026")).not.toBeChecked();
  });

  it("com um lançamento só sem categoria, o atalho fala no singular e marca só ele (BUG-02)", async () => {
    const user = await openDraft({
      step: "Adicionar lançamentos novos",
      setup: (d) => { d.entries.find((e) => e.id === SALARY).category_tag_id = "cat-yield"; },
    });

    expect(screen.getByText("1 lançamento vai para Não classificado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar as \d+ sem categoria/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Marcar a que está sem categoria" }));

    expect(markBox("07/10/2026")).toBeChecked();
    expect(markBox("05/10/2026")).not.toBeChecked();
    expect(markBox("02/10/2026")).not.toBeChecked();
  });

  it("não registrar as marcadas, com desfazer", async () => {
    const user = await openDraft({ step: "Adicionar lançamentos novos" });

    await user.click(markBox("05/10/2026"));
    await user.click(markBox("07/10/2026"));
    await user.click(screen.getByRole("button", { name: "Não registrar as marcadas" }));

    await waitFor(() => expect(calls).toContainEqual({ batch: [{ id: SALARY, answer: "ignore" }, { id: ENERGY, answer: "ignore" }] }));
    await waitFor(() => expect(screen.getAllByTestId("ignored-entry")).toHaveLength(3));
    const bar = screen.getByTestId("undo-bar");
    expect(bar).toHaveTextContent("2 lançamentos marcados como não registrar");

    await user.click(within(bar).getByRole("button", { name: "Desfazer" }));

    // Volta a resposta E o "confirmado" que cada um tinha (G3-2-08).
    await waitFor(() => expect(calls).toContainEqual({ batch: [
      { id: SALARY, answer: "create", confirmed: entryBefore(SALARY).confirmed },
      { id: ENERGY, answer: "create", confirmed: entryBefore(ENERGY).confirmed },
    ] }));
    expect([entry(SALARY).confirmed, entry(ENERGY).confirmed]).toEqual([entryBefore(SALARY).confirmed, entryBefore(ENERGY).confirmed]);
    await waitFor(() => expect(screen.getAllByTestId("ignored-entry")).toHaveLength(1));
  });
});

describe("sugestão respondida Não, adicionar agora (fincla-api#510)", () => {
  it("a transação nova embutida no cartão tem categoria pelo histórico e etiquetas da categoria", async () => {
    const user = await openDraft({ setup: (d) => {
      const suggested = clone(contract.suggested_draft);
      d.entries = suggested.entries;
      d.groups = [];
      // O histórico sugeriu Alimentação para o primeiro lançamento sugerido.
      const first = d.entries.find((e) => e.classification === "suggested" && !e.confirmed);
      first.category_tag_id = FOOD;
      first.suggested_category_tag_id = FOOD;
    } });
    const first = draft.entries.find((e) => e.classification === "suggested" && !e.confirmed);
    const pairCard = () => screen.getAllByRole("article").find((a) => within(a).queryByText(first.bank_description) && within(a).queryByRole("button", { name: "Não, adicionar agora" }));

    await user.click(within(pairCard()).getByRole("button", { name: "Não, adicionar agora" }));

    const side = await screen.findByTestId("statement-entry-new-side");
    expect(within(side).getByText("Sugerida pelo seu histórico")).toBeInTheDocument();
    const tags = within(side).getByRole("group", { name: "Etiquetas de Alimentação" });
    await user.click(within(tags).getByRole("button", { name: "Lanche" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: first.id, body: { detail_tag_ids: ["det-snack"] } }));
  });
});

describe("revisar e concluir", () => {
  it("o resumo avisa quantas transações vão para Não classificado e conta as somas", async () => {
    const user = await openDraft({ step: "Revisar e concluir" });

    expect(screen.getByTestId("unclassified-warning")).toHaveTextContent("3 transações vão para Não classificado.");
    expect(screen.getByTestId("summary-grouped")).toHaveTextContent("2");
    expect(screen.getByText(/em 1 transação/)).toBeInTheDocument();
    expect(screen.getByTestId("summary-ignored")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "Classificar agora" }));
    expect(screen.getByRole("heading", { name: "Adicionar lançamentos novos" })).toBeInTheDocument();
  });

  it("sem nada para Não classificado, não avisa", async () => {
    await openDraft({ step: "Revisar e concluir", setup: (d) => {
      d.entries.forEach((e) => { if (e.answer === "create") e.category_tag_id = FOOD; });
      d.groups.forEach((g) => { g.category_tag_id = "cat-yield"; });
    } });

    expect(screen.queryByTestId("unclassified-warning")).toBeNull();
  });
});

// Evita aviso de variável não usada quando a fixture muda de ordem: a ordem é presa aqui.
it("a fixture tem os lançamentos na ordem que estes testes usam", () => {
  expect(Object.keys(E)).toEqual(["PIX0", "REMUNERACAO1", "PAG2", "REND3", "REND4", "TARIFA5"]);
});
