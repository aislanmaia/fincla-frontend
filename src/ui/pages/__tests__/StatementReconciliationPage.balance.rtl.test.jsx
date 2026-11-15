/** @vitest-environment jsdom */
// Conciliar extrato, "Conferir o saldo" e "Revisar e concluir" (fincla-api#514), no nível da página.
// Alimentada pela fixture canônica do backend (`draft` + `balance_check`): o saldo do banco e o do
// Fincla em três pontos, separados a partir de 07/10; três transações do Fincla sem par (o salário
// fantasma marcado para excluir, a conta de luz com a data mudando de 15/10 para 07/10 e a farmácia,
// que tem estorno e não pode ser excluída). O cálculo e a gravação são garantidos pelos testes de
// API; aqui conferimos o que a pessoa vê e o que a tela manda.
import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const ENERGY_ENTRY = contract.draft.entries.find((e) => e.bank_description === "PAG BOLETO ENERGIA");

const calls = [];
let draft;
let check;

const server = setupServer(
  http.get("*/v1/users/me/preferences", () => HttpResponse.json({ statement_reconciliation_view: "detailed" })),
  http.get("*/v1/accounts", () => HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true }])),
  http.get("*/v1/tags", () => HttpResponse.json({ tags: [] })),
  http.get(`${BASE}/${IMPORT}`, () => HttpResponse.json(draft)),
  http.patch(`${BASE}/${IMPORT}`, async ({ request }) => {
    const body = await request.json();
    Object.assign(draft, body);
    return HttpResponse.json(draft);
  }),
  http.get(`${BASE}/${IMPORT}/balance-check`, () => HttpResponse.json(check)),
  http.patch(`${BASE}/${IMPORT}/balance-check/transactions`, async ({ request }) => {
    const body = await request.json();
    calls.push({ checks: body.transactions });
    // O backend recalcula; aqui o mínimo: a resposta de cada transação.
    for (const change of body.transactions) {
      const item = check.unmatched_transactions.find((u) => u.transaction_id === change.transaction_id);
      item.check = change.action;
      item.new_date = change.action === "change_date" ? change.new_date : null;
    }
    return HttpResponse.json(check);
  }),
  http.patch(`${BASE}/${IMPORT}/entries/:entryId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ entry: p.entryId, body });
    const entry = draft.entries.find((e) => e.id === p.entryId);
    Object.assign(entry, body);
    // Pareada pela dica, a transação deixa de estar sem par (e volta com o desfazer).
    const paired = body.answer === "pair" ? body.paired_transaction_id : null;
    check = clone(check);
    if (paired) check.unmatched_transactions = check.unmatched_transactions.filter((u) => u.transaction_id !== paired);
    else if (!check.unmatched_transactions.some((u) => u.transaction_id === 95)) {
      check.unmatched_transactions.push(clone(contract.balance_check.unmatched_transactions[1]));
    }
    return HttpResponse.json(entry);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  server.resetHandlers();
  navigate.mockReset();
});

const setup = ({ step = "balance", edit = null } = {}) => {
  draft = clone(contract.draft);
  draft.current_step = step;
  check = clone(contract.balance_check);
  if (edit) edit({ draft, check });
};

const openPage = async (options) => {
  setup(options);
  params = { accountId: ACCOUNT, importId: IMPORT };
  render(<StatementReconciliationPage organizationId={ORG} />);
  await screen.findByRole("heading", { name: options?.step === "summary" ? "Revisar e concluir" : "Conferir o saldo" });
  if ((options?.step ?? "balance") === "balance") await screen.findByTestId("balance-step");
  return userEvent.setup();
};

const rows = () => screen.getAllByTestId("unmatched-transaction");
const rowOf = (description) => rows().find((r) => r.textContent.includes(description));
const lastChecks = () => calls.filter((c) => c.checks).at(-1).checks;

describe("Conferir o saldo: o painel", () => {
  it("mostra a diferença em destaque e o primeiro dia em que os saldos se separam", async () => {
    await openPage();

    expect(screen.getByTestId("balance-title")).toHaveTextContent("Diferença de −R$ 23,06");
    expect(screen.getByTestId("balance-first-day")).toHaveTextContent(
      "Os saldos estavam iguais até 30/09/2026. A partir de 7 de outubro eles se separam.",
    );
    expect(screen.getByTestId("balance-panel")).toHaveTextContent("Banco em 31/10/2026: R$ 1.834,10");
    expect(screen.getByTestId("balance-panel")).toHaveTextContent("Fincla em 31/10/2026: R$ 1.857,16");
    const days = screen.getAllByTestId("balance-day");
    expect(days.map((d) => [d.textContent, d.dataset.state])).toEqual([["30/09", "ok"], ["07/10", "off"], ["31/10", "off"]]);
    expect(days[1]).toHaveAccessibleName(/^07\/10\/2026: diferença de −R\$\s120,00 \(primeiro dia diferente\)$/);
    // Concluir com diferença é permitido: ela fica registrada.
    expect(screen.getByTestId("conclude-with-difference")).toHaveTextContent(
      "Você pode concluir mesmo assim. A diferença de −R$ 23,06 fica registrada nesta conciliação",
    );
  });

  it("quando batem em todos os pontos, diz que os saldos batem e não pede para concluir com diferença", async () => {
    await openPage({
      edit: ({ check: c }) => {
        c.points = c.points.map((p) => ({ ...p, fincla: p.bank, difference: { amount: "0.00", currency: "BRL" } }));
        c.first_divergent_date = null;
        c.final_difference = { amount: "0.00", currency: "BRL" };
      },
    });

    expect(screen.getByTestId("balance-title")).toHaveTextContent("Os saldos batem");
    expect(screen.getByTestId("balance-first-day")).toHaveTextContent("Banco e Fincla terminam 31/10 com R$ 1.834,10.");
    expect(screen.queryByTestId("conclude-with-difference")).not.toBeInTheDocument();
  });

  it("sem saldo no arquivo, diz que não dá para comparar e não inventa zero", async () => {
    await openPage({
      edit: ({ check: c }) => {
        c.points = [];
        c.first_divergent_date = null;
        c.final_difference = null;
      },
    });

    expect(screen.getByTestId("balance-title")).toHaveTextContent("O arquivo não informa saldo");
    expect(screen.getByTestId("balance-panel")).not.toHaveTextContent("R$ 0,00");
  });
});

describe("Conferir o saldo: transações sem par", () => {
  it("avisa das candidatas de lançamentos sem resposta e lista as sem par com o estado de cada uma", async () => {
    await openPage();

    expect(screen.getByTestId("pending-entries")).toHaveTextContent("1 lançamento do banco ainda está sem decisão.");
    expect(screen.getByTestId("waiting-transactions")).toHaveTextContent(
      "1 transação do Fincla ainda pode ser o par de algum dos 1 lançamento sem resposta. Ela não aparece nesta lista até você responder.",
    );
    expect(rows()).toHaveLength(3);
    // Excluir só vale ao concluir: a transação continua à vista, riscada.
    expect(rowOf("2ª parcela salário")).toHaveTextContent("Será excluída ao concluir");
    expect(within(rowOf("2ª parcela salário")).getByText("2ª parcela salário")).toHaveStyle({ textDecoration: "line-through" });
    // Mudar data também: a data antiga → a nova, com desfazer.
    const dateChange = within(rowOf("Conta de luz")).getByTestId("date-change");
    expect(dateChange).toHaveTextContent("Data muda ao concluir");
    expect(dateChange).toHaveTextContent("15/10/2026 → 07/10/2026");
    expect(within(dateChange).getByText("15/10/2026").tagName).toBe("S");
    // A primeira sem resposta abre: a farmácia, que tem estorno e não pode ser excluída.
    const current = rowOf("Farmácia");
    expect(current.dataset.current).toBe("true");
    expect(within(current).getByRole("button", { name: "Excluir" })).toBeDisabled();
    expect(current).toHaveTextContent("Tem um estorno ligado a ela");
    expect(screen.getByTestId("queue-position")).toHaveTextContent("Transação 3 de 3");
    // Os lançamentos que não vão para o Fincla também explicam a diferença.
    expect(screen.getByText("Lançamentos do extrato que você não registrou")).toBeInTheDocument();
    expect(screen.getAllByTestId("not-recorded-entry")[0]).toHaveTextContent("TARIFA PACOTE");
    expect(screen.getByTestId("paid-invoice")).toHaveTextContent("O banco pagou menos que o total da fatura.");
  });

  it("Está certa assim grava a resposta e Desfazer a esquece", async () => {
    const user = await openPage();

    await user.click(within(rowOf("Farmácia")).getByRole("button", { name: "Está certa assim" }));

    expect(lastChecks()).toEqual([{ transaction_id: 97, action: "keep", new_date: null }]);
    await waitFor(() => expect(rowOf("Farmácia")).toHaveTextContent("Você disse que está certa"));
    await user.click(within(rowOf("Farmácia")).getByRole("button", { name: "Desfazer" }));
    expect(lastChecks()).toEqual([{ transaction_id: 97, action: null, new_date: null }]);
  });

  it("Excluir deixa a transação riscada à vista, e Desfazer exclusão devolve a resposta anterior", async () => {
    const user = await openPage();
    await user.click(within(rowOf("Conta de luz")).getByRole("button", { name: "Alterar" }));

    await user.click(within(rowOf("Conta de luz")).getByRole("button", { name: "Excluir" }));

    expect(lastChecks()).toEqual([{ transaction_id: 95, action: "delete", new_date: null }]);
    await waitFor(() => expect(rowOf("Conta de luz")).toHaveTextContent("Será excluída ao concluir"));
    await user.click(within(rowOf("Conta de luz")).getByRole("button", { name: "Desfazer exclusão" }));
    // Antes de excluir, a data mudava: é isso que volta.
    expect(lastChecks()).toEqual([{ transaction_id: 95, action: "change_date", new_date: "2026-10-07" }]);
  });

  it("Mudar data manda o novo dia", async () => {
    const user = await openPage();
    const farmacia = rowOf("Farmácia");

    await user.click(within(farmacia).getByRole("button", { name: "Mudar data" }));
    fireEvent.change(within(farmacia).getByLabelText("Nova data"), { target: { value: "2026-10-21" } });
    await user.click(within(farmacia).getByRole("button", { name: "Mudar para esta data" }));

    expect(lastChecks()).toEqual([{ transaction_id: 97, action: "change_date", new_date: "2026-10-21" }]);
  });

  it("em lote: exclui as marcadas que podem ser excluídas, e o Desfazer devolve o que cada uma tinha", async () => {
    const user = await openPage();

    await user.click(screen.getByRole("button", { name: "Marcar todas (3)" }));
    const bar = screen.getByTestId("balance-selection");
    expect(bar).toHaveTextContent("3 marcadas");
    expect(bar).toHaveTextContent("1 não pode ser excluída");
    await user.click(within(bar).getByRole("button", { name: "Excluir 2 das marcadas" }));

    expect(lastChecks()).toEqual([
      { transaction_id: 92, action: "delete", new_date: null },
      { transaction_id: 95, action: "delete", new_date: null },
    ]);
    const undo = await screen.findByTestId("balance-batch-undo");
    expect(undo).toHaveTextContent("2 transações marcadas para excluir ao concluir");
    await user.click(within(undo).getByRole("button", { name: "Desfazer" }));
    expect(lastChecks()).toEqual([
      { transaction_id: 92, action: "delete", new_date: null },
      { transaction_id: 95, action: "change_date", new_date: "2026-10-07" },
    ]);
  });

  it("“É este lançamento do banco” pareia o lançamento a adicionar, e a ligação continua à vista com desfazer", async () => {
    const user = await openPage();
    await user.click(within(rowOf("Conta de luz")).getByRole("button", { name: "Alterar" }));

    const hint = within(rowOf("Conta de luz")).getByTestId("pair-hint");
    expect(hint).toHaveTextContent(
      "Parece o lançamento do banco de 07/10/2026 “PAG BOLETO ENERGIA” (−R$ 120,00), que está marcado para adicionar ao Fincla.",
    );
    await user.click(within(hint).getByRole("button", { name: "É este lançamento do banco" }));

    expect(calls.find((c) => c.entry)).toEqual({
      entry: ENERGY_ENTRY.id,
      body: { answer: "pair", paired_transaction_id: 95 },
    });
    const linked = await screen.findByTestId("linked-transaction");
    expect(linked).toHaveTextContent("Conta de luz");
    expect(linked).toHaveTextContent("Ligada ao lançamento do banco de 07/10/2026");
    await waitFor(() => expect(rows()).toHaveLength(2));

    await user.click(within(linked).getByRole("button", { name: "Desfazer" }));
    expect(calls.filter((c) => c.entry).at(-1)).toEqual({ entry: ENERGY_ENTRY.id, body: { answer: "create", confirmed: false } });
    await waitFor(() => expect(screen.queryByTestId("linked-transaction")).not.toBeInTheDocument());
  });
});

describe("Revisar e concluir", () => {
  it("destaca no topo a diferença que fica e mostra os selos do que mais acontece", async () => {
    await openPage({ step: "summary" });

    const difference = await screen.findByTestId("summary-difference");
    expect(difference).toHaveTextContent("Diferença de saldo que fica no fim de outubro");
    expect(difference).toHaveTextContent("−R$ 23,06");
    expect(difference).toHaveTextContent("Banco R$ 1.834,10 · Fincla R$ 1.857,16 em 31/10/2026. Ela fica registrada nesta conciliação.");
    const effects = screen.getAllByTestId("summary-effect").map((e) => e.textContent);
    expect(effects).toEqual(["Exclusão1 transação do Fincla é excluída.", "Data muda1 transação muda de data."]);
    expect(screen.getByTestId("conclude-with-difference")).toBeInTheDocument();
  });

  it("os selos concordam no plural", async () => {
    await openPage({
      step: "summary",
      edit: ({ check: c }) => {
        c.effects = { ...c.effects, deletions: 2, date_changes: 3 };
      },
    });

    await screen.findByTestId("summary-difference");
    const effects = screen.getAllByTestId("summary-effect").map((e) => e.textContent);
    expect(effects).toEqual(["Exclusão2 transações do Fincla são excluídas.", "Data muda3 transações mudam de data."]);
  });

  it("concluída, mostra a diferença registrada; sem saldo no arquivo, diz que nenhuma foi registrada", async () => {
    setup();
    draft = { ...clone(contract.undone), status: "concluded", undone_at: null, latest_concluded: true, final_difference: { amount: "-23.06", currency: "BRL" } };
    draft.id = IMPORT;
    params = { accountId: ACCOUNT, importId: IMPORT };
    const { unmount } = render(<StatementReconciliationPage organizationId={ORG} />);
    expect(await screen.findByTestId("recorded-difference")).toHaveTextContent("Diferença registrada: −R$ 23,06");
    unmount();

    draft.final_difference = null;
    render(<StatementReconciliationPage organizationId={ORG} />);
    expect(await screen.findByTestId("recorded-difference")).toHaveTextContent("O extrato não informava saldo: nenhuma diferença foi registrada.");
  });
});
