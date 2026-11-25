/** @vitest-environment jsdom */
// Conciliar fatura, terceira entrega (fincla-api#557): compras novas, à vista e parceladas, no nível
// da página, com a fixture de contrato (`new_purchases_draft`, `entry_new`, cópia byte a byte da do
// backend). Confere o que a pessoa vê e o que a tela manda: o formulário do item novo (o mesmo do
// extrato) com a forma de pagamento travada no cartão; o Confirmar desligado sem descrição, com o
// motivo ligado por aria-describedby; as duas opções da compra parcelada (decisão 5) com as notas e
// as parcelas por fatura; a fatura paga (decisão 1); "Não, adicionar agora" do passo 1; o resumo e o
// Concluir; e os alvos de toque no celular.
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
const CARD = contract.new_purchases_draft.credit_card;
const BASE = `*/v1/credit-cards/${CARD.id}/invoice-imports`;
const clone = (value) => JSON.parse(JSON.stringify(value));

const FOOD = contract.entry_new.category_tag_id;
const SNACK = contract.entry_new.detail_tag_ids[0];
const CATEGORIES = [
  { id: FOOD, name: "alimentacao", label: "Alimentação", allowed_transaction_types: ["expense"], is_fallback: false },
  { id: "cat-casa", name: "casa", label: "Casa", allowed_transaction_types: ["expense"], is_fallback: false },
  { id: "cat-fallback", name: "nao-classificado", label: "Não classificado", allowed_transaction_types: ["expense", "income", "refund"], is_fallback: true },
];
const DETAILS = [
  { id: SNACK, name: "lanche", label: "Lanche", parent_category_tag_id: FOOD },
  { id: "det-moveis", name: "moveis", label: "Móveis", parent_category_tag_id: "cat-casa" },
];

const calls = [];
let draft = clone(contract.new_purchases_draft);

/** O que o backend faz: responder confirma, a menos que venha `confirmed`; trocar a categoria tira as etiquetas de outra. */
function applyBody(entry, body) {
  if (body.answer !== undefined) {
    entry.answer = body.answer;
    entry.paired_transaction_id = body.answer === "pair" ? entry.suggested_transaction_id : null;
  }
  if (body.description !== undefined) entry.description = body.description;
  if (body.category_tag_id !== undefined) {
    entry.category_tag_id = body.category_tag_id;
    entry.detail_tag_ids = entry.detail_tag_ids.filter((id) => DETAILS.find((d) => d.id === id)?.parent_category_tag_id === body.category_tag_id);
  }
  if (body.detail_tag_ids !== undefined) entry.detail_tag_ids = body.detail_tag_ids;
  if (body.installments_scope !== undefined) entry.installments_scope = body.installments_scope;
  if (body.confirmed !== undefined) entry.confirmed = body.confirmed;
  else if (body.answer !== undefined) entry.confirmed = true;
}

const server = setupServer(
  http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: CARD.id, public_id: CARD.public_id, description: CARD.name, brand: "Visa", last4: CARD.last4 }])),
  http.get("*/v1/tags", ({ request }) =>
    HttpResponse.json({ tags: new URL(request.url).searchParams.get("tag_type") === "detalhe" ? DETAILS : CATEGORIES })),
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
    applyBody(entry, body);
    return HttpResponse.json(entry);
  }),
  http.patch(`${BASE}/:importId/entries`, async ({ request }) => {
    const body = await request.json();
    calls.push({ batch: body.entries });
    for (const item of body.entries) applyBody(draft.entries.find((e) => e.id === item.id), item);
    return HttpResponse.json(draft);
  }),
  http.post(`${BASE}/:importId/suggestions/confirm`, async ({ request }) => {
    const body = await request.json();
    calls.push({ confirm: body });
    draft.entries.filter((e) => body.entry_ids.includes(e.id)).forEach((e) => { e.confirmed = body.confirmed; });
    return HttpResponse.json(draft);
  }),
  http.post(`${BASE}/:importId/conclude`, () => {
    calls.push({ conclude: true });
    return HttpResponse.json(contract.concluded);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  draft = clone(contract.new_purchases_draft);
  server.resetHandlers();
  navigate.mockReset();
});

const byText = (text) => draft.entries.find((e) => e.bank_description === text);
const MERCADO = () => byText("MERCADO BOA VISTA");
const PADARIA = () => byText("PADARIA PAO QUENTE");
const LOJA = () => byText("LOJA DO BAIRRO 03/06");

const open = async (props = {}) => {
  params = { cardId: CARD.public_id, importId: draft.id };
  render(<CardInvoiceReconciliationPage organizationId={ORG} {...props} />);
  return screen.findByRole("heading", { name: "Compras novas" });
};
const purchase = (text) => screen.getByRole("article", { name: new RegExp(`Compra de .*: ${text.replace(/[*/]/g, ".")}`) });
const alter = (text) => screen.getByRole("button", { name: new RegExp(`Alterar o lançamento de .*: ${text.replace(/[*/]/g, ".")}`) });

describe("o passo Compras novas", () => {
  it("abre no passo 5 com a primeira compra aberta: o formulário do item novo, com a forma de pagamento travada no cartão", async () => {
    await open();

    const mercado = purchase("MERCADO BOA VISTA");
    // O texto do banco continua à vista, do lado do banco.
    expect(within(mercado).getByTestId("bank-side")).toHaveTextContent("MERCADO BOA VISTA");
    expect(within(mercado).getByTestId("bank-side")).toHaveTextContent("R$ 310,10");
    expect(within(mercado).getByRole("textbox", { name: "Descrição" })).toHaveValue("MERCADO BOA VISTA");
    expect(within(mercado).getByTestId("locked-payment")).toHaveTextContent("Cartão de crédito · Itaú Visa");
    expect(within(mercado).getByTestId("locked-type")).toHaveTextContent("Despesa");
    expect(within(mercado).queryByRole("combobox", { name: "Forma de pagamento" })).not.toBeInTheDocument();
    // Sem histórico: o texto da spec (fincla-api#554) na fatura.
    expect(mercado).toHaveTextContent("Sem histórico parecido: escolha a categoria");
    expect(mercado).not.toHaveTextContent("Sem categoria: vai para Não classificado");
    // Data e Valor travados: "Vem da fatura" (o artigo concorda com o nome, QA F3 BUG-02).
    expect(within(mercado).getByTestId("locked-date")).toHaveAttribute("title", "Vem da fatura e não pode ser alterada");
    expect(within(mercado).getByTestId("locked-amount")).toHaveAttribute("title", "Vem da fatura e não pode ser alterado");
    const answers = within(mercado).getByRole("group", { name: "O que fazer com esta compra?" });
    expect(within(answers).getByRole("button", { name: "Adicionar" })).toHaveAttribute("aria-pressed", "true");
    expect(within(answers).getByRole("button", { name: "Não registrar" })).toHaveAttribute("aria-pressed", "false");
    expect(within(mercado).getByRole("button", { name: "Confirmar" })).toBeEnabled();
    expect(within(mercado).getByTestId("pair-outcome")).toHaveTextContent(
      "Ao concluir: entra a compra “MERCADO BOA VISTA” em Não classificado, no cartão, na fatura de janeiro/2027, na data do banco.",
    );
    // Sem lote nem soma na fatura; o aviso de quantas vão para Não classificado fica.
    expect(screen.queryByRole("button", { name: /Marcar todas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByTestId("unclassified-note")).toHaveTextContent("5 compras sem categoria vão para Não classificado ao concluir.");
    expect(screen.getByTestId("go-to-pending")).toHaveTextContent(/Falta responder 5/);
  });

  it("Confirmar grava a confirmação e recolhe no clique: a linha fica parada com Conferido e nada aparece abaixo", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(within(purchase("MERCADO BOA VISTA")).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: MERCADO().id, body: { confirmed: true } }));
    const row = (await screen.findAllByTestId("entry-row")).find((r) => r.textContent.includes("MERCADO BOA VISTA"));
    expect(row).toHaveTextContent("Adicionar ao Fincla: MERCADO BOA VISTA");
    expect(row).toHaveTextContent("Conferido");
    // O próximo pendente abre: a padaria, sem descrição.
    expect(await screen.findByRole("article", { name: /Compra de .*: PADARIA PAO QUENTE/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("go-to-pending")).toHaveTextContent(/Falta responder 4/));
  });

  it("sem descrição, o Confirmar fica desligado com o motivo ligado por aria-describedby; escrever liga e grava a descrição antes", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(alter("PADARIA PAO QUENTE"));

    const padaria = purchase("PADARIA PAO QUENTE");
    const confirm = within(padaria).getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    const note = document.getElementById(confirm.getAttribute("aria-describedby"));
    expect(note).toHaveTextContent("Escreva a descrição para confirmar.");
    expect(within(padaria).getByRole("textbox", { name: "Descrição" })).toHaveAttribute("aria-invalid", "true");

    await user.type(within(padaria).getByRole("textbox", { name: "Descrição" }), "Padaria");
    await user.click(within(purchase("PADARIA PAO QUENTE")).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: PADARIA().id, body: { confirmed: true } }));
    const patches = calls.filter((c) => c.patch === PADARIA().id).map((c) => c.body);
    expect(patches).toEqual([{ description: "Padaria" }, { confirmed: true }]);
  });

  it("a categoria pelo histórico e as etiquetas só dela; trocar a categoria tira as que não são dela", async () => {
    const padaria = PADARIA();
    Object.assign(padaria, { description: "Padaria", category_tag_id: FOOD, suggested_category_tag_id: FOOD, detail_tag_ids: [SNACK] });
    const user = userEvent.setup();
    await open();
    await user.click(alter("PADARIA PAO QUENTE"));

    let card = purchase("PADARIA PAO QUENTE");
    expect(card).toHaveTextContent("Categoria pelo histórico: compras parecidas foram para Alimentação");
    expect(card).not.toHaveTextContent("Sugerida pelo seu histórico");
    const tags = within(card).getByRole("group", { name: "Etiquetas de Alimentação" });
    expect(within(tags).getByRole("button", { name: "Lanche" })).toHaveAttribute("aria-pressed", "true");
    expect(within(tags).queryByRole("button", { name: "Móveis" })).not.toBeInTheDocument();

    await user.selectOptions(within(card).getByRole("combobox", { name: "Categoria" }), "Casa");
    await waitFor(() => expect(calls).toContainEqual({ patch: padaria.id, body: { category_tag_id: "cat-casa" } }));
    card = purchase("PADARIA PAO QUENTE");
    const casa = await within(card).findByRole("group", { name: "Etiquetas de Casa" });
    expect(within(casa).getByRole("button", { name: "Móveis" })).toHaveAttribute("aria-pressed", "false");
    expect(within(card).getByTestId("pair-outcome")).toHaveTextContent("em Casa");
  });

  it("Não registrar confirma e recolhe no clique, listrado; Desfazer escolha volta a Adicionar a confirmar", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(within(purchase("MERCADO BOA VISTA")).getByRole("button", { name: "Não registrar" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: MERCADO().id, body: { answer: "ignore" } }));
    const row = await screen.findByTestId("ignored-entry");
    expect(row).toHaveTextContent("MERCADO BOA VISTA");
    expect(row).toHaveTextContent("fica fora do Fincla");
    expect(row).toHaveTextContent("Conferido");
    expect(row.style.background).toContain("repeating-linear-gradient");

    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: MERCADO().id, body: { answer: "create", confirmed: false } }));
    // Volta aberto, a confirmar: o "Adicionar" só se confirma pelo Confirmar.
    expect(await within(purchase("MERCADO BOA VISTA")).findByRole("button", { name: "Confirmar" })).toBeEnabled();
  });

  it("N pelo atalho, depois Desfazer escolha: volta a Adicionar a confirmar, com o cartão aberto", async () => {
    const user = userEvent.setup();
    await open();
    purchase("MERCADO BOA VISTA");

    await user.keyboard("n");
    const row = (await screen.findAllByTestId("ignored-entry")).find((r) => r.textContent.includes("MERCADO BOA VISTA"));
    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));

    await waitFor(() => expect(calls.filter((c) => c.patch === MERCADO().id).at(-1).body).toEqual({ answer: "create", confirmed: false }));
    const card = await screen.findByRole("article", { name: /Compra de .*: MERCADO BOA VISTA/ });
    expect(within(card).getByRole("button", { name: "Adicionar" })).toHaveAttribute("aria-pressed", "true");
    expect(within(card).getByRole("button", { name: "Confirmar" })).toBeEnabled();
    expect(MERCADO().confirmed).toBe(false);
  });

  it("rascunho retomado com Não registrar já confirmado: Desfazer escolha não confirma o Adicionar sozinho", async () => {
    Object.assign(MERCADO(), { answer: "ignore", confirmed: true });
    const user = userEvent.setup();
    await open();

    const row = (await screen.findAllByTestId("ignored-entry")).find((r) => r.textContent.includes("MERCADO BOA VISTA"));
    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: MERCADO().id, body: { answer: "create", confirmed: false } }));
    expect(await within(purchase("MERCADO BOA VISTA")).findByRole("button", { name: "Confirmar" })).toBeEnabled();
  });

  it("A pelo atalho confirma e recolhe; Desfazer escolha devolve o cartão aberto, a confirmar", async () => {
    const user = userEvent.setup();
    await open();
    purchase("MERCADO BOA VISTA");

    await user.keyboard("a");
    await waitFor(() => expect(calls).toContainEqual({ patch: MERCADO().id, body: { confirmed: true } }));
    const row = (await screen.findAllByTestId("entry-row")).find((r) => r.textContent.includes("MERCADO BOA VISTA"));
    expect(row).toHaveTextContent("Conferido");
    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));

    await waitFor(() => expect(calls.filter((c) => c.patch === MERCADO().id).at(-1).body).toEqual({ confirmed: false }));
    expect(await within(purchase("MERCADO BOA VISTA")).findByRole("button", { name: "Confirmar" })).toBeEnabled();
  });

  it("o Valor travado vai como a fatura mostra: cobrança sem sinal; estorno sem o sinal invertido", async () => {
    Object.assign(PADARIA(), { amount: { amount: "21.00", currency: "BRL" }, transaction_type: "refund", description: "Estorno padaria" });
    const user = userEvent.setup();
    await open();

    const plain = (el) => el.textContent.replace(/\u00a0/g, " ");
    expect(plain(within(purchase("MERCADO BOA VISTA")).getByTestId("locked-amount"))).toBe("R$ 310,10");
    await user.click(alter("PADARIA PAO QUENTE"));
    const padaria = purchase("PADARIA PAO QUENTE");
    expect(plain(within(padaria).getByTestId("locked-amount"))).toBe("R$ 21,00");
    expect(within(padaria).getByTestId("locked-type")).toHaveTextContent("Estorno");
  });

  it("Não registrar mantém o formulário à vista, sem edição, com a nota Fica de fora", async () => {
    MERCADO().answer = "ignore";
    MERCADO().confirmed = false;
    await open();

    // A confirmar, ela é a primeira pendente: abre sozinha.
    const mercado = purchase("MERCADO BOA VISTA");
    expect(within(mercado).getByTestId("new-side-skipped")).toBeInTheDocument();
    expect(within(mercado).getByRole("textbox", { name: "Descrição" })).toBeDisabled();
    expect(within(mercado).getByTestId("skip-note")).toHaveTextContent("Esta compra não entra no Fincla: nada é adicionado.");
    expect(within(mercado).queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  });

  it("atalhos: N não registra a compra aberta", async () => {
    const user = userEvent.setup();
    await open();
    purchase("MERCADO BOA VISTA");

    await user.keyboard("n");
    await waitFor(() => expect(calls).toContainEqual({ patch: MERCADO().id, body: { answer: "ignore" } }));
  });

  it("Próximo confirma as escolhas que faltam confirmar (Adicionar e Não registrar), sem mudar nada no Fincla", async () => {
    PADARIA().description = "Padaria";
    const user = userEvent.setup();
    await open();

    const next = screen.getByRole("button", { name: /Próximo: Sobrando no Fincla/ });
    expect(screen.getByText("Ao avançar, as 5 escolhas que faltam confirmar ficam confirmadas. Nada muda no Fincla até você concluir.")).toBeInTheDocument();
    await user.click(next);

    await waitFor(() => expect(calls.find((c) => c.batch)?.batch).toHaveLength(5));
    expect(calls.find((c) => c.batch).batch.every((b) => b.confirmed === true && Object.keys(b).length === 2)).toBe(true);
    expect(await screen.findByRole("heading", { name: "Sobrando no Fincla" })).toBeInTheDocument();
  });

  it("compra nova sem descrição segura o Próximo (falta responder)", async () => {
    await open();
    expect(screen.getByRole("button", { name: /Próximo: Sobrando no Fincla/ })).toBeDisabled();
  });
});

describe("compra parcelada nova (decisão 5)", () => {
  it("Compra inteira vem marcada, com a nota das faturas anteriores e as parcelas por fatura (valor estimado marcado)", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(alter("LOJA DO BAIRRO 03/06"));

    const loja = purchase("LOJA DO BAIRRO 03/06");
    expect(within(loja).getByRole("textbox", { name: "Descrição" })).toHaveValue("LOJA DO BAIRRO");
    const scope = within(loja).getByRole("radiogroup", { name: "Compra parcelada · 03/06" });
    const full = within(scope).getByRole("radio", { name: /Compra inteira \(parcelas 01 a 06\)/ });
    const fromCurrent = within(scope).getByRole("radio", { name: /Só daqui em diante \(parcelas 03 a 06\)/ });
    expect(full).toBeChecked();
    expect(fromCurrent).not.toBeChecked();
    expect(within(loja).getByTestId("scope-note-full")).toHaveTextContent(
      "Cria a compra em 6 parcelas: 01 e 02 nas faturas de novembro/2026 e dezembro/2026, com o valor da 03; 03/06 nesta fatura; as próximas até a 06/06 com os valores que o banco já informou.",
    );
    expect(within(loja).getByTestId("scope-note-from_current")).toHaveTextContent("As parcelas 01 e 02 ficam de fora.");
    const installments = within(loja).getAllByTestId("new-purchase-installment");
    // O dinheiro sai com o espaço do Intl (U+00A0).
    expect(installments.map((i) => i.textContent.replace(/\u00a0/g, " "))).toEqual([
      "01/06novembro/2026R$ 99,90valor estimado",
      "02/06dezembro/2026R$ 99,90valor estimadofatura já paga: entra paga",
      "03/06nesta faturaR$ 99,90",
      "04/06fevereiro/2027R$ 99,90",
      "05/06março/2027R$ 99,90",
      "06/06abril/2027R$ 99,90",
    ]);
    expect(loja).toHaveTextContent("Total da compra: R$ 599,40, nas duas opções.");
    expect(loja).toHaveTextContent("As etiquetas valem para todas as parcelas.");
    expect(within(loja).getByTestId("pair-outcome")).toHaveTextContent("em 6 parcelas (01 a 06), cada uma na sua fatura.");
  });

  it("Só daqui em diante: grava a opção sem recolher; a lista e o que acontece mudam para 03 a 06", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(alter("LOJA DO BAIRRO 03/06"));

    await user.click(within(purchase("LOJA DO BAIRRO 03/06")).getByRole("radio", { name: /Só daqui em diante/ }));

    await waitFor(() => expect(calls).toContainEqual({ patch: LOJA().id, body: { installments_scope: "from_current" } }));
    const loja = purchase("LOJA DO BAIRRO 03/06");
    await waitFor(() => expect(within(loja).getByRole("radio", { name: /Só daqui em diante/ })).toBeChecked());
    expect(within(loja).getAllByTestId("new-purchase-installment")).toHaveLength(4);
    expect(within(loja).getByTestId("pair-outcome")).toHaveTextContent("em 4 parcelas (03 a 06)");
    // Escolher a opção não confirma: o Confirmar continua ali.
    expect(within(loja).getByRole("button", { name: "Confirmar" })).toBeEnabled();
  });

  it("parcela anterior em fatura já paga: a nota diz que entra já paga, e a lista marca a fatura", async () => {
    // Na fixture gravada pelo backend, dezembro/2026 já está paga (parcela 02 da LOJA).
    const user = userEvent.setup();
    await open();
    await user.click(alter("LOJA DO BAIRRO 03/06"));

    const loja = purchase("LOJA DO BAIRRO 03/06");
    expect(within(loja).getByTestId("scope-note-full")).toHaveTextContent("A fatura de dezembro/2026 já foi paga: a parcela 02 entra nela já paga.");
    expect(within(loja).getAllByTestId("new-purchase-installment")[1]).toHaveTextContent("fatura já paga: entra paga");
    expect(within(loja).getAllByTestId("new-purchase-installment")[0]).not.toHaveTextContent("fatura já paga");
  });

  it("muitas parcelas anteriores: a nota resume as faturas de uma a outra", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(alter("CURSO IDIOMAS 13/24"));

    const curso = purchase("CURSO IDIOMAS 13/24");
    expect(within(curso).getByTestId("scope-note-full")).toHaveTextContent(
      "Cria a compra em 24 parcelas: 01 a 12 nas faturas de janeiro/2026 a dezembro/2026, com o valor da 13; 13/24 nesta fatura; as próximas até a 24/24 com os valores que o banco já informou (as que ele não listou levam o valor da 13: valor estimado).",
    );
    expect(within(curso).getByTestId("scope-note-from_current")).toHaveTextContent("As parcelas 01 a 12 ficam de fora.");
  });

  it("as opções ficam desligadas enquanto a escolha está sendo gravada", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    server.use(http.patch(`${BASE}/:importId/entries/:entryId`, async ({ request, params: p }) => {
      const body = await request.json();
      calls.push({ patch: p.entryId, body });
      await gate;
      const entry = draft.entries.find((e) => e.id === p.entryId);
      applyBody(entry, body);
      return HttpResponse.json(entry);
    }));
    const user = userEvent.setup();
    await open();
    await user.click(alter("LOJA DO BAIRRO 03/06"));

    await user.click(within(purchase("LOJA DO BAIRRO 03/06")).getByRole("radio", { name: /Só daqui em diante/ }));

    await waitFor(() => expect(within(purchase("LOJA DO BAIRRO 03/06")).getByRole("radio", { name: /Compra inteira/ })).toBeDisabled());
    expect(within(purchase("LOJA DO BAIRRO 03/06")).getByRole("radio", { name: /Só daqui em diante/ })).toBeDisabled();
    release();
    await waitFor(() => expect(within(purchase("LOJA DO BAIRRO 03/06")).getByRole("radio", { name: /Compra inteira/ })).toBeEnabled());
  });

  it("parcela 01/MM: sem o que escolher, a lista das parcelas e o total ficam à vista", async () => {
    LOJA().installment = { number: 1, count: 6 };
    const user = userEvent.setup();
    await open();
    await user.click(alter("LOJA DO BAIRRO 03/06"));

    const loja = purchase("LOJA DO BAIRRO 03/06");
    expect(within(loja).queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(within(loja).getByTestId("installments-scope")).toHaveTextContent("Compra parcelada · 01/06");
    expect(within(loja).getAllByTestId("new-purchase-installment")).toHaveLength(6);
    expect(within(loja).getByTestId("new-purchase-total").textContent.replace(/\u00a0/g, " ")).toBe(
      "As etiquetas valem para todas as parcelas. Total da compra: R$ 599,40.",
    );
  });

  it("sem o total da compra: diz que não sabemos, em vez de esconder", async () => {
    LOJA().new_purchase.total_amount = null;
    const user = userEvent.setup();
    await open();
    await user.click(alter("LOJA DO BAIRRO 03/06"));

    expect(within(purchase("LOJA DO BAIRRO 03/06")).getByTestId("new-purchase-total")).toHaveTextContent("Total da compra: não sabemos, nas duas opções.");
  });

  it("a linha recolhida diz quantas parcelas entram", async () => {
    LOJA().confirmed = true;
    await open();

    const row = screen.getAllByTestId("entry-row").find((r) => r.textContent.includes("LOJA DO BAIRRO 03/06"));
    expect(row).toHaveTextContent("6 parcelas, 01 a 06");
  });
});

describe("fatura já paga (decisão 1)", () => {
  const paid = () => {
    for (const e of draft.entries) Object.assign(e, { answer: "ignore", confirmed: false, value_locked: true });
  };

  it("Adicionar desligado com o motivo; Não registrar marcado confirma no clique", async () => {
    paid();
    const user = userEvent.setup();
    await open();

    const mercado = purchase("MERCADO BOA VISTA");
    expect(within(mercado).getByRole("button", { name: "Adicionar" })).toBeDisabled();
    expect(within(mercado).getByTestId("answer-note")).toHaveTextContent("Esta fatura já foi paga. Para corrigir, desmarque o pagamento e volte aqui.");
    expect(within(mercado).queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();

    await user.click(within(mercado).getByRole("button", { name: "Não registrar" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: MERCADO().id, body: { confirmed: true } }));
    const row = (await screen.findAllByTestId("ignored-entry")).find((r) => r.textContent.includes("MERCADO BOA VISTA"));
    expect(row).toHaveTextContent("Conferido");
    // Sem resposta anterior a voltar e sem Adicionar: Desfazer escolha só tira a confirmação.
    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));
    await waitFor(() => expect(calls.filter((c) => c.patch === MERCADO().id).at(-1).body).toEqual({ confirmed: false }));
  });

  it("as linhas a confirmar não dizem Conferido", async () => {
    paid();
    await open();
    const rows = screen.getAllByTestId("ignored-entry");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).not.toHaveTextContent("Conferido");
  });
});

describe("Não, adicionar agora (passo 1)", () => {
  const openStep1 = async () => {
    draft = clone(contract.draft);
    params = { cardId: CARD.public_id, importId: draft.id };
    render(<CardInvoiceReconciliationPage organizationId={ORG} />);
    await screen.findByRole("heading", { name: "Confirmar compras encontradas" });
  };
  const pairCard = (text) => screen.getByRole("article", { name: new RegExp(`Lançamento de .*: ${text}`) });

  it("abre o formulário da compra nova no lugar da sugestão, sem confirmar; o Confirmar grava e recolhe", async () => {
    const user = userEvent.setup();
    await openStep1();
    const mercadoId = draft.entries.find((e) => e.bank_description === "MERCADO BOA VISTA").id;

    await user.click(within(pairCard("MERCADO BOA VISTA")).getByRole("button", { name: "Não, adicionar agora" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: mercadoId, body: { answer: "create", confirmed: false } }));
    const card = pairCard("MERCADO BOA VISTA");
    expect(within(card).getByRole("button", { name: "Não, adicionar agora" })).toHaveAttribute("aria-pressed", "true");
    expect(within(card).getByRole("textbox", { name: "Descrição" })).toHaveValue("MERCADO BOA VISTA");
    expect(within(card).getByTestId("locked-payment")).toHaveTextContent("Cartão de crédito · Itaú Visa");
    expect(within(card).getByTestId("bank-side")).toHaveTextContent("Entra no Fincla");
    expect(within(card).queryByRole("button", { name: "Confirmar sugestão" })).not.toBeInTheDocument();

    await user.clear(within(card).getByRole("textbox", { name: "Descrição" }));
    const confirm = within(pairCard("MERCADO BOA VISTA")).getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeDisabled();
    expect(document.getElementById(confirm.getAttribute("aria-describedby"))).toHaveTextContent("Escreva a descrição para confirmar.");

    await user.type(within(pairCard("MERCADO BOA VISTA")).getByRole("textbox", { name: "Descrição" }), "Mercado do mês");
    await user.click(within(pairCard("MERCADO BOA VISTA")).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: mercadoId, body: { confirmed: true } }));
    expect(calls).toContainEqual({ patch: mercadoId, body: { description: "Mercado do mês" } });
    const row = (await screen.findAllByTestId("pair-row")).find((r) => r.textContent.includes("MERCADO BOA VISTA"));
    expect(row).toHaveTextContent("Adicionar ao Fincla: Mercado do mês");
    expect(row).toHaveTextContent("Conferido");
  });

  it("clicar de novo em Não, adicionar agora já marcado confirma, como no passo 5 (e o A também)", async () => {
    draft = clone(contract.draft);
    const [first, second] = draft.entries.filter((e) => e.answerable && e.fincla_transaction);
    Object.assign(first, { answer: "create", confirmed: false, description: "Mercado do mês" });
    Object.assign(second, { answer: "create", confirmed: false, description: "Outra compra" });
    params = { cardId: CARD.public_id, importId: draft.id };
    const user = userEvent.setup();
    render(<CardInvoiceReconciliationPage organizationId={ORG} />);
    await screen.findByRole("heading", { name: "Confirmar compras encontradas" });

    await user.click(within(pairCard(first.bank_description.replace(/[*/]/g, "."))).getByRole("button", { name: "Não, adicionar agora" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: first.id, body: { confirmed: true } }));
    expect(calls.filter((c) => c.patch === first.id)).toHaveLength(1);

    await screen.findByRole("article", { name: new RegExp(`Lançamento de .*: ${second.bank_description.replace(/[*/]/g, ".")}`) });
    await user.keyboard("a");
    await waitFor(() => expect(calls).toContainEqual({ patch: second.id, body: { confirmed: true } }));
  });

  it("parcela sugerida: Não, adicionar agora mostra as duas opções da compra parcelada", async () => {
    const user = userEvent.setup();
    await openStep1();
    await user.click(screen.getByRole("button", { name: /Alterar o lançamento de .*: ELETRO CASA 03\/10/ }));

    await user.click(within(pairCard("ELETRO CASA 03.10")).getByRole("button", { name: "Não, adicionar agora" }));

    const card = pairCard("ELETRO CASA 03.10");
    expect(await within(card).findByRole("radio", { name: /Compra inteira \(parcelas 01 a 10\)/ })).toBeChecked();
    expect(within(card).getByRole("radio", { name: /Só daqui em diante \(parcelas 03 a 10\)/ })).not.toBeChecked();
  });

  it("fatura já paga: Não, adicionar agora desligado, e o atalho A também não adiciona", async () => {
    const user = userEvent.setup();
    draft = clone(contract.draft);
    for (const e of draft.entries) e.value_locked = true;
    params = { cardId: CARD.public_id, importId: draft.id };
    render(<CardInvoiceReconciliationPage organizationId={ORG} />);
    await screen.findByRole("heading", { name: "Confirmar compras encontradas" });

    expect(within(pairCard("MERCADO BOA VISTA")).getByRole("button", { name: "Não, adicionar agora" })).toBeDisabled();
    await user.keyboard("a");
    expect(calls.filter((c) => c.patch)).toEqual([]);
  });
});

describe("crédito parcelado (só Não registrar)", () => {
  // Um crédito "NN/MM" que o backend não cria (guia, #557): vem "Não registrar" a confirmar. A LOJA
  // da fixture vira crédito; as compras antes dela já estão respondidas, então ela abre sozinha.
  const installmentCredit = () => {
    MERCADO().confirmed = true;
    Object.assign(PADARIA(), { description: "Padaria", confirmed: true });
    Object.assign(LOJA(), { amount: { amount: "99.90", currency: "BRL" }, transaction_type: "refund", answer: "ignore", confirmed: false });
  };
  const REASON = "Crédito parcelado não entra no Fincla como compra: só dá para não registrar.";

  it("Adicionar desligado com o motivo escrito (aria-describedby); o atalho A não adiciona; Não registrar confirma", async () => {
    installmentCredit();
    const user = userEvent.setup();
    await open();

    const loja = purchase("LOJA DO BAIRRO 03/06");
    const add = within(loja).getByRole("button", { name: "Adicionar" });
    expect(add).toBeDisabled();
    expect(within(loja).getByTestId("answer-note")).toHaveTextContent(REASON);
    expect(add).toHaveAccessibleDescription(REASON);
    // "Não registrar" ligado não é descrito pelo motivo.
    expect(within(loja).getByRole("button", { name: "Não registrar" })).not.toHaveAttribute("aria-describedby");

    await user.keyboard("a");
    expect(calls.filter((c) => c.patch)).toEqual([]);

    await user.click(within(loja).getByRole("button", { name: "Não registrar" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: LOJA().id, body: { confirmed: true } }));
    expect(calls.some((c) => c.body?.answer === "create")).toBe(false);
  });

  it("compra parcelada (cobrança) segue com Adicionar ligado e sem motivo", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(alter("LOJA DO BAIRRO 03/06"));

    const loja = purchase("LOJA DO BAIRRO 03/06");
    expect(within(loja).getByRole("button", { name: "Adicionar" })).toBeEnabled();
    expect(within(loja).queryByTestId("answer-note")).not.toBeInTheDocument();
  });
});

describe("Revisar e concluir com compras novas", () => {
  it("compra nova sem descrição segura o Concluir, com o motivo; as sem categoria têm o aviso de quantas", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(within(screen.getByRole("navigation", { name: "Etapas da conciliação da fatura" })).getByRole("button", { name: /Revisar e concluir/ }));

    expect(await screen.findByTestId("summary-created")).toHaveTextContent("34 transações novas entram no Fincla · de 5 compras, com as parcelas");
    expect(screen.getByTestId("summary-uncategorized")).toHaveTextContent("5 compras novas estão sem categoria e vão para Não classificado ao concluir.");
    const conclude = screen.getByRole("button", { name: "Concluir conciliação da fatura" });
    expect(conclude).toBeDisabled();
    expect(screen.getByTestId("conclude-blocked")).toHaveTextContent("Uma compra nova está sem descrição: escreva a descrição em Compras novas.");
    expect(conclude).toHaveAttribute("aria-describedby", "conclude-blocked");
  });
});

describe("alvos de toque", () => {
  it("varredura: no celular nenhum controle de Compras novas (à vista, parcelada, fatura paga) nem do formulário do passo 1 fica abaixo de 44 px", async () => {
    const found = {};
    const user = userEvent.setup();
    await open({ isMobile: true });
    found.cash = smallTouchTargets(document.body);
    await user.click(alter("LOJA DO BAIRRO 03/06"));
    await screen.findByRole("radiogroup", { name: "Compra parcelada · 03/06" });
    found.installments = smallTouchTargets(document.body);
    cleanup();

    for (const e of draft.entries) Object.assign(e, { answer: "ignore", confirmed: false, value_locked: true });
    await open({ isMobile: true });
    found.paid = smallTouchTargets(document.body);
    cleanup();

    draft = clone(contract.draft);
    draft.entries[0].answer = "create";
    draft.entries[0].confirmed = false;
    params = { cardId: CARD.public_id, importId: draft.id };
    render(<CardInvoiceReconciliationPage organizationId={ORG} isMobile />);
    await screen.findByTestId("locked-payment");
    found.step1Form = smallTouchTargets(document.body);

    expect(found).toEqual({ cash: [], installments: [], paid: [], step1Form: [] });
  });

  it("no computador, o Confirmar e as opções da parcelada ficam com a altura de antes", async () => {
    const user = userEvent.setup();
    await open();
    expect(within(purchase("MERCADO BOA VISTA")).getByRole("button", { name: "Confirmar" }).style.minHeight).toBe("");
    await user.click(alter("LOJA DO BAIRRO 03/06"));
    expect(within(purchase("LOJA DO BAIRRO 03/06")).getByRole("radio", { name: /Compra inteira/ }).closest("label").style.minHeight).toBe("");
  });
});
