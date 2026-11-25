/** @vitest-environment jsdom */
// Desfazer conciliação da fatura (fincla-api#556), alimentada pela fixture de contrato
// (`undo_preview`, `undo_preview_refused`, `undone`). Que o desfazer volta o Fincla exatamente ao que
// era é garantido pelos testes de API; aqui: a prévia ("Editada depois", o valor que volta, a marca de
// conferida que sai), nada desfeito sem confirmar NA PÁGINA, as recusas escritas (a mais recente do
// cartão, a fatura já paga) e o fim.
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
import { CardInvoiceUndoPage } from "../CardInvoiceUndoPage.jsx";

const ORG = "org";
const CARD = contract.concluded.credit_card;
const IMPORT = contract.undo_preview.import_id;
const BASE = `*/v1/credit-cards/${CARD.id}/invoice-imports/${IMPORT}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const PAID = "Esta fatura já foi paga. Para desfazer a conciliação, desmarque o pagamento e volte aqui.";

const calls = [];
let preview = clone(contract.undo_preview);
let undoResponse = null;
const server = setupServer(
  http.get("*/v1/credit-cards", () => HttpResponse.json([{ id: CARD.id, public_id: CARD.public_id, description: CARD.name, brand: "Visa", last4: CARD.last4 }])),
  http.get(`${BASE}/undo-preview`, () => {
    calls.push({ preview: IMPORT });
    return HttpResponse.json(preview);
  }),
  http.post(`${BASE}/undo`, () => {
    calls.push({ undo: IMPORT });
    if (undoResponse) return undoResponse();
    return HttpResponse.json(contract.undone);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  preview = clone(contract.undo_preview);
  undoResponse = null;
  server.resetHandlers();
  navigate.mockReset();
});

const open = (props = {}) => {
  params = { cardId: CARD.public_id, importId: IMPORT };
  render(<CardInvoiceUndoPage organizationId={ORG} {...props} />);
};

describe("a prévia", () => {
  it("diz o que volta: as compras ligadas voltam e deixam de estar conferidas, o valor do banco volta, Editada depois", async () => {
    open();
    expect(await screen.findByText("Se você desfizer esta conciliação:")).toBeInTheDocument();

    expect(screen.getByTestId("undo-restore-count")).toHaveTextContent(
      "4 transações que já estavam no Fincla voltam ao estado de antes da conciliação e deixam de estar conferidas",
    );
    // As compras novas que a conclusão criou (#557) são apagadas.
    expect(screen.getByTestId("undo-delete-count")).toHaveTextContent("5 transações adicionadas serão apagadas");
    const restored = screen.getAllByTestId("undo-restored");
    expect(restored).toHaveLength(4);
    const loja = restored.find((r) => r.textContent.includes("Loja (presente)"));
    expect(within(loja).getByText("Editada depois: descrição")).toBeInTheDocument();
    expect(loja).toHaveTextContent("Volta só o que a conciliação mudou; o que você editou depois continua como está.");
    expect(within(loja).getByTestId("undo-value-back")).toHaveTextContent("O valor volta a R$ 108,33 (a conciliação tinha posto o valor do banco).");
    const mercado = restored.find((r) => r.textContent.includes("Mercado"));
    expect(mercado).toHaveTextContent("Volta ao que era antes da conciliação.");
    expect(within(mercado).queryByText(/Editada depois/)).not.toBeInTheDocument();
    expect(screen.getByText(/Só a conciliação de fatura concluída mais recente do cartão pode ser desfeita/)).toBeInTheDocument();
    expect(calls).toEqual([{ preview: IMPORT }]);
  });

  it("o que a pessoa mudou de novo fica como ela deixou (kept_fields), sem valor que volta", async () => {
    preview.to_restore[2] = { ...preview.to_restore[2], edited_after: true, changed_fields: ["value"], kept_fields: ["value"], value_back: null };
    open();

    const loja = (await screen.findAllByTestId("undo-restored"))[2];
    expect(within(loja).getByTestId("undo-kept")).toHaveTextContent("Você mudou de novo depois: fica como você deixou (valor).");
    expect(within(loja).queryByTestId("undo-value-back")).not.toBeInTheDocument();
  });
});

describe("desfazer", () => {
  it("só desfaz depois do Sim na página, e mostra o fim", async () => {
    const onUndone = vi.fn();
    const user = userEvent.setup();
    open({ onUndone });

    await user.click(await screen.findByRole("button", { name: "Desfazer conciliação" }));
    expect(calls).not.toContainEqual({ undo: IMPORT });
    const confirm = screen.getByRole("group", { name: "Confirmar desfazer conciliação" });
    expect(confirm).toHaveTextContent("Tem certeza? As 5 transações adicionadas serão apagadas.");
    await user.click(within(confirm).getByRole("button", { name: "Sim, desfazer conciliação" }));

    expect(await screen.findByRole("heading", { name: "Conciliação desfeita" })).toBeInTheDocument();
    expect(screen.getByText(/5 transações adicionadas foram apagadas\. .*voltaram ao que eram antes: o valor de antes e sem a marca de conferida/)).toBeInTheDocument();
    expect(calls).toContainEqual({ undo: IMPORT });
    expect(onUndone).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Conciliar a fatura de novo" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/reconcile` });
  });

  it("Cancelar fecha a confirmação sem desfazer; Voltar para a conciliação abre a concluída", async () => {
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole("button", { name: "Desfazer conciliação" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("group", { name: "Confirmar desfazer conciliação" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voltar para a conciliação" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/cards/${CARD.public_id}/reconcile/${IMPORT}` });
    expect(calls).not.toContainEqual({ undo: IMPORT });
  });

  it("recusado pelo servidor (a fatura foi paga noutra aba): o motivo aparece e a prévia é buscada de novo", async () => {
    undoResponse = () => HttpResponse.json({ detail: { code: "business_rule", message: PAID } }, { status: 422 });
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole("button", { name: "Desfazer conciliação" }));
    preview = { ...clone(contract.undo_preview), can_undo: false, refusal: { code: "invoice_paid", message: PAID } };
    await user.click(screen.getByRole("button", { name: "Sim, desfazer conciliação" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(PAID);
    await waitFor(() => expect(screen.getByTestId("undo-refusal")).toHaveAttribute("data-code", "invoice_paid"));
    expect(calls.filter((c) => c.preview)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Desfazer conciliação" })).not.toBeInTheDocument();
  });
});

describe("trocar de conciliação na mesma rota", () => {
  it("de A para B: a confirmação aberta de A não passa para B, e B carrega a própria prévia", async () => {
    const OTHER = "other-import";
    server.use(http.get(`*/v1/credit-cards/${CARD.id}/invoice-imports/${OTHER}/undo-preview`, () => {
      calls.push({ preview: OTHER });
      return HttpResponse.json({ ...clone(contract.undo_preview), import_id: OTHER });
    }));
    const user = userEvent.setup();
    params = { cardId: CARD.public_id, importId: IMPORT };
    const { rerender } = render(<CardInvoiceUndoPage organizationId={ORG} />);
    await user.click(await screen.findByRole("button", { name: "Desfazer conciliação" }));
    expect(screen.getByRole("group", { name: "Confirmar desfazer conciliação" })).toBeInTheDocument();

    params = { cardId: CARD.public_id, importId: OTHER };
    rerender(<CardInvoiceUndoPage organizationId={ORG} />);

    expect(await screen.findByRole("button", { name: "Desfazer conciliação" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Confirmar desfazer conciliação" })).not.toBeInTheDocument();
    expect(calls).toContainEqual({ preview: OTHER });
  });

  it("de A desfeita para B: o fim de A não aparece em B", async () => {
    const OTHER = "other-import";
    server.use(http.get(`*/v1/credit-cards/${CARD.id}/invoice-imports/${OTHER}/undo-preview`, () => HttpResponse.json({ ...clone(contract.undo_preview), import_id: OTHER })));
    const user = userEvent.setup();
    params = { cardId: CARD.public_id, importId: IMPORT };
    const { rerender } = render(<CardInvoiceUndoPage organizationId={ORG} />);
    await user.click(await screen.findByRole("button", { name: "Desfazer conciliação" }));
    await user.click(screen.getByRole("button", { name: "Sim, desfazer conciliação" }));
    expect(await screen.findByRole("heading", { name: "Conciliação desfeita" })).toBeInTheDocument();

    params = { cardId: CARD.public_id, importId: OTHER };
    rerender(<CardInvoiceUndoPage organizationId={ORG} />);

    expect(await screen.findByText("Se você desfizer esta conciliação:")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Conciliação desfeita" })).not.toBeInTheDocument();
  });
});

describe("recusas", () => {
  it("não é a mais recente do cartão: o motivo no lugar do botão, e o que ela fez", async () => {
    preview = clone(contract.undo_preview_refused);
    open();

    const refusal = await screen.findByTestId("undo-refusal");
    expect(refusal).toHaveTextContent(`Não dá para desfazer esta conciliação. ${contract.undo_preview_refused.refusal.message}`);
    expect(screen.getByText("O que esta conciliação fez:")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desfazer conciliação" })).not.toBeInTheDocument();
  });

  it("fatura já paga (decisão 8): recusa com o motivo", async () => {
    preview = { ...clone(contract.undo_preview), can_undo: false, refusal: { code: "invoice_paid", message: PAID } };
    open();

    expect(await screen.findByTestId("undo-refusal")).toHaveTextContent(`Não dá para desfazer esta conciliação. ${PAID}`);
    expect(screen.queryByRole("button", { name: "Desfazer conciliação" })).not.toBeInTheDocument();
  });

  it("já desfeita: mostra o fim, sem botão de desfazer", async () => {
    preview = { ...clone(contract.undo_preview), can_undo: false, refusal: { code: "already_undone", message: "Já desfeita." } };
    open();

    expect(await screen.findByRole("heading", { name: "Conciliação desfeita" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desfazer conciliação" })).not.toBeInTheDocument();
  });
});

it.each([[false, ""], [true, "44px"]])("os botões têm 44 px só no celular (mobile=%s → %s)", async (isMobile, height) => {
  const user = userEvent.setup();
  open({ isMobile });

  const undo = await screen.findByRole("button", { name: "Desfazer conciliação" });
  expect(undo.style.minHeight).toBe(height);
  expect(screen.getByRole("button", { name: "Voltar para a conciliação" }).style.minHeight).toBe(height);
  await user.click(undo);
  expect(screen.getByRole("button", { name: "Sim, desfazer conciliação" }).style.minHeight).toBe(height);
});

describe("varredura de alvos de toque no celular (QA F2 BUG-01)", () => {
  it("nenhum controle da prévia nem da confirmação fica abaixo de 44 px", async () => {
    const user = userEvent.setup();
    open({ isMobile: true });
    await screen.findByText("Se você desfizer esta conciliação:");
    expect(smallTouchTargets(document.body)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Desfazer conciliação" }));
    expect(smallTouchTargets(document.body)).toEqual([]);
  });
});
