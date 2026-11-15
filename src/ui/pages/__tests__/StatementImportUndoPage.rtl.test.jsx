/** @vitest-environment jsdom */
// Desfazer importação (fincla-api#509). A página é alimentada pela fixture canônica do backend
// (`undo_preview` / `undo_refused` de `statement_import.example.json`). Que o desfazer devolve o
// Fincla ao estado anterior é garantido pelos testes de API; aqui conferimos o que a pessoa vê
// antes de decidir, que nada é desfeito sem confirmar NA PÁGINA, e o que a tela manda.
import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import contract from "../../../api/__fixtures__/statement_import.example.json";

const navigate = vi.fn();
let params = {};
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate, useParams: () => params }));
import { StatementImportUndoPage } from "../StatementImportUndoPage.jsx";

const ORG = "org";
const ACCOUNT = contract.draft.account_id;
const IMPORT = contract.draft.id;
const BASE = `*/v1/accounts/${ACCOUNT}/statement-imports/${IMPORT}`;
const clone = (value) => JSON.parse(JSON.stringify(value));

const calls = [];
let preview = clone(contract.undo_preview);
let undoResponse = null;
const server = setupServer(
  http.get("*/v1/accounts", () =>
    HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true, initial_balance: { amount: "0.00", currency: "BRL" } }]),
  ),
  http.get(`${BASE}/undo-preview`, () => {
    calls.push({ preview: IMPORT });
    return HttpResponse.json(preview);
  }),
  http.post(`${BASE}/undo`, () => {
    calls.push({ undo: IMPORT });
    if (undoResponse) return undoResponse();
    return HttpResponse.json({ ...clone(contract.undone), deleted_transactions: 2 });
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

const open = async (props = {}) => {
  params = { accountId: ACCOUNT, importId: IMPORT };
  render(<StatementImportUndoPage organizationId={ORG} {...props} />);
  await screen.findByText("Se você desfizer esta importação:");
};

describe("prévia", () => {
  it("diz quantas transações serão apagadas e quais foram editadas depois, com o que mudou", async () => {
    await open();

    expect(screen.getByTestId("undo-delete-count")).toHaveTextContent(
      "2 transações adicionadas serão apagadas (1 editada depois da conciliação — essa também some)",
    );
    expect(screen.getByTestId("undo-already-deleted")).toHaveTextContent("1 transação da conciliação já foi excluída por você: nada a fazer com ela");
    const rows = screen.getAllByTestId("undo-transaction");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("02/10/2026 · Padaria"),
      expect.stringContaining("07/10/2026 · PAG BOLETO ENERGIA"),
    ]);
    expect(within(rows[0]).getByText("Editada depois: descrição, categoria ou etiquetas")).toBeInTheDocument();
    expect(within(rows[1]).queryByText(/Editada depois/)).not.toBeInTheDocument();
    expect(rows[1]).toHaveTextContent(/−R\$\s120,00/);
    expect(calls).toEqual([{ preview: IMPORT }]);
  });

  it("a transação pareada que volta mostra o que foi editado depois e o que fica como a pessoa deixou (G3-2-01)", async () => {
    await open();

    expect(screen.getByTestId("undo-restore-count")).toHaveTextContent("2 transações que já estavam no Fincla voltam ao estado de antes da conciliação");
    const [restored] = screen.getAllByTestId("undo-restored");
    expect(restored).toHaveTextContent("Aluguel de outubro");
    expect(within(restored).getByText("Editada depois: descrição, data de pagamento")).toBeInTheDocument();
    expect(restored).toHaveTextContent("Volta só o que a conciliação mudou; o que você editou depois continua como está.");
    expect(within(restored).getByTestId("undo-kept")).toHaveTextContent("Você mudou de novo depois: fica como você deixou (situação, data de pagamento).");
    // Aviso, não recusa: o botão continua lá.
    expect(screen.getByRole("button", { name: "Desfazer importação" })).toBeInTheDocument();
  });

  it("a transação excluída na conferência de saldo volta a existir, contada à parte (fincla-api#514)", async () => {
    await open();

    expect(screen.getByTestId("undo-recreated-count")).toHaveTextContent("1 transação excluída na conferência de saldo volta a existir");
    const recreated = screen.getAllByTestId("undo-restored").find((r) => r.textContent.includes("2ª parcela salário"));
    expect(recreated).toHaveTextContent("Volta a existir como era antes da conciliação.");
  });

  it("a transação com a data mudada na conferência diz para que dia a data volta (G3-3-06)", async () => {
    await open();

    const moved = screen.getAllByTestId("undo-restored").find((r) => r.textContent.includes("Conta de luz"));
    expect(within(moved).getByTestId("undo-date-back")).toHaveTextContent("A data volta a 15/10 (a conciliação tinha mudado para 07/10).");
    // A pareada não muda de data: nada sobre data.
    const paired = screen.getAllByTestId("undo-restored").find((r) => r.textContent.includes("Aluguel de outubro"));
    expect(within(paired).queryByTestId("undo-date-back")).toBeNull();
  });

  it("as contagens do que volta vêm do backend, nunca de uma conta da tela (G3-3-13)", async () => {
    preview.summary = { ...preview.summary, restored_transactions: 1, recreated_transactions: 3 };
    await open();

    expect(screen.getByTestId("undo-restore-count")).toHaveTextContent("1 transação que já estava no Fincla volta ao estado de antes da conciliação");
    expect(screen.getByTestId("undo-recreated-count")).toHaveTextContent("3 transações excluídas na conferência de saldo voltam a existir");
    // A lista cobre transações e faturas: o nome diz isso.
    expect(screen.getByRole("list", { name: "O que volta ao estado de antes" })).toBeInTheDocument();
  });

  it("uma pareada sem edição depois só diz que volta ao que era", async () => {
    preview.to_restore = [{
      ...contract.undo_preview.to_restore[0], description: "Aluguel", edited_after: false, changed_fields: [], kept_fields: [], value_back: null, account_back: null,
    }];
    await open();

    const [restored] = screen.getAllByTestId("undo-restored");
    expect(restored.textContent).toBe("AluguelVolta ao que era antes da conciliação.");
  });

  it("a pareada com o valor do banco e trazida de outra conta diz o valor e a conta que voltam (fincla-api#511)", async () => {
    await open();

    const [restored] = screen.getAllByTestId("undo-restored");
    expect(within(restored).getByTestId("undo-value-back")).toHaveTextContent(
      "O valor volta a R$ 1.490,00 (a conciliação tinha posto o valor do banco).",
    );
    expect(within(restored).getByTestId("undo-account-back")).toHaveTextContent(
      "Volta para a conta Nubank (a conciliação a tinha movido para esta).",
    );
  });

  it("sem edições depois, não fala de editadas", async () => {
    preview.summary = { to_delete: 1, edited_after: 0, already_deleted: 0, to_restore: 0, restored_transactions: 0, recreated_transactions: 0, restored_invoices: 0 };
    preview.transactions_to_delete = [contract.undo_preview.transactions_to_delete[1]];
    await open();

    expect(screen.getByTestId("undo-delete-count")).toHaveTextContent(/^1 transação adicionada será apagada$/);
    expect(screen.queryByTestId("undo-already-deleted")).not.toBeInTheDocument();
  });
});

describe("confirmar na página", () => {
  it("nada é desfeito no primeiro clique: a confirmação aparece na própria página", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    await open();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Desfazer importação" }));

    const box = screen.getByRole("group", { name: "Confirmar desfazer importação" });
    expect(box).toHaveTextContent("As 2 transações adicionadas serão apagadas, inclusive as editadas depois.");
    expect(calls.some((c) => c.undo)).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("cancelar volta à prévia sem desfazer nada", async () => {
    await open();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Desfazer importação" }));

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("group", { name: "Confirmar desfazer importação" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desfazer importação" })).toBeInTheDocument();
    expect(calls.some((c) => c.undo)).toBe(false);
  });

  it("confirmado, desfaz, avisa a lista de transações e diz o que aconteceu", async () => {
    const onUndone = vi.fn();
    const onOpen = vi.fn();
    await open({ onUndone, onOpenAccountTransactions: onOpen });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Desfazer importação" }));

    await user.click(screen.getByRole("button", { name: "Sim, desfazer importação" }));

    expect(await screen.findByRole("heading", { name: "Importação desfeita" })).toBeInTheDocument();
    expect(screen.getByText(/2 transações adicionadas foram apagadas/)).toBeInTheDocument();
    expect(calls.filter((c) => c.undo)).toEqual([{ undo: IMPORT }]);
    expect(onUndone).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Ver transações da conta" }));
    expect(onOpen).toHaveBeenCalledWith(ACCOUNT);
  });

  it("diz quantas o backend apagou de fato, não a contagem da prévia carregada antes", async () => {
    // A prévia diz 2; outra aba excluiu uma antes de confirmar: o desfazer apagou só 1.
    undoResponse = () => HttpResponse.json(clone(contract.undone));
    await open();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Desfazer importação" }));

    await user.click(screen.getByRole("button", { name: "Sim, desfazer importação" }));

    expect(await screen.findByRole("heading", { name: "Importação desfeita" })).toBeInTheDocument();
    expect(contract.undone.deleted_transactions).toBe(1);
    expect(screen.getByText(/^1 transação adicionada foi apagada\./)).toBeInTheDocument();
    expect(screen.queryByText(/2 transações adicionadas foram apagadas/)).not.toBeInTheDocument();
  });

  it("se a pessoa sair da tela antes da nova prévia voltar, nada é atualizado na tela fechada", async () => {
    undoResponse = () => HttpResponse.json(
      { detail: { code: "business_rule", message: contract.undo_refused.refusal.message } },
      { status: 422 },
    );
    let release;
    await open();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Desfazer importação" }));
    server.use(http.get(`${BASE}/undo-preview`, async () => {
      await new Promise((resolve) => { release = resolve; });
      return HttpResponse.json(clone(contract.undo_refused));
    }));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    await user.click(screen.getByRole("button", { name: "Sim, desfazer importação" }));
    await screen.findByRole("alert");
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    cleanup();
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("se o backend recusar na hora, mostra o motivo e a prévia volta a valer", async () => {
    undoResponse = () => HttpResponse.json(
      { detail: { code: "business_rule", message: contract.undo_refused.refusal.message } },
      { status: 422 },
    );
    await open();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Desfazer importação" }));
    preview = clone(contract.undo_refused);

    await user.click(screen.getByRole("button", { name: "Sim, desfazer importação" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(contract.undo_refused.refusal.message);
    expect(await screen.findByTestId("undo-refusal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desfazer importação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Importação desfeita" })).not.toBeInTheDocument();
  });
});

describe("quando não dá para desfazer", () => {
  it("importação que não é a mais recente: mostra o motivo e o que ela fez, sem botão", async () => {
    preview = clone(contract.undo_refused);
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementImportUndoPage organizationId={ORG} />);

    const refusal = await screen.findByTestId("undo-refusal");
    expect(refusal).toHaveTextContent(contract.undo_refused.refusal.message);
    expect(screen.getByText("O que esta importação fez:")).toBeInTheDocument();
    expect(screen.getAllByTestId("undo-transaction")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Desfazer importação" })).not.toBeInTheDocument();
  });

  it("importação já desfeita: diz que já foi desfeita", async () => {
    preview = {
      ...clone(contract.undo_refused),
      refusal: { code: "already_undone", message: "Esta importação já foi desfeita." },
      summary: { to_delete: 0, edited_after: 0, already_deleted: 0, to_restore: 0, restored_transactions: 0, recreated_transactions: 0, restored_invoices: 0 },
      transactions_to_delete: [],
    };
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementImportUndoPage organizationId={ORG} />);

    expect(await screen.findByRole("heading", { name: "Importação desfeita" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desfazer importação" })).not.toBeInTheDocument();
  });

  it("importação de outra organização: mostra o erro da API", async () => {
    server.use(http.get(`${BASE}/undo-preview`, () =>
      HttpResponse.json({ detail: { code: "not_found", message: "Conciliação não encontrada nesta conta." } }, { status: 404 })));
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementImportUndoPage organizationId={ORG} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Conciliação não encontrada nesta conta.");
  });
});
