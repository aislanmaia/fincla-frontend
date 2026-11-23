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
let listAnswer = () => ({ imports: [] });

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
  http.get(BASE, () => HttpResponse.json(listAnswer())),
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
  listAnswer = () => ({ imports: [] });
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

    // Pela regra do saldo, o que vem antes do início não entra no saldo: trazer de volta não o desequilibra.
    expect(screen.getByRole("note").textContent).toBe(
      "O saldo inicial da conta no Fincla já inclui esses movimentos. Se você trouxer um de volta, ele entra no Fincla "
      + "como transação, mas não muda o saldo da conta nem a diferença de saldo: o saldo só soma o que acontece a partir "
      + "de 08/09/2026.",
    );
    expect(screen.getByRole("note")).not.toHaveTextContent("não bater");
    // O já trazido de volta (respondido, com descrição) aparece minimizado como "Conferido"; o
    // outro, minimizado com o "Trazer de volta".
    const done = screen.getByTestId("brought-back-entry");
    expect(done).toHaveTextContent(BROUGHT_BACK.bank_description);
    expect(within(done).getByTestId("conferido-badge")).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: `Lançamento ${BROUGHT_BACK.bank_description}` })).toBeNull();
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

  it("BUG-03: Não registrar no cartão trazido de volta mantém o formulário à vista, inerte e listrado, com Fica de fora", async () => {
    await openDraft();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Antes do início da conta/ }));
    await user.click(within(screen.getByTestId("before-start-entry")).getByRole("button", { name: "Trazer de volta" }));
    const card = await screen.findByRole("article", { name: `Lançamento ${EARLY.bank_description}` });

    await user.click(within(card).getByRole("button", { name: /Não registrar/ }));

    await waitFor(() => expect(calls).toContainEqual({ patch: EARLY.id, body: { answer: "ignore" } }));
    // O cartão não some: o lado do Fincla continua com o formulário, sem editar, listrado e com a nota.
    await waitFor(() => expect(within(card).getByRole("button", { name: /Não registrar/ })).toHaveAttribute("aria-pressed", "true"));
    expect(card).toBeInTheDocument();
    const side = within(card).getByTestId("new-side-skipped");
    expect(side.style.background).toContain("repeating-linear-gradient");
    expect(within(side).getByRole("group", { name: /sem uso: não registrar/ })).toBeDisabled();
    expect(within(side).getByLabelText("Descrição")).toBeDisabled();
    expect(within(card).getByTestId("skip-note")).toHaveTextContent("Fica de fora");
    expect(screen.queryByTestId("before-start-entry")).toBeNull();
    // Sem Confirmar num "Não registrar"; clicar de novo nele recolhe o cartão para fora.
    expect(within(card).queryByRole("button", { name: "Confirmar" })).toBeNull();
    await user.click(within(card).getByRole("button", { name: /Não registrar/ }));
    await waitFor(() => expect(screen.getAllByTestId("before-start-entry").map((r) => r.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining(EARLY.bank_description)]),
    ));
    expect(screen.queryByRole("article", { name: `Lançamento ${EARLY.bank_description}` })).toBeNull();
  });

  it("BUG-04: o trazido de volta tem Confirmar ao lado das respostas, desligado com a descrição vazia, e recolhe como Conferido", async () => {
    await openDraft();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Antes do início da conta/ }));
    await user.click(within(screen.getByTestId("before-start-entry")).getByRole("button", { name: "Trazer de volta" }));
    const card = await screen.findByRole("article", { name: `Lançamento ${EARLY.bank_description}` });

    const confirm = within(card).getByRole("button", { name: "Confirmar" });
    expect(confirm).toBeEnabled();
    const input = within(card).getByLabelText("Descrição");
    await user.clear(input);
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription("Escreva a descrição para confirmar.");
    await user.type(input, "Feira do bairro");
    expect(confirm).toBeEnabled();

    await user.click(confirm);

    await waitFor(() => expect(calls).toContainEqual({ patch: EARLY.id, body: { description: "Feira do bairro" } }));
    // Recolhe numa linha como a dos outros passos: "Conferido", "Alterar" e "Desfazer escolha".
    const row = await screen.findByText((_, el) => el?.dataset?.testid === "brought-back-entry" && el.textContent.includes(EARLY.bank_description));
    expect(screen.queryByRole("article", { name: `Lançamento ${EARLY.bank_description}` })).toBeNull();
    expect(row).toHaveTextContent("Adicionar ao Fincla: Feira do bairro");
    expect(within(row).getByTestId("conferido-badge")).toBeInTheDocument();
    expect(calls.filter((c) => c.patch === EARLY.id && c.body.description)).toHaveLength(1);

    // "Alterar" reabre o cartão; "Desfazer escolha" na linha devolve para fora.
    await user.click(within(row).getByRole("button", { name: "Alterar" }));
    const reopened = await screen.findByRole("article", { name: `Lançamento ${EARLY.bank_description}` });
    await user.click(within(reopened).getByRole("button", { name: "Confirmar" }));
    const again = await screen.findByText((_, el) => el?.dataset?.testid === "brought-back-entry" && el.textContent.includes(EARLY.bank_description));
    await user.click(within(again).getByRole("button", { name: "Desfazer escolha" }));
    await waitFor(() => expect(calls.at(-1)).toEqual({ patch: EARLY.id, body: { answer: "ignore" } }));
    await waitFor(() => expect(screen.getAllByTestId("before-start-entry").some((r) => r.textContent.includes(EARLY.bank_description))).toBe(true));
  });

  it("antes do último ajuste de saldo diz que é o ajuste que já inclui os movimentos", async () => {
    draft.left_out = { before: "2026-09-09", reason: "balance_adjustment" };
    await openDraft();
    const user = userEvent.setup();

    const toggle = screen.getByRole("button", { name: /Antes do último ajuste de saldo/ });
    // Coerente com o aviso de "Trazer de volta" ("o saldo só soma o que acontece a partir de…").
    expect(toggle.textContent).toContain("o saldo da conta só soma o que acontece a partir de 09/09/2026; ficam de fora");
    expect(toggle.textContent).not.toContain("conta conta");
    await user.click(toggle);

    expect(screen.getByRole("note").textContent).toBe(
      "O ajuste de saldo que você fez já inclui esses movimentos. Se você trouxer um de volta, ele entra no Fincla "
      + "como transação, mas não muda o saldo da conta nem a diferença de saldo: o saldo só soma o que acontece a partir "
      + "de 09/09/2026.",
    );
  });

  it("sem o dia em que o saldo começa, o aviso não inventa data", async () => {
    draft.left_out = null;
    await openDraft();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Antes do início da conta/ }));

    expect(screen.getByRole("note").textContent).toBe(
      "O saldo inicial da conta no Fincla já inclui esses movimentos. Se você trouxer um de volta, ele entra no Fincla "
      + "como transação, mas não muda o saldo da conta nem a diferença de saldo.",
    );
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

    const notice = await screen.findByTestId("draft-in-progress-notice");
    expect(notice).toHaveTextContent(contract.draft_in_progress.message);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(within(notice).getByRole("button", { name: "Continuar conciliação" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${contract.draft_in_progress.import_id}` });
  });

  it("o 409 traz o quadro Continue de onde parou na hora, sem recarregar a página (smoke em dev, D1)", async () => {
    // O rascunho nasceu por outro caminho (outra aba, ou um envio cuja resposta se perdeu): a lista
    // carregada ao abrir a página está vazia; o servidor já o tem quando o envio volta com 409.
    const theDraft = contract.imports.imports.find((i) => i.id === contract.draft_in_progress.import_id);
    uploadAnswer = () => {
      listAnswer = () => ({ imports: [clone(theDraft)] });
      return HttpResponse.json({ detail: contract.draft_in_progress }, { status: 409 });
    };
    params = { accountId: ACCOUNT };
    const user = userEvent.setup();
    render(<StatementReconciliationPage organizationId={ORG} />);
    await screen.findByText("Nenhum extrato importado nesta conta ainda.");
    expect(screen.queryByTestId("resume-draft")).not.toBeInTheDocument();

    await user.upload(await screen.findByLabelText(/Arquivo do extrato/), new File(["<OFX>"], "extrato.ofx", { type: "application/x-ofx" }));

    const card = await screen.findByTestId("resume-draft");
    expect(within(card).getByRole("heading", { name: "Continue de onde parou" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Descartar" })).toBeInTheDocument();
    // A lista "Extratos importados" também já o mostra, e o aviso continua.
    expect(screen.getAllByTestId("imported-statement")).toHaveLength(1);
    expect(screen.getByTestId("draft-in-progress-notice")).toHaveTextContent(contract.draft_in_progress.message);
  });
});
