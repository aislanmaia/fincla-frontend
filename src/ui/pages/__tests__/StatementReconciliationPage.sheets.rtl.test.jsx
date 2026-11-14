/** @vitest-environment jsdom */
// Conciliar extrato em planilha (fincla-api#515): "indique as colunas" e o aviso "parece ser de
// outra conta". Alimentado pela fixture canônica do backend (`statement_import.example.json`):
// `column_mapping_required` é o corpo do 422 de uma planilha não reconhecida.
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

const uploads = [];
let draft = clone(contract.draft);
// What POST answers, in order; the last one repeats.
let answers = [];
const needsMapping = () => HttpResponse.json({ detail: clone(contract.column_mapping_required) }, { status: 422 });

const server = setupServer(
  http.get("*/v1/accounts", () =>
    HttpResponse.json([{ id: ACCOUNT, name: "Nubank", type: "checking", currency: "BRL", is_active: true, initial_balance: { amount: "0.00", currency: "BRL" } }]),
  ),
  http.get("*/v1/tags", () => HttpResponse.json({ tags: [] })),
  http.get(`${BASE}/${IMPORT}`, () => HttpResponse.json(draft)),
  http.get(BASE, () => HttpResponse.json({ imports: [] })),
  http.patch(`${BASE}/${IMPORT}`, () => HttpResponse.json(draft)),
  http.post(BASE, async ({ request }) => {
    const form = await request.formData();
    const mapping = form.get("column_mapping");
    uploads.push({ file: form.get("file") ? "file" : null, column_mapping: mapping ? JSON.parse(mapping) : null });
    const answer = answers.length > 1 ? answers.shift() : answers[0];
    return answer ? answer() : HttpResponse.json(draft, { status: 201 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  uploads.length = 0;
  answers = [];
  draft = clone(contract.draft);
  server.resetHandlers();
  navigate.mockReset();
});

const sendFile = async (user, name = "extrato.csv") => {
  params = { accountId: ACCOUNT };
  render(<StatementReconciliationPage organizationId={ORG} />);
  await user.upload(await screen.findByLabelText(/Arquivo do extrato/), new File(["x"], name));
  await user.click(screen.getByRole("button", { name: "Enviar extrato" }));
};

describe("formatos aceitos", () => {
  it("o seletor aceita OFX, XLS, XLSX e CSV", async () => {
    params = { accountId: ACCOUNT };
    render(<StatementReconciliationPage organizationId={ORG} />);

    const input = await screen.findByLabelText(/Arquivo do extrato \(OFX, XLS, XLSX ou CSV/);
    for (const ext of [".ofx", ".xls", ".xlsx", ".csv"]) expect(input.getAttribute("accept")).toContain(ext);
  });

  it("um XLS reconhecido vai direto para o rascunho, sem pedir colunas", async () => {
    const user = userEvent.setup();
    await sendFile(user, "Extrato Conta Corrente.xls");

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${IMPORT}` }));
    expect(uploads).toEqual([{ file: "file", column_mapping: null }]);
    expect(screen.queryByText("Indique as colunas")).not.toBeInTheDocument();
  });
});

describe("indique as colunas", () => {
  it("planilha não reconhecida mostra as primeiras linhas e pede data, descrição e valor", async () => {
    answers = [needsMapping];
    const user = userEvent.setup();
    await sendFile(user);

    const card = await screen.findByTestId("column-mapping");
    expect(within(card).getByText("Indique as colunas")).toBeInTheDocument();
    // A promessa da tela bate com o leitor (fincla-api G3-1-01): saldo do banco nunca vira lançamento.
    expect(card).toHaveTextContent("as linhas de saldo do banco (como “Saldo anterior” e “Saldo do dia”) nunca viram lançamento");
    expect(card).not.toHaveTextContent("saldos) ficam de fora");
    expect(within(card).getByText(/extrato\.csv/)).toBeInTheDocument();
    const table = within(card).getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["A · Data", "B · Descrição", "C", "D · Valor", "E"]);
    expect(within(table).getByText("Compra cartão débito MERCADO EXEMPLO")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("o mapeamento lembrado vem pré-selecionado e reenvia o mesmo arquivo com as colunas", async () => {
    answers = [needsMapping, () => HttpResponse.json(draft, { status: 201 })];
    const user = userEvent.setup();
    await sendFile(user);
    await screen.findByTestId("column-mapping");

    expect(screen.getByLabelText("Coluna da data")).toHaveValue("0");
    expect(screen.getByLabelText("Coluna da descrição")).toHaveValue("1");
    expect(screen.getByLabelText("Coluna do valor")).toHaveValue("3");
    await user.click(screen.getByRole("button", { name: "Ler o extrato com estas colunas" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${IMPORT}` }));
    expect(uploads).toEqual([
      { file: "file", column_mapping: null },
      { file: "file", column_mapping: { date: 0, description: 1, amount: 3 } },
    ]);
  });

  it("sem sugestão, só deixa ler depois de três colunas diferentes", async () => {
    const withoutSuggestion = () => {
      const body = clone(contract.column_mapping_required);
      body.preview.suggested_mapping = null;
      return HttpResponse.json({ detail: body }, { status: 422 });
    };
    answers = [withoutSuggestion, () => HttpResponse.json(draft, { status: 201 })];
    const user = userEvent.setup();
    await sendFile(user);
    await screen.findByTestId("column-mapping");
    const read = screen.getByRole("button", { name: "Ler o extrato com estas colunas" });

    expect(read).toBeDisabled();
    expect(screen.getByText("Escolha uma coluna para a data, a descrição e o valor.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Coluna da data"), "0");
    await user.selectOptions(screen.getByLabelText("Coluna da descrição"), "0");
    await user.selectOptions(screen.getByLabelText("Coluna do valor"), "3");
    expect(read).toBeDisabled();
    expect(screen.getByText("Cada informação precisa de uma coluna diferente.")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Coluna da descrição"), "1");
    expect(read).toBeEnabled();
    await user.click(read);

    await waitFor(() => expect(uploads[1]).toEqual({ file: "file", column_mapping: { date: 0, description: 1, amount: 3 } }));
  });

  it("colunas sem nenhum lançamento: mostra o motivo e continua na escolha", async () => {
    const refused = () =>
      HttpResponse.json(
        { detail: { code: "business_rule", message: "Nenhuma linha tem data e valor nas colunas indicadas. Confira as colunas escolhidas." } },
        { status: 422 },
      );
    answers = [needsMapping, refused];
    const user = userEvent.setup();
    await sendFile(user);
    await screen.findByTestId("column-mapping");

    await user.click(screen.getByRole("button", { name: "Ler o extrato com estas colunas" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhuma linha tem data e valor nas colunas indicadas");
    expect(screen.getByTestId("column-mapping")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("Escolher outro arquivo volta ao envio", async () => {
    answers = [needsMapping];
    const user = userEvent.setup();
    await sendFile(user);
    await screen.findByTestId("column-mapping");

    await user.click(screen.getByRole("button", { name: "Escolher outro arquivo" }));

    expect(screen.queryByTestId("column-mapping")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Arquivo do extrato/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar extrato" })).toBeDisabled();
  });
});

describe("parece ser de outra conta", () => {
  const openDraft = async () => {
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);
    await screen.findAllByText("PIX QRS PADARIA 02 10");
  };

  it("avisa sem bloquear e sugere a conta certa", async () => {
    const user = userEvent.setup();
    await openDraft();

    const notice = screen.getByTestId("other-account-notice");
    expect(notice).toHaveTextContent("Este extrato parece ser de outra conta.");
    expect(notice).toHaveTextContent("Pelo arquivo, ele é da conta Itaú");
    expect(notice).toHaveTextContent("nada impede a conciliação");
    // The guided review is still there: nothing blocked.
    expect(screen.getByRole("navigation", { name: "Passos da conciliação" })).toBeInTheDocument();

    await user.click(within(notice).getByRole("button", { name: "Conciliar na conta Itaú" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${contract.draft.account_check.suggested_account.id}/reconcile` });
  });

  it("sem conta sugerida, avisa sem oferecer outra", async () => {
    draft.account_check = { status: "other_account", suggested_account: null };
    await openDraft();

    const notice = screen.getByTestId("other-account-notice");
    expect(notice).toHaveTextContent("Este extrato parece ser de outra conta.");
    expect(within(notice).queryByRole("button")).not.toBeInTheDocument();
  });

  it.each(["same_account", "first_time", "not_identified"])("com %s não há aviso", async (status) => {
    draft.account_check = { status, suggested_account: null };
    await openDraft();

    expect(screen.queryByTestId("other-account-notice")).not.toBeInTheDocument();
  });
});
