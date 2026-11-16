/** @vitest-environment jsdom */
// A primeira tela do Conciliar extrato na conta (decisão do Owner de 2026-11-16, fincla-api#507):
// tom neutro, área grande de soltar o arquivo (o envio começa ao escolher), "Extratos importados"
// agrupados por ano e, com rascunho aberto, o quadro "Continue de onde parou" — com "Concluir agora"
// e a confirmação no próprio quadro quando nada falta. Alimentada pela fixture canônica do backend.
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
const BASE = `*/v1/accounts/${ACCOUNT}/statement-imports`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const [DRAFT, CONCLUDED, UNDONE, OLDER] = contract.imports.imports;

const calls = [];
let imports = [];
let listReads = 0;
const server = setupServer(
  http.get("*/v1/accounts", () =>
    HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true, initial_balance: { amount: "0.00", currency: "BRL" } }]),
  ),
  http.get(BASE, () => {
    listReads += 1;
    return HttpResponse.json({ imports });
  }),
  http.post(`${BASE}/:importId/conclude`, ({ params: p }) => {
    calls.push({ conclude: p.importId });
    imports = imports.map((i) => (i.id === p.importId ? { ...i, status: "concluded", can_conclude: false, latest_concluded: true, concluded_at: "2026-11-16T10:00:00", current_step: null, balance_now: null, balance_check_actions: null } : { ...i, latest_concluded: false }));
    return HttpResponse.json({ ...clone(contract.draft), id: p.importId, status: "concluded" });
  }),
  http.delete(`${BASE}/:importId`, ({ params: p }) => {
    calls.push({ discard: p.importId });
    imports = imports.filter((i) => i.id !== p.importId);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(BASE, async () => {
    calls.push({ upload: true });
    return HttpResponse.json(contract.draft, { status: 201 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  imports = [];
  listReads = 0;
  server.resetHandlers();
  navigate.mockReset();
});

const openAccount = async () => {
  params = { accountId: ACCOUNT };
  render(<StatementReconciliationPage organizationId={ORG} />);
  await screen.findByRole("heading", { name: "Extratos importados" });
};

/** Um rascunho com `answered` de `total` lançamentos respondidos. */
const draftWith = (answered, total, extra = {}) => ({
  ...clone(DRAFT),
  summary: { ...clone(DRAFT.summary), total, unanswered: total - answered, missing_description: 0 },
  can_conclude: false,
  blockers: total - answered ? [{ code: "unanswered", count: total - answered }] : [],
  ...extra,
});

/** Pronto para concluir: tudo respondido, sem pendência. */
const readyDraft = (summary = {}, extra = {}) => ({
  ...clone(DRAFT),
  summary: { ...clone(DRAFT.summary), missing_description: 0, unanswered: 0, ...summary },
  can_conclude: true,
  blockers: [],
  ...extra,
});

describe("a tela inicial, sem rascunho", () => {
  it("tem o texto neutro, a área de soltar e nenhuma cobrança de tempo", async () => {
    await openAccount();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Conciliar extrato");
    expect(screen.getByText("Compare o extrato do banco com o Fincla quando quiser conferir o saldo. Você vê cada lançamento antes de qualquer coisa mudar.")).toBeInTheDocument();
    expect(await screen.findByText("Itaú")).toBeInTheDocument();
    const zone = screen.getByRole("button", { name: /Solte aqui o extrato do banco/ });
    expect(zone).toHaveTextContent("ou clique para escolher. A leitura começa na hora.");
    expect(zone).toHaveTextContent("OFX, XLS, XLSX ou CSV · até 5 MB");
    expect(screen.queryByText(/ainda não conferid/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("resume-draft")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar extrato" })).not.toBeInTheDocument();
  });

  it("sem conciliação concluída, não há dica", async () => {
    imports = [clone(UNDONE)];
    await openAccount();

    expect(screen.queryByText(/^Dica:/)).not.toBeInTheDocument();
  });

  it("a dica parte do dia seguinte ao fim da última concluída que não foi desfeita", async () => {
    // A desfeita é de setembro e a concluída mais antiga de agosto: vale a concluída mais recente (setembro).
    imports = [clone(UNDONE), clone(OLDER), clone(CONCLUDED)];
    await openAccount();

    expect(screen.getByText("Dica: a última conciliação foi até 30/09/2026. Um extrato a partir de 01/10 continua de onde ela parou.")).toBeInTheDocument();
  });

  it("a dica vira o mês e o ano sem fuso: fim em 31/12 → a partir de 01/01", async () => {
    imports = [{ ...clone(CONCLUDED), period: { start: "2026-12-01", end: "2026-12-31" } }];
    await openAccount();

    expect(screen.getByText("Dica: a última conciliação foi até 31/12/2026. Um extrato a partir de 01/01 continua de onde ela parou.")).toBeInTheDocument();
  });

  it("escolher o arquivo já envia, mostra Lendo… e abre o rascunho criado", async () => {
    let release;
    server.use(http.post(BASE, async () => {
      calls.push({ upload: true });
      await new Promise((resolve) => { release = resolve; });
      return HttpResponse.json(contract.draft, { status: 201 });
    }));
    const user = userEvent.setup();
    await openAccount();

    await user.upload(screen.getByLabelText(/Arquivo do extrato/), new File(["<OFX>"], "extrato-outubro.ofx"));

    expect(await screen.findByText("Lendo extrato-outubro.ofx…")).toBeInTheDocument();
    expect(calls).toEqual([{ upload: true }]);
    release();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${contract.draft.id}` }));
  });

  it("soltar o arquivo na área envia na hora", async () => {
    await openAccount();

    const zone = screen.getByRole("button", { name: /Solte aqui o extrato do banco/ });
    const file = new File(["<OFX>"], "solto.ofx");
    fireEvent.dragOver(zone, { dataTransfer: { files: [file], types: ["Files"] } });
    fireEvent.drop(zone, { dataTransfer: { files: [file], types: ["Files"] } });

    await waitFor(() => expect(calls).toEqual([{ upload: true }]));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${contract.draft.id}` }));
  });

  it("Enter e Espaço na área abrem o seletor de arquivo", async () => {
    await openAccount();
    const input = screen.getByLabelText(/Arquivo do extrato/);
    const click = vi.spyOn(input, "click");

    const zone = screen.getByRole("button", { name: /Solte aqui o extrato do banco/ });
    fireEvent.keyDown(zone, { key: "Enter" });
    fireEvent.keyDown(zone, { key: " " });
    fireEvent.keyDown(zone, { key: "a" });

    expect(click).toHaveBeenCalledTimes(2);
  });

  it("arquivo recusado: o motivo aparece no lugar e dá para escolher outro", async () => {
    server.use(http.post(BASE, () =>
      HttpResponse.json({ detail: { code: "business_rule", message: "O extrato está em USD e a conta em BRL." } }, { status: 422 }),
    ));
    const user = userEvent.setup();
    await openAccount();

    await user.upload(screen.getByLabelText(/Arquivo do extrato/), new File(["x"], "e.ofx"));

    expect(await screen.findByRole("alert")).toHaveTextContent("O extrato está em USD e a conta em BRL.");
    expect(screen.getByRole("button", { name: /Solte aqui o extrato do banco/ })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("planilha não reconhecida: Indique as colunas ocupa o lugar da área e reenvia o mesmo arquivo", async () => {
    let sent = 0;
    server.use(http.post(BASE, async ({ request }) => {
      sent += 1;
      const form = await request.formData();
      if (!form.get("column_mapping")) return HttpResponse.json({ detail: clone(contract.column_mapping_required) }, { status: 422 });
      calls.push({ mapping: JSON.parse(form.get("column_mapping")) });
      return HttpResponse.json(contract.draft, { status: 201 });
    }));
    const user = userEvent.setup();
    await openAccount();

    await user.upload(screen.getByLabelText(/Arquivo do extrato/), new File(["a;b"], "planilha.csv"));

    expect(await screen.findByRole("heading", { name: /Indique as colunas/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Solte aqui o extrato do banco/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ler o extrato com estas colunas" }));
    await waitFor(() => expect(sent).toBe(2));
    expect(calls[0].mapping).toBeTruthy();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${contract.draft.id}` }));
  });

  it("mesmo arquivo com rascunho aberto (409): avisa, recarrega a lista e oferece continuar", async () => {
    server.use(http.post(BASE, () => {
      imports = [clone(DRAFT)];
      return HttpResponse.json({ detail: clone(contract.draft_in_progress) }, { status: 409 });
    }));
    const user = userEvent.setup();
    await openAccount();
    const readsBefore = listReads;

    await user.upload(screen.getByLabelText(/Arquivo do extrato/), new File(["<OFX>"], "repetido.ofx"));

    const notice = await screen.findByTestId("draft-in-progress-notice");
    expect(notice).toHaveTextContent("Você já tem uma conciliação em andamento deste arquivo nesta conta.");
    await waitFor(() => expect(listReads).toBeGreaterThan(readsBefore));
    expect(await screen.findByTestId("resume-draft")).toBeInTheDocument();
    await user.click(within(notice).getByRole("button", { name: "Continuar conciliação" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${DRAFT.id}` });
  });
});

describe("Continue de onde parou (rascunho aberto)", () => {
  it.each([
    [0, 13, "Pronta para começar", "0 de 13 lançamentos respondidos · faltam 13"],
    [6, 13, "Em andamento", "6 de 13 lançamentos respondidos · faltam 7"],
    [7, 13, "Passou da metade", "7 de 13 lançamentos respondidos · faltam 6"],
    [10, 13, "Passou da metade", "10 de 13 lançamentos respondidos · faltam 3"],
    [11, 13, "Quase lá · falta pouco!", "11 de 13 lançamentos respondidos · faltam 2"],
    [12, 13, "Quase lá · falta pouco!", "12 de 13 lançamentos respondidos · falta 1"],
  ])("%i de %i respondidos: selo %s", async (answered, total, badge, count) => {
    imports = [draftWith(answered, total)];
    await openAccount();

    const card = screen.getByTestId("resume-draft");
    expect(within(card).getByTestId("resume-badge")).toHaveTextContent(badge);
    expect(card).toHaveTextContent(count);
    const bar = within(card).getByRole("progressbar", { name: "Lançamentos respondidos" });
    expect(bar).toHaveAttribute("aria-valuenow", String(answered));
    expect(bar).toHaveAttribute("aria-valuemax", String(total));
    expect(within(card).getByRole("button", { name: "Continuar conciliação" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Concluir agora" })).not.toBeInTheDocument();
  });

  it("mostra o período, o passo em que parou e quando é descartado; a área de soltar fica menor", async () => {
    imports = [draftWith(5, 6, { current_step: "balance" }), clone(CONCLUDED)];
    const user = userEvent.setup();
    await openAccount();

    const card = screen.getByTestId("resume-draft");
    expect(within(card).getByRole("heading", { name: "Continue de onde parou" })).toBeInTheDocument();
    expect(card).toHaveTextContent("Extrato de 01/10/2026 a 31/10/2026 · você parou em Conferir o saldo");
    expect(card).toHaveTextContent("Suas respostas estão salvas. Se ficar parada, é descartada em 14/12/2026.");
    expect(screen.getByRole("button", { name: /Ou solte aqui outro extrato/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Solte aqui o extrato do banco/ })).not.toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Continuar conciliação" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${DRAFT.id}` });
  });

  it("sem passo gravado, não diz onde parou", async () => {
    imports = [draftWith(5, 6, { current_step: null })];
    await openAccount();

    const card = screen.getByTestId("resume-draft");
    expect(card).toHaveTextContent("Extrato de 01/10/2026 a 31/10/2026");
    expect(card).not.toHaveTextContent("você parou em");
  });

  it("um quadro por rascunho", async () => {
    imports = [draftWith(1, 6), { ...draftWith(2, 4), id: "outro-rascunho", period: { start: "2026-11-01", end: "2026-11-10" } }];
    await openAccount();

    expect(screen.getAllByTestId("resume-draft")).toHaveLength(2);
  });

  it("tudo respondido mas com pendência: não oferece concluir e diz o que falta", async () => {
    imports = [{ ...draftWith(6, 6), summary: { ...clone(DRAFT.summary), total: 6, unanswered: 0, missing_description: 1 }, blockers: [{ code: "missing_description", count: 1 }] }];
    await openAccount();

    const card = screen.getByTestId("resume-draft");
    expect(within(card).queryByRole("button", { name: "Concluir agora" })).not.toBeInTheDocument();
    expect(card).toHaveTextContent("1 lançamento novo sem descrição");
    expect(within(card).getByTestId("resume-badge")).not.toHaveTextContent("Tudo respondido");
  });

  it("Descartar pede confirmação no quadro e, confirmado, some com o rascunho", async () => {
    imports = [draftWith(3, 6)];
    const user = userEvent.setup();
    await openAccount();

    await user.click(within(screen.getByTestId("resume-draft")).getByRole("button", { name: "Descartar" }));
    await user.click(screen.getByRole("button", { name: "Sim, descartar" }));

    expect(await screen.findByText("Rascunho descartado. Nada mudou nas suas transações.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("resume-draft")).not.toBeInTheDocument());
    expect(calls).toEqual([{ discard: DRAFT.id }]);
  });
});

describe("Concluir agora (nada falta)", () => {
  it("o selo fica verde e os botões viram Concluir agora, Abrir conciliação e Descartar", async () => {
    imports = [readyDraft()];
    const user = userEvent.setup();
    await openAccount();

    const card = screen.getByTestId("resume-draft");
    expect(within(card).getByTestId("resume-badge")).toHaveTextContent("Tudo respondido · só falta concluir");
    expect(card).toHaveTextContent("6 de 6 lançamentos respondidos");
    expect(within(card).getAllByRole("button").map((b) => b.textContent)).toEqual(["Concluir agora", "Abrir conciliação", "Descartar"]);
    await user.click(within(card).getByRole("button", { name: "Abrir conciliação" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${DRAFT.id}` });
  });

  it("a confirmação no quadro resume o que vai acontecer, com os números do servidor", async () => {
    imports = [readyDraft(
      { to_create: 3, groups: 1, to_pair: 2, ignored: 3, unclassified: 1 },
      { balance_check_actions: { delete: 2, change_date: 1 } },
    )];
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));

    const ask = screen.getByRole("group", { name: "Confirmar a conclusão" });
    expect(ask).toHaveTextContent("Concluir a conciliação de 01/10/2026 a 31/10/2026?");
    // O dinheiro sai do Intl, com espaço inseparável depois do símbolo.
    expect(within(ask).getAllByRole("listitem").map((li) => li.textContent.replace(/\u00a0/g, " "))).toEqual([
      "4 transações novas entram no Fincla, pagas na data do banco.",
      "2 que já estavam no Fincla ficam pagas na data do banco.",
      "3 lançamentos não serão registrados.",
      "1 transação vai para Não classificado.",
      "2 transações do Fincla serão excluídas.",
      "1 transação do Fincla muda de data.",
      "Diferença de saldo que fica registrada: −R$ 23,06.",
    ]);
    expect(ask).toHaveTextContent("Dá para desfazer depois, em Extratos importados.");
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("frases com zero não aparecem; singular certo; sem saldo no arquivo a diferença é —, nunca zero", async () => {
    imports = [readyDraft(
      { to_create: 1, groups: 0, to_pair: 1, ignored: 1, unclassified: 0 },
      { balance_now: null, balance_check_actions: { delete: 1, change_date: 0 } },
    )];
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));

    expect(within(screen.getByRole("group", { name: "Confirmar a conclusão" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "1 transação nova entra no Fincla, paga na data do banco.",
      "1 que já estava no Fincla fica paga na data do banco.",
      "1 lançamento não será registrado.",
      "1 transação do Fincla será excluída.",
      "Diferença de saldo que fica registrada: —.",
    ]);
  });

  it("diferença zero aparece como R$ 0,00, sem sinal", async () => {
    imports = [readyDraft({}, { balance_now: { ...clone(DRAFT.balance_now), difference: { amount: "0.00", currency: "BRL" } } })];
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));

    expect(screen.getByRole("group", { name: "Confirmar a conclusão" })).toHaveTextContent("Diferença de saldo que fica registrada: R$ 0,00.");
  });

  it("Agora não fecha a confirmação sem concluir", async () => {
    imports = [readyDraft()];
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));
    await user.click(screen.getByRole("button", { name: "Agora não" }));

    expect(screen.queryByRole("group", { name: "Confirmar a conclusão" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir agora" })).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it("Sim, concluir chama o concluir do rascunho, recarrega a lista e o Desfazer fica na linha dela", async () => {
    imports = [readyDraft(), clone(CONCLUDED)];
    const user = userEvent.setup();
    await openAccount();
    const readsBefore = listReads;

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));
    await user.click(screen.getByRole("button", { name: "Sim, concluir" }));

    expect(await screen.findByText(/Conciliação concluída\./)).toBeInTheDocument();
    expect(calls).toEqual([{ conclude: DRAFT.id }]);
    expect(listReads).toBeGreaterThan(readsBefore);
    await waitFor(() => expect(screen.queryByTestId("resume-draft")).not.toBeInTheDocument());
    const rows = screen.getAllByTestId("imported-statement");
    const undoable = rows.filter((r) => within(r).queryByRole("button", { name: "Desfazer importação" }));
    expect(undoable).toHaveLength(1);
    expect(undoable[0]).toHaveTextContent("01/10/2026 a 31/10/2026");
  });

  it("erro do servidor ao concluir aparece no quadro", async () => {
    server.use(http.post(`${BASE}/:importId/conclude`, () =>
      HttpResponse.json({ detail: { code: "business_rule", message: "Ainda falta responder 1 lançamento." } }, { status: 422 }),
    ));
    imports = [readyDraft()];
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));
    await user.click(screen.getByRole("button", { name: "Sim, concluir" }));

    expect(await within(screen.getByTestId("resume-draft")).findByRole("alert")).toHaveTextContent("Ainda falta responder 1 lançamento.");
  });
});

describe("Extratos importados, agrupados por ano", () => {
  const item = (id, status, start, end, extra = {}) => ({
    ...clone(CONCLUDED), id, status, period: { start, end }, latest_concluded: false, undone_at: status === "undone" ? "2026-01-01T00:00:00" : null, ...extra,
  });

  it("anos do mais novo para o mais antigo, pelo fim do período; o rascunho no topo como Em andamento", async () => {
    imports = [
      item("a", "concluded", "2025-12-15", "2026-01-10", { latest_concluded: true }),
      item("b", "concluded", "2025-11-01", "2025-11-30"),
      draftWith(1, 6),
      item("c", "undone", "2024-03-01", "2024-03-31"),
      item("d", "concluded", "2025-12-01", "2025-12-14"),
    ];
    await openAccount();

    const list = screen.getByRole("region", { name: "Extratos importados" });
    expect(within(list).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["2026", "2025", "2024"]);
    const rows = within(list).getAllByTestId("imported-statement");
    expect(rows.map((r) => r.querySelector("b").textContent)).toEqual([
      "01/10/2026 a 31/10/2026",
      "15/12/2025 a 10/01/2026",
      "01/12/2025 a 14/12/2025",
      "01/11/2025 a 30/11/2025",
      "01/03/2024 a 31/03/2024",
    ]);
    expect(within(rows[0]).getByTestId("import-status")).toHaveTextContent("Em andamento");
    expect(rows.map((r) => within(r).queryByRole("button", { name: "Desfazer importação" }) !== null)).toEqual([false, true, false, false, false]);
  });

  it("a lista rola dentro da coluna", async () => {
    imports = [item("a", "concluded", "2026-01-01", "2026-01-31")];
    await openAccount();

    const scroller = screen.getByTestId("imported-statements-scroll");
    expect(scroller).toHaveClass("fincla-scroll");
    expect(scroller.style.overflowY).toBe("auto");
  });
});
