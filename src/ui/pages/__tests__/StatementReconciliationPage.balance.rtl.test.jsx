/** @vitest-environment jsdom */
// Conciliar extrato, "Conferir o saldo" e "Revisar e concluir" (fincla-api#514), no nível da página.
// Alimentada pela fixture canônica do backend (`draft` + `balance_check`): o saldo do banco e o do
// Fincla em três pontos, separados a partir de 07/10; três transações do Fincla sem par (o salário
// fantasma marcado para excluir, a conta de luz com a data mudando de 15/10 para 07/10 e a farmácia,
// que tem estorno e não pode ser excluída). O cálculo e a gravação são garantidos pelos testes de
// API; aqui conferimos o que a pessoa vê e o que a tela manda.
import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
    // Como o backend: a resposta "Sim, é esta" mostra a transação do par; desfeita, nenhuma.
    if (body.answer === "pair") {
      Object.assign(entry, { fincla_match: { kind: "transaction", transaction_id: body.paired_transaction_id, transfer_id: null, description: "Conta de luz", type: "expense", value: { amount: "120.00", currency: "BRL" }, date: "2026-10-15T00:00:00", day: "2026-10-15", status: "paid", paid_at: "2026-10-15T00:00:00", payment_method: "boleto", category_name: "Moradia", tag_names: [], account_id: ACCOUNT, account_name: "Itaú", from_account_name: null, to_account_name: null, differences: ["date"], taken_by_entry_id: null } });
    } else {
      Object.assign(entry, { fincla_match: null, paired_transaction_id: null });
    }
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

describe("Conferir o saldo: o aviso do que ainda pode ser par", () => {
  const waitingText = async (waiting, transfers, unanswered) => {
    await openPage({
      edit: ({ check: c }) => {
        c.waiting_transactions = waiting;
        c.waiting_transfers = transfers;
        c.unanswered_entries = unanswered;
      },
    });
    return screen.getByTestId("waiting-transactions").textContent.replace(/Responder agora$/, "").trim();
  };

  it("uma transferência é chamada de transferência, nunca de transação", async () => {
    expect(await waitingText(1, 1, 1)).toBe(
      "1 transferência do Fincla ainda pode ser o par do lançamento sem resposta. Ela não aparece nesta lista até você responder.",
    );
  });

  it("várias transferências e vários lançamentos: plural nos dois", async () => {
    expect(await waitingText(2, 2, 3)).toBe(
      "2 transferências do Fincla ainda podem ser o par de algum dos 3 lançamentos sem resposta. Elas não aparecem nesta lista até você responder.",
    );
  });

  it("transações e transferências juntas: cada uma pelo nome", async () => {
    expect(await waitingText(3, 1, 2)).toBe(
      "2 transações e 1 transferência do Fincla ainda podem ser o par de algum dos 2 lançamentos sem resposta. Elas não aparecem nesta lista até você responder.",
    );
  });

  it("várias transações e um lançamento", async () => {
    expect(await waitingText(2, 0, 1)).toBe(
      "2 transações do Fincla ainda podem ser o par do lançamento sem resposta. Elas não aparecem nesta lista até você responder.",
    );
  });
});

describe("Conferir o saldo: transações sem par", () => {
  it("avisa das candidatas de lançamentos sem resposta e lista as sem par com o estado de cada uma", async () => {
    await openPage();

    expect(screen.getByTestId("pending-entries")).toHaveTextContent("1 lançamento do banco ainda está sem decisão.");
    expect(screen.getByTestId("waiting-transactions")).toHaveTextContent(
      "1 transação do Fincla ainda pode ser o par do lançamento sem resposta. Ela não aparece nesta lista até você responder.",
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
    // G3-3-07: no Fincla a fatura é paga pelo total; o que o banco pagou a menos ENTRA na diferença.
    const [invoice, alreadyPaid] = screen.getAllByTestId("paid-invoice");
    expect(within(invoice).getByTestId("paid-invoice-text").textContent.replace(/\u00a0/g, " ")).toBe(
      "No Fincla a fatura é paga pelo total (R$ 8.279,05); o banco pagou R$ 8.278,54. O banco pagou R$ 0,51 a menos que o total da fatura no Fincla. Essa diferença entra na diferença de saldo.",
    );
    // G3-3-01: a fatura já paga no Fincla aparece com a diferença de data, e nada muda nela.
    expect(alreadyPaid).toHaveTextContent("Fatura Nubank · setembro de 2026Já paga no Fincla");
    expect(alreadyPaid).toHaveTextContent("paga no Fincla em 05/10/2026 · pago pelo banco em 08/10/2026");
    expect(within(alreadyPaid).getByTestId("paid-invoice-text").textContent).toBe(
      "A fatura já estava paga no Fincla e nada muda nela. As compras dela saíram do saldo do Fincla em 05/10/2026 e do banco em 08/10/2026: nesses dias os saldos ficam diferentes. ",
    );
    // Sem jargão: "entra no saldo com", nunca "pesa".
    expect(rowOf("Farmácia")).toHaveTextContent(/entra no saldo com −R\$\s23,06/);
    expect(screen.getByTestId("balance-step")).not.toHaveTextContent(/\bpesam?\b/);
  });

  it("transferências sem par aparecem só para ver, com Abrir e sem Excluir nem Mudar data (G3-3-10)", async () => {
    const user = await openPage();

    const [transfer] = screen.getAllByTestId("unmatched-transfer");
    expect(transfer).toHaveTextContent("Guardartransferência");
    expect(transfer).toHaveTextContent("20/10/2026 · Itaú → Reserva · está no Fincla e não aparece no extrato");
    expect(transfer).toHaveTextContent(/entra no saldo com −R\$\s500,00/);
    expect(within(transfer).getAllByRole("button").map((b) => b.textContent)).toEqual(["Abrir"]);
    expect(within(transfer).queryByRole("checkbox")).toBeNull();
    await user.click(within(transfer).getByRole("button", { name: "Abrir" }));
    expect(within(transfer).getByTestId("transfer-details")).toHaveTextContent(
      "Guardar · transferência de Itaú para ReservaData 20/10/2026A conciliação não altera transferências.",
    );
    // Entram na contagem do que explica a diferença: 2 transações vivas + a transferência.
    expect(screen.getByText("Transações do Fincla sem par no extrato").closest("h3")).toHaveTextContent(/sem par no extrato\s?3$/);
  });

  it("Está certa assim grava a resposta e Desfazer escolha a esquece", async () => {
    const user = await openPage();

    await user.click(within(rowOf("Farmácia")).getByRole("button", { name: "Está certa assim" }));

    expect(lastChecks()).toEqual([{ transaction_id: 97, action: "keep", new_date: null }]);
    await waitFor(() => expect(rowOf("Farmácia")).toHaveTextContent("Você disse que está certa"));
    // BUG-05: a linha minimizada é como a dos outros passos: "Conferido", "Alterar" e "Desfazer escolha".
    const row = rowOf("Farmácia");
    expect(within(row).getByTestId("conferido-badge")).toHaveTextContent("Conferido");
    expect(within(row).getByRole("button", { name: "Alterar" })).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Desfazer" })).toBeNull();
    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));
    expect(lastChecks()).toEqual([{ transaction_id: 97, action: null, new_date: null }]);
  });

  it("Excluir deixa a transação riscada à vista, e Desfazer escolha devolve a resposta anterior", async () => {
    const user = await openPage();
    await user.click(within(rowOf("Conta de luz")).getByRole("button", { name: "Alterar" }));
    // Antes de excluir, o cartão aberto não tem o listrado vermelho.
    expect(rowOf("Conta de luz").style.background).not.toContain("repeating-linear-gradient");

    await user.click(within(rowOf("Conta de luz")).getByRole("button", { name: "Excluir" }));

    expect(lastChecks()).toEqual([{ transaction_id: 95, action: "delete", new_date: null }]);
    await waitFor(() => expect(rowOf("Conta de luz")).toHaveTextContent("Será excluída ao concluir"));
    // BUG-06: a linha minimizada fica listrada em vermelho claro (o `.crow.del` do protótipo)…
    const row = rowOf("Conta de luz");
    expect(row).toHaveAttribute("data-check", "delete");
    expect(row.style.background).toMatch(/^repeating-linear-gradient\(135deg, rgb\(254, 242, 242\) 0 7px, color-mix\(in srgb, rgb\(220, 38, 38\) 16%/);
    // …com o selo "Conferido" e "Desfazer escolha" (BUG-05).
    expect(within(row).getByTestId("conferido-badge")).toBeInTheDocument();
    // …e o cartão reaberto também (o `.ccard.del`).
    await user.click(within(row).getByRole("button", { name: "Alterar" }));
    const card = rowOf("Conta de luz");
    expect(card).toHaveAttribute("data-current", "true");
    expect(card.style.background).toMatch(/^repeating-linear-gradient\(135deg, rgb\(254, 242, 242\) 0 9px/);
    expect(within(card).queryByTestId("conferido-badge")).toBeNull();
    await user.click(within(card).getByRole("button", { name: "Desfazer escolha" }));
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

  it("em lote: marcada só a que não pode ser excluída, o botão não fala em 0 (BUG-03)", async () => {
    const user = await openPage();

    await user.click(screen.getByRole("checkbox", { name: "Marcar Farmácia" }));
    const bar = screen.getByTestId("balance-selection");
    expect(bar).toHaveTextContent("1 marcada");
    expect(bar).toHaveTextContent("1 não pode ser excluída");
    expect(within(bar).getByRole("button", { name: "Excluir as marcadas" })).toBeDisabled();
    expect(bar).not.toHaveTextContent(/\b0 das marcadas/);
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

  it("a ligação feita pela dica continua à vista depois de recarregar a página (G3-3-08)", async () => {
    const user = await openPage();
    await user.click(within(rowOf("Conta de luz")).getByRole("button", { name: "Alterar" }));
    await user.click(within(rowOf("Conta de luz")).getByRole("button", { name: "É este lançamento do banco" }));
    await screen.findByTestId("linked-transaction");

    cleanup();
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);
    await screen.findByTestId("balance-step");

    const linked = await screen.findByTestId("linked-transaction");
    expect(linked).toHaveTextContent("Conta de luz");
    expect(linked).toHaveTextContent("Ligada ao lançamento do banco de 07/10/2026");
    expect(linked).toHaveTextContent("Você disse que é o lançamento “PAG BOLETO ENERGIA”. Não entra mais na diferença.");
    expect(within(linked).getByRole("button", { name: "Desfazer" })).toBeInTheDocument();
  });
});

// Decisão do Owner (fincla-api#507, 2026-11-24, proposta 3): o resumo do próximo pendente também
// aqui, com as ações do cartão da transação (Mudar data leva ao cartão: precisa do formulário).
describe("Conferir o saldo: o resumo do próximo pendente (proposta 3)", () => {
  beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });
  afterEach(() => { delete Element.prototype.scrollIntoView; });

  const summary = () => screen.queryByTestId("next-pending-summary");
  const inSummary = (name) => within(summary()).getByRole("button", { name });

  /** O salário e a farmácia sem resposta; responder a farmácia (a última) abre o salário acima. */
  const answerFarmacia = async () => {
    const user = await openPage({ edit: ({ check: c }) => Object.assign(c.unmatched_transactions[0], { check: null, new_date: null }) });
    await user.click(within(rowOf("Farmácia")).getByRole("button", { name: "Alterar" }));
    await user.click(within(rowOf("Farmácia")).getByRole("button", { name: "Está certa assim" }));
    await waitFor(() => expect(summary()).toBeInTheDocument());
    await waitFor(() => expect(inSummary("Excluir")).not.toBeDisabled());
    calls.length = 0;
    return user;
  };

  it("mostra a transação com as ações do cartão; Excluir manda o mesmo pedido do cartão; o resumo sai e a linha verde fica", async () => {
    const user = await answerFarmacia();
    const s = summary();
    expect(s).toHaveAccessibleName(/2ª parcela salário/);
    expect(within(s).getByTestId("next-pending-hint")).toHaveTextContent("Está no Fincla e não aparece no extrato");
    expect(within(s).getByRole("group").textContent).toBe("Mudar dataExcluirEstá certa assim");

    await user.click(inSummary("Excluir"));

    expect(lastChecks()).toEqual([{ transaction_id: 92, action: "delete", new_date: null }]);
    await waitFor(() => expect(summary()).toBeNull());
    expect(screen.getByTestId("next-pending-done")).toHaveTextContent(/2ª parcela salário·Será excluída ao concluirConferido/);
    await waitFor(() => expect(rowOf("2ª parcela salário")).toHaveTextContent("Será excluída ao concluir"));
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("Mudar data leva ao cartão, sem gravar, com o formulário da data já aberto", async () => {
    const user = await answerFarmacia();

    await user.click(inSummary("Mudar data"));

    expect(calls.filter((c) => c.checks)).toEqual([]);
    expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(screen.getByTestId("current-entry"));
    expect(summary()).toBeNull();
    const salario = rowOf("2ª parcela salário");
    expect(within(salario).getByTestId("change-date-form")).toBeInTheDocument();
    expect(within(salario).getByRole("button", { name: "Mudar data" })).toHaveAttribute("aria-expanded", "true");
    // Cancelar fecha como no cartão.
    await user.click(within(salario).getByRole("button", { name: "Cancelar" }));
    expect(within(salario).queryByTestId("change-date-form")).toBeNull();
  });

  it("com a exclusão recusada, Excluir fica desligado no resumo com o mesmo motivo do cartão", async () => {
    const user = await openPage({
      edit: ({ check: c }) => Object.assign(c.unmatched_transactions[0], { check: null, new_date: null, delete_refusal: "goal" }),
    });
    await user.click(within(rowOf("Farmácia")).getByRole("button", { name: "Alterar" }));
    await user.click(within(rowOf("Farmácia")).getByRole("button", { name: "Está certa assim" }));
    await waitFor(() => expect(summary()).toBeInTheDocument());

    const excluir = inSummary("Excluir");
    expect(excluir).toBeDisabled();
    expect(excluir).toHaveAccessibleDescription("Ligada a um aporte de meta: desfaça o aporte na meta para poder excluir.");
    expect(within(summary()).getByText("Ligada a um aporte de meta: desfaça o aporte na meta para poder excluir.")).toBeInTheDocument();
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
