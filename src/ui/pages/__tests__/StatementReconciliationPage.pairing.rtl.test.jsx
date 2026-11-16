/** @vitest-environment jsdom */
// Conciliar extrato, "Confirmar lançamentos encontrados" (fincla-api#510), no nível da página.
// Alimentada pela fixture canônica do backend (`suggested_draft`): a padaria vem sugerida e
// ainda falta confirmar; o aluguel já foi confirmado. A gravação é garantida pelos testes de
// API; aqui conferimos o que a pessoa vê, o que a tela manda e que nada some sem desfazer.
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
const ACCOUNT = contract.suggested_draft.account_id;
const IMPORT = contract.suggested_draft.id;
const BASE = `*/v1/accounts/${ACCOUNT}/statement-imports`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const PADARIA = contract.suggested_draft.entries[0].id;
const ALUGUEL = contract.suggested_draft.entries[3].id;

const calls = [];
let draft = clone(contract.suggested_draft);

/** O que o backend faz com uma resposta (ver a API): o par é a sugestão; responder confirma. */
function applyAnswer(entry, body) {
  if (body.answer) {
    entry.answer = body.answer;
    entry.paired_transaction_id = body.answer === "pair" ? entry.suggested_transaction_id : null;
    entry.confirmed = body.confirmed ?? true;
  } else if (body.confirmed !== undefined) {
    entry.confirmed = body.confirmed;
  }
  Object.assign(entry, Object.fromEntries(Object.entries(body).filter(([k]) => !["answer", "confirmed"].includes(k))));
}

const server = setupServer(
  // "Revisar e concluir" mostra a diferença de saldo (fincla-api#514).
  http.get(`${BASE}/${IMPORT}/balance-check`, () => HttpResponse.json(contract.balance_check)),
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
  http.patch(`${BASE}/${IMPORT}/entries/:entryId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ patch: p.entryId, body });
    const entry = draft.entries.find((e) => e.id === p.entryId);
    applyAnswer(entry, body);
    return HttpResponse.json(entry);
  }),
  http.post(`${BASE}/${IMPORT}/suggestions/confirm`, async ({ request }) => {
    const body = await request.json();
    calls.push({ confirm: body });
    draft.entries.filter((e) => body.entry_ids.includes(e.id)).forEach((e) => { e.confirmed = body.confirmed; });
    return HttpResponse.json(draft);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  draft = clone(contract.suggested_draft);
  server.resetHandlers();
  navigate.mockReset();
});

const openDraft = async () => {
  params = { accountId: ACCOUNT, importId: IMPORT };
  render(<StatementReconciliationPage organizationId={ORG} />);
  await screen.findByRole("heading", { name: "Confirmar lançamentos encontrados" });
};

const padariaCard = () => screen.getByRole("article", { name: /PIX QRS PADARIA 02 10/ });
const rows = () => screen.queryAllByTestId("pair-row");
const railStatus = (title) => {
  const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });
  const step = within(rail).getAllByRole("button").find((b) => within(b).getByTestId("step-title").textContent === title);
  return step.textContent.replace(title, "").replace(/^\d/, "");
};

describe("o passo Confirmar lançamentos encontrados", () => {
  it("abre no passo e mostra o par sugerido ligado ao lançamento do banco, com o que acontece ao concluir", async () => {
    await openDraft();

    const card = padariaCard();
    expect(within(card).getByText("No extrato do banco")).toBeInTheDocument();
    expect(within(card).getByText("Sugerido pelo Fincla")).toBeInTheDocument();
    expect(within(card).getByText("Sugerido · falta confirmar")).toBeInTheDocument();
    const fincla = within(card).getByTestId("fincla-side");
    expect(fincla).toHaveTextContent("Padaria do bairro");
    expect(fincla).toHaveTextContent("29/09/2026");
    expect(fincla).toHaveTextContent("Alimentação");
    expect(fincla).toHaveTextContent("Padaria");
    expect(fincla).toHaveTextContent("Em aberto");
    expect(within(card).getByTestId("pair-connector")).toHaveAttribute("data-link", "pair");
    // A data do Fincla é outra: o cartão diz que a data da transação continua.
    expect(within(card).getByText("DATAS DIFERENTES")).toBeInTheDocument();

    const question = within(card).getByRole("group", { name: "Este lançamento do banco já está no Fincla?" });
    expect(within(question).getByRole("button", { name: "Sim, é esta" })).toHaveAttribute("aria-pressed", "true");
    expect(within(question).getByRole("button", { name: "Não, adicionar agora" })).toHaveAttribute("aria-pressed", "false");
    expect(within(question).getByRole("button", { name: "Não registrar" })).toHaveAttribute("aria-pressed", "false");
    expect(within(card).getByTestId("pair-outcome")).toHaveTextContent(
      "Ao concluir a conciliação: Padaria do bairro fica paga em 02/10/2026 (data do banco).",
    );

    // O aluguel já confirmado fica minimizado numa linha que continua visível.
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("PIX TRANSF ALUGUEL 08 10");
    expect(rows()[0]).toHaveTextContent("Sim, é Aluguel");
    expect(railStatus("Confirmar lançamentos encontrados")).toBe("1 sugestão para confirmar");
  });

  it("Sim, é esta confirma o par e o cartão minimiza; Desfazer escolha o traz de volta como estava", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(padariaCard()).getByRole("button", { name: "Sim, é esta" }));

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(calls).toContainEqual({ patch: PADARIA, body: { answer: "pair" } });
    expect(screen.queryByRole("article", { name: /PIX QRS PADARIA/ })).not.toBeInTheDocument();
    expect(screen.getByText("Todos conferidos")).toBeInTheDocument();

    const row = rows().find((r) => r.textContent.includes("PIX QRS PADARIA 02 10"));
    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));

    await waitFor(() => expect(within(padariaCard()).getByText("Sugerido · falta confirmar")).toBeInTheDocument());
    expect(calls).toContainEqual({ patch: PADARIA, body: { answer: "pair", confirmed: false } });
    expect(rows()).toHaveLength(1);
  });

  it("clicar na transação sugerida confirma o par, como o Sim, é esta", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(padariaCard()).getByRole("button", { name: /^Confirmar que é Padaria do bairro/ }));

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(calls).toContainEqual({ patch: PADARIA, body: { answer: "pair" } });
    expect(screen.queryByRole("article", { name: /PIX QRS PADARIA/ })).not.toBeInTheDocument();
  });

  it("Não registrar minimiza o item com o selo próprio, e Desfazer escolha devolve a sugestão", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(padariaCard()).getByRole("button", { name: "Não registrar" }));

    await waitFor(() => expect(rows()).toHaveLength(2));
    const row = rows().find((r) => r.textContent.includes("PIX QRS PADARIA 02 10"));
    expect(row).toHaveTextContent("Não registrar");
    expect(row).toHaveTextContent("Fica fora do Fincla");
    expect(calls).toContainEqual({ patch: PADARIA, body: { answer: "ignore" } });

    await user.click(within(row).getByRole("button", { name: "Desfazer escolha" }));

    await waitFor(() => expect(within(padariaCard()).getByRole("button", { name: "Sim, é esta" })).toHaveAttribute("aria-pressed", "true"));
    expect(calls.at(-1)).toEqual({ patch: PADARIA, body: { answer: "pair", confirmed: false } });
  });

  it("Não, adicionar agora mantém o cartão aberto com a transação nova para conferir", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(padariaCard()).getByRole("button", { name: "Não, adicionar agora" }));

    await waitFor(() => expect(within(padariaCard()).getByTestId("statement-entry-new-side")).toBeInTheDocument());
    const card = padariaCard();
    expect(calls).toContainEqual({ patch: PADARIA, body: { answer: "create" } });
    expect(within(card).getByLabelText("Descrição")).toHaveValue("PIX QRS PADARIA 02 10");
    expect(within(card).getByTestId("pair-connector")).toHaveAttribute("data-link", "create");
    expect(within(card).getByTestId("pair-outcome")).toHaveTextContent("será adicionada");
    expect(within(card).getByRole("button", { name: "Desfazer escolha" })).toBeInTheDocument();
  });

  it("com uma sugestão pendente, o botão fala no singular e confirma só ela, com Desfazer na barra", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(screen.getByRole("button", { name: "Confirmar este lançamento" }));

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(calls).toContainEqual({ confirm: { entry_ids: [PADARIA], confirmed: true } });
    expect(screen.getByText("1 lançamento confirmado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Desfazer" }));

    await waitFor(() => expect(within(padariaCard()).getByText("Sugerido · falta confirmar")).toBeInTheDocument());
    expect(calls).toContainEqual({ confirm: { entry_ids: [PADARIA], confirmed: false } });
    expect(screen.queryByText("1 lançamento confirmado")).not.toBeInTheDocument();
    // O que já estava confirmado antes do lote não é desfeito por ele.
    expect(draft.entries.find((e) => e.id === ALUGUEL).confirmed).toBe(true);
  });

  it("com várias sugestões pendentes, Confirmar os N de uma vez confirma todas e a barra conta no plural (BUG-02)", async () => {
    const user = userEvent.setup();
    draft.entries.find((e) => e.id === ALUGUEL).confirmed = false;
    await openDraft();

    expect(screen.queryByRole("button", { name: "Confirmar este lançamento" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar os 2 de uma vez" }));

    await waitFor(() => expect(screen.getByText("2 lançamentos confirmados")).toBeInTheDocument());
    expect(calls).toContainEqual({ confirm: { entry_ids: [PADARIA, ALUGUEL], confirmed: true } });
    expect(screen.getByText("Todos conferidos")).toBeInTheDocument();
  });

  it("responder um dos confirmados em lote tira a barra: o Desfazer dela não fala mais da verdade (G3-2-06)", async () => {
    const user = userEvent.setup();
    await openDraft();
    await user.click(screen.getByRole("button", { name: "Confirmar este lançamento" }));
    await waitFor(() => expect(screen.getByText("1 lançamento confirmado")).toBeInTheDocument());

    const row = rows().find((r) => r.textContent.includes("PIX QRS PADARIA 02 10"));
    await user.click(within(row).getByRole("button", { name: /Alterar/ }));
    await user.click(within(padariaCard()).getByRole("button", { name: "Não registrar" }));

    await waitFor(() => expect(calls).toContainEqual({ patch: PADARIA, body: { answer: "ignore" } }));
    expect(screen.queryByText("1 lançamento confirmado")).not.toBeInTheDocument();
    expect(calls.filter((c) => c.confirm)).toEqual([{ confirm: { entry_ids: [PADARIA], confirmed: true } }]);
  });

  it("Não registrar no par tem o fundo listrado e o selo próprios, na linha e no cartão (G3-2-09)", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(padariaCard()).getByRole("button", { name: "Não registrar" }));

    await waitFor(() => expect(rows()).toHaveLength(2));
    const row = rows().find((r) => r.textContent.includes("PIX QRS PADARIA 02 10"));
    expect(row.style.background).toContain("repeating-linear-gradient");
    // A linha do aluguel (par confirmado) não tem o fundo do "Não registrar".
    expect(rows().find((r) => r.textContent.includes("ALUGUEL")).style.background).not.toContain("repeating-linear-gradient");

    await user.click(within(row).getByRole("button", { name: /Alterar/ }));
    const side = within(padariaCard()).getByTestId("pair-ignored-side");
    expect(side.style.background).toContain("repeating-linear-gradient");
    expect(side).toHaveTextContent("Não registrar");
  });

  it("minimizar o cartão leva o foco ao Alterar da linha que fica no lugar (G3-2-10)", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(padariaCard()).getByRole("button", { name: "Sim, é esta" }));

    await waitFor(() => expect(rows()).toHaveLength(2));
    const row = rows().find((r) => r.textContent.includes("PIX QRS PADARIA 02 10"));
    await waitFor(() => expect(within(row).getByRole("button", { name: /Alterar/ })).toHaveFocus());

    await user.click(within(rows().find((r) => r.textContent.includes("ALUGUEL"))).getByRole("button", { name: /Alterar/ }));
    await user.click(within(screen.getByRole("article", { name: /ALUGUEL/ })).getByRole("button", { name: "Minimizar" }));
    const aluguel = rows().find((r) => r.textContent.includes("ALUGUEL"));
    await waitFor(() => expect(within(aluguel).getByRole("button", { name: /Alterar/ })).toHaveFocus());
  });

  it("Alterar reabre um par minimizado, e Minimizar o fecha de novo", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(rows()[0]).getByRole("button", { name: /Alterar/ }));

    const aluguel = screen.getByRole("article", { name: /PIX TRANSF ALUGUEL 08 10/ });
    expect(within(aluguel).getByText("Sim, já está no Fincla")).toBeInTheDocument();
    expect(within(aluguel).getByTestId("fincla-side")).toHaveTextContent("Paga em 08/10/2026");
    // Só um cartão aberto por vez (fincla-api#517): a padaria, que estava aberta, vira linha.
    expect(screen.getAllByTestId("pair-card")).toHaveLength(1);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("PIX QRS PADARIA 02 10");

    await user.click(within(aluguel).getByRole("button", { name: "Minimizar" }));

    expect(rows()).toHaveLength(2);
    expect(screen.queryAllByTestId("pair-card")).toHaveLength(0);
    expect(calls).toEqual([]);
  });

  it("o passo só fica Conferido depois que a pessoa passa por ele", async () => {
    const user = userEvent.setup();
    await openDraft();
    await user.click(screen.getByRole("button", { name: "Confirmar este lançamento" }));
    await waitFor(() => expect(rows()).toHaveLength(2));

    // Tudo confirmado, mas a pessoa ainda está no passo: falta conferir.
    expect(railStatus("Confirmar lançamentos encontrados")).toBe("Sugestões prontas · falta você conferir");

    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await waitFor(() => expect(railStatus("Confirmar lançamentos encontrados")).toBe("Conferido"));
    await waitFor(() =>
      expect(calls).toContainEqual({ progress: { current_step: "doubt", reviewed_steps: ["suggested"] } }),
    );
  });

  it("o resumo conta os que já estavam no Fincla", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(within(screen.getByRole("navigation", { name: "Passos da conciliação" })).getByText("Revisar e concluir"));

    expect(await screen.findByTestId("summary-to-pair")).toHaveTextContent("2");
    expect(screen.getByTestId("summary-to-create")).toHaveTextContent("2");
  });
});
