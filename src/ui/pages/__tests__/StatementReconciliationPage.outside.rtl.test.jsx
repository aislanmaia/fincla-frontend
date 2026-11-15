/** @vitest-environment jsdom */
// Conciliar extrato, "Ver o que fica de fora" e o mesmo arquivo de novo (fincla-api#516).
// A página é alimentada pela fixture canônica do backend (`outside_draft` e `draft_in_progress`
// de `statement_import.example.json`). A gravação é garantida pelos testes de API; aqui
// conferimos o que a pessoa vê e o que a tela manda.
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
const ACCOUNT = contract.outside_draft.account_id;
const IMPORT = contract.outside_draft.id;
const BASE = `*/v1/accounts/${ACCOUNT}/statement-imports`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const [EARLY, BROUGHT_BACK, RECONCILED, ZERO, NEW] = contract.outside_draft.entries;

const CATEGORIES = [
  { id: "cat-food", name: "Food", label: "Alimentação", tag_type: { name: "categoria" }, is_active: true, is_fallback: false, allowed_transaction_types: ["expense"] },
  { id: "cat-unclassified", name: "Unclassified", label: "Não classificado", tag_type: { name: "categoria" }, is_active: true, is_fallback: true, allowed_transaction_types: ["income", "expense"] },
];

const calls = [];
let draft = clone(contract.outside_draft);
let uploadAnswer = null;

/** O backend recalcula as contagens; aqui o mínimo para a tela mostrar o que mudou. */
const recount = (d) => {
  const before = d.entries.filter((e) => e.classification === "before_start" && e.answer === "ignore").length;
  const ignored = d.entries.filter((e) => e.answer === "ignore").length;
  const toCreate = d.entries.filter((e) => e.answer === "create").length;
  d.summary = { ...d.summary, ignored, to_create: toCreate, left_out_before_start: before };
};

const server = setupServer(
  http.get("*/v1/users/me/preferences", () => HttpResponse.json({ statement_reconciliation_view: "detailed" })),
  http.get("*/v1/accounts", () =>
    HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true, initial_balance: { amount: "0.00", currency: "BRL" } }]),
  ),
  http.get("*/v1/tags", () => HttpResponse.json({ tags: CATEGORIES })),
  http.get(`${BASE}/${IMPORT}`, () => HttpResponse.json(draft)),
  http.get(BASE, () => HttpResponse.json({ imports: [] })),
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
    Object.assign(entry, body);
    recount(draft);
    return HttpResponse.json(entry);
  }),
  http.post(BASE, () => {
    calls.push({ upload: true });
    return uploadAnswer();
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  draft = clone(contract.outside_draft);
  uploadAnswer = null;
  server.resetHandlers();
  navigate.mockReset();
});

const openDraft = async () => {
  params = { accountId: ACCOUNT, importId: IMPORT };
  render(<StatementReconciliationPage organizationId={ORG} />);
  // O rascunho do exemplo parou em "Ver o que fica de fora".
  await screen.findByRole("heading", { name: "Ver o que fica de fora" });
};

describe("Ver o que fica de fora", () => {
  it("mostra as seções recolhidas, com as contagens, e o trilho diz o que não vira transação", async () => {
    await openDraft();

    const reconciled = screen.getByRole("button", { name: /Já conferidos/ });
    const before = screen.getByRole("button", { name: /Antes do início da conta/ });
    expect(reconciled).toHaveAttribute("aria-expanded", "false");
    expect(reconciled).toHaveTextContent("Já conferidos1vieram de uma importação anterior; nada a fazer");
    expect(before).toHaveAttribute("aria-expanded", "false");
    expect(before).toHaveTextContent("Antes do início da conta2a conta começa em 08/09/2026 no Fincla; ficam de fora");
    // Recolhidas: nada das linhas aparece antes de abrir.
    expect(screen.queryByTestId("reconciled-entry")).not.toBeInTheDocument();
    expect(screen.queryByTestId("before-start-entry")).not.toBeInTheDocument();
    // Valor zero continua à vista, como antes.
    expect(screen.getByTestId("left-out-entry")).toHaveTextContent("TARIFA ISENTA");

    const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });
    // Fora: o já conferido, o anterior que ficou fora e o de valor zero; o trazido de volta vira transação.
    expect(within(rail).getAllByRole("button")[5]).toHaveTextContent(
      "Nada a fazer · 3 não viram transação · 1 trazido de volta",
    );
  });

  it("o progresso no topo concorda no singular: 1 já conferido antes (G3-3-04)", async () => {
    await openDraft();

    const bar = screen.getByTestId("status-bar");
    expect(bar).toHaveTextContent("1 já conferido antes ·");
    expect(bar).not.toHaveTextContent("1 já conferidos");
  });

  it("já conferido mostra com qual transação do Fincla, sem nada a responder", async () => {
    await openDraft();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Já conferidos/ }));

    const row = screen.getByTestId("reconciled-entry");
    expect(row).toHaveTextContent(RECONCILED.bank_description);
    expect(row).toHaveTextContent("10/09/2026");
    expect(row).toHaveTextContent("Já conferida com Salário");
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Já conferidos/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("já conferido com uma transferência entre contas diz que é a transferência", async () => {
    const reconciled = draft.entries.find((e) => e.id === RECONCILED.id);
    reconciled.fincla_transaction = null;
    reconciled.paired_transaction_id = null;
    reconciled.paired_transfer_id = "t-1";
    reconciled.fincla_match = { ...reconciled.fincla_match, kind: "transfer", transaction_id: null, transfer_id: "t-1", description: "Reserva" };
    await openDraft();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Já conferidos/ }));

    expect(screen.getByTestId("reconciled-entry")).toHaveTextContent("Já conferida com a transferência “Reserva”");
  });

  it("Trazer de volta marca para adicionar, abre o cartão e Desfazer devolve para fora", async () => {
    await openDraft();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Antes do início da conta/ }));

    expect(screen.getByRole("note")).toHaveTextContent("O saldo inicial da conta no Fincla já inclui esses movimentos");
    // O já trazido de volta aparece como cartão de lançamento novo; o outro, minimizado com o botão.
    expect(screen.getByRole("article", { name: `Lançamento ${BROUGHT_BACK.bank_description}` })).toBeInTheDocument();
    const early = screen.getByTestId("before-start-entry");
    expect(early).toHaveTextContent(EARLY.bank_description);
    expect(early).toHaveTextContent("Fica de fora");

    await user.click(within(early).getByRole("button", { name: "Trazer de volta" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: EARLY.id, body: { answer: "create" } }));
    expect(await screen.findByRole("article", { name: `Lançamento ${EARLY.bank_description}` })).toBeInTheDocument();
    expect(screen.queryByTestId("before-start-entry")).not.toBeInTheDocument();
    const bar = screen.getByTestId("brought-back-bar");
    expect(bar).toHaveTextContent(`“${EARLY.bank_description}” trazido de volta: entra no Fincla ao concluir.`);

    await user.click(within(bar).getByRole("button", { name: "Desfazer" }));

    // Volta exatamente ao que era: "Não registrar" e o "confirmado" de antes.
    await waitFor(() => expect(calls).toContainEqual({ patch: EARLY.id, body: { answer: "ignore", confirmed: false } }));
    expect(await screen.findByTestId("before-start-entry")).toHaveTextContent(EARLY.bank_description);
    expect(screen.queryByTestId("brought-back-bar")).not.toBeInTheDocument();
  });

  it("Não registrar no cartão trazido de volta o devolve para fora", async () => {
    await openDraft();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Antes do início da conta/ }));
    const card = screen.getByRole("article", { name: `Lançamento ${BROUGHT_BACK.bank_description}` });

    await user.click(within(card).getByRole("button", { name: /Não registrar/ }));

    await waitFor(() => expect(calls).toContainEqual({ patch: BROUGHT_BACK.id, body: { answer: "ignore" } }));
    await waitFor(() => expect(screen.getAllByTestId("before-start-entry")).toHaveLength(2));
  });

  it("antes do último ajuste de saldo diz que é o ajuste que já inclui os movimentos", async () => {
    draft.left_out = { before: "2026-09-09", reason: "balance_adjustment" };
    await openDraft();
    const user = userEvent.setup();

    const toggle = screen.getByRole("button", { name: /Antes do último ajuste de saldo/ });
    expect(toggle).toHaveTextContent("o saldo da conta conta a partir de 09/09/2026; ficam de fora");
    await user.click(toggle);

    expect(screen.getByRole("note")).toHaveTextContent("O ajuste de saldo que você fez já inclui esses movimentos");
  });

  it("sem nada fora, diz que nada fica de fora", async () => {
    draft.entries = [NEW];
    draft.summary = { ...draft.summary, total: 1, to_create: 1, ignored: 0, already_reconciled: 0, left_out_before_start: 0 };
    await openDraft();

    expect(screen.getByText(/Nada fica de fora neste extrato/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Já conferidos/ })).not.toBeInTheDocument();
  });

  it("o resumo conta os já conferidos e os que ficaram fora antes do início", async () => {
    await openDraft();
    const user = userEvent.setup();
    const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });

    await user.click(within(rail).getAllByRole("button")[7]);

    expect(screen.getByTestId("summary-already-reconciled")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-ignored")).toHaveTextContent("2");
    expect(screen.getByText(/1 antes do início/)).toBeInTheDocument();
    expect(ZERO.answer).toBe("ignore");
  });
});

describe("o mesmo arquivo de novo", () => {
  it("avisa que o arquivo já foi importado e leva a Ver o que fica de fora", async () => {
    draft.current_step = "new";
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);
    const user = userEvent.setup();

    const notice = await screen.findByTestId("file-already-imported");
    expect(notice).toHaveTextContent("Este arquivo já foi importado em 02/11/2026.");
    expect(notice).toHaveTextContent("Os lançamentos que já foram conferidos aparecem recolhidos em “Ver o que fica de fora”");

    await user.click(within(notice).getByRole("button", { name: "Ver o que fica de fora" }));

    expect(screen.getByRole("heading", { name: "Ver o que fica de fora" })).toBeInTheDocument();
  });

  it("importado em outra conta, nomeia a conta e não manda para fora", async () => {
    draft.file_check = { ...draft.file_check, account_id: "outra", account_name: "Nubank" };
    await openDraft();

    const notice = screen.getByTestId("file-already-imported");
    expect(notice).toHaveTextContent("Este arquivo já foi importado em 02/11/2026 na conta Nubank. Se ele é mesmo desta conta, pode seguir.");
    expect(within(notice).queryByRole("button")).not.toBeInTheDocument();
  });

  it("arquivo novo não mostra aviso", async () => {
    draft.file_check = clone(contract.draft.file_check);
    await openDraft();

    expect(screen.queryByTestId("file-already-imported")).not.toBeInTheDocument();
  });

  it("com conciliação do mesmo arquivo em andamento, oferece continuar nela", async () => {
    uploadAnswer = () => HttpResponse.json({ detail: contract.draft_in_progress }, { status: 409 });
    params = { accountId: ACCOUNT };
    const user = userEvent.setup();
    render(<StatementReconciliationPage organizationId={ORG} />);

    await user.upload(await screen.findByLabelText(/Arquivo do extrato/), new File(["<OFX>"], "extrato.ofx", { type: "application/x-ofx" }));
    await user.click(screen.getByRole("button", { name: "Enviar extrato" }));

    const notice = await screen.findByTestId("draft-in-progress-notice");
    expect(notice).toHaveTextContent(contract.draft_in_progress.message);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(within(notice).getByRole("button", { name: "Continuar conciliação" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${contract.draft_in_progress.import_id}` });
  });
});
