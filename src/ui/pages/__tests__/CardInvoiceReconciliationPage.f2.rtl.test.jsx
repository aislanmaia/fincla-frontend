/** @vitest-environment jsdom */
// Conciliar fatura, segunda entrega (fincla-api#556), no nível da página, sobre a fixture de contrato
// (`list`, `reimport`, `concluded`, `undone`, `undo_preview*`). Que o desfazer, a retomada e a
// reimportação gravam certo é garantido pelos testes de API; aqui conferimos o que a pessoa vê e o
// que a tela manda: "Faturas conciliadas" do cartão, retomar no passo, descartar, o arquivo já
// conciliado, os já conferidos só para leitura, o "Desfazer conciliação" da concluída (e o motivo
// quando não dá) e os alvos de toque no celular.
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
const [LIST_DRAFT, LIST_UNDONE, LIST_CONCLUDED] = contract.list.imports;

const calls = [];
let list = clone(contract.list);
let detail = clone(contract.draft);
let preview = clone(contract.undo_preview);
let detailResponse = null;

const server = setupServer(
  http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: CARD.id, public_id: CARD.public_id, description: CARD.name, brand: "Visa", last4: CARD.last4 }])),
  http.get(BASE, () => {
    calls.push({ list: true });
    return HttpResponse.json(list);
  }),
  http.get(`${BASE}/:importId`, ({ params: p }) => {
    calls.push({ get: p.importId });
    if (detailResponse) return detailResponse();
    return HttpResponse.json(detail);
  }),
  http.patch(`${BASE}/:importId`, async ({ request }) => {
    const body = await request.json();
    calls.push({ progress: body });
    Object.assign(detail, body);
    return HttpResponse.json(detail);
  }),
  http.delete(`${BASE}/:importId`, ({ params: p }) => {
    calls.push({ discard: p.importId });
    list.imports = list.imports.filter((i) => i.id !== p.importId);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(`${BASE}/:importId/undo-preview`, ({ params: p }) => {
    calls.push({ preview: p.importId });
    return HttpResponse.json(preview);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  list = clone(contract.list);
  detail = clone(contract.draft);
  preview = clone(contract.undo_preview);
  detailResponse = null;
  server.resetHandlers();
  navigate.mockReset();
});

const openUpload = async (props = {}) => {
  params = { cardId: CARD.public_id };
  render(<CardInvoiceReconciliationPage organizationId={ORG} {...props} />);
  await screen.findByRole("heading", { name: "Faturas conciliadas" });
  return screen.findAllByTestId("reconciled-invoice");
};

const openImport = (id, props = {}) => {
  params = { cardId: CARD.public_id, importId: id };
  render(<CardInvoiceReconciliationPage organizationId={ORG} {...props} />);
};

const rail = () => screen.getByRole("navigation", { name: "Etapas da conciliação da fatura" });
const railButton = (title) => within(rail()).getAllByRole("button").find((b) => within(b).getByTestId("step-title").textContent === title);
const railStatus = (title) => railButton(title).textContent.replace(title, "").replace(/^\d/, "");

describe("Faturas conciliadas do cartão", () => {
  it("lista rascunho, desfeita e concluída, com as contagens, o passo em que parou e a diferença registrada", async () => {
    const rows = await openUpload();

    expect(rows.map((r) => r.dataset.status)).toEqual(["draft", "undone", "concluded"]);
    const [draftRow, undoneRow, concludedRow] = rows;
    expect(draftRow).toHaveTextContent("Fatura de dezembro/2026");
    expect(draftRow).toHaveTextContent("Em andamento");
    expect(draftRow).toHaveTextContent("20 lançamentos · 4 já conferidos · 16 não registrados");
    expect(draftRow).toHaveTextContent("Você parou em Decidir casos com dúvida.");
    expect(draftRow).toHaveTextContent("Se ficar parada, é descartada em 25/12/2026.");
    expect(within(draftRow).getByRole("button", { name: "Continuar conciliação" })).toBeInTheDocument();
    expect(within(draftRow).getByRole("button", { name: "Descartar rascunho" })).toBeInTheDocument();
    expect(within(draftRow).queryByRole("button", { name: "Desfazer conciliação" })).not.toBeInTheDocument();

    expect(undoneRow).toHaveTextContent("Desfeita");
    expect(within(undoneRow).getByTestId("import-difference")).toHaveTextContent("Desfeita em 25/11/2026 · Diferença registrada: +R$ 1.512,08");
    expect(within(undoneRow).queryByRole("button", { name: "Desfazer conciliação" })).not.toBeInTheDocument();

    expect(concludedRow).toHaveTextContent("Concluída");
    expect(concludedRow).toHaveTextContent("20 lançamentos · 4 compras ligadas · 16 não registrados");
    expect(within(concludedRow).getByTestId("import-difference")).toHaveTextContent("Concluída em 25/11/2026 · Diferença registrada: +R$ 1.512,08");
  });

  it("Continuar conciliação abre o rascunho; Ver conciliação, a concluída; Desfazer leva à tela do desfazer", async () => {
    const user = userEvent.setup();
    const [draftRow, , concludedRow] = await openUpload();

    await user.click(within(draftRow).getByRole("button", { name: "Continuar conciliação" }));
    expect(navigate).toHaveBeenLastCalledWith({ to: `/cards/${CARD.public_id}/reconcile/${LIST_DRAFT.id}` });
    await user.click(within(concludedRow).getByRole("button", { name: "Ver conciliação" }));
    expect(navigate).toHaveBeenLastCalledWith({ to: `/cards/${CARD.public_id}/reconcile/${LIST_CONCLUDED.id}` });
    await user.click(within(concludedRow).getByRole("button", { name: "Desfazer conciliação" }));
    expect(navigate).toHaveBeenLastCalledWith({ to: `/cards/${CARD.public_id}/reconcile/${LIST_CONCLUDED.id}/undo` });
  });

  it("Desfazer só na concluída mais recente do cartão; nas outras, o motivo", async () => {
    const older = { ...clone(LIST_CONCLUDED), id: "older-import", latest_concluded: false };
    list.imports.push(older);
    const rows = await openUpload();

    const olderRow = rows.at(-1);
    expect(within(olderRow).queryByRole("button", { name: "Desfazer conciliação" })).not.toBeInTheDocument();
    expect(within(olderRow).getByTestId("undo-not-latest")).toHaveTextContent("Só a conciliação mais recente do cartão pode ser desfeita.");
    expect(within(rows[2]).getByRole("button", { name: "Desfazer conciliação" })).toBeInTheDocument();
  });

  it("Descartar rascunho pede confirmação na página, apaga o rascunho e recarrega a lista", async () => {
    const user = userEvent.setup();
    const [draftRow] = await openUpload();

    await user.click(within(draftRow).getByRole("button", { name: "Descartar rascunho" }));
    expect(calls).not.toContainEqual({ discard: LIST_DRAFT.id });
    await user.click(screen.getByRole("button", { name: "Sim, descartar" }));

    await waitFor(() => expect(screen.getAllByTestId("reconciled-invoice")).toHaveLength(2));
    expect(calls).toContainEqual({ discard: LIST_DRAFT.id });
    expect(screen.getByText("Rascunho descartado. Nada mudou nas suas transações.")).toHaveAttribute("role", "status");
  });

  it("sem nenhuma conciliação, a lista diz que não há fatura conciliada", async () => {
    list = { imports: [] };
    params = { cardId: CARD.public_id };
    render(<CardInvoiceReconciliationPage organizationId={ORG} />);

    expect(await screen.findByText("Nenhuma fatura deste cartão conciliada ainda.")).toBeInTheDocument();
  });

  it("reenviar o PDF de uma fatura com rascunho aberto: Continuar conciliação, e a lista é buscada de novo", async () => {
    server.use(http.post(BASE, () => HttpResponse.json({ detail: contract.draft_in_progress }, { status: 409 })));
    const user = userEvent.setup();
    await openUpload();
    const before = calls.filter((c) => c.list).length;

    await user.upload(screen.getByLabelText("PDF da fatura do cartão (até 5 MB)"), new File(["%PDF-1.4"], "fatura.pdf", { type: "application/pdf" }));

    const notice = await screen.findByTestId("draft-in-progress-notice");
    expect(notice).toHaveTextContent(contract.draft_in_progress.message);
    await waitFor(() => expect(calls.filter((c) => c.list).length).toBe(before + 1));
    await user.click(within(notice).getByRole("button", { name: "Continuar conciliação" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/cards/${contract.draft_in_progress.credit_card_public_id}/reconcile/${contract.draft_in_progress.import_id}` });
  });
});

describe("a área de envio e a lista", () => {
  const LIST_FAILED = { detail: { code: "internal", message: "Não deu para buscar as faturas." } };

  it("com rascunho, a área já nasce menor: não aparece grande enquanto a lista carrega (como a do extrato)", async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    server.use(http.get(BASE, async () => { await gate; return HttpResponse.json(list); }));
    params = { cardId: CARD.public_id };
    render(<CardInvoiceReconciliationPage organizationId={ORG} />);

    await screen.findByTestId("card-invoice-upload");
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("button", { name: /Solte aqui o PDF da fatura/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ou solte aqui outra fatura/ })).not.toBeInTheDocument();

    release();
    expect(await screen.findByRole("button", { name: /Ou solte aqui outra fatura/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Solte aqui o PDF da fatura/ })).not.toBeInTheDocument();
  });

  it("se a lista não carrega, a área de envio aparece mesmo assim, com o erro", async () => {
    server.use(http.get(BASE, () => HttpResponse.json(LIST_FAILED, { status: 500 })));
    params = { cardId: CARD.public_id };
    render(<CardInvoiceReconciliationPage organizationId={ORG} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não deu para buscar as faturas.");
    expect(screen.getByRole("button", { name: /Solte aqui o PDF da fatura/ })).toBeInTheDocument();
  });

  it("a busca que falha depois tira a lista velha; a que volta a dar certo apaga o erro", async () => {
    const user = userEvent.setup();
    const [draftRow] = await openUpload();

    // Descartou, mas a lista não veio: o rascunho descartado não fica na tela ao lado do erro.
    server.use(http.get(BASE, () => HttpResponse.json(LIST_FAILED, { status: 500 })));
    await user.click(within(draftRow).getByRole("button", { name: "Descartar rascunho" }));
    await user.click(screen.getByRole("button", { name: "Sim, descartar" }));
    expect(await screen.findByText("Não deu para buscar as faturas.")).toBeInTheDocument();
    expect(screen.queryAllByTestId("reconciled-invoice")).toHaveLength(0);

    // O reenvio do PDF busca a lista de novo, e agora ela vem: o erro some.
    server.use(
      http.get(BASE, () => HttpResponse.json(list)),
      http.post(BASE, () => HttpResponse.json({ detail: contract.draft_in_progress }, { status: 409 })),
    );
    await user.upload(screen.getByLabelText("PDF da fatura do cartão (até 5 MB)"), new File(["%PDF-1.4"], "fatura.pdf", { type: "application/pdf" }));
    expect(await screen.findAllByTestId("reconciled-invoice")).toHaveLength(2);
    expect(screen.queryByText("Não deu para buscar as faturas.")).not.toBeInTheDocument();
  });
});

describe("retomar o rascunho", () => {
  it("abre no passo em que a pessoa parou, com os passos já vistos", async () => {
    detail.current_step = "doubt";
    detail.reviewed_steps = ["suggested", "other_invoice"];
    openImport(detail.id);

    expect(await screen.findByRole("heading", { name: "Decidir casos com dúvida" })).toBeInTheDocument();
    expect(railStatus("Decidir casos com dúvida")).toBe("Você está aqui");
    expect(railStatus("Compras em outra fatura")).toBe("Conferido");
  });

  it("rascunho parado há 30 dias: a mensagem do backend e o caminho para enviar o PDF de novo", async () => {
    const message = "Esta conciliação ficou parada por 30 dias e foi descartada. Para conciliar esta fatura, envie o PDF de novo.";
    detailResponse = () => HttpResponse.json({ detail: { code: "not_found", message } }, { status: 404 });
    const user = userEvent.setup();
    openImport(detail.id);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    await user.click(screen.getByRole("button", { name: "Enviar o PDF da fatura" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/reconcile` });
  });
});

describe("reimportação do mesmo PDF", () => {
  it("só avisa que o arquivo já foi conciliado, com o caminho para a conciliação anterior", async () => {
    detail = clone(contract.reimport);
    const user = userEvent.setup();
    openImport(detail.id);

    const notice = await screen.findByTestId("file-already-imported");
    expect(notice).toHaveTextContent("Este arquivo já foi conciliado em 25/11/2026.");
    expect(notice).toHaveTextContent("aparecem como “já conferidos” no primeiro passo e nada se duplica");
    await user.click(within(notice).getByRole("button", { name: "Ver a conciliação anterior" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/reconcile/${contract.reimport.file_check.import_id}` });
  });

  it("os já conferidos aparecem só para leitura no passo 1, sem respostas, e contam no resumo", async () => {
    detail = clone(contract.reimport);
    const user = userEvent.setup();
    openImport(detail.id);
    // Nada a responder: abre em Revisar e concluir.
    expect(await screen.findByRole("heading", { name: "Revisar e concluir" })).toBeInTheDocument();
    expect(railStatus("Confirmar compras encontradas")).toBe("Nada a fazer · 4 já conferidos");
    expect(screen.getByTestId("summary-already-reconciled")).toHaveTextContent("4 lançamentos já foram conferidos numa conciliação anterior: nada muda neles");
    expect(screen.queryByTestId("summary-paired")).not.toBeInTheDocument();

    await user.click(railButton("Confirmar compras encontradas"));

    const rows = await screen.findAllByTestId("reconciled-row");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("MERCADO BOA VISTA");
    expect(rows[0]).toHaveTextContent("Já conferido");
    expect(rows[0]).toHaveTextContent("É Mercado");
    expect(within(screen.getByTestId("reconciled-entries")).queryAllByRole("button")).toEqual([]);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByText(/o Fincla não achou compra desta fatura/)).not.toBeInTheDocument();
  });
});

describe("a conciliação concluída", () => {
  it("a mais recente do cartão, com a fatura em aberto: Desfazer conciliação leva à tela do desfazer", async () => {
    detail = clone(contract.concluded);
    const user = userEvent.setup();
    openImport(detail.id);

    const undo = await screen.findByRole("button", { name: "Desfazer conciliação" });
    expect(calls).toContainEqual({ preview: detail.id });
    expect(screen.queryByTestId("undo-unavailable")).not.toBeInTheDocument();
    await user.click(undo);
    expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/reconcile/${detail.id}/undo` });
  });

  it("fatura já paga (decisão 8): sem o botão, com o motivo escrito", async () => {
    detail = clone(contract.concluded);
    const message = "Esta fatura já foi paga. Para desfazer a conciliação, desmarque o pagamento e volte aqui.";
    preview = { ...clone(contract.undo_preview), can_undo: false, refusal: { code: "invoice_paid", message } };
    openImport(detail.id);

    const why = await screen.findByTestId("undo-unavailable");
    expect(why).toHaveAttribute("data-code", "invoice_paid");
    expect(why).toHaveTextContent(`Não dá para desfazer esta conciliação. ${message}`);
    expect(screen.queryByRole("button", { name: "Desfazer conciliação" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver a fatura" })).toBeInTheDocument();
  });

  it("não é a mais recente do cartão: o motivo, sem pedir a prévia", async () => {
    detail = { ...clone(contract.concluded), latest_concluded: false };
    openImport(detail.id);

    const why = await screen.findByTestId("undo-unavailable");
    expect(why).toHaveAttribute("data-code", "not_latest");
    expect(why).toHaveTextContent("Só a conciliação de fatura concluída mais recente deste cartão pode ser desfeita.");
    expect(screen.queryByRole("button", { name: "Desfazer conciliação" })).not.toBeInTheDocument();
    expect(calls.some((c) => c.preview)).toBe(false);
  });

  it("a desfeita diz quando foi desfeita e deixa conciliar a fatura de novo", async () => {
    detail = clone(contract.undone);
    const user = userEvent.setup();
    openImport(detail.id);

    const done = await screen.findByTestId("invoice-import-undone");
    expect(done).toHaveTextContent("Conciliação da fatura de dezembro desfeita");
    expect(done).toHaveTextContent("Desfeita em 25/11/2026.");
    await user.click(within(done).getByRole("button", { name: "Conciliar a fatura de novo" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/reconcile` });
  });
});

describe("alvos de toque no celular (QA F1)", () => {
  it.each([[false, ""], [true, "44px"]])("os botões do rascunho têm 44 px só no celular (mobile=%s → %s)", async (isMobile, height) => {
    detail.card_check = clone(contract.card_check_other_card);
    openImport(detail.id, { isMobile });
    await screen.findByRole("heading", { name: "Confirmar compras encontradas" });

    expect(screen.getAllByRole("button", { name: "Confirmar sugestão" })[0].style.minHeight).toBe(height);
    expect(screen.getByRole("button", { name: "Descartar rascunho" }).style.minHeight).toBe(height);
    expect(screen.getByRole("button", { name: `Conciliar no cartão ${contract.card_check_other_card.suggested_card.name}` }).style.minHeight).toBe(height);
    expect(screen.getByRole("button", { name: "escolha outro cartão" }).style.minHeight).toBe(height);
  });

  it.each([[false, ""], [true, "44px"]])("os botões de Faturas conciliadas e da concluída têm 44 px só no celular (mobile=%s → %s)", async (isMobile, height) => {
    const [draftRow, , concludedRow] = await openUpload({ isMobile });
    expect(within(draftRow).getByRole("button", { name: "Continuar conciliação" }).style.minHeight).toBe(height);
    expect(within(draftRow).getByRole("button", { name: "Descartar rascunho" }).style.minHeight).toBe(height);
    expect(within(concludedRow).getByRole("button", { name: "Desfazer conciliação" }).style.minHeight).toBe(height);
    cleanup();

    detail = clone(contract.concluded);
    openImport(detail.id, { isMobile });
    expect((await screen.findByRole("button", { name: "Desfazer conciliação" })).style.minHeight).toBe(height);
  });

  it("varredura: no celular nenhum controle do fluxo da fatura fica abaixo de 44 px", async () => {
    const found = {};
    await openUpload({ isMobile: true });
    found.upload = smallTouchTargets(document.body);
    cleanup();

    detail.card_check = clone(contract.card_check_other_card);
    openImport(detail.id, { isMobile: true });
    await screen.findByRole("heading", { name: "Confirmar compras encontradas" });
    found.step1 = smallTouchTargets(document.body);
    cleanup();

    detail = clone(contract.concluded);
    openImport(detail.id, { isMobile: true });
    await screen.findByRole("button", { name: "Desfazer conciliação" });
    found.concluded = smallTouchTargets(document.body);
    cleanup();

    detail = clone(contract.undone);
    openImport(detail.id, { isMobile: true });
    await screen.findByTestId("invoice-import-undone");
    found.undone = smallTouchTargets(document.body);

    expect(found).toEqual({ upload: [], step1: [], concluded: [], undone: [] });
  });

  it("no computador, o filtro Mostrar e o caminho ficam com a altura de antes", async () => {
    openImport(detail.id);
    await screen.findByRole("heading", { name: "Confirmar compras encontradas" });
    expect(within(screen.getByRole("group", { name: "Mostrar:" })).getByRole("button", { name: /^Falta responder/ }).style.minHeight).toBe("28px");
    expect(screen.getByRole("button", { name: "Cartões" }).style.minHeight).toBe("");
    expect(screen.getByRole("button", { name: "Fatura de dezembro" }).style.minHeight).toBe("");
  });
});
