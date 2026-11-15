/** @vitest-environment jsdom */
// Conciliar extrato com muitos lançamentos (fincla-api#517), no nível da página.
// A lista de cada passo mostra todos compactos e só o atual aberto; responder abre o próximo sem
// resposta; filtro com contagens e aviso do que esconde; atalhos S/A/N/J/K (nunca dentro de campos
// nem com a busca aberta); clicar em qualquer ponto da linha a reabre; visualização Detalhada ou
// Compacta lembrada por pessoa. Os lançamentos vêm da fixture canônica do backend, multiplicados.
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

/** `count` sugestões ainda sem confirmar (a padaria da fixture, uma por dia) e os lançamentos novos. */
function draftWith(count) {
  const base = clone(contract.suggested_draft);
  const [bakery, salary, energy] = base.entries;
  const suggested = Array.from({ length: count }, (_, i) => ({
    ...clone(bakery),
    id: `s${i + 1}`,
    position: i,
    bank_description: `PIX PADARIA ${String(i + 1).padStart(3, "0")}`,
    confirmed: false,
  }));
  energy.description = "Conta de luz";
  base.entries = [...suggested, salary, energy];
  return base;
}

const calls = [];
let draft = draftWith(5);
let preferences = { statement_reconciliation_view: "detailed" };

function applyAnswer(entry, body) {
  if (body.answer !== undefined) {
    entry.answer = body.answer;
    entry.confirmed = body.confirmed ?? body.answer !== null;
  } else if (body.confirmed !== undefined) {
    entry.confirmed = body.confirmed;
  }
  Object.assign(entry, Object.fromEntries(Object.entries(body).filter(([k]) => !["answer", "confirmed"].includes(k))));
}

const server = setupServer(
  http.get("*/v1/users/me/preferences", () => HttpResponse.json(preferences)),
  http.patch("*/v1/users/me/preferences", async ({ request }) => {
    const body = await request.json();
    calls.push({ preferences: body });
    preferences = { ...preferences, ...body };
    return HttpResponse.json(preferences);
  }),
  http.get("*/v1/accounts", () => HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true }])),
  http.get("*/v1/tags", () => HttpResponse.json({ tags: [] })),
  http.get(`${BASE}/${IMPORT}`, () => HttpResponse.json(draft)),
  http.patch(`${BASE}/${IMPORT}`, async ({ request }) => {
    Object.assign(draft, await request.json());
    return HttpResponse.json(draft);
  }),
  http.patch(`${BASE}/${IMPORT}/entries/:entryId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ patch: p.entryId, body });
    const entry = draft.entries.find((e) => e.id === p.entryId);
    applyAnswer(entry, body);
    return HttpResponse.json(entry);
  }),
  http.get(`${BASE}/${IMPORT}/entries/:entryId/search`, ({ params: p }) => {
    calls.push({ search: p.entryId });
    return HttpResponse.json(contract.search);
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  draft = draftWith(5);
  preferences = { statement_reconciliation_view: "detailed" };
  server.resetHandlers();
});

const openDraft = async () => {
  params = { accountId: ACCOUNT, importId: IMPORT };
  render(<StatementReconciliationPage organizationId={ORG} />);
  await screen.findByRole("heading", { name: "Confirmar lançamentos encontrados" });
  return userEvent.setup();
};

const position = () => screen.getByTestId("queue-position").textContent;
const pending = () => screen.getByTestId("queue-pending").textContent;
/** O lançamento aberto (só um por vez). */
const current = () => screen.getByTestId("current-entry");
const currentIs = (bankText) => expect(within(current()).getByTestId("pair-card")).toHaveTextContent(bankText);
const rows = () => screen.queryAllByTestId("pair-row");
const row = (bankText) => rows().find((r) => r.textContent.includes(bankText));
const answers = () => calls.filter((c) => c.patch);

describe("lista com só o atual aberto", () => {
  it("mostra todos compactos e só o primeiro sem resposta aberto, com a posição e quantos faltam", async () => {
    await openDraft();

    expect(screen.getAllByTestId("pair-card")).toHaveLength(1);
    currentIs("PIX PADARIA 001");
    expect(rows().map((r) => r.textContent)).toEqual([2, 3, 4, 5].map((n) => expect.stringContaining(`PIX PADARIA 00${n}`)));
    expect(position()).toBe("Lançamento 1 de 5");
    expect(pending()).toBe("5 sem resposta");
    expect(screen.getByTestId("queue-shortcuts")).toHaveTextContent("Atalhos: S sim · A adicionar · N não registrar · J/K próximo/anterior");
  });

  it("responder abre o próximo sem resposta e leva o foco ao cartão aberto", async () => {
    const user = await openDraft();

    await user.click(within(current()).getByRole("button", { name: "Sim, é esta" }));

    await waitFor(() => currentIs("PIX PADARIA 002"));
    expect(answers()).toEqual([{ patch: "s1", body: { answer: "pair" } }]);
    expect(position()).toBe("Lançamento 2 de 5");
    expect(pending()).toBe("4 sem resposta");
    expect(row("PIX PADARIA 001")).toHaveTextContent("Sim, já está no Fincla");
    await waitFor(() => expect(current()).toHaveFocus());
  });

  it("pula os já respondidos e dá a volta na lista até o próximo sem resposta", async () => {
    draft.entries[1].confirmed = true;
    draft.entries[2].confirmed = true;
    const user = await openDraft();
    await user.click(row("PIX PADARIA 004"));
    expect(position()).toBe("Lançamento 4 de 5");

    await user.click(within(current()).getByRole("button", { name: "Não registrar" }));
    await waitFor(() => currentIs("PIX PADARIA 005"));
    await user.click(within(current()).getByRole("button", { name: "Não registrar" }));

    // Depois do último, volta ao primeiro que ainda falta (o 1), sem reabrir os respondidos (2 e 3).
    await waitFor(() => currentIs("PIX PADARIA 001"));
    expect(pending()).toBe("1 sem resposta");
  });

  it("Não, adicionar agora mantém o cartão aberto com Próximo sem resposta →", async () => {
    const user = await openDraft();

    await user.click(within(current()).getByRole("button", { name: "Não, adicionar agora" }));

    await waitFor(() => expect(within(current()).getByTestId("statement-entry-new-side")).toBeInTheDocument());
    currentIs("PIX PADARIA 001");
    expect(position()).toBe("Lançamento 1 de 5");

    await user.click(within(current()).getByRole("button", { name: "Próximo sem resposta →" }));

    currentIs("PIX PADARIA 002");
    expect(answers()).toEqual([{ patch: "s1", body: { answer: "create" } }]);
  });

  it("quando o último sem resposta é respondido, nenhum fica aberto e a página diz que acabou", async () => {
    draft = draftWith(1);
    const user = await openDraft();

    await user.click(within(current()).getByRole("button", { name: "Sim, é esta" }));

    await waitFor(() => expect(screen.queryByTestId("current-entry")).toBeNull());
    expect(pending()).toBe("Todos respondidos");
    expect(position()).toBe("1 lançamento");
    expect(screen.getByText("Tudo respondido neste passo. Clique em qualquer lançamento para rever.")).toBeInTheDocument();
    // O foco vai para o "Alterar" da linha que ficou no lugar.
    await waitFor(() => expect(within(row("PIX PADARIA 001")).getByRole("button", { name: /Alterar/ })).toHaveFocus());
  });
});

describe("filtro Todos / Falta responder / Respondidos", () => {
  it("conta cada grupo, esconde com aviso e Mostrar todos traz tudo de volta", async () => {
    const user = await openDraft();
    await user.click(within(current()).getByRole("button", { name: "Sim, é esta" }));
    await waitFor(() => currentIs("PIX PADARIA 002"));
    const show = () => screen.getByRole("group", { name: "Mostrar:" });

    expect(within(show()).getAllByRole("button").map((b) => b.textContent)).toEqual(["Todos (5)", "Falta responder (4)", "Respondidos (1)"]);
    expect(screen.queryByTestId("queue-hidden")).toBeNull();

    await user.click(within(show()).getByRole("button", { name: "Falta responder (4)" }));

    expect(row("PIX PADARIA 001")).toBeUndefined();
    expect(screen.getByTestId("queue-hidden")).toHaveTextContent("1 lançamento já respondido não aparece com este filtro · Mostrar todos");
    expect(rows()).toHaveLength(3);

    // Responder com o filtro ligado: o respondido sai da lista, e o aviso conta mais um.
    await user.click(within(current()).getByRole("button", { name: "Não registrar" }));
    await waitFor(() => currentIs("PIX PADARIA 003"));
    expect(row("PIX PADARIA 002")).toBeUndefined();
    expect(screen.getByTestId("queue-hidden")).toHaveTextContent("2 lançamentos já respondidos não aparecem com este filtro");

    await user.click(within(show()).getByRole("button", { name: "Respondidos (2)" }));
    // O aberto continua visível mesmo sem resposta; os outros sem resposta saem, com aviso.
    currentIs("PIX PADARIA 003");
    expect(rows().map((r) => r.textContent)).toEqual([expect.stringContaining("PIX PADARIA 001"), expect.stringContaining("PIX PADARIA 002")]);
    expect(screen.getByTestId("queue-hidden")).toHaveTextContent("2 lançamentos sem resposta não aparecem com este filtro");

    await user.click(within(screen.getByTestId("queue-hidden")).getByRole("button", { name: "Mostrar todos" }));

    expect(rows()).toHaveLength(4);
    expect(screen.queryByTestId("queue-hidden")).toBeNull();
    expect(within(show()).getByRole("button", { name: "Todos (5)" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("atalhos de teclado", () => {
  it("S responde Sim e avança; N não registra e avança; A adiciona e fica; J/K andam", async () => {
    const user = await openDraft();

    await user.keyboard("s");
    await waitFor(() => currentIs("PIX PADARIA 002"));
    await user.keyboard("n");
    await waitFor(() => currentIs("PIX PADARIA 003"));
    await user.keyboard("a");
    await waitFor(() => expect(within(current()).getByTestId("statement-entry-new-side")).toBeInTheDocument());
    currentIs("PIX PADARIA 003");

    expect(answers()).toEqual([
      { patch: "s1", body: { answer: "pair" } },
      { patch: "s2", body: { answer: "ignore" } },
      { patch: "s3", body: { answer: "create" } },
    ]);

    await user.keyboard("j");
    currentIs("PIX PADARIA 004");
    await user.keyboard("k");
    await user.keyboard("k");
    currentIs("PIX PADARIA 002");
    await waitFor(() => expect(current()).toHaveFocus());
  });

  it("ficam desligados dentro de um campo e com Ctrl/Cmd", async () => {
    const user = await openDraft();
    await user.keyboard("a");
    const description = await within(current()).findByLabelText("Descrição");
    const before = answers().length;

    await user.click(description);
    await user.keyboard("snjk");
    await user.keyboard("{Control>}s{/Control}");

    expect(answers()).toHaveLength(before);
    currentIs("PIX PADARIA 001");
    expect(description).toHaveValue("PIX QRS PADARIA 02 10snjk");
  });

  it("ficam desligados com a busca no Fincla aberta", async () => {
    draft.entries.forEach((e) => { if (e.classification === "suggested") e.confirmed = true; });
    const user = await openDraft();
    await user.click(within(screen.getByRole("navigation", { name: "Passos da conciliação" })).getByText("Adicionar lançamentos novos"));
    await screen.findByRole("heading", { name: "Adicionar lançamentos novos" });
    await user.click(within(screen.getAllByTestId("entry-row")[0]).getByRole("button", { name: /Alterar/ }));

    // S nos lançamentos novos é "Está no Fincla com outros dados…": abre a busca.
    await user.keyboard("s");
    const dialog = await screen.findByRole("dialog");
    await user.click(dialog);
    await user.keyboard("n");
    await user.keyboard("j");

    expect(answers()).toEqual([]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("o mesmo mecanismo nos lançamentos novos", () => {
  it("abre o que falta (sem descrição); N não registra e o lançamento minimiza sem sumir; A não avança", async () => {
    draft.entries.forEach((e) => { if (e.classification === "suggested") e.confirmed = true; });
    draft.entries.find((e) => e.bank_description === "PAG BOLETO ENERGIA").description = "";
    const user = await openDraft();
    await user.click(within(screen.getByRole("navigation", { name: "Passos da conciliação" })).getByText("Adicionar lançamentos novos"));
    await screen.findByRole("heading", { name: "Adicionar lançamentos novos" });

    expect(position()).toBe("Lançamento 2 de 2");
    expect(pending()).toBe("1 sem resposta");
    expect(within(current()).getByTestId("statement-entry")).toHaveTextContent("PAG BOLETO ENERGIA");
    expect(screen.getAllByTestId("entry-row").map((r) => r.textContent)).toEqual([expect.stringContaining("REMUNERACAO SALARIO")]);

    await user.keyboard("a");
    expect(answers()).toEqual([]);
    await user.keyboard("n");

    await waitFor(() => expect(screen.queryByTestId("current-entry")).toBeNull());
    expect(answers()).toEqual([{ patch: draft.entries.find((e) => e.bank_description === "PAG BOLETO ENERGIA").id, body: { answer: "ignore" } }]);
    expect(screen.getByTestId("ignored-entry")).toHaveTextContent("PAG BOLETO ENERGIA");
    expect(pending()).toBe("Todos respondidos");
  });
});

describe("reabrir uma linha", () => {
  it("clicar em qualquer ponto da linha minimizada a abre como o atual, com Alterar no começo", async () => {
    const user = await openDraft();
    const target = row("PIX PADARIA 004");
    expect(within(target).getAllByRole("button")[0]).toHaveTextContent("Alterar");

    await user.click(within(target).getByText("PIX PADARIA 004"));

    currentIs("PIX PADARIA 004");
    expect(position()).toBe("Lançamento 4 de 5");
    expect(row("PIX PADARIA 001")).toBeTruthy();
    expect(screen.getAllByTestId("pair-card")).toHaveLength(1);
    expect(answers()).toEqual([]);
    await waitFor(() => expect(current()).toHaveFocus());
  });

  it("o Alterar da linha abre uma vez só (o clique não vale duas ações)", async () => {
    const user = await openDraft();

    await user.click(within(row("PIX PADARIA 003")).getByRole("button", { name: /Alterar/ }));

    currentIs("PIX PADARIA 003");
    expect(screen.getAllByTestId("pair-card")).toHaveLength(1);
    expect(answers()).toEqual([]);
  });
});

describe("visualização Detalhada / Compacta", () => {
  it("abre na Detalhada quando a pessoa nunca escolheu, e Compacta põe os rótulos ao lado dos valores e é gravada", async () => {
    const user = await openDraft();
    const view = () => screen.getByRole("group", { name: "Visualização:" });

    expect(within(view()).getByRole("button", { name: "Detalhada" })).toHaveAttribute("aria-pressed", "true");
    expect(within(current()).queryByTestId("bank-inline")).toBeNull();

    await user.click(within(view()).getByRole("button", { name: "Compacta" }));

    expect(within(view()).getByRole("button", { name: "Compacta" })).toHaveAttribute("aria-pressed", "true");
    const bank = within(current()).getByTestId("bank-inline");
    expect(bank).toHaveTextContent(/Data\s*02\/10\/2026/);
    expect(bank).toHaveTextContent(/Descrição\s*PIX PADARIA 001/);
    expect(bank).toHaveTextContent(/Valor\s*-R\$\s45,90/);
    expect(within(current()).getByTestId("match-inline")).toHaveTextContent(/Descrição\s*Padaria do bairro/);
    await waitFor(() => expect(calls).toContainEqual({ preferences: { statement_reconciliation_view: "compact" } }));
  });

  it("volta na visualização que a pessoa escolheu antes", async () => {
    preferences = { statement_reconciliation_view: "compact" };
    await openDraft();

    await waitFor(() => expect(within(current()).getByTestId("bank-inline")).toBeInTheDocument());
    expect(within(screen.getByRole("group", { name: "Visualização:" })).getByRole("button", { name: "Compacta" })).toHaveAttribute("aria-pressed", "true");
    expect(calls.filter((c) => c.preferences)).toEqual([]);
  });

  it("se não der para gravar, volta à anterior e diz por quê", async () => {
    server.use(http.patch("*/v1/users/me/preferences", () => HttpResponse.json({ detail: "x" }, { status: 500 })));
    const user = await openDraft();

    await user.click(within(screen.getByRole("group", { name: "Visualização:" })).getByRole("button", { name: "Compacta" }));

    await screen.findByText("Não foi possível guardar a visualização escolhida. Tente de novo.");
    expect(within(screen.getByRole("group", { name: "Visualização:" })).getByRole("button", { name: "Detalhada" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("volume grande", () => {
  it("com 300 lançamentos só o atual tem o cartão completo, e responder avança", async () => {
    draft = draftWith(300);
    const user = await openDraft();

    expect(screen.getAllByTestId("pair-card")).toHaveLength(1);
    expect(screen.getAllByTestId("fincla-side")).toHaveLength(1);
    expect(rows()).toHaveLength(299);
    expect(position()).toBe("Lançamento 1 de 300");

    await user.keyboard("s");

    await waitFor(() => expect(position()).toBe("Lançamento 2 de 300"));
    expect(pending()).toBe("299 sem resposta");
    expect(screen.getAllByTestId("pair-card")).toHaveLength(1);
  });
});
