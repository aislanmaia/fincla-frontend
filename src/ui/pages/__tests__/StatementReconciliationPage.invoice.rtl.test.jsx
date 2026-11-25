/** @vitest-environment jsdom */
// Conciliar extrato, "Conferir pagamento de fatura" (fincla-api#512), no nível da página.
// Alimentada pela fixture canônica do backend (`invoice_draft`): o pagamento da fatura Itaú Visa
// de outubro (R$ 3.412,57 pagos em 12/10; total no Fincla R$ 3.412,60, vencimento 13/10) e um
// boleto comum. O pagamento é um lançamento de referência: já decidido, sem ações, e nunca vira
// transação. A gravação (fatura paga na data do banco, desfazer) é garantida pelos testes de API.
import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import contract from "../../../api/__fixtures__/statement_import.example.json";
import { smallTouchTargets } from "../../../test/touchTargets.js";

const navigate = vi.fn();
let params = {};
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate, useParams: () => params }));
import { StatementReconciliationPage } from "../StatementReconciliationPage.jsx";
import { StatementImportUndoPage } from "../StatementImportUndoPage.jsx";

const ORG = "org";
const ACCOUNT = contract.invoice_draft.account_id;
const IMPORT = contract.invoice_draft.id;
const BASE = `*/v1/accounts/${ACCOUNT}/statement-imports`;
const clone = (value) => JSON.parse(JSON.stringify(value));

const calls = [];
let draft = clone(contract.invoice_draft);
let preview = clone(contract.undo_preview);
let check = clone(contract.balance_check);

const server = setupServer(
  // "Revisar e concluir" mostra a diferença de saldo (fincla-api#514).
  http.get(`${BASE}/${IMPORT}/balance-check`, () => HttpResponse.json(check)),
  http.get("*/v1/accounts", () => HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true }])),
  http.get("*/v1/tags", () => HttpResponse.json({ tags: [] })),
  http.get(`${BASE}/${IMPORT}`, () => HttpResponse.json(draft)),
  http.patch(`${BASE}/${IMPORT}`, async ({ request }) => {
    const body = await request.json();
    calls.push({ progress: body });
    Object.assign(draft, body);
    return HttpResponse.json(draft);
  }),
  http.patch(`${BASE}/${IMPORT}/entries/:entryId`, async ({ request, params: p }) => {
    calls.push({ patch: p.entryId, body: await request.json() });
    return HttpResponse.json(draft.entries.find((e) => e.id === p.entryId));
  }),
  http.patch(`${BASE}/${IMPORT}/entries`, async ({ request }) => {
    calls.push({ batch: await request.json() });
    return HttpResponse.json(draft);
  }),
  http.get(`${BASE}/${IMPORT}/undo-preview`, () => HttpResponse.json(preview)),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  draft = clone(contract.invoice_draft);
  preview = clone(contract.undo_preview);
  check = clone(contract.balance_check);
  server.resetHandlers();
  navigate.mockReset();
});

const openDraft = async (props = {}) => {
  params = { accountId: ACCOUNT, importId: IMPORT };
  render(<StatementReconciliationPage organizationId={ORG} {...props} />);
  await screen.findByRole("heading", { name: "Conferir pagamento de fatura" });
};

const invoiceCard = () => screen.getByRole("article", { name: "Pagamento de fatura de 12/10/2026" });
const railButton = (title) => {
  const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });
  return within(rail).getAllByRole("button").find((b) => within(b).getByTestId("step-title").textContent === title);
};
const railStatus = (title) => railButton(title).textContent.replace(title, "").replace(/^\d/, "");

describe("o passo Conferir pagamento de fatura", () => {
  it("mostra o pagamento ligado à fatura, já decidido, com o que acontece ao concluir", async () => {
    await openDraft();

    expect(screen.getByText("O banco mostra o pagamento de uma fatura de cartão. Só confira se é a fatura certa.")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma transação é criada. Ao concluir a conciliação, a fatura fica paga na data do banco.")).toBeInTheDocument();
    const card = invoiceCard();
    expect(within(card).getByText("Pagamento de fatura")).toBeInTheDocument();
    expect(within(card).getByText("No extrato do banco")).toBeInTheDocument();
    expect(within(card).getByText("PAGAMENTO FATURA ITAU VISA")).toBeInTheDocument();
    expect(within(card).getByTestId("pair-connector")).toHaveAttribute("data-link", "pair");
    const side = within(card).getByTestId("invoice-side");
    expect(side).toHaveTextContent("No Fincla · fatura do cartão");
    expect(side).toHaveTextContent("Vencimento13/10/2026");
    expect(side).toHaveTextContent("DescriçãoFatura Itaú Visa · outubro");
    expect(side).toHaveTextContent(/Total[-−]\s?R\$\s3\.412,60/);
    expect(side).toHaveTextContent("CartãoItaú Visa · paga pela Itaú");
    expect(side).toHaveTextContent("SituaçãoFechada");
    // Vencimento e total diferem do banco: destacados, com a diferença em centavos.
    expect(within(side).getAllByTestId("match-highlight").map((h) => h.textContent)).toEqual([
      "13/10/2026",
      expect.stringMatching(/3\.412,60/),
    ]);
    expect(within(side).getByTestId("invoice-amount-difference")).toHaveTextContent(
      /VALOR DIFERENTE O banco pagou R\$\s0,03 a menos que o total da fatura no Fincla\. A diferença aparece na conferência de saldo\./,
    );
    expect(within(card).getByTestId("invoice-outcome")).toHaveTextContent(
      "Este lançamento é o pagamento da fatura. Nenhuma transação é criada: as compras dela já estão no Fincla. "
      + "Ao concluir a conciliação, a Fatura Itaú Visa · outubro fica paga em 12/10/2026 (data do banco).",
    );
    expect(within(card).queryByTestId("invoice-unavailable")).not.toBeInTheDocument();
    expect(railStatus("Conferir pagamento de fatura")).toBe("2 pagamentos de fatura · falta você conferir");
  });

  it("não tem Sim, é esta / Não, adicionar agora / Não registrar nem nada para editar, e não manda nada", async () => {
    await openDraft();

    const card = invoiceCard();
    expect(within(card).queryAllByRole("button")).toEqual([]);
    expect(within(card).queryAllByRole("textbox")).toEqual([]);
    expect(within(card).queryAllByRole("combobox")).toEqual([]);
    expect(screen.queryByRole("group", { name: "Este lançamento do banco já está no Fincla?" })).not.toBeInTheDocument();
    // O boleto comum não aparece aqui: ele é um lançamento novo.
    expect(screen.queryByText("PAG BOLETO ENERGIA")).not.toBeInTheDocument();
    expect(calls.filter((c) => c.patch || c.batch)).toEqual([]);
  });

  it("os atalhos de teclado das listas não respondem nada aqui, e não há lista nem filtro", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.keyboard("s");
    await user.keyboard("a");
    await user.keyboard("n");
    await user.keyboard("j");

    expect(calls.filter((c) => c.patch || c.batch)).toEqual([]);
    expect(screen.queryByText(/Falta responder/)).not.toBeInTheDocument();
    expect(invoiceCard()).toBeInTheDocument();
  });

  it("passar pelo passo o marca como conferido, e ele continua visível ao voltar", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByRole("heading", { name: "Revisar rendimentos pequenos" });
    expect(calls).toContainEqual({ progress: { current_step: "yield", reviewed_steps: ["suggested", "doubt", "invoice"] } });
    expect(railStatus("Conferir pagamento de fatura")).toBe("Conferido");
    await user.click(railButton("Conferir pagamento de fatura"));
    expect(await screen.findByRole("article", { name: "Pagamento de fatura de 12/10/2026" })).toBeInTheDocument();
  });

  it("uma fatura sem diferença de valor não mostra VALOR DIFERENTE", async () => {
    const payment = draft.entries[0];
    payment.amount = { amount: "-3412.60", currency: "BRL" };
    payment.invoice.differences = ["date"];
    payment.invoice.difference = { amount: "0.00", currency: "BRL" };
    await openDraft();

    expect(within(invoiceCard()).queryByTestId("invoice-amount-difference")).not.toBeInTheDocument();
    expect(within(invoiceCard()).queryByText("VALOR DIFERENTE")).not.toBeInTheDocument();
  });

  it("o banco pagou a mais: diz a mais", async () => {
    const payment = draft.entries[0];
    payment.amount = { amount: "-3413.10", currency: "BRL" };
    payment.invoice.difference = { amount: "-0.50", currency: "BRL" };
    await openDraft();

    expect(within(invoiceCard()).getByTestId("invoice-amount-difference")).toHaveTextContent(/O banco pagou R\$\s0,50 a mais/);
  });

  it("avisa quando a fatura foi paga depois da leitura do extrato (concluir vai ser recusado)", async () => {
    draft.entries[0].invoice.status = "paid";
    draft.entries[0].invoice.paid_date = "2026-10-11";
    await openDraft();

    expect(within(invoiceCard()).getByTestId("invoice-side")).toHaveTextContent("SituaçãoPaga em 11/10/2026");
    expect(within(invoiceCard()).getByTestId("invoice-unavailable")).toHaveTextContent(
      "A Fatura Itaú Visa · outubro já foi marcada como paga depois da leitura do extrato. Para conciliar, descarte esta conciliação e envie o extrato de novo.",
    );
  });

  it("avisa quando a fatura não existe mais", async () => {
    draft.entries[0].invoice = null;
    await openDraft();

    expect(within(invoiceCard()).getByTestId("invoice-unavailable")).toHaveTextContent("A fatura deste pagamento não existe mais no Fincla.");
  });
});

describe("fatura já paga no Fincla (G3-3-01)", () => {
  // A fatura Nubank de setembro (R$ 640,00) foi paga pelo app em 05/10; o banco pagou em 08/10.
  const paidCard = () => screen.getByRole("article", { name: "Pagamento de fatura de 08/10/2026" });

  it("aparece como referência já paga, com o cartão e a fatura, sem ações e sem prometer pagar", async () => {
    await openDraft();

    const card = paidCard();
    expect(within(card).getByText("Já paga no Fincla")).toBeInTheDocument();
    const side = within(card).getByTestId("invoice-side");
    expect(side).toHaveTextContent("DescriçãoFatura Nubank · setembro");
    expect(side).toHaveTextContent("CartãoNubank · paga pela Itaú");
    // Sem o ano, como as outras datas curtas do passo: o pagamento é do mesmo ano do extrato.
    expect(side.textContent).toContain("SituaçãoJá paga no Fincla em 05/10");
    expect(side.textContent).not.toContain("Já paga no Fincla em 05/10/2026");
    // O dia do Fincla difere do banco: destacado.
    expect(within(side).getAllByTestId("match-highlight").map((h) => h.textContent)).toEqual(["05/10"]);
    expect(within(card).getByTestId("invoice-outcome").textContent).toBe(
      "Este lançamento é o pagamento de uma fatura que já está paga no Fincla. Ao concluir, nada muda: nenhuma transação é "
      + "criada e a fatura continua como está. No Fincla ela foi paga em 05/10/2026 e no banco em 08/10/2026: a diferença "
      + "de data aparece na conferência de saldo.",
    );
    expect(card).not.toHaveTextContent("fica paga");
    expect(within(card).queryByTestId("invoice-unavailable")).not.toBeInTheDocument();
    expect(within(card).queryAllByRole("button")).toEqual([]);
  });

  it("paga num ano diferente do extrato: mostra a data com o ano", async () => {
    const paid = draft.entries.find((e) => e.answer === "invoice_already_paid");
    paid.invoice.paid_date = "2025-12-30";
    await openDraft();

    const side = within(paidCard()).getByTestId("invoice-side");
    expect(side.textContent).toContain("SituaçãoJá paga no Fincla em 30/12/2025");
    expect(within(side).getAllByTestId("match-highlight").map((h) => h.textContent)).toEqual(["30/12/2025"]);
  });

  it("desmarcada no app depois da leitura: avisa que concluir vai ser recusado, sem prometer nada", async () => {
    const paid = draft.entries.find((e) => e.answer === "invoice_already_paid");
    paid.invoice.status = "closed";
    paid.invoice.paid_date = null;
    await openDraft();

    const card = paidCard();
    // OBS-10: o estado de AGORA manda. Nenhum selo nem texto diz que ela está paga.
    expect(card).not.toHaveTextContent("Já paga no Fincla");
    expect(card).not.toHaveTextContent("já está paga");
    expect(within(card).getByTestId("invoice-side").textContent).toContain("SituaçãoFechada");
    // O aviso e a instrução são os mesmos da recusa do Concluir (backend, invoice_no_longer_paid).
    expect(within(card).getByTestId("invoice-unavailable").textContent).toBe(
      "A Fatura Nubank · setembro foi desmarcada como paga depois da leitura do extrato. Para conciliar, descarte esta conciliação e "
      + "envie o extrato de novo, para o Fincla ler a fatura como está agora.",
    );
    expect(within(card).getByTestId("invoice-outcome").textContent).toBe(
      "Este lançamento é o pagamento da fatura. Nenhuma transação é criada: as compras dela já estão no Fincla.",
    );
    expect(within(card).queryAllByRole("button")).toEqual([]);
  });

  it("no resumo, conta à parte e diz que nada muda nela; a outra fatura fica paga", async () => {
    draft.current_step = "summary";
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);
    await screen.findByRole("heading", { name: "Revisar e concluir" });

    expect(screen.getByTestId("summary-invoices-already-paid-count")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-invoices-already-paid").textContent).toBe(
      "Fatura já pagaA Fatura Nubank · setembro já está paga no Fincla: nada muda nela e nenhuma transação é criada.",
    );
    expect(screen.getAllByTestId("summary-invoices-paid")).toHaveLength(1);
  });

  describe("desmarcada no app depois da leitura (BUG-02): nenhum outro passo diz que ela está paga", () => {
    // OBS-16: nomeia a fatura (cartão e mês), como o aviso da fatura a pagar.
    const UNMARKED = "A Fatura Nubank · setembro foi desmarcada como paga depois da leitura do extrato. Para conciliar, descarte esta "
      + "conciliação e envie o extrato de novo, para o Fincla ler a fatura como está agora.";
    const unmark = ({ backendSaysPaid = false } = {}) => {
      const paid = draft.entries.find((e) => e.answer === "invoice_already_paid");
      paid.invoice.status = "closed";
      paid.invoice.paid_date = null;
      // Como o backend responde agora: pelo estado atual, não pela resposta.
      const item = check.paid_invoices.find((i) => i.entry_id === paid.id);
      Object.assign(item, { already_paid: backendSaysPaid, fincla_paid_on: null });
      return item;
    };
    const openStep = async (step, heading) => {
      draft.current_step = step;
      params = { accountId: ACCOUNT, importId: IMPORT };
      render(<StatementReconciliationPage organizationId={ORG} />);
      await screen.findByRole("heading", { name: heading });
    };
    const nubankItem = async () => {
      const items = await screen.findAllByTestId("paid-invoice");
      return items.find((i) => i.textContent.includes("Fatura Nubank"));
    };

    it.each([
      ["o backend já responde pelo estado atual", false],
      ["mesmo que a resposta ainda diga já paga", true],
    ])("Conferir o saldo: sem selo, sem data vazia, com o mesmo aviso do cartão (%s)", async (_label, backendSaysPaid) => {
      unmark({ backendSaysPaid });
      await openStep("balance", "Conferir o saldo");

      const item = await nubankItem();
      expect(item).not.toHaveTextContent("Já paga no Fincla");
      expect(item).not.toHaveTextContent("paga no Fincla em");
      expect(item).not.toHaveTextContent("já estava paga");
      expect(item).not.toHaveTextContent(/saldo do Fincla em\s+e/);
      expect(item.textContent).toContain("Total no Fincla R$\u00a0640,00 · pago pelo banco em 08/10/2026: R$\u00a0640,00");
      expect(within(item).getByTestId("paid-invoice-text").textContent).toBe(UNMARKED);
      // A outra fatura (a pagar, ainda em aberto) não muda.
      const [other] = screen.getAllByTestId("paid-invoice");
      expect(within(other).getByTestId("paid-invoice-text").textContent).toMatch(/^No Fincla a fatura é paga pelo total/);
    });

    it("Conferir o saldo: paga, mas sem o dia, não escreve uma data vazia", async () => {
      const item = check.paid_invoices.find((i) => i.already_paid);
      item.fincla_paid_on = null;
      await openStep("balance", "Conferir o saldo");

      const shown = await nubankItem();
      expect(shown).toHaveTextContent("Já paga no Fincla");
      expect(shown).not.toHaveTextContent("paga no Fincla em");
      expect(within(shown).getByTestId("paid-invoice-text").textContent).toBe("A fatura já estava paga no Fincla e nada muda nela. ");
    });

    it("Revisar e concluir: não a conta como já paga e mostra o mesmo aviso no lugar de já está paga", async () => {
      unmark();
      await openStep("summary", "Revisar e concluir");

      expect(screen.queryByTestId("summary-invoices-already-paid-count")).not.toBeInTheDocument();
      expect(screen.queryByText(/Pagamentos de fatura já paga/)).not.toBeInTheDocument();
      expect(screen.queryByTestId("summary-invoices-already-paid")).not.toBeInTheDocument();
      expect(screen.getByTestId("summary-pair-changes")).not.toHaveTextContent("já está paga");
      expect(screen.getByTestId("summary-invoice-unavailable").textContent).toBe(`Fatura mudou${UNMARKED}`);
      // A fatura a pagar continua contada e com o efeito dela.
      expect(screen.getByTestId("summary-invoice-payments")).toHaveTextContent("1");
      expect(screen.getAllByTestId("summary-invoices-paid")).toHaveLength(1);
    });
  });

  it("concluída, a tela final não diz que ela ficou paga", async () => {
    draft = { ...draft, status: "concluded", concluded_at: "2026-11-15T10:30:00", expires_at: null, latest_concluded: true, balance_now: null };
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);

    expect(await screen.findByTestId("done-invoices-paid")).toHaveTextContent("1 fatura de cartão ficou paga na data do banco.");
    expect(screen.getByTestId("done-invoices-already-paid")).toHaveTextContent(
      "1 pagamento era de uma fatura já paga no Fincla: nada mudou nela.",
    );
  });
});

describe("reimportação (fincla-api#516)", () => {
  it("um pagamento de fatura conferido antes fica em Ver o que fica de fora, com a fatura que ele pagou", async () => {
    draft.entries = draft.entries.filter((e) => e.answer !== "invoice_already_paid");
    const payment = draft.entries[0];
    Object.assign(payment, { classification: "reconciled", answer: "reconciled", confirmed: true });
    payment.invoice.status = "paid";
    payment.invoice.paid_date = "2026-10-12";
    draft.summary = { ...draft.summary, invoice_payments: 0, invoices_already_paid: 0, already_reconciled: 1 };
    draft.current_step = "outside";
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);
    await screen.findByRole("heading", { name: "Ver o que fica de fora" });

    const user = userEvent.setup();
    const toggle = screen.queryByRole("button", { name: /Já conferid/ });
    if (toggle && toggle.getAttribute("aria-expanded") === "false") await user.click(toggle);
    expect(screen.getByTestId("reconciled-entry")).toHaveTextContent("Já conferida com o pagamento da Fatura Itaú Visa · outubro");
    // Nunca como uma fatura a pagar de novo.
    expect(railStatus("Conferir pagamento de fatura")).toBe("Nada a fazer");
  });
});

describe("o resumo", () => {
  it("conta o pagamento de fatura e destaca a fatura que fica paga na data do banco", async () => {
    draft.current_step = "summary";
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);
    await screen.findByRole("heading", { name: "Revisar e concluir" });

    expect(screen.getByTestId("summary-invoice-payments")).toHaveTextContent("1");
    expect(screen.getByTestId("summary-to-create")).toHaveTextContent("1");
    // O selo FATURA PAGA da lista "Também vai acontecer ao concluir" (fincla-api#514).
    const paid = screen.getByTestId("summary-invoices-paid");
    expect(paid).toHaveTextContent("Fatura paga");
    expect(paid).toHaveTextContent("A Fatura Itaú Visa · outubro fica paga em 12/10/2026 (data do banco). Nenhuma transação é criada.");
  });

  it("sem pagamento de fatura, nada sobre fatura aparece", async () => {
    draft = clone(contract.draft);
    draft.id = IMPORT;
    draft.account_id = ACCOUNT;
    draft.current_step = "summary";
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);
    await screen.findByRole("heading", { name: "Revisar e concluir" });

    expect(screen.queryByTestId("summary-invoice-payments")).not.toBeInTheDocument();
    expect(screen.queryByTestId("summary-invoices-paid")).not.toBeInTheDocument();
    expect(railStatus("Conferir pagamento de fatura")).toBe("Nada a fazer");
  });
});

describe("desfazer", () => {
  const openUndo = async () => {
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementImportUndoPage organizationId={ORG} />);
    await screen.findByText("Se você desfizer esta importação:");
  };

  it("diz que a fatura volta a ficar em aberto, separada das transações que voltam", async () => {
    await openUndo();

    expect(screen.getByTestId("undo-restore-count")).toHaveTextContent("2 transações que já estavam no Fincla voltam ao estado de antes da conciliação");
    // G3-3-05: o resumo diz a mesma situação do detalhe (a fatura estava fechada), com maiúscula.
    expect(screen.getByTestId("undo-invoice-reopens")).toHaveTextContent(/^A Fatura Itaú Visa · outubro volta a ficar fechada$/);
    const row = screen.getByTestId("undo-restored-invoice");
    expect(row.textContent).toBe(
      "Fatura Itaú Visa · outubroVolta a ficar fechada, sem data de pagamento (a conciliação a tinha pago na data do banco).",
    );
  });

  it("uma fatura que estava em aberto diz que volta a ficar em aberto", async () => {
    const invoice = preview.to_restore.find((r) => r.entity_type === "invoice");
    invoice.invoice = { ...invoice.invoice, status_back: "open" };
    await openUndo();

    expect(screen.getByTestId("undo-invoice-reopens")).toHaveTextContent(/^A Fatura Itaú Visa · outubro volta a ficar em aberto$/);
    expect(screen.getByTestId("undo-restored-invoice")).toHaveTextContent("Volta a ficar em aberto, sem data de pagamento");
  });

  it("paga de novo pela pessoa depois de concluir: fica como ela deixou", async () => {
    const invoice = preview.to_restore.find((r) => r.entity_type === "invoice");
    Object.assign(invoice, {
      edited_after: true,
      changed_fields: ["paid_date"],
      kept_fields: ["status", "paid_date"],
      invoice: { ...invoice.invoice, status_back: null },
    });
    await openUndo();

    await waitFor(() => expect(screen.getByTestId("undo-restored-invoice")).toBeInTheDocument());
    const row = screen.getByTestId("undo-restored-invoice");
    expect(within(row).getByText("Editada depois: data de pagamento")).toBeInTheDocument();
    expect(row).toHaveTextContent("Você mudou o pagamento dela depois da conciliação: fica como você deixou.");
    expect(screen.queryByTestId("undo-invoice-reopens")).not.toBeInTheDocument();
  });
});

describe("varredura de alvos de toque no celular (QA F2 BUG-01)", () => {
  it("nenhum controle de Conferir pagamento de fatura fica abaixo de 44 px", async () => {
    await openDraft({ isMobile: true });
    expect(smallTouchTargets(document.body)).toEqual([]);
  });
});
