/** @vitest-environment jsdom */
// Conciliar extrato, "Decidir casos com dúvida" (fincla-api#511), no nível da página.
// Alimentada pela fixture canônica do backend (`doubt_draft` e `search`): Julia já escolheu a
// aula de violão; Paulo está sem resposta e vê a aula desativada ("Desfazer lá"); o Uber tem
// diferença de centavos; a farmácia (lançamento novo) foi pareada pela busca com uma transação
// do Nubank; a TED é uma transferência sugerida. A gravação é garantida pelos testes de API;
// aqui conferimos o que a pessoa vê, o que a tela manda e que nada some sem desfazer.
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
const ACCOUNT = contract.doubt_draft.account_id;
const IMPORT = contract.doubt_draft.id;
const BASE = `*/v1/accounts/${ACCOUNT}/statement-imports`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const [JULIA, PAULO, UBER, TED, FARMACIA] = contract.doubt_draft.entries.map((e) => e.id);

const calls = [];
let draft = clone(contract.doubt_draft);

/** As candidatas e os resultados da busca que a fixture conhece, por id de transação. */
const knownMatches = () => {
  const all = [...draft.entries.flatMap((e) => [e.fincla_match, ...e.candidates]), ...contract.search.results].filter(Boolean);
  return new Map(all.filter((m) => m.kind === "transaction").map((m) => [m.transaction_id, m]));
};

/** O que o backend faz com uma resposta (ver a API): null = sem resposta; pair escolhe; o mesmo par em dois é 409. */
function applyAnswer(entry, body) {
  if ("answer" in body && body.answer === null) {
    Object.assign(entry, { answer: null, confirmed: false, paired_transaction_id: null, paired_transfer_id: null, fincla_match: null, fincla_transaction: null });
    return null;
  }
  if (body.answer === "pair" && body.paired_transaction_id) {
    const other = draft.entries.find((e) => e.id !== entry.id && e.answer === "pair" && e.paired_transaction_id === body.paired_transaction_id);
    if (other) {
      return HttpResponse.json(
        { detail: { code: "conflict", message: `Esta transação já foi escolhida para o lançamento "${other.bank_description}". Desfaça a escolha lá primeiro.` } },
        { status: 409 },
      );
    }
    const match = { ...knownMatches().get(body.paired_transaction_id), taken_by_entry_id: null };
    Object.assign(entry, { answer: "pair", confirmed: true, paired_transaction_id: body.paired_transaction_id, paired_transfer_id: null, fincla_match: match });
    return null;
  }
  if (body.answer) Object.assign(entry, { answer: body.answer, confirmed: body.confirmed ?? true, paired_transaction_id: null, paired_transfer_id: null });
  if (body.answer && body.answer !== "pair") entry.fincla_match = null;
  return null;
}

/** As candidatas "tomadas" acompanham as respostas, como o backend calcula ao vivo. */
function refreshTaken() {
  for (const entry of draft.entries) {
    for (const candidate of entry.candidates) {
      const by = draft.entries.find((e) => e.id !== entry.id && e.answer === "pair" && e.paired_transaction_id === candidate.transaction_id);
      candidate.taken_by_entry_id = by ? by.id : null;
    }
  }
  draft.summary.unanswered = draft.entries.filter((e) => e.answer === null).length;
  draft.blockers = draft.summary.unanswered ? [{ code: "unanswered", count: draft.summary.unanswered }] : [];
  draft.can_conclude = !draft.blockers.length;
}

const server = setupServer(
  // "Revisar e concluir" mostra a diferença de saldo (fincla-api#514).
  http.get(`${BASE}/${IMPORT}/balance-check`, () => {
    calls.push({ balanceCheck: true });
    return HttpResponse.json(contract.balance_check);
  }),
  http.get("*/v1/users/me/preferences", () => HttpResponse.json({ statement_reconciliation_view: "detailed" })),
  http.get("*/v1/accounts", () => HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true }])),
  http.get("*/v1/tags", () => HttpResponse.json({ tags: [] })),
  http.get(`${BASE}/${IMPORT}`, () => HttpResponse.json(draft)),
  http.patch(`${BASE}/${IMPORT}`, async ({ request }) => {
    const body = await request.json();
    calls.push({ progress: body });
    Object.assign(draft, body);
    return HttpResponse.json(draft);
  }),
  http.get(`${BASE}/${IMPORT}/entries/:entryId/search`, ({ request, params: p }) => {
    calls.push({ search: p.entryId, q: new URL(request.url).searchParams.get("q") });
    return HttpResponse.json(contract.search);
  }),
  http.patch(`${BASE}/${IMPORT}/entries/:entryId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ patch: p.entryId, body });
    const entry = draft.entries.find((e) => e.id === p.entryId);
    const refused = applyAnswer(entry, body);
    if (refused) return refused;
    refreshTaken();
    return HttpResponse.json(entry);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  draft = clone(contract.doubt_draft);
  server.resetHandlers();
  navigate.mockReset();
});

const openDraft = async () => {
  params = { accountId: ACCOUNT, importId: IMPORT };
  render(<StatementReconciliationPage organizationId={ORG} />);
  await screen.findByRole("heading", { name: "Decidir casos com dúvida" });
};

const card = (text) => screen.getByRole("article", { name: new RegExp(text) });
const patches = () => calls.filter((c) => c.patch);
const railStatus = (title) => {
  const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });
  const step = within(rail).getAllByRole("button").find((b) => within(b).getByTestId("step-title").textContent === title);
  return step.textContent.replace(title, "").replace(/^\d/, "");
};
const goTo = async (user, title) => {
  const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });
  await user.click(within(rail).getAllByRole("button").find((b) => within(b).getByTestId("step-title").textContent === title));
  await screen.findByRole("heading", { name: title });
};

describe("a diferença de saldo no topo (história 24, G3-3-02)", () => {
  it("fica ao lado do progresso e muda depois de cada resposta, sem pedir a conferência inteira", async () => {
    const user = userEvent.setup();
    // O backend recalcula a cada resposta: Paulo era o corte de cabelo, e os saldos passam a bater.
    server.use(http.patch(`${BASE}/${IMPORT}/entries/:entryId`, async ({ request, params: p }) => {
      const body = await request.json();
      calls.push({ patch: p.entryId, body });
      const entry = draft.entries.find((e) => e.id === p.entryId);
      applyAnswer(entry, body);
      refreshTaken();
      draft.balance_now = { ...draft.balance_now, fincla: draft.balance_now.bank, difference: { amount: "0.00", currency: "BRL" } };
      return HttpResponse.json(entry);
    }));
    await openDraft();

    const now = screen.getByTestId("balance-now");
    expect(now).toHaveAttribute("role", "status");
    expect(now).toHaveAttribute("aria-live", "polite");
    expect(now).toHaveAttribute("data-state", "off");
    expect(now.textContent.replace(/\u00a0/g, " ")).toBe(
      "Diferença de saldo agora−R$ 45,90Banco R$ 1.834,10 · Fincla R$ 1.880,00 em 31/10",
    );

    await user.click(within(card("PIX TRANSF PAULO V06 10")).getByRole("button", { name: /Corte de cabelo/ }));

    await waitFor(() => expect(screen.getByTestId("balance-now")).toHaveAttribute("data-state", "ok"));
    expect(screen.getByTestId("balance-now").textContent.replace(/\u00a0/g, " ")).toBe(
      "Diferença de saldo agoraR$ 0,00Banco e Fincla batem em 31/10",
    );
    expect(calls.filter((c) => c.balanceCheck)).toEqual([]);
  });

  it("sem saldo no arquivo mostra — e diz por quê, nunca zero", async () => {
    draft.balance_now = null;
    await openDraft();

    const now = screen.getByTestId("balance-now");
    expect(now).toHaveAttribute("data-state", "unknown");
    expect(within(now).getByTestId("balance-now-value")).toHaveTextContent(/^—$/);
    expect(now).toHaveTextContent("O arquivo não informa saldo");
    expect(now).not.toHaveTextContent("0,00");
  });
});

describe("a diferença de saldo fica fixa no topo ao rolar", () => {
  const stickyOf = (panel) => panel.closest('[data-sticky="balance-now"]');

  it("no computador o topo (progresso e diferença) gruda no alto da página, acima de todos os passos", async () => {
    await openDraft();

    const sticky = stickyOf(screen.getByTestId("balance-now"));
    expect(sticky).not.toBeNull();
    expect(sticky).toHaveStyle({ position: "sticky", top: "0px" });
    // Fundo próprio: o que rola por baixo não aparece através dele.
    expect(sticky.style.background).not.toBe("");
    // Gruda na página inteira, não num pedaço dela: o passo e a lista ficam no mesmo bloco, abaixo.
    expect(sticky.parentElement).toContainElement(screen.getByRole("heading", { name: "Decidir casos com dúvida" }));
    // Continua completo no computador.
    expect(screen.getByTestId("balance-now").textContent.replace(/\u00a0/g, " ")).toBe(
      "Diferença de saldo agora−R$ 45,90Banco R$ 1.834,10 · Fincla R$ 1.880,00 em 31/10",
    );
  });

  it("vale em qualquer passo: muda de passo e continua fixo", async () => {
    const user = userEvent.setup();
    await openDraft();
    await goTo(user, "Revisar e concluir");

    expect(stickyOf(screen.getByTestId("balance-now"))).toHaveStyle({ position: "sticky", top: "0px" });
  });

  it("no celular fica compacto: uma linha com o rótulo curto e o valor, e só ele gruda", async () => {
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} isMobile />);
    await screen.findByRole("heading", { name: "Decidir casos com dúvida" });

    const panel = screen.getByTestId("balance-now");
    expect(panel).toHaveAttribute("data-compact", "true");
    expect(panel.textContent.replace(/\u00a0/g, " ")).toBe("Diferença agora−R$ 45,90");
    expect(panel).toHaveAttribute("role", "status");
    expect(panel).toHaveStyle({ display: "flex", alignItems: "center" });
    const sticky = stickyOf(panel);
    expect(sticky).toHaveStyle({ position: "sticky", top: "0px" });
    // O progresso não gruda junto (ocuparia a tela do celular).
    expect(sticky).not.toContainElement(screen.getByText(/Seu progresso/));
    expect(sticky.parentElement).toContainElement(screen.getByRole("heading", { name: "Decidir casos com dúvida" }));
    // Texto nunca abaixo de 11px.
    for (const el of [panel, ...panel.querySelectorAll("*")]) {
      const size = Number.parseFloat(el.style.fontSize);
      if (!Number.isNaN(size)) expect(size).toBeGreaterThanOrEqual(11);
    }
  });

  it("no celular, sem saldo no arquivo, mostra — e nunca zero", async () => {
    draft.balance_now = null;
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} isMobile />);
    await screen.findByRole("heading", { name: "Decidir casos com dúvida" });

    const panel = screen.getByTestId("balance-now");
    expect(within(panel).getByTestId("balance-now-value")).toHaveTextContent(/^—$/);
    expect(panel).toHaveAttribute("aria-label", "Diferença de saldo agora: o arquivo não informa saldo");
  });

  it("o que ganha foco ao rolar não fica escondido atrás dele: a página reserva o espaço e devolve ao sair", async () => {
    const scroller = document.createElement("div");
    scroller.setAttribute("data-fincla-main-scroll", "");
    scroller.style.scrollPaddingTop = "4px";
    document.body.appendChild(scroller);
    params = { accountId: ACCOUNT, importId: IMPORT };
    const { unmount } = render(<StatementReconciliationPage organizationId={ORG} />, { container: scroller });
    await screen.findByRole("heading", { name: "Decidir casos com dúvida" });

    expect(scroller.style.scrollPaddingTop).toMatch(/^\d+px$/);
    expect(scroller.style.scrollPaddingTop).not.toBe("4px");

    unmount();
    expect(scroller.style.scrollPaddingTop).toBe("4px");
    scroller.remove();
  });
});

describe("o passo Decidir casos com dúvida", () => {
  it("nada vem pré-marcado: o sem resposta mostra as opções e a já escolhida noutro lançamento desativada", async () => {
    await openDraft();

    expect(railStatus("Decidir casos com dúvida")).toBe("1 lançamento para responder");
    const paulo = card("PIX TRANSF PAULO V06 10");
    expect(within(paulo).getByText("Falta responder")).toBeInTheDocument();
    expect(within(paulo).getByText("2 opções no Fincla parecidas")).toBeInTheDocument();
    const question = within(paulo).getByRole("group", { name: "Este lançamento do banco já está no Fincla?" });
    for (const name of ["Sim, é esta", "Não, adicionar agora", "Não registrar"]) {
      expect(within(question).getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
    expect(within(paulo).getByText("Confira se é a mesma e clique nela para confirmar.")).toBeInTheDocument();
    const [option] = within(paulo).getAllByTestId("match-option");
    expect(option).toHaveTextContent("Corte de cabelo");
    // O botão cobre a opção sem embrulhar a lista de dados (G3-3-13): o nome é curto e as
    // consequências chegam ao leitor de tela pela descrição.
    const pick = within(option).getByRole("button");
    expect(pick).toHaveAttribute("aria-pressed", "false");
    expect(pick.querySelector("dl")).toBeNull();
    expect(option.querySelector("button dl, button div")).toBeNull();
    // A aula de violão já é o par da Julia: visível, desativada, com o caminho de volta.
    const taken = within(paulo).getByTestId("match-taken");
    expect(taken).toHaveAttribute("aria-disabled", "true");
    expect(taken).toHaveTextContent("Aula de violão");
    expect(taken).toHaveTextContent("Você já disse que esta é o lançamento do banco de 04/10/2026 (PIX TRANSF JULIA F04 10).");
    expect(within(taken).getByRole("button", { name: "Desfazer lá" })).toBeInTheDocument();
    // Os respondidos ficam minimizados numa linha que continua visível.
    expect(screen.getAllByTestId("doubt-row").map((r) => r.textContent)).toEqual([
      expect.stringContaining("Sim, é Aula de violão"),
      expect.stringContaining("Sim, é Uber · valor do banco"),
    ]);
  });

  it("escolher uma a mostra ligada e minimiza, com Desfazer escolha que volta a sem resposta", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(card("PIX TRANSF PAULO V06 10")).getByRole("button", { name: /Corte de cabelo/ }));

    await waitFor(() => expect(patches()).toEqual([{ patch: PAULO, body: { answer: "pair", paired_transaction_id: 92 } }]));
    const row = (await screen.findAllByTestId("doubt-row")).find((r) => r.textContent.includes("PAULO"));
    expect(row).toHaveTextContent("Sim, é Corte de cabelo");
    expect(railStatus("Decidir casos com dúvida")).not.toContain("para responder");

    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));

    await waitFor(() => expect(patches().at(-1)).toEqual({ patch: PAULO, body: { answer: null } }));
    expect(await within(await screen.findByRole("article", { name: /PAULO/ })).findByText("Falta responder")).toBeInTheDocument();
  });

  it("Sim, é esta com uma só opção livre escolhe essa", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(card("PIX TRANSF PAULO V06 10")).getByRole("button", { name: "Sim, é esta" }));

    await waitFor(() => expect(patches()).toEqual([{ patch: PAULO, body: { answer: "pair", paired_transaction_id: 92 } }]));
  });

  it("Sim, é esta com várias opções livres só pede a escolha, sem gravar nada", async () => {
    // Julia ainda sem resposta: as duas aulas/cortes estão livres para ela.
    Object.assign(draft.entries[0], { answer: null, confirmed: false, paired_transaction_id: null, fincla_match: null, fincla_transaction: null });
    refreshTaken();
    const user = userEvent.setup();
    await openDraft();
    const julia = card("PIX TRANSF JULIA F04 10");
    expect(within(julia).getByText("Qual destas é o mesmo lançamento do banco? Clique para escolher.")).toBeInTheDocument();

    await user.click(within(julia).getByRole("button", { name: "Sim, é esta" }));

    expect(within(julia).getByRole("button", { name: "Sim, é esta" })).toHaveAttribute("aria-pressed", "true");
    expect(julia).toHaveTextContent("Escolha ao lado qual transação é.");
    expect(patches()).toEqual([]);
  });

  it("Desfazer lá solta a transação do outro lançamento e ela fica disponível aqui", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(card("PIX TRANSF PAULO V06 10")).getByRole("button", { name: "Desfazer lá" }));

    await waitFor(() => expect(patches()).toEqual([{ patch: JULIA, body: { answer: null } }]));
    const paulo = card("PIX TRANSF PAULO V06 10");
    await waitFor(() => expect(within(paulo).queryByTestId("match-taken")).toBeNull());
    expect(within(paulo).getAllByTestId("match-option").map((o) => o.textContent)).toEqual([
      expect.stringContaining("Corte de cabelo"),
      expect.stringContaining("Aula de violão"),
    ]);
    // A Julia volta a pedir resposta, com o próprio Desfazer escolha; o Paulo continua o aberto
    // (só um cartão por vez, fincla-api#517), então ela aparece como linha.
    const julia = screen.getAllByTestId("doubt-row").find((r) => r.textContent.includes("PIX TRANSF JULIA F04 10"));
    expect(within(julia).getByText("Falta responder")).toBeInTheDocument();
    expect(within(julia).getByRole("button", { name: "Desfazer escolha" })).toBeInTheDocument();
  });

  it("os selos de diferença dizem o que acontece ao concluir: valor antigo → novo", async () => {
    const user = userEvent.setup();
    await openDraft();

    const uberRow = screen.getAllByTestId("doubt-row").find((r) => r.textContent.includes("UBERX"));
    await user.click(within(uberRow).getByRole("button", { name: /Alterar/ }));

    const uber = card("RSHOP UBERX 04 10");
    expect(within(uber).getByText("VALOR DIFERENTE")).toBeInTheDocument();
    expect(within(uber).getByTestId("consequence-amount")).toHaveTextContent(
      /Diferença de R\$\s0,47\. Ao concluir a conciliação, o valor no Fincla muda: -R\$\s23,00\s+-R\$\s23,47 \(vale o do banco\)/,
    );
    expect(within(uber).queryByText("OUTRA CONTA")).toBeNull();
    expect(within(uber).getByTestId("doubt-outcome")).toHaveTextContent(
      /Ao concluir a conciliação: Uber fica paga em 04\/10\/2026 \(data do banco\); o valor passa a -R\$\s23,47\./,
    );
  });

  it("Está no Fincla com outros dados… procura em todas as contas e escolher uma de outra conta mostra OUTRA CONTA", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(card("PIX TRANSF PAULO V06 10")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const dialog = await screen.findByRole("dialog", { name: "Procurar a transação no Fincla" });
    await user.type(within(dialog).getByLabelText("Buscar por descrição, conta, valor ou data"), "farm");

    await waitFor(() => expect(calls.filter((c) => c.search).at(-1)).toEqual({ search: PAULO, q: "farm" }));
    const pick = await within(dialog).findByRole("button", { name: /Presente/ });
    const option = pick.closest("[data-testid='match-option']");
    expect(option).toHaveTextContent("Nubank");
    // O leitor de tela ouve o que muda ao concluir pela descrição do botão (G3-3-13).
    expect(pick).toHaveAccessibleDescription(/OUTRA CONTA.*a transação é movida/);
    expect(within(option).getByText("OUTRA CONTA")).toBeInTheDocument();
    expect(within(option).getByTestId("consequence-account")).toHaveTextContent(
      /Ao concluir a conciliação \(se for esta\), a transação é movida: Nubank\s+Itaú/,
    );
    // A aula de violão aparece desativada, porque é o par da Julia.
    expect(within(within(dialog).getByTestId("match-taken")).getByRole("button", { name: "Desfazer lá" })).toBeInTheDocument();

    await user.click(pick);

    await waitFor(() => expect(patches()).toEqual([{ patch: PAULO, body: { answer: "pair", paired_transaction_id: 96 } }]));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const row = screen.getAllByTestId("doubt-row").find((r) => r.textContent.includes("PAULO"));
    expect(row).toHaveTextContent("Sim, é Presente · vem da Nubank");
  });

  it("a busca fecha com Esc e com Cancelar sem mudar nada", async () => {
    const user = userEvent.setup();
    await openDraft();
    const paulo = card("PIX TRANSF PAULO V06 10");

    await user.click(within(paulo).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(within(paulo).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(patches()).toEqual([]);
  });

  it("a busca lê as respostas de agora: a transação já escolhida noutro lançamento vem desativada", async () => {
    server.use(http.get(`${BASE}/${IMPORT}/entries/:entryId/search`, () => HttpResponse.json({
      // A busca respondida antes da escolha da Julia: sem a marca de tomada.
      results: [{ ...contract.search.results[1], taken_by_entry_id: null }],
    })));
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(card("PIX TRANSF PAULO V06 10")).getByRole("button", { name: "Está no Fincla com outros dados…" }));
    const dialog = await screen.findByRole("dialog");
    // A tela lê das respostas atuais: a aula é o par da Julia, então já vem desativada.
    expect(await within(dialog).findByTestId("match-taken")).toHaveTextContent("Aula de violão");
    expect(within(dialog).queryByTestId("match-option")).toBeNull();
  });
});

describe("as outras telas mostram o par de #511", () => {
  it("o lançamento novo pareado pela busca mostra a transação de outra conta com OUTRA CONTA e o que acontece", async () => {
    const user = userEvent.setup();
    await openDraft();

    await goTo(user, "Adicionar lançamentos novos");
    // Tudo já respondido no passo: os lançamentos vêm como linhas; a da farmácia diz o par.
    const row = screen.getAllByTestId("doubt-row").find((r) => r.textContent.includes("RSHOP FARMACIA ETA09 10"));
    expect(row).toHaveTextContent("Sim, é Farmácia");
    await user.click(within(row).getByRole("button", { name: /Alterar/ }));

    const farmacia = card("RSHOP FARMACIA ETA09 10");
    expect(within(farmacia).getByText("OUTRA CONTA")).toBeInTheDocument();
    expect(within(farmacia).getByTestId("doubt-outcome")).toHaveTextContent(
      "Ao concluir a conciliação: Farmácia fica paga em 09/10/2026 (data do banco); é movida da Nubank para a Itaú.",
    );
    expect(within(farmacia).getByRole("button", { name: "Sim, é esta" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a transferência sugerida aparece como transferência, sem criar nada", async () => {
    const user = userEvent.setup();
    await openDraft();

    await goTo(user, "Confirmar lançamentos encontrados");

    const ted = card("TED 102.0001 NUBANK PAGAMENTOS");
    const fincla = within(ted).getByTestId("fincla-side");
    expect(fincla).toHaveTextContent("Transferência para Nubank");
    expect(fincla).toHaveTextContent("Itaú → Nubank");
    expect(within(ted).getByText("Sugerido pelo Fincla")).toBeInTheDocument();
    expect(within(ted).getByTestId("pair-outcome")).toHaveTextContent(
      "Ao concluir a conciliação: nada muda em Transferência para Nubank, que já está no Fincla; nenhuma transação é criada.",
    );
  });

  it("o resumo destaca os valores e as contas que mudam ao concluir, e o bloqueio aponta a dúvida", async () => {
    const user = userEvent.setup();
    await openDraft();

    await goTo(user, "Revisar e concluir");

    const changes = screen.getByTestId("summary-pair-changes");
    expect(changes).toHaveTextContent("1 transação passa a ter o valor do banco");
    expect(changes).toHaveTextContent("1 transação é movida para esta conta");
    expect(screen.getByTestId("conclude-blocked")).toHaveTextContent("1 lançamento sem resposta. Responda todos para concluir (em Decidir casos com dúvida).");
    expect(screen.getByRole("button", { name: "Concluir conciliação" })).toBeDisabled();
  });
});
