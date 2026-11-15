/** @vitest-environment jsdom */
// Conciliar extrato, primeira conciliação de ponta a ponta (fincla-api#508).
// A página é alimentada pela fixture canônica do backend (`statement_import.example.json`,
// presa aos modelos Pydantic por um teste de lá). A gravação é garantida pelos testes de API;
// aqui conferimos o que a pessoa vê e o que a tela manda.
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

const CATEGORIES = [
  { id: "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d", name: "Food", label: "Alimentação", tag_type: { name: "categoria" }, is_active: true, is_fallback: false, allowed_transaction_types: ["expense"] },
  { id: "cat-salary", name: "Salary", label: "Salário", tag_type: { name: "categoria" }, is_active: true, is_fallback: false, allowed_transaction_types: ["income"] },
  { id: "cat-unclassified", name: "Unclassified", label: "Não classificado", tag_type: { name: "categoria" }, is_active: true, is_fallback: true, allowed_transaction_types: ["income", "expense"] },
];

const calls = [];
let draft = clone(contract.draft);
let imports = [];
const server = setupServer(
  http.get("*/v1/accounts", () =>
    HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true, initial_balance: { amount: "0.00", currency: "BRL" } }]),
  ),
  http.get("*/v1/tags", () => HttpResponse.json({ tags: CATEGORIES })),
  http.get(`${BASE}/${IMPORT}`, () => HttpResponse.json(draft)),
  http.get(BASE, () => HttpResponse.json({ imports })),
  http.patch(`${BASE}/${IMPORT}`, async ({ request }) => {
    const body = await request.json();
    calls.push({ progress: body });
    Object.assign(draft, body);
    return HttpResponse.json(draft);
  }),
  http.delete(`${BASE}/:importId`, ({ params: p }) => {
    calls.push({ discard: p.importId });
    imports = imports.filter((i) => i.id !== p.importId);
    return new HttpResponse(null, { status: 204 });
  }),
  http.patch(`${BASE}/${IMPORT}/entries/:entryId`, async ({ request, params: p }) => {
    const body = await request.json();
    calls.push({ patch: p.entryId, body });
    const entry = draft.entries.find((e) => e.id === p.entryId);
    Object.assign(entry, body);
    return HttpResponse.json(entry);
  }),
  http.post(`${BASE}/${IMPORT}/conclude`, () => {
    calls.push({ conclude: IMPORT });
    const concluded = clone(draft);
    concluded.status = "concluded";
    concluded.concluded_at = "2026-11-14T10:30:00";
    concluded.latest_concluded = true;
    concluded.entries.forEach((e, i) => { e.created_transaction_id = 100 + i; });
    return HttpResponse.json(concluded);
  }),
  http.post(BASE, async ({ request }) => {
    const form = await request.formData();
    // jsdom's FormData loses the file name on the way through axios; the field itself must be there.
    calls.push({ upload: form.get("file") ? "file" : null });
    return HttpResponse.json(draft, { status: 201 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => {
  cleanup();
  calls.length = 0;
  draft = clone(contract.draft);
  imports = [];
  server.resetHandlers();
  navigate.mockReset();
});

const openDraft = async () => {
  params = { accountId: ACCOUNT, importId: IMPORT };
  render(<StatementReconciliationPage organizationId={ORG} />);
  await screen.findAllByText("PIX QRS PADARIA 02 10");
};

describe("enviar o extrato", () => {
  it("envia o OFX escolhido e abre o rascunho criado", async () => {
    params = { accountId: ACCOUNT };
    const user = userEvent.setup();
    render(<StatementReconciliationPage organizationId={ORG} />);

    expect(await screen.findByText(/Nada muda no Fincla até você concluir a conciliação/)).toBeInTheDocument();
    const file = new File(["<OFX>"], "extrato-outubro.ofx", { type: "application/x-ofx" });
    await user.upload(screen.getByLabelText(/Arquivo do extrato/), file);
    await user.click(screen.getByRole("button", { name: "Enviar extrato" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${IMPORT}` }));
    expect(calls).toContainEqual({ upload: "file" });
  });

  it("mostra o motivo quando o arquivo é recusado", async () => {
    server.use(
      http.post(BASE, () =>
        HttpResponse.json(
          { detail: { code: "business_rule", message: "O extrato está em USD e a conta em BRL. Envie o extrato para uma conta em USD." } },
          { status: 422 },
        ),
      ),
    );
    params = { accountId: ACCOUNT };
    const user = userEvent.setup();
    render(<StatementReconciliationPage organizationId={ORG} />);

    await user.upload(await screen.findByLabelText(/Arquivo do extrato/), new File(["x"], "e.ofx"));
    await user.click(screen.getByRole("button", { name: "Enviar extrato" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("O extrato está em USD e a conta em BRL");
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("rascunho", () => {
  it("mostra o trilho com os 8 passos; os sem conteúdo dizem que não há nada a fazer", async () => {
    await openDraft();

    const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });
    const steps = within(rail).getAllByRole("button");
    expect(steps.map((s) => within(s).getByTestId("step-title").textContent)).toEqual([
      "Confirmar lançamentos encontrados",
      "Decidir casos com dúvida",
      "Conferir pagamento de fatura",
      "Revisar rendimentos pequenos",
      "Adicionar lançamentos novos",
      "Ver o que fica de fora",
      "Conferir o saldo",
      "Revisar e concluir",
    ]);
    for (const empty of [0, 1, 2, 3, 5]) expect(steps[empty]).toHaveTextContent(/nada a fazer/i);
    expect(steps[4]).toHaveTextContent("1 lançamento sem descrição");
  });

  it("abre em Adicionar lançamentos novos com o banco de um lado e a transação nova do outro", async () => {
    await openDraft();

    expect(screen.getByRole("heading", { name: "Adicionar lançamentos novos" })).toBeInTheDocument();
    const cards = screen.getAllByTestId("statement-entry");
    expect(cards).toHaveLength(3);
    const bakery = cards[0];
    expect(within(bakery).getByText("No extrato do banco")).toBeInTheDocument();
    expect(within(bakery).getByText("No Fincla · nova transação")).toBeInTheDocument();
    expect(within(bakery).getByText("PIX QRS PADARIA 02 10")).toBeInTheDocument();
    expect(within(bakery).getByLabelText("Descrição")).toHaveValue("Padaria do bairro");
    expect(within(bakery).getByLabelText("Categoria")).toHaveValue("7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d");
    // Data e valor vêm do banco e ficam travados.
    expect(within(bakery).getByTestId("locked-date")).toHaveTextContent("02/10/2026");
    expect(within(bakery).getByTestId("locked-amount")).toHaveTextContent("45,90");
    // Saída do banco só vira despesa.
    expect(within(bakery).queryByLabelText("Tipo")).toBeNull();
    expect(within(bakery).getByTestId("locked-type")).toHaveTextContent("Despesa");
    // Entrada: receita ou estorno; sem categoria vai para Não classificado.
    const salary = cards[1];
    expect(within(salary).getByLabelText("Tipo")).toHaveValue("income");
    expect(within(salary).getByText(/vai para Não classificado/)).toBeInTheDocument();
    expect(screen.getAllByText(/Nada muda no Fincla até você concluir a conciliação/).length).toBeGreaterThan(0);
  });

  it("grava a descrição ao sair do campo e mantém o texto do banco visível", async () => {
    await openDraft();
    const user = userEvent.setup();
    const energy = screen.getAllByTestId("statement-entry")[2];

    expect(within(energy).getByText("Escreva uma descrição.")).toBeInTheDocument();
    await user.type(within(energy).getByLabelText("Descrição"), "Conta de luz");
    await user.tab();

    await waitFor(() =>
      expect(calls).toContainEqual({ patch: contract.draft.entries[2].id, body: { description: "Conta de luz" } }),
    );
    expect(within(energy).getByText("PAG BOLETO ENERGIA")).toBeInTheDocument();
    expect(within(energy).queryByText("Escreva uma descrição.")).toBeNull();
  });

  it("muda categoria e tipo; Não classificado volta a ser sem categoria", async () => {
    await openDraft();
    const user = userEvent.setup();
    const [bakery, salary] = screen.getAllByTestId("statement-entry");

    // Só aparecem as categorias que aceitam o tipo do lançamento.
    const options = within(within(salary).getByLabelText("Categoria")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Não classificado", "Salário"]);

    await user.selectOptions(within(bakery).getByLabelText("Categoria"), "Não classificado");
    await user.selectOptions(within(salary).getByLabelText("Tipo"), "refund");

    await waitFor(() => {
      expect(calls).toContainEqual({ patch: contract.draft.entries[0].id, body: { category_tag_id: null } });
      expect(calls).toContainEqual({ patch: contract.draft.entries[1].id, body: { transaction_type: "refund" } });
    });
  });

  it("a forma de pagamento vem sugerida pelo texto do banco e pode ser trocada", async () => {
    await openDraft();
    const user = userEvent.setup();
    const [bakery, salary, energy] = screen.getAllByTestId("statement-entry");

    expect(within(bakery).getByLabelText("Forma de pagamento")).toHaveValue("pix");
    expect(within(energy).getByLabelText("Forma de pagamento")).toHaveValue("boleto");
    expect(within(bakery).getByText("Sugerida pelo texto do banco")).toBeInTheDocument();
    // Extrato de conta não tem compra no cartão de crédito: ela sai na fatura.
    const options = within(within(salary).getByLabelText("Forma de pagamento")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Pix", "Boleto", "Cartão de débito", "Transferência", "Dinheiro"]);

    await user.selectOptions(within(salary).getByLabelText("Forma de pagamento"), "Pix");

    await waitFor(() =>
      expect(calls).toContainEqual({ patch: contract.draft.entries[1].id, body: { payment_method: "pix" } }),
    );
  });

  it("lançamento de valor zero não vira transação, mas continua visível em Ver o que fica de fora", async () => {
    draft.entries.push({
      ...clone(draft.entries[0]),
      id: "zero",
      position: 3,
      bank_description: "TARIFA ISENTA",
      amount: { amount: "0.00", currency: "BRL" },
      answer: "ignore",
      description: "TARIFA ISENTA",
    });
    draft.summary = { ...draft.summary, total: 4, ignored: 1 };
    await openDraft();
    const user = userEvent.setup();
    const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });
    expect(within(rail).getAllByRole("button")[5]).toHaveTextContent("Nada a fazer · 1 não vira transação");

    await user.click(within(rail).getAllByRole("button")[5]);
    expect(screen.getByTestId("left-out-entry")).toHaveTextContent("TARIFA ISENTA");

    await user.click(within(rail).getAllByRole("button")[7]);
    expect(screen.getByTestId("summary-ignored")).toHaveTextContent("1");
  });

  it("avisa quando as categorias não carregam, em vez de mostrar a lista vazia sem explicação", async () => {
    server.use(http.get("*/v1/tags", () => HttpResponse.json({ detail: "erro" }, { status: 500 })));
    await openDraft();

    expect(await screen.findByText(/Não foi possível carregar as suas categorias/)).toBeInTheDocument();
  });

  it("um passo só fica conferido depois que a pessoa passa por ele", async () => {
    await openDraft();
    const user = userEvent.setup();
    const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });
    const outside = within(rail).getAllByRole("button")[5];
    expect(outside).not.toHaveTextContent("Conferido");

    await user.click(outside);

    expect(screen.getByRole("heading", { name: "Ver o que fica de fora" })).toBeInTheDocument();
    expect(screen.getByText(/Nada a fazer aqui/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("heading", { name: "Conferir o saldo" })).toBeInTheDocument();
    expect(within(rail).getAllByRole("button")[5]).toHaveTextContent("Conferido");
  });
});

describe("revisar e concluir", () => {
  const openSummary = async (user) => {
    await openDraft();
    const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });
    await user.click(within(rail).getAllByRole("button")[7]);
  };

  it("bloqueia concluir com o motivo escrito enquanto houver lançamento novo sem descrição", async () => {
    const user = userEvent.setup();
    await openSummary(user);

    expect(screen.getByTestId("summary-to-create")).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "Concluir conciliação" })).toBeDisabled();
    expect(screen.getByTestId("conclude-blocked")).toHaveTextContent("1 lançamento novo sem descrição");
    expect(calls.some((c) => c.conclude)).toBe(false);
  });

  it("conclui de uma vez e diz quantas transações entraram", async () => {
    draft.entries[2].description = "Conta de luz";
    draft.summary.missing_description = 0;
    draft.blockers = [];
    draft.can_conclude = true;
    const user = userEvent.setup();
    await openSummary(user);

    await user.click(screen.getByRole("button", { name: "Concluir conciliação" }));

    expect(await screen.findByText("Conciliação concluída")).toBeInTheDocument();
    expect(screen.getByText(/3 transações adicionadas/)).toBeInTheDocument();
    expect(calls).toContainEqual({ conclude: IMPORT });
  });

  it("depois de concluir, abre as transações da conta no período do extrato", async () => {
    draft.entries[2].description = "Conta de luz";
    draft.summary.missing_description = 0;
    draft.blockers = [];
    draft.can_conclude = true;
    const onOpen = vi.fn();
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} onOpenAccountTransactions={onOpen} />);
    await screen.findAllByText("PIX QRS PADARIA 02 10");
    const user = userEvent.setup();
    const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });
    await user.click(within(rail).getAllByRole("button")[7]);
    await user.click(screen.getByRole("button", { name: "Concluir conciliação" }));

    await user.click(await screen.findByRole("button", { name: "Ver transações da conta" }));

    expect(onOpen).toHaveBeenCalledWith(ACCOUNT, { from: contract.draft.period.start, to: contract.draft.period.end });
  });
});

describe("desfazer a importação (fincla-api#509)", () => {
  it("a conciliação concluída leva à tela de desfazer da importação", async () => {
    draft.status = "concluded";
    draft.concluded_at = "2026-11-14T10:30:00";
    draft.latest_concluded = true;
    const user = userEvent.setup();
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);

    await user.click(await screen.findByRole("button", { name: "Desfazer importação" }));

    expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${IMPORT}/undo` });
  });

  it("uma concluída que não é a mais recente da conta não oferece desfazer", async () => {
    draft.status = "concluded";
    draft.concluded_at = "2026-11-14T10:30:00";
    draft.latest_concluded = false;
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);

    expect(await screen.findByText("Conciliação concluída")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desfazer importação" })).not.toBeInTheDocument();
  });

  it("uma importação desfeita diz isso, sem reabrir os passos", async () => {
    draft.status = "undone";
    draft.concluded_at = "2026-11-14T10:30:00";
    draft.undone_at = "2026-11-15T09:00:00";
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);

    expect(await screen.findByRole("heading", { name: "Importação desfeita" })).toBeInTheDocument();
    expect(screen.getByText("15/11/2026")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Passos da conciliação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desfazer importação" })).not.toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------------------------
// Rascunho e Extratos importados (fincla-api#518)
// --------------------------------------------------------------------------------------------

const openAccount = async () => {
  params = { accountId: ACCOUNT };
  render(<StatementReconciliationPage organizationId={ORG} />);
  await screen.findByRole("heading", { name: "Extratos importados" });
};

describe("retomar a conciliação (fincla-api#518)", () => {
  it("a conta mostra a conciliação em andamento e Continuar abre o rascunho, sem o id na URL", async () => {
    imports = clone(contract.imports.imports);
    const user = userEvent.setup();
    await openAccount();

    const card = screen.getByTestId("draft-in-progress");
    expect(card).toHaveTextContent("Conciliação em andamento");
    expect(card).toHaveTextContent("Extrato de 01/10/2026 a 31/10/2026");
    expect(card).toHaveTextContent("3 lançamentos · 3 a adicionar");
    expect(card).toHaveTextContent("Última alteração em 14/11/2026");
    expect(card).toHaveTextContent("descartada em 14/12/2026");
    await user.click(within(card).getByRole("button", { name: "Continuar conciliação" }));

    expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${IMPORT}` });
  });

  it("sem rascunho, a conta não oferece continuar", async () => {
    imports = clone(contract.imports.imports).filter((i) => i.status !== "draft");
    await openAccount();

    expect(screen.queryByTestId("draft-in-progress")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar extrato" })).toBeInTheDocument();
  });

  it("volta no passo em que parou, com os passos já vistos conferidos e as respostas do servidor", async () => {
    draft.current_step = "balance";
    draft.reviewed_steps = ["suggested", "doubt", "invoice", "yield", "new"];
    draft.entries[0].description = "Padaria do bairro (editada antes de fechar a aba)";
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);

    expect(await screen.findByRole("heading", { name: "Conferir o saldo" })).toBeInTheDocument();
    const steps = within(screen.getByRole("navigation", { name: "Passos da conciliação" })).getAllByRole("button");
    expect(steps[6]).toHaveAttribute("aria-current", "step");
    for (const seen of [0, 1, 2, 3]) expect(steps[seen]).toHaveTextContent("Conferido");
    // "Adicionar lançamentos novos" foi visto, mas ainda tem lançamento sem descrição: o aviso vence.
    expect(steps[4]).toHaveTextContent("1 lançamento sem descrição");
    expect(steps[5]).toHaveTextContent(/nada a fazer/i);

    await userEvent.setup().click(steps[4]);
    expect(screen.getByDisplayValue("Padaria do bairro (editada antes de fechar a aba)")).toBeInTheDocument();
  });

  it("abrir o rascunho não grava nada; cada troca de passo grava o passo e os já vistos, na ordem", async () => {
    const user = userEvent.setup();
    await openDraft();
    expect(calls.filter((c) => c.progress)).toEqual([]);

    const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });
    await user.click(within(rail).getAllByRole("button")[6]);
    await user.click(within(rail).getAllByRole("button")[0]);

    await waitFor(() =>
      expect(calls.filter((c) => c.progress)).toEqual([
        { progress: { current_step: "balance", reviewed_steps: ["new"] } },
        { progress: { current_step: "suggested", reviewed_steps: ["new", "balance"] } },
      ]),
    );
  });

  it("trocas de passo rápidas gravam em fila: o servidor fica com o último passo aberto", async () => {
    const started = [];
    const pending = [];
    server.use(http.patch(`${BASE}/${IMPORT}`, async ({ request }) => {
      const body = await request.json();
      started.push(body.current_step);
      // A primeira resposta demora: sem fila, a segunda chegaria antes e o servidor ficaria com a primeira.
      await new Promise((resolve) => pending.push(resolve));
      Object.assign(draft, body);
      return HttpResponse.json(draft);
    }));
    const user = userEvent.setup();
    await openDraft();
    const rail = screen.getByRole("navigation", { name: "Passos da conciliação" });

    await user.click(within(rail).getAllByRole("button")[1]);
    await user.click(within(rail).getAllByRole("button")[6]);
    await waitFor(() => expect(started).toEqual(["doubt"]));
    // A segunda só parte quando a primeira respondeu.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(started).toEqual(["doubt"]);
    pending.shift()();
    await waitFor(() => expect(started).toEqual(["doubt", "balance"]));
    pending.shift()();

    await waitFor(() => expect(draft.current_step).toBe("balance"));
  });

  it("rascunho expirado: mostra o motivo que a API escreve", async () => {
    const message = "Esta conciliação ficou parada por mais de 30 dias e foi descartada. Para conciliar este extrato, envie o arquivo de novo.";
    server.use(http.get(`${BASE}/${IMPORT}`, () => HttpResponse.json({ detail: { code: "not_found", message } }, { status: 404 })));
    params = { accountId: ACCOUNT, importId: IMPORT };
    render(<StatementReconciliationPage organizationId={ORG} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("rascunho expirado em StrictMode e ao recarregar: a mensagem de expiração fica, e a tela não lista nem grava nada", async () => {
    // QA etapa 1, OBS-01. A API agora repete a mensagem de expiração em toda leitura e só apaga o
    // rascunho na limpeza das LISTAS: se abrir o link listasse as importações da conta, a primeira
    // leitura sairia certa e a segunda (StrictMode, recarregar) cairia em "não encontrada".
    const message = "Esta conciliação ficou parada por mais de 30 dias e foi descartada. Para conciliar este extrato, envie o arquivo de novo.";
    const seen = [];
    server.use(
      http.get(`${BASE}/${IMPORT}`, () => {
        seen.push("read");
        return HttpResponse.json({ detail: { code: "not_found", message } }, { status: 404 });
      }),
      http.get(BASE, () => {
        seen.push("list");
        return HttpResponse.json({ imports: [] });
      }),
    );
    calls.length = 0;
    params = { accountId: ACCOUNT, importId: IMPORT };
    const first = render(<React.StrictMode><StatementReconciliationPage organizationId={ORG} /></React.StrictMode>);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    first.unmount();

    render(<React.StrictMode><StatementReconciliationPage organizationId={ORG} /></React.StrictMode>);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(/não encontrada/i)).toBeNull();
    expect(seen.filter((s) => s === "read").length).toBeGreaterThanOrEqual(2);
    expect(seen).not.toContain("list");
    expect(calls).toEqual([]);
  });
});

describe("descartar o rascunho (fincla-api#518)", () => {
  it("pede confirmação na própria página; Manter rascunho não apaga nada", async () => {
    imports = clone(contract.imports.imports);
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Descartar rascunho" }));
    const ask = screen.getByRole("group", { name: "Confirmar descarte do rascunho" });
    expect(ask).toHaveTextContent("Descartar esta conciliação? As respostas que você deu serão apagadas");
    await user.click(within(ask).getByRole("button", { name: "Manter rascunho" }));

    expect(screen.queryByRole("group", { name: "Confirmar descarte do rascunho" })).not.toBeInTheDocument();
    expect(screen.getByTestId("draft-in-progress")).toBeInTheDocument();
    expect(calls.some((c) => c.discard)).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("confirmado, descarta, avisa e a lista deixa de mostrar o rascunho", async () => {
    imports = clone(contract.imports.imports);
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Descartar rascunho" }));
    await user.click(screen.getByRole("button", { name: "Sim, descartar" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Rascunho descartado. Nada mudou nas suas transações.");
    await waitFor(() => expect(screen.queryByTestId("draft-in-progress")).not.toBeInTheDocument());
    expect(calls).toContainEqual({ discard: IMPORT });
    expect(screen.getAllByTestId("imported-statement").map((r) => within(r).getByTestId("import-status").textContent)).toEqual([
      "Concluída",
      "Desfeita",
      "Concluída",
    ]);
  });

  it("descartar de dentro do rascunho volta para a conta", async () => {
    const user = userEvent.setup();
    await openDraft();

    await user.click(screen.getByRole("button", { name: "Descartar rascunho" }));
    await user.click(screen.getByRole("button", { name: "Sim, descartar" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile` }));
    expect(calls).toContainEqual({ discard: IMPORT });
  });

  it("se o descarte falhar, diz o motivo e o rascunho continua", async () => {
    imports = clone(contract.imports.imports);
    server.use(
      http.delete(`${BASE}/:importId`, () =>
        HttpResponse.json({ detail: { code: "conflict", message: "Esta conciliação já foi concluída: não é mais um rascunho." } }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Descartar rascunho" }));
    await user.click(screen.getByRole("button", { name: "Sim, descartar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Esta conciliação já foi concluída");
    expect(screen.getByTestId("draft-in-progress")).toBeInTheDocument();
  });
});

describe("Extratos importados (fincla-api#518)", () => {
  it("lista cada importação com período, estado, contagens, datas e a diferença registrada", async () => {
    imports = clone(contract.imports.imports);
    await openAccount();

    const rows = screen.getAllByTestId("imported-statement");
    expect(rows.map((r) => within(r).getByTestId("import-status").textContent)).toEqual(["Rascunho", "Concluída", "Desfeita", "Concluída"]);
    expect(rows[0]).toHaveTextContent("01/10/2026 a 31/10/2026");
    expect(rows[0]).toHaveTextContent("3 lançamentos · 3 a adicionar");
    expect(within(rows[0]).queryByTestId("import-difference")).not.toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("41 lançamentos · 38 adicionados · 3 não registrados");
    expect(rows[1]).toHaveTextContent("Importado em 03/10/2026 · concluída em 03/10/2026");
    expect(rows[2]).toHaveTextContent("41 adicionados e apagados ao desfazer");
    expect(rows[2]).toHaveTextContent("desfeita em 02/10/2026");
  });

  it("diferença não registrada aparece como travessão, nunca como zero", async () => {
    imports = clone(contract.imports.imports);
    await openAccount();

    const rows = screen.getAllByTestId("imported-statement");
    expect(within(rows[1]).getByTestId("import-difference")).toHaveTextContent("Diferença de saldo registrada: —");
    expect(within(rows[1]).getByTestId("import-difference")).not.toHaveTextContent(/0,00/);
    expect(within(rows[3]).getByTestId("import-difference")).toHaveTextContent(/Diferença de saldo registrada: −R\$\s23,06/);
  });

  it("só a concluída mais recente oferece desfazer, que leva à tela do desfazer", async () => {
    imports = clone(contract.imports.imports);
    const user = userEvent.setup();
    await openAccount();

    const rows = screen.getAllByTestId("imported-statement");
    expect(rows.map((r) => within(r).queryByRole("button", { name: "Desfazer importação" }) !== null)).toEqual([false, true, false, false]);
    await user.click(within(rows[1]).getByRole("button", { name: "Desfazer importação" }));

    expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${imports[1].id}/undo` });
  });

  it("de cada linha se chega à conciliação: o rascunho para continuar, a concluída para ver", async () => {
    imports = clone(contract.imports.imports);
    const user = userEvent.setup();
    await openAccount();

    const rows = screen.getAllByTestId("imported-statement");
    await user.click(within(rows[0]).getByRole("button", { name: "Continuar conciliação" }));
    await user.click(within(rows[3]).getByRole("button", { name: "Ver conciliação" }));

    expect(navigate.mock.calls.map(([arg]) => arg)).toEqual([
      { to: `/accounts/${ACCOUNT}/reconcile/${imports[0].id}` },
      { to: `/accounts/${ACCOUNT}/reconcile/${imports[3].id}` },
    ]);
  });

  it("conta sem importações diz isso", async () => {
    await openAccount();

    expect(screen.getByText("Nenhum extrato importado nesta conta ainda.")).toBeInTheDocument();
  });
});
