/** @vitest-environment jsdom */
// Conciliar fatura (fincla-api#555), no nível da página, alimentada pela fixture de contrato
// (`card_invoice_import.example.json`, cópia byte a byte da do backend). A gravação é garantida
// pelos testes de API; aqui conferimos o que a pessoa vê, o que a tela manda e as regras de
// interface do passo 1 (Confirmar só na sugestão intacta, recolher no clique sem temporizador,
// linha parada com Alterar/Desfazer, rodapé de pendentes, "Não registrar" listrado, lote com
// desfazer, fatura paga) e do passo 8 (contagens e Concluir).
import React from "react";
import { act } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import contract from "../../../api/__fixtures__/card_invoice_import.example.json";

const navigate = vi.fn();
let params = {};
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate, useParams: () => params }));
import { CardInvoiceReconciliationPage } from "../CardInvoiceReconciliationPage.jsx";
import { StatementReconciliationPage } from "../StatementReconciliationPage.jsx";

const ORG = "org";
const CARD = contract.draft.credit_card;
const IMPORT = contract.draft.id;
const BASE = `*/v1/credit-cards/${CARD.id}/invoice-imports`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const byDescription = (d, text) => d.entries.find((e) => e.bank_description === text);
const MERCADO = byDescription(contract.draft, "MERCADO BOA VISTA").id;
const LOJA = byDescription(contract.draft, "LOJA DO BAIRRO 05/12").id;

const calls = [];
let draft = clone(contract.draft);

/** O que o backend faz com uma resposta: o par é a sugestão; responder confirma, a menos que venha `confirmed`. */
function applyAnswer(entry, body) {
  if (body.answer !== undefined) {
    entry.answer = body.answer;
    entry.paired_transaction_id = body.answer === "pair" ? entry.suggested_transaction_id : null;
  }
  entry.confirmed = body.confirmed ?? true;
}

// Categorias e etiquetas da organização: o id da Padaria é o da fixture `entry_new`.
const CATEGORIES = [
  { id: "a643ca47-c39a-40ca-9f67-c69e5aaec686", name: "alimentacao", label: "Alimentação", allowed_transaction_types: ["expense"], is_fallback: false },
  { id: "cat-casa", name: "casa", label: "Casa", allowed_transaction_types: ["expense"], is_fallback: false },
  { id: "cat-fallback", name: "nao-classificado", label: "Não classificado", allowed_transaction_types: ["expense", "income", "refund"], is_fallback: true },
];
const DETAILS = [
  { id: "8a2803e0-8264-4821-be73-d56114679006", name: "lanche", label: "Lanche", parent_category_tag_id: "a643ca47-c39a-40ca-9f67-c69e5aaec686" },
  { id: "det-moveis", name: "moveis", label: "Móveis", parent_category_tag_id: "cat-casa" },
];

const server = setupServer(
  // As categorias e as etiquetas do formulário da compra nova (#557).
  http.get("*/v1/tags", ({ request }) =>
    HttpResponse.json({ tags: new URL(request.url).searchParams.get("tag_type") === "detalhe" ? DETAILS : CATEGORIES })),
  http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: CARD.id, public_id: CARD.public_id, description: CARD.name, brand: "Visa", last4: CARD.last4 }])),
  // "Faturas conciliadas" (#556) e a prévia do desfazer da concluída: os testes da F2 ficam em
  // `CardInvoiceReconciliationPage.f2.rtl.test.jsx`.
  http.get("*/v1/credit-cards/:cardId/invoice-imports", () => HttpResponse.json({ imports: [] })),
  http.get(`${BASE}/:importId/undo-preview`, () => HttpResponse.json(contract.undo_preview)),
  http.get(`${BASE}/${IMPORT}`, () => HttpResponse.json(draft)),
  http.patch(`${BASE}/${IMPORT}`, async ({ request }) => {
    const body = await request.json();
    calls.push({ progress: body });
    Object.assign(draft, body);
    return HttpResponse.json(draft);
  }),
  http.patch(`${BASE}/${IMPORT}/entries/:entryId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ patch: p.entryId, body });
    const entry = draft.entries.find((e) => e.id === p.entryId);
    applyAnswer(entry, body);
    return HttpResponse.json(entry);
  }),
  http.patch(`${BASE}/${IMPORT}/entries`, async ({ request }) => {
    const body = await request.json();
    calls.push({ batch: body.entries });
    for (const item of body.entries) applyAnswer(draft.entries.find((e) => e.id === item.id), item);
    return HttpResponse.json(draft);
  }),
  http.post(`${BASE}/${IMPORT}/suggestions/confirm`, async ({ request }) => {
    const body = await request.json();
    calls.push({ confirm: body });
    draft.entries.filter((e) => body.entry_ids.includes(e.id)).forEach((e) => { e.confirmed = body.confirmed; });
    return HttpResponse.json(draft);
  }),
  http.post(`${BASE}/${IMPORT}/conclude`, () => {
    calls.push({ conclude: true });
    return HttpResponse.json(contract.concluded);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  draft = clone(contract.draft);
  server.resetHandlers();
  navigate.mockReset();
});

const openDraft = async (props = {}) => {
  params = { cardId: CARD.public_id, importId: IMPORT };
  render(<CardInvoiceReconciliationPage organizationId={ORG} {...props} />);
  await screen.findByRole("heading", { name: "Confirmar compras encontradas" });
};

const card = (text) => screen.getByRole("article", { name: new RegExp(text.replace(/[*/]/g, ".")) });
const rows = () => screen.queryAllByTestId("pair-row");
const rail = () => screen.getByRole("navigation", { name: "Etapas da conciliação da fatura" });
const railButton = (title) => within(rail()).getAllByRole("button").find((b) => within(b).getByTestId("step-title").textContent === title);
const railStatus = (title) => railButton(title).textContent.replace(title, "").replace(/^\d/, "");

describe("o topo da conciliação da fatura", () => {
  it("mostra o caminho, os chips, o reconhecimento, o progresso e a diferença da fatura agora", async () => {
    await openDraft();

    expect(screen.getByRole("navigation", { name: "Caminho" })).toHaveTextContent("Cartões›Itaú Visa›Fatura de dezembro›Conciliar fatura");
    const chips = screen.getByTestId("invoice-chips");
    expect(chips).toHaveTextContent("Cartão Itaú Visa");
    expect(chips).toHaveTextContent("Fatura dezembro/2026");
    expect(chips).toHaveTextContent("Vencimento 10/12/2026 · fechamento 03/12/2026");
    expect(within(chips).getByTestId("invoice-file-chip")).toHaveTextContent(`Arquivo ${contract.draft.file_name} · total conferido`);
    expect(chips).toHaveTextContent("20 lançamentos na fatura");
    expect(screen.getByTestId("recognition-notice")).toHaveTextContent(
      "Reconhecemos este arquivo como a fatura do Itaú Visa de dezembro (vencimento 10/12), pelo final do cartão e pelo vencimento que vêm no PDF. Se não for, escolha outro cartão.",
    );
    expect(screen.getByTestId("invoice-progress")).toHaveTextContent("Seu progresso: 0 de 6 passos conferidos");
    const difference = screen.getByTestId("invoice-difference");
    expect(difference).toHaveTextContent("Diferença da fatura agora");
    // A Assinatura que sobra no Fincla (#560) entra no total: R$ 61,00 além dos R$ 0,40 do posto.
    expect(within(difference).getByTestId("invoice-difference-value")).toHaveTextContent("−R$ 61,40");
    expect(difference).toHaveTextContent("Banco R$ 2.402,92 · Fincla R$ 2.464,32");
    expect(screen.queryByTestId("other-card-notice")).not.toBeInTheDocument();
  });

  it("o trilho tem os 8 passos, cada um com o estado dos seus itens", async () => {
    await openDraft();

    const titles = within(rail()).getAllByTestId("step-title").map((t) => t.textContent);
    expect(titles).toEqual([
      "Confirmar compras encontradas", "Compras em outra fatura", "Decidir casos com dúvida", "Encargos, tarifas e estornos",
      "Compras novas", "Sobrando no Fincla", "Conferir o total", "Revisar e concluir",
    ]);
    // O passo aberto diz "Você está aqui" (protótipo v16); os outros, o estado deles.
    expect(railStatus("Confirmar compras encontradas")).toBe("Você está aqui");
    // #559: a compra em outra fatura vem com a sugestão marcada; as dúvidas, sem resposta.
    expect(railStatus("Compras em outra fatura")).toBe("1 escolha para confirmar");
    expect(railStatus("Decidir casos com dúvida")).toBe("3 lançamentos para responder");
    // Compras novas (#557): vêm "Adicionar" marcado, a confirmar.
    expect(railStatus("Compras novas")).toBe("4 escolhas para confirmar");
    expect(railStatus("Conferir o total")).toBe("Depois dos lançamentos");
  });

  it("sem nome de arquivo, o chip diz que o arquivo foi lido do PDF", async () => {
    draft.file_name = null;
    await openDraft();

    expect(screen.getByTestId("invoice-file-chip")).toHaveTextContent("Arquivo lido do PDF · total conferido");
  });

  it("outro cartão com o final do PDF que não dá para escolher (suggested_card null): avisa, sem Conciliar no cartão X", async () => {
    draft.card_check = { ...clone(contract.card_check_other_card), suggested_card: null };
    await openDraft();

    const notice = screen.getByTestId("other-card-notice");
    expect(notice).toHaveTextContent("Esta fatura parece ser de outro cartão.");
    expect(notice).toHaveTextContent("O PDF é do cartão final 4321.");
    expect(notice).toHaveTextContent("Se ela é mesmo deste cartão, pode seguir");
    expect(within(notice).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByTestId("recognition-notice")).not.toHaveTextContent("pelo final do cartão");
  });

  // QA F1 BUG-01: o aviso azul dizia "Reconhecemos… pelo final do cartão" e o amarelo, logo abaixo,
  // que o PDF é de outro final. Com `other_card`, o azul só diz em que fatura está o rascunho.
  it("PDF de outro cartão: o aviso azul não afirma o reconhecimento pelo final, só em que fatura está", async () => {
    draft.card_check = clone(contract.card_check_other_card);
    await openDraft();

    const recognition = screen.getByTestId("recognition-notice");
    expect(recognition).toHaveTextContent(
      "Esta conciliação está na fatura do Itaú Visa de dezembro (vencimento 10/12), pelo vencimento que vem no PDF. Se não for, escolha outro cartão.",
    );
    expect(recognition).not.toHaveTextContent("Reconhecemos");
    expect(recognition).not.toHaveTextContent("pelo final do cartão");
    expect(screen.getByTestId("other-card-notice")).toHaveTextContent("O PDF é do cartão final 4321");
  });

  it("PDF do mesmo cartão (same_card): o reconhecimento pelo final continua, sem aviso de outro cartão", async () => {
    draft.card_check = { status: "same_card", file_last4: CARD.last4, suggested_card: null };
    await openDraft();

    expect(screen.getByTestId("recognition-notice")).toHaveTextContent(
      "Reconhecemos este arquivo como a fatura do Itaú Visa de dezembro (vencimento 10/12), pelo final do cartão e pelo vencimento que vêm no PDF. Se não for, escolha outro cartão.",
    );
    expect(screen.queryByTestId("other-card-notice")).not.toBeInTheDocument();
  });

  // QA F1: a API devolve o 404 do extrato ("…nesta conta."); na rota do cartão a frase diz "neste cartão".
  it("conciliação que não existe neste cartão (404): diz 'neste cartão', não 'nesta conta'", async () => {
    server.use(http.get(`${BASE}/${IMPORT}`, () =>
      HttpResponse.json({ detail: { code: "not_found", message: "Conciliação não encontrada nesta conta." } }, { status: 404 })));
    params = { cardId: CARD.public_id, importId: IMPORT };
    render(<CardInvoiceReconciliationPage organizationId={ORG} />);

    expect(await screen.findByText("Conciliação não encontrada neste cartão.")).toBeInTheDocument();
    expect(screen.queryByText(/nesta conta/)).not.toBeInTheDocument();
  });

  it("o PDF de outro cartão da organização só avisa, com Conciliar no cartão X", async () => {
    draft.card_check = clone(contract.card_check_other_card);
    await openDraft();

    const notice = screen.getByTestId("other-card-notice");
    expect(notice).toHaveTextContent("O PDF é do cartão final 4321 (Itaú Visa)");
    await userEvent.setup().click(within(notice).getByRole("button", { name: "Conciliar no cartão Itaú Visa" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/reconcile` });
  });
});

describe("o passo Confirmar compras encontradas", () => {
  // QA F1: no celular as respostas tinham 32 px; alvo de toque é 44 px. No computador, 32 px.
  it.each([[false, "32px"], [true, "44px"]])("as respostas têm altura de alvo de toque só no celular (mobile=%s → %s)", async (isMobile, height) => {
    params = { cardId: CARD.public_id, importId: IMPORT };
    render(<CardInvoiceReconciliationPage organizationId={ORG} isMobile={isMobile} />);
    await screen.findByRole("heading", { name: "Confirmar compras encontradas" });

    const answers = within(card("MERCADO BOA VISTA")).getByRole("group", { name: /já está no Fincla/ });
    for (const button of within(answers).getAllByRole("button")) expect(button.style.minHeight).toBe(height);
  });

  it("a sugestão intacta vem marcada, com Confirmar sugestão ao lado das respostas e o que acontece ao concluir", async () => {
    await openDraft();

    const mercado = card("MERCADO BOA VISTA");
    expect(within(mercado).getByText("Na fatura do banco")).toBeInTheDocument();
    expect(within(mercado).getByTestId("bank-side")).toHaveTextContent("Compras");
    expect(within(mercado).getByTestId("bank-side")).toHaveTextContent("final 4321");
    expect(within(mercado).getByText("Sugerido pelo Fincla")).toBeInTheDocument();
    expect(within(mercado).getByText("Sugerido · falta confirmar")).toBeInTheDocument();
    expect(within(mercado).getByTestId("fincla-side")).toHaveTextContent("Mercado");
    expect(within(mercado).getByTestId("pair-consequences")).toHaveTextContent("Ao concluir, a compra fica ligada ao lançamento do banco. Nada mais muda nela.");
    const answers = within(mercado).getByRole("group", { name: "Esta compra do banco já está no Fincla?" });
    expect(within(answers).getByRole("button", { name: "Sim, é esta" })).toHaveAttribute("aria-pressed", "true");
    expect(within(answers).getByRole("button", { name: "Não registrar" })).toHaveAttribute("aria-pressed", "false");
    expect(within(mercado).getByRole("button", { name: "Confirmar sugestão" })).toBeInTheDocument();
    expect(within(mercado).getByTestId("pair-outcome")).toHaveTextContent("Ao concluir: Mercado fica ligada a este lançamento da fatura.");
    // Só o atual aberto; os outros em linhas.
    expect(screen.getAllByTestId("pair-card")).toHaveLength(1);
    expect(rows()).toHaveLength(3);
  });

  it("Confirmar sugestão recolhe no clique (sem espera): a linha fica parada com Conferido, Alterar e Desfazer escolha, e nada aparece abaixo", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(card("MERCADO BOA VISTA")).getByRole("button", { name: "Confirmar sugestão" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: MERCADO, body: { answer: "pair" } }));
    const row = await screen.findByRole("button", { name: /Alterar o lançamento de 05\/11\/2026: MERCADO BOA VISTA/ });
    const line = row.closest("[data-testid='pair-row']");
    expect(within(line).getByTestId("conferido-badge")).toBeInTheDocument();
    expect(within(line).getByRole("button", { name: "Desfazer escolha" })).toBeInTheDocument();
    expect(line).toHaveTextContent("É Mercado");
    // O próximo pendente abre no lugar dele; nada de resumo nem "Próximo pendente" abaixo da linha.
    expect(screen.queryByText(/Próximo pendente/)).not.toBeInTheDocument();
    expect(card("FARMACIA SAO JOAO")).toBeInTheDocument();
    // Mais nada mudou: o passo continua com as outras 3 sugestões a confirmar.
    expect(screen.getByRole("button", { name: "Confirmar as 3 de uma vez" })).toBeInTheDocument();
  });

  it("Desfazer escolha volta a sugestão para 'falta confirmar' e reabre o cartão", async () => {
    const user = userEvent.setup();
    await openDraft();
    await user.click(within(card("MERCADO BOA VISTA")).getByRole("button", { name: "Confirmar sugestão" }));
    const line = (await screen.findByRole("button", { name: /Alterar o lançamento de 05\/11\/2026: MERCADO/ })).closest("[data-testid='pair-row']");

    await user.click(within(line).getByRole("button", { name: "Desfazer escolha" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: MERCADO, body: { answer: "pair", confirmed: false } }));
    expect(await screen.findByRole("button", { name: "Confirmar sugestão" })).toBeInTheDocument();
    expect(within(card("MERCADO BOA VISTA")).getByText("Sugerido · falta confirmar")).toBeInTheDocument();
  });

  it("clicar de novo na resposta já confirmada só recolhe, sem gravar de novo", async () => {
    draft.entries.find((e) => e.id === MERCADO).confirmed = true;
    const user = userEvent.setup();
    await openDraft();
    await user.click(screen.getByRole("button", { name: /Alterar o lançamento de 05\/11\/2026: MERCADO/ }));
    const mercado = card("MERCADO BOA VISTA");
    expect(within(mercado).queryByRole("button", { name: "Confirmar sugestão" })).not.toBeInTheDocument();

    await user.click(within(mercado).getByRole("button", { name: "Sim, é esta" }));

    expect(screen.queryByRole("article", { name: /MERCADO BOA VISTA/ })).not.toBeInTheDocument();
    expect(calls.filter((c) => c.patch)).toEqual([]);
  });

  it("Não registrar recolhe no clique; reaberto, o lado do Fincla continua à vista em cinza listrado com Fica de fora, sem Confirmar", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(card("MERCADO BOA VISTA")).getByRole("button", { name: "Não registrar" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: MERCADO, body: { answer: "ignore" } }));
    const line = (await screen.findByRole("button", { name: /Alterar o lançamento de 05\/11\/2026: MERCADO/ })).closest("[data-testid='pair-row']");
    expect(line).toHaveTextContent("Fica fora do Fincla");

    await user.click(within(line).getByRole("button", { name: /Alterar/ }));
    const mercado = card("MERCADO BOA VISTA");
    const skipped = within(mercado).getByTestId("fincla-side-skipped");
    expect(skipped).toHaveTextContent("Mercado");
    expect(within(skipped).getByTestId("skip-note")).toHaveTextContent("Fica de fora");
    expect(within(mercado).getByTestId("bank-side")).toHaveTextContent("Não entra no Fincla");
    expect(within(mercado).queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
    expect(within(mercado).getByTestId("pair-outcome")).toHaveTextContent("Não entra no Fincla. A diferença aparece em Conferir o total.");
  });

  it("parcela com valor diferente: o selo, a frase do banco × Fincla, a troca para o valor do banco e o aviso das próximas parcelas", async () => {
    const user = userEvent.setup();
    await openDraft();
    await user.click(screen.getByRole("button", { name: /Alterar o lançamento de 14\/07\/2026: LOJA DO BAIRRO 05\/12/ }));

    const loja = card("LOJA DO BAIRRO 05/12");
    expect(within(loja).getByText("VALOR DIFERENTE")).toBeInTheDocument();
    expect(within(loja).getByTestId("fincla-side")).toHaveTextContent("Data da compra14/07/2026");
    expect(within(loja).getByTestId("installment-badge")).toHaveTextContent("05/12");
    const consequences = within(loja).getByTestId("pair-consequences");
    expect(consequences).toHaveTextContent("O banco cobrou R$ 108,30; no Fincla está R$ 108,33 (diferença de R$ 0,03).");
    expect(within(consequences).getByTestId("value-change")).toHaveTextContent(/Ao concluir, vale o valor do banco:\s*R\$ 108,33\s*R\$ 108,30/);
    // 7 parcelas seguintes: 7 × 108,33 no Fincla contra 7 × 108,27 do banco.
    expect(within(consequences).getByTestId("future-installments-note")).toHaveTextContent(
      "As outras 7 parcelas desta compra continuam com o valor do Fincla. Até elas serem conciliadas, o total da compra fica R$ 0,42 diferente do banco.",
    );
    expect(within(loja).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(loja).getByTestId("pair-outcome")).toHaveTextContent("passa a valer R$ 108,30, o valor do banco.");
  });

  it("fatura já paga com valor diferente: o par liga sem trocar o valor, o motivo aparece, e Não registrar continua disponível", async () => {
    const loja = draft.entries.find((e) => e.id === LOJA);
    loja.value_locked = true;
    loja.value_change = null;
    const user = userEvent.setup();
    await openDraft();
    await user.click(screen.getByRole("button", { name: /Alterar o lançamento de 14\/07\/2026: LOJA DO BAIRRO/ }));

    const open = card("LOJA DO BAIRRO 05/12");
    expect(within(open).getByTestId("pair-consequences")).toHaveTextContent("Fatura já paga: o valor não muda.");
    expect(within(open).queryByTestId("value-change")).not.toBeInTheDocument();
    expect(within(open).getByTestId("answer-note")).toHaveTextContent("Esta fatura já foi paga. Para corrigir, desmarque o pagamento e volte aqui.");
    expect(within(open).getByRole("button", { name: "Confirmar sugestão" })).toBeEnabled();
    // "Não registrar" não muda nada no Fincla: fica ligado numa fatura paga.
    expect(within(open).getByRole("button", { name: "Não registrar" })).toBeEnabled();
    await user.click(within(open).getByRole("button", { name: "Não registrar" }));
    await waitFor(() => expect(calls).toContainEqual({ patch: LOJA, body: { answer: "ignore" } }));
  });

  it("fatura já paga: o atalho N também não registra (a mesma regra do botão)", async () => {
    const loja = draft.entries.find((e) => e.id === LOJA);
    loja.value_locked = true;
    loja.value_change = null;
    const user = userEvent.setup();
    await openDraft();
    await user.click(screen.getByRole("button", { name: /Alterar o lançamento de 14\/07\/2026: LOJA DO BAIRRO/ }));
    card("LOJA DO BAIRRO 05/12");

    await user.keyboard("n");
    await waitFor(() => expect(calls).toContainEqual({ patch: LOJA, body: { answer: "ignore" } }));
  });

  it("fatura já paga com o mesmo valor: o valor não muda sem aviso, Adicionar desligado com o motivo (decisão 1), o resto ligado", async () => {
    for (const e of draft.entries) e.value_locked = true;
    await openDraft();

    const mercado = card("MERCADO BOA VISTA");
    expect(within(mercado).getByTestId("pair-consequences")).not.toHaveTextContent(/fatura já paga/i);
    // Fatura paga não recebe compra nova (#557): o motivo fica escrito.
    expect(within(mercado).getByRole("button", { name: "Não, adicionar agora" })).toBeDisabled();
    expect(within(mercado).getByTestId("answer-note")).toHaveTextContent("Esta fatura já foi paga. Para corrigir, desmarque o pagamento e volte aqui.");
    expect(within(mercado).getByTestId("pair-consequences")).toHaveTextContent("Nada mais muda nela.");
    expect(within(mercado).getByRole("button", { name: "Não registrar" })).toBeEnabled();
    expect(within(mercado).getByRole("button", { name: "Sim, é esta" })).toBeEnabled();
  });

  it("Confirmar as 4 de uma vez, com a faixa de Desfazer", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(screen.getByRole("button", { name: "Confirmar as 4 de uma vez" }));

    await waitFor(() => expect(calls.find((c) => c.confirm)?.confirm.confirmed).toBe(true));
    expect(calls.find((c) => c.confirm).confirm.entry_ids).toHaveLength(4);
    const banner = await screen.findByText("4 compras confirmadas.");
    expect(screen.queryAllByTestId("pair-card")).toHaveLength(0);
    expect(rows()).toHaveLength(4);
    expect(screen.queryByTestId("go-to-pending-bar")).not.toBeInTheDocument();

    await user.click(within(banner.closest("[role='status']")).getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(calls.filter((c) => c.confirm).at(-1).confirm.confirmed).toBe(false));
    expect(await screen.findByRole("button", { name: "Confirmar as 4 de uma vez" })).toBeInTheDocument();
  });

  it("com pendente no passo: o rodapé fixo 'Falta responder' leva a ele, e Próximo fica desligado", async () => {
    // As outras sugestões já confirmadas: só a sem resposta falta.
    for (const e of draft.entries) if (e.answerable) e.confirmed = true;
    const pending = draft.entries.find((e) => e.id === MERCADO);
    pending.answer = null;
    pending.paired_transaction_id = null;
    await openDraft();

    expect(screen.getByTestId("go-to-pending")).toHaveAccessibleName("Falta responder 1 compra deste passo. Ir para o primeiro item que falta responder");
    expect(screen.getByRole("button", { name: /^Próximo: Compras em outra fatura/ })).toBeDisabled();
    expect(railStatus("Confirmar compras encontradas")).toBe("1 lançamento para responder");
  });

  it("Próximo confirma as escolhas que faltam confirmar e abre o passo seguinte; nada muda no Fincla", async () => {
    const user = userEvent.setup();
    await openDraft();
    expect(screen.getByTestId("step-footer")).toHaveTextContent("Ao avançar, as 4 escolhas que faltam confirmar ficam confirmadas. Nada muda no Fincla até você concluir.");

    await user.click(screen.getByRole("button", { name: "Próximo: Compras em outra fatura →" }));

    expect(await screen.findByRole("heading", { name: "Compras em outra fatura" })).toBeInTheDocument();
    // Um lote só, tudo ou nada: nenhuma confirmação em separado.
    expect(calls.filter((c) => c.batch)).toHaveLength(1);
    expect(calls.find((c) => c.batch).batch).toHaveLength(4);
    expect(calls.find((c) => c.batch).batch.every((b) => b.confirmed === true && Object.keys(b).length === 2)).toBe(true);
    expect(calls.some((c) => c.confirm)).toBe(false);
    await waitFor(() => expect(calls).toContainEqual({ progress: { current_step: "other_invoice", reviewed_steps: ["suggested"] } }));
    expect(railStatus("Confirmar compras encontradas")).toBe("Conferido");
    // Desde a #559 o passo 2 responde: a compra em outra fatura abre (ver o teste .f5).
    expect(await screen.findByRole("article", { name: /CAFETERIA AROMA/ })).toBeInTheDocument();
  });

  it("desde a #559 nenhum passo de lançamentos fica só para leitura", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(railButton("Decidir casos com dúvida"));
    expect(await screen.findByTestId("doubt-card")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Esta compra do banco já está no Fincla?" })).toBeInTheDocument();
    expect(screen.queryByTestId("read-only-entries")).not.toBeInTheDocument();
    await user.click(railButton("Compras em outra fatura"));
    expect(await screen.findByTestId("move-card")).toBeInTheDocument();
    expect(screen.queryByTestId("read-only-entries")).not.toBeInTheDocument();
    // Encargos, tarifas e estornos responde desde a #558 (ver o teste .f4): nada fica de fora ali.
    await user.click(railButton("Encargos, tarifas e estornos"));
    expect(await screen.findByTestId("charge-group-card")).toBeInTheDocument();
    expect(screen.queryByTestId("read-only-entries")).not.toBeInTheDocument();
  });
});

/**
 * As três dúvidas respondidas (#559): cada Uber com uma das duas corridas, o posto com a opção de
 * valor parecido. Sem nada sem resposta, o rascunho pode ser concluído.
 */
function answerDoubts(d) {
  const ids = [25, 26, 27];
  d.entries.filter((e) => e.classification === "doubt").forEach((e, i) => {
    const chosen = e.candidates.find((c) => c.id === ids[i]);
    Object.assign(e, { answer: "pair", confirmed: true, paired_transaction_id: chosen.id, fincla_transaction: { ...chosen } });
  });
  d.summary.unanswered = 0;
  d.summary.to_pair += 3;
  d.blockers = [];
  d.can_conclude = true;
}

describe("o passo Revisar e concluir", () => {
  it("mostra as contagens, o total da fatura no Fincla, a diferença e conclui", async () => {
    answerDoubts(draft);
    const user = userEvent.setup();
    await openDraft();
    await user.click(railButton("Revisar e concluir"));

    expect(await screen.findByTestId("summary-paired")).toHaveTextContent("7 compras já estavam no Fincla e ficam ligadas ao banco");
    expect(screen.getByTestId("summary-bank-value")).toHaveTextContent("1 compra passa a ter o valor do banco");
    // A compra em outra fatura (#559): sai da fatura de janeiro e entra nesta.
    expect(screen.getByTestId("summary-moved")).toHaveTextContent("1 compra sai de outra fatura e entra nesta");
    expect(screen.queryByTestId("summary-moved-series")).not.toBeInTheDocument();
    // O grupo de encargos somado (#558) e os encargos, tarifas e estornos que entram como transações.
    expect(screen.getByTestId("summary-summed-charges")).toHaveTextContent("4 encargos já estavam somados no Fincla · em “Encargos do cartão”, que fica ligada a todos eles");
    expect(screen.getByTestId("summary-created")).toHaveTextContent("8 transações novas entram no Fincla · 2 estornos diminuem o total da fatura");
    expect(screen.queryByTestId("summary-ignored")).not.toBeInTheDocument();
    expect(screen.getByTestId("summary-uncategorized")).toHaveTextContent(
      "8 transações novas estão sem categoria e vão para Não classificado ao concluir. Dá para escolher a categoria em Encargos, tarifas e estornos e em Compras novas.",
    );
    expect(screen.getByTestId("summary-fincla-total")).toHaveTextContent(/Fatura de dezembro no Fincla fica\s*R\$ 2\.464,32/);
    expect(screen.getByTestId("summary-difference")).toHaveTextContent(/Diferença que fica registrada\s*−R\$ 61,40/);
    expect(screen.getByTestId("payment-not-marked")).toHaveTextContent("O pagamento desta fatura não é marcado aqui: ele é conferido quando você concilia o extrato da conta corrente");

    await user.click(screen.getByRole("button", { name: "Concluir conciliação da fatura" }));

    expect(await screen.findByRole("heading", { name: "Fatura de dezembro conciliada" })).toBeInTheDocument();
    expect(screen.getByTestId("done-totals")).toHaveTextContent("Fatura no Fincla: R$ 2.463,92 · diferença registrada: −R$ 61,00.");
    await user.click(screen.getByRole("button", { name: "Ver a fatura" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/invoices/2026/12` });
  });

  it("concluída, avisa as outras telas para buscar as transações de novo; recusada, não", async () => {
    const onConcluded = vi.fn();
    answerDoubts(draft);
    const user = userEvent.setup();
    server.use(http.post(`${BASE}/${IMPORT}/conclude`, () => HttpResponse.json({ detail: { code: "business_rule", message: "Falta responder." } }, { status: 422 })));
    await openDraft({ onConcluded });
    await user.click(railButton("Revisar e concluir"));

    await user.click(await screen.findByRole("button", { name: "Concluir conciliação da fatura" }));
    expect(await screen.findByText("Falta responder.")).toBeInTheDocument();
    expect(onConcluded).not.toHaveBeenCalled();

    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Concluir conciliação da fatura" }));
    expect(await screen.findByRole("heading", { name: "Fatura de dezembro conciliada" })).toBeInTheDocument();
    expect(onConcluded).toHaveBeenCalledTimes(1);
  });

  it("Concluir fica desligado com o motivo escrito enquanto falta responder", async () => {
    draft.can_conclude = false;
    draft.summary.unanswered = 1;
    draft.blockers = [{ code: "unanswered", count: 1 }];
    const user = userEvent.setup();
    await openDraft();
    await user.click(railButton("Revisar e concluir"));

    expect(await screen.findByRole("button", { name: "Concluir conciliação da fatura" })).toBeDisabled();
    expect(screen.getByTestId("conclude-blocked")).toHaveTextContent("Falta responder 1 item.");
  });

  it("o total do Fincla que não sabemos é 'não sabemos', nunca R$ 0,00", async () => {
    draft.difference_now = { bank: draft.difference_now.bank, fincla: null, difference: null };
    const user = userEvent.setup();
    await openDraft();

    expect(screen.getByTestId("invoice-difference-value")).toHaveTextContent("não sabemos");
    await user.click(railButton("Revisar e concluir"));
    expect(await screen.findByTestId("summary-fincla-total")).toHaveTextContent("não sabemos");
    expect(screen.getByTestId("summary-fincla-total")).not.toHaveTextContent("R$ 0,00");
  });
});

describe("enviar o PDF da fatura", () => {
  it("pela tela do cartão: o PDF vai para a rota do cartão e a conciliação abre", async () => {
    server.use(http.post(BASE, () => HttpResponse.json(draft, { status: 201 })));
    params = { cardId: CARD.public_id };
    const user = userEvent.setup();
    render(<CardInvoiceReconciliationPage organizationId={ORG} />);

    const input = await screen.findByLabelText("PDF da fatura do cartão (até 5 MB)");
    expect(input).toHaveAttribute("accept", ".pdf,application/pdf");
    await user.upload(input, new File(["%PDF-1.4"], "fatura.pdf", { type: "application/pdf" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/reconcile/${IMPORT}` }));
  });

  it("já há conciliação em andamento desta fatura: o aviso leva ao rascunho", async () => {
    server.use(http.post(BASE, () => HttpResponse.json({ detail: contract.draft_in_progress }, { status: 409 })));
    params = { cardId: CARD.public_id };
    const user = userEvent.setup();
    render(<CardInvoiceReconciliationPage organizationId={ORG} />);

    await user.upload(await screen.findByLabelText("PDF da fatura do cartão (até 5 MB)"), new File(["%PDF-1.4"], "fatura.pdf", { type: "application/pdf" }));

    const notice = await screen.findByTestId("draft-in-progress-notice");
    expect(notice).toHaveTextContent("Você já tem uma conciliação em andamento desta fatura.");
    await user.click(within(notice).getByRole("button", { name: "Continuar conciliação" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/reconcile/${IMPORT}` });
  });

  it("trocar de cartão no meio: enquanto o novo cartão carrega não há onde soltar, e o PDF vai para o cartão novo", async () => {
    const OTHER = { id: 2, public_id: "other-card-public-id", description: "Nubank", brand: "Master", last4: "9999" };
    let release;
    let listed = 0;
    const posted = [];
    server.use(
      http.get("*/v1/credit-cards", async () => {
        listed += 1;
        if (listed > 1) await new Promise((r) => { release = r; });
        return HttpResponse.json([{ id: CARD.id, public_id: CARD.public_id, description: CARD.name, brand: "Visa", last4: CARD.last4 }, OTHER]);
      }),
      http.post("*/v1/credit-cards/:cardId/invoice-imports", ({ params: p }) => {
        posted.push(Number(p.cardId));
        return HttpResponse.json(draft, { status: 201 });
      }),
    );
    params = { cardId: CARD.public_id };
    const user = userEvent.setup();
    const view = render(<CardInvoiceReconciliationPage organizationId={ORG} />);
    await screen.findByLabelText("PDF da fatura do cartão (até 5 MB)");

    params = { cardId: OTHER.public_id };
    view.rerender(<CardInvoiceReconciliationPage organizationId={ORG} />);
    // O cartão anterior deixa de valer na hora: nada de área de envio apontando para ele.
    expect(screen.queryByLabelText("PDF da fatura do cartão (até 5 MB)")).not.toBeInTheDocument();
    expect(screen.getByText("Carregando o cartão…")).toBeInTheDocument();

    await waitFor(() => expect(release).toBeTypeOf("function"));
    await act(async () => { release(); });
    await user.upload(await screen.findByLabelText("PDF da fatura do cartão (até 5 MB)"), new File(["%PDF-1.4"], "fatura.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(posted).toEqual([OTHER.id]));
  });

  it("pela área de envio da conta, com conciliação da fatura em andamento: o mesmo aviso do extrato leva ao rascunho no cartão", async () => {
    const ACCOUNT = contract.draft.account_id;
    server.use(
      http.get("*/v1/accounts", () => HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true }])),
      http.get(`*/v1/accounts/${ACCOUNT}/statement-imports`, () => HttpResponse.json({ imports: [] })),
      http.post(`*/v1/accounts/${ACCOUNT}/statement-imports`, () => HttpResponse.json({ detail: contract.draft_in_progress }, { status: 409 })),
    );
    params = { accountId: ACCOUNT };
    const user = userEvent.setup();
    render(<StatementReconciliationPage organizationId={ORG} />);

    await user.upload(await screen.findByLabelText(/Arquivo do extrato/), new File(["%PDF-1.4"], "fatura.pdf", { type: "application/pdf" }));

    const notice = await screen.findByTestId("draft-in-progress-notice");
    expect(notice).toHaveTextContent(contract.draft_in_progress.message);
    // Não navega sozinho: a pessoa vê o aviso e escolhe continuar.
    expect(navigate).not.toHaveBeenCalled();
    await user.click(within(notice).getByRole("button", { name: "Continuar conciliação" }));
    expect(navigate).toHaveBeenCalledWith({
      to: `/cards/${contract.draft_in_progress.credit_card_public_id}/reconcile/${contract.draft_in_progress.import_id}`,
    });
  });

  it("pela área de envio da conta: um PDF reconhecido como fatura abre a conciliação da fatura no cartão", async () => {
    const ACCOUNT = contract.draft.account_id;
    server.use(
      http.get("*/v1/accounts", () => HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true }])),
      http.get(`*/v1/accounts/${ACCOUNT}/statement-imports`, () => HttpResponse.json({ imports: [] })),
      http.post(`*/v1/accounts/${ACCOUNT}/statement-imports`, () => HttpResponse.json(draft, { status: 201 })),
    );
    params = { accountId: ACCOUNT };
    const user = userEvent.setup();
    render(<StatementReconciliationPage organizationId={ORG} />);

    const input = await screen.findByLabelText(/Arquivo do extrato/);
    expect(input.getAttribute("accept")).toContain(".pdf");
    await user.upload(input, new File(["%PDF-1.4"], "fatura.pdf", { type: "application/pdf" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/reconcile/${IMPORT}` }));
  });
});
