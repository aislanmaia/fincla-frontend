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
// O detalhe de cada rascunho (o quadro mede o progresso nele) e a conferência de saldo da confirmação.
let details = {};
let detailReads = 0;
let check = clone(contract.balance_check);
const server = setupServer(
  http.get(`${BASE}/:importId/balance-check`, () => HttpResponse.json(check)),
  http.get(`${BASE}/:importId`, ({ params: p }) => {
    detailReads += 1;
    const found = details[p.importId];
    return found ? HttpResponse.json(found) : HttpResponse.json({ detail: { code: "not_found", message: "Não encontrado." } }, { status: 404 });
  }),
  http.get("*/v1/users/me/preferences", () => HttpResponse.json({ statement_reconciliation_view: "detailed" })),
  http.get("*/v1/tags", () => HttpResponse.json({ tags: [] })),
  http.get("*/v1/accounts", () =>
    HttpResponse.json([{ id: ACCOUNT, name: "Itaú", type: "checking", currency: "BRL", is_active: true, initial_balance: { amount: "0.00", currency: "BRL" } }]),
  ),
  http.get(BASE, () => {
    listReads += 1;
    return HttpResponse.json({ imports });
  }),
  http.post(`${BASE}/:importId/conclude`, ({ params: p }) => {
    calls.push({ conclude: p.importId });
    delete details[p.importId];
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
  details = {};
  detailReads = 0;
  check = clone(contract.balance_check);
  server.resetHandlers();
  navigate.mockReset();
});

const openAccount = async () => {
  params = { accountId: ACCOUNT };
  render(<StatementReconciliationPage organizationId={ORG} />);
  await screen.findByRole("heading", { name: "Extratos importados" });
};

const BEFORE_SUMMARY = ["suggested", "doubt", "invoice", "yield", "new", "outside", "balance"];

/**
 * Um rascunho aberto: a linha da lista e o detalhe (o mesmo que a conciliação abre), com os passos
 * que a pessoa já viu. Parte do rascunho canônico do backend, com a descrição em branco preenchida
 * (dá para concluir). `detail` muda o detalhe; `item` muda a linha.
 */
const openDraft = (reviewed, { detail = {}, item = {} } = {}) => {
  const base = clone(contract.draft);
  details[DRAFT.id] = {
    ...base,
    id: DRAFT.id,
    entries: base.entries.map((e) => (e.answer === "create" && !e.description ? { ...e, description: "Mercado" } : e)),
    summary: { ...base.summary, missing_description: 0 },
    can_conclude: true,
    blockers: [],
    reviewed_steps: reviewed,
    ...detail,
  };
  return { ...clone(DRAFT), ...item };
};

/** Tudo visto e nada bloqueando: o único estado com "Concluir agora". */
const readyDraft = (detail = {}, item = {}) => openDraft(BEFORE_SUMMARY, { detail, item });

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

  it("com rascunho, a área já nasce menor: não aparece grande enquanto a lista carrega (G4 OBS-12)", async () => {
    imports = [openDraft(["suggested"])];
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    server.use(http.get(BASE, async () => { await gate; return HttpResponse.json({ imports }); }));
    params = { accountId: ACCOUNT };
    render(<StatementReconciliationPage organizationId={ORG} />);

    // Lista ainda carregando: nenhuma área de envio (nem a grande, que pularia de tamanho depois).
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("button", { name: /Solte aqui o extrato do banco/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ou solte aqui outro extrato/ })).not.toBeInTheDocument();

    release();
    expect(await screen.findByRole("button", { name: /Ou solte aqui outro extrato/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Solte aqui o extrato do banco/ })).not.toBeInTheDocument();
  });

  it("se a lista não carrega, a área de envio aparece mesmo assim, com o erro", async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ detail: { code: "internal", message: "Falhou" } }, { status: 500 })));
    params = { accountId: ACCOUNT };
    render(<StatementReconciliationPage organizationId={ORG} />);

    expect(await screen.findByRole("button", { name: /Solte aqui o extrato do banco/ })).toBeInTheDocument();
  });

  it("sem rascunho, a linha da área ocupa a altura que sobra; com rascunho, não (área compacta)", async () => {
    await openAccount();
    await screen.findByRole("button", { name: /Solte aqui o extrato do banco/ });
    expect(screen.getByTestId("start-upload-row").style.flexGrow).toBe("1");
    cleanup();

    imports = [openDraft(["suggested"])];
    await openAccount();
    await screen.findByRole("button", { name: /Ou solte aqui outro extrato/ });
    expect(screen.getByTestId("start-upload-row").style.flexGrow).not.toBe("1");
  });

  it("a altura chega à linha: página, conta e linha esticam em cadeia (G3 achado 10)", async () => {
    await openAccount();
    await screen.findByRole("button", { name: /Solte aqui o extrato do banco/ });
    const page = screen.getByTestId("statement-reconciliation-page");
    expect(page.style.flexGrow).toBe("1");
    expect(page.style.display).toBe("flex");
    expect(page.style.flexDirection).toBe("column");
    const view = screen.getByTestId("account-statements-view");
    expect(view.parentElement).toBe(page);
    expect(view.style.flexGrow).toBe("1");
    expect(view.style.display).toBe("flex");
    expect(view.style.flexDirection).toBe("column");
    const row = screen.getByTestId("start-upload-row");
    expect(row.parentElement).toBe(view);
    expect(row.style.flexGrow).toBe("1");
  });

  it("linha esticada: a lista de extratos ocupa a coluna inteira (G3 achado 3); com rascunho, volta a medir o conteúdo até 480px", async () => {
    imports = [clone(CONCLUDED)];
    await openAccount();
    await screen.findByRole("button", { name: /Solte aqui o extrato do banco/ });
    expect(screen.getByTestId("imported-statements-scroll").style.position).toBe("absolute");
    cleanup();

    imports = [openDraft(["suggested"])];
    await openAccount();
    await screen.findByRole("button", { name: /Ou solte aqui outro extrato/ });
    const scroll = screen.getByTestId("imported-statements-scroll");
    expect(scroll.style.position).not.toBe("absolute");
    expect(scroll.style.maxHeight).toBe("480px");
  });

  it("no celular a linha não estica e a lista mede o conteúdo", async () => {
    params = { accountId: ACCOUNT };
    render(<StatementReconciliationPage organizationId={ORG} isMobile />);
    await screen.findByRole("heading", { name: "Extratos importados" });
    expect(screen.getByTestId("imported-statements-scroll").style.position).not.toBe("absolute");
  });

  describe("linha que quebra (768–1030px: área e lista não cabem lado a lado)", () => {
    let rowWidth = 0;
    beforeAll(() => {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get() { return this.dataset?.testid === "start-upload-row" ? rowWidth : 0; },
      });
    });
    // A propriedade original mora em Element.prototype: apagar a cópia devolve a original.
    afterAll(() => { delete HTMLElement.prototype.clientWidth; });
    afterEach(() => { rowWidth = 0; });

    it("quebrou (700px): não estica — sem meia altura extra na área nem faixa vazia na lista", async () => {
      rowWidth = 700;
      await openAccount();
      await screen.findByRole("button", { name: /Solte aqui o extrato do banco/ });
      expect(screen.getByTestId("start-upload-row").style.flexGrow).toBe("0");
      const scroll = screen.getByTestId("imported-statements-scroll");
      expect(scroll.style.position).not.toBe("absolute");
      expect(scroll.style.maxHeight).toBe("480px");
    });

    it("cabe lado a lado (776px): estica", async () => {
      rowWidth = 776;
      await openAccount();
      await screen.findByRole("button", { name: /Solte aqui o extrato do banco/ });
      expect(screen.getByTestId("start-upload-row").style.flexGrow).toBe("1");
    });

    it("a janela estreita depois de aberta: deixa de esticar", async () => {
      rowWidth = 1000;
      await openAccount();
      await screen.findByRole("button", { name: /Solte aqui o extrato do banco/ });
      expect(screen.getByTestId("start-upload-row").style.flexGrow).toBe("1");
      rowWidth = 760;
      fireEvent(window, new Event("resize"));
      await waitFor(() => expect(screen.getByTestId("start-upload-row").style.flexGrow).toBe("0"));
    });
  });

  it("no celular a área fala em tocar, não em soltar nem clicar (G4 OBS)", async () => {
    params = { accountId: ACCOUNT };
    render(<StatementReconciliationPage organizationId={ORG} isMobile />);
    await screen.findByRole("heading", { name: "Extratos importados" });

    const zone = screen.getByRole("button", { name: /Toque para escolher o extrato do banco/ });
    expect(zone).toHaveTextContent("A leitura começa na hora.");
    expect(zone).not.toHaveTextContent(/solte|clique/i);
  });

  it("no celular, com rascunho, a área menor também fala em tocar", async () => {
    imports = [openDraft(["suggested"])];
    params = { accountId: ACCOUNT };
    render(<StatementReconciliationPage organizationId={ORG} isMobile />);
    await screen.findByRole("heading", { name: "Extratos importados" });

    const zone = await screen.findByRole("button", { name: /Ou toque para escolher outro extrato/ });
    expect(zone).not.toHaveTextContent(/solte|clique/i);
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

  it("a dica usa a concluída de maior fim de período, não a concluída por último", async () => {
    // Outubro foi concluído antes; setembro, que tinha ficado para trás, depois.
    imports = [
      { ...clone(CONCLUDED), id: "outubro", period: { start: "2026-10-01", end: "2026-10-31" }, concluded_at: "2026-11-02T09:00:00" },
      { ...clone(CONCLUDED), concluded_at: "2026-11-10T09:00:00" },
    ];
    await openAccount();

    expect(screen.getByText("Dica: a última conciliação foi até 31/10/2026. Um extrato a partir de 01/11 continua de onde ela parou.")).toBeInTheDocument();
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

    // Anunciado por uma região viva FORA do botão (os filhos de um botão não são lidos).
    const status = await screen.findByTestId("drop-zone-status");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveTextContent("Lendo extrato-outubro.ofx…");
    const zone = screen.getByRole("button", { name: "Lendo extrato-outubro.ofx…" });
    expect(zone).not.toContainElement(status);
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

  it("soltar mais de um arquivo não envia nenhum e avisa", async () => {
    await openAccount();

    const zone = screen.getByRole("button", { name: /Solte aqui o extrato do banco/ });
    const files = [new File(["<OFX>"], "a.ofx"), new File(["<OFX>"], "b.ofx")];
    fireEvent.drop(zone, { dataTransfer: { files, types: ["Files"] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Solte um arquivo por vez.");
    expect(calls).toEqual([]);
  });

  it("soltar o arquivo fora da área não deixa o navegador abrir o arquivo; ao sair da tela, isso para", async () => {
    await openAccount();
    const file = new File(["<OFX>"], "fora.ofx");

    // `fireEvent` devolve false quando o evento foi cancelado (preventDefault).
    expect(fireEvent.dragOver(document.body, { dataTransfer: { files: [file], types: ["Files"] } })).toBe(false);
    expect(fireEvent.drop(document.body, { dataTransfer: { files: [file], types: ["Files"] } })).toBe(false);
    // Arrastar texto (não arquivo) continua com o comportamento do navegador.
    expect(fireEvent.drop(document.body, { dataTransfer: { files: [], types: ["text/plain"] } })).toBe(true);
    expect(calls).toEqual([]);

    cleanup();
    expect(fireEvent.drop(document.body, { dataTransfer: { files: [file], types: ["Files"] } })).toBe(true);
  });

  it("o destaque não apaga ao passar o arquivo sobre o ícone e os textos da área", async () => {
    await openAccount();
    const zone = screen.getByRole("button", { name: /Solte aqui o extrato do banco/ });
    const child = within(zone).getByText("Solte aqui o extrato do banco");
    const drag = { dataTransfer: { files: [], types: ["Files"] } };

    fireEvent.dragEnter(zone, drag);
    expect(zone).toHaveAttribute("data-dragging", "true");
    // Entrar num filho: o navegador dispara dragenter no filho e dragleave na área.
    fireEvent.dragEnter(child, drag);
    fireEvent.dragLeave(zone, drag);
    expect(zone).toHaveAttribute("data-dragging", "true");
    // Sair do filho de volta para a área, e depois sair da área de fato.
    fireEvent.dragLeave(child, drag);
    expect(zone).not.toHaveAttribute("data-dragging");
  });

  it("o campo de arquivo escondido fica fora da árvore de acessibilidade", async () => {
    await openAccount();

    expect(screen.getByLabelText(/Arquivo do extrato/)).toHaveAttribute("aria-hidden", "true");
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
  // O progresso é em PASSOS CONFERIDOS (G3): a mesma conta do "Seu progresso" da conciliação.
  it.each([
    [[], 0, "Pronta para começar"],
    [["suggested"], 1, "Em andamento"],
    [["suggested", "doubt", "invoice"], 3, "Em andamento"],
    // 4 de 8 = 50% exatos: já "Passou da metade".
    [["suggested", "doubt", "invoice", "yield"], 4, "Passou da metade"],
    [["suggested", "doubt", "invoice", "yield", "new", "outside"], 6, "Passou da metade"],
  ])("passos vistos %j: %i de 8 conferidos, selo %s, sem Concluir agora", async (reviewed, done, badge) => {
    imports = [openDraft(reviewed)];
    await openAccount();

    const card = await screen.findByTestId("resume-badge").then(() => screen.getByTestId("resume-draft"));
    expect(within(card).getByTestId("resume-badge")).toHaveTextContent(badge);
    expect(within(card).getByTestId("resume-count")).toHaveTextContent(`${done} de 8 passos conferidos`);
    const bar = within(card).getByRole("progressbar", { name: "Passos conferidos" });
    expect(bar).toHaveAttribute("aria-valuenow", String(done));
    expect(bar).toHaveAttribute("aria-valuemax", "8");
    expect(within(card).getByRole("button", { name: "Continuar conciliação" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Concluir agora" })).not.toBeInTheDocument();
  });

  it("recém-enviado, sem dúvida nem pendência (o servidor deixaria concluir): Pronta para começar, nunca Concluir agora", async () => {
    // O rascunho canônico como sai do envio: lançamentos novos já marcados para adicionar, nada visto.
    imports = [openDraft([], { detail: { current_step: null } })];
    await openAccount();

    const card = await screen.findByTestId("resume-draft");
    expect(await within(card).findByTestId("resume-badge")).toHaveTextContent("Pronta para começar");
    expect(card).toHaveTextContent("0 de 8 passos conferidos");
    expect(card).not.toHaveTextContent("Tudo conferido");
    expect(within(card).queryByRole("button", { name: "Concluir agora" })).not.toBeInTheDocument();
  });

  it("os números do quadro são os mesmos do Seu progresso da conciliação aberta", async () => {
    // O rascunho canônico, com um lançamento novo sem descrição: tudo visto, mas bloqueado.
    imports = [clone(DRAFT)];
    details[DRAFT.id] = { ...clone(contract.draft), id: DRAFT.id, reviewed_steps: BEFORE_SUMMARY, current_step: "summary" };
    await openAccount();
    const card = await screen.findByTestId("resume-draft");
    const count = (await within(card).findByTestId("resume-count")).textContent;
    expect(count).toBe("6 de 8 passos conferidos");
    // Tudo visto, mas bloqueado: "Quase lá", o motivo, e nada de concluir.
    expect(within(card).getByTestId("resume-badge")).toHaveTextContent("Quase lá · falta pouco!");
    expect(within(card).getByTestId("resume-blockers")).toHaveTextContent("1 lançamento novo sem descrição. Escreva a descrição em Adicionar lançamentos novos.");
    expect(within(card).queryByRole("button", { name: "Concluir agora" })).not.toBeInTheDocument();
    cleanup();

    params = { accountId: ACCOUNT, importId: DRAFT.id };
    render(<StatementReconciliationPage organizationId={ORG} />);

    expect(await screen.findByText(/Seu progresso:/)).toHaveTextContent(`Seu progresso: ${count}`);
  });

  it("mostra o período, o passo em que parou e quando é descartado; a área de soltar fica menor", async () => {
    imports = [openDraft(["suggested"], { item: { current_step: "balance" } }), clone(CONCLUDED)];
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
    imports = [openDraft(["suggested"], { item: { current_step: null } })];
    await openAccount();

    const card = screen.getByTestId("resume-draft");
    expect(card).toHaveTextContent("Extrato de 01/10/2026 a 31/10/2026");
    expect(card).not.toHaveTextContent("você parou em");
  });

  it("um quadro por rascunho, cada um com o seu progresso", async () => {
    const first = openDraft(["suggested"]);
    details["outro-rascunho"] = { ...details[DRAFT.id], id: "outro-rascunho", reviewed_steps: ["suggested", "doubt", "invoice", "yield"] };
    imports = [first, { ...clone(DRAFT), id: "outro-rascunho", period: { start: "2026-11-01", end: "2026-11-10" } }];
    await openAccount();

    const cards = screen.getAllByTestId("resume-draft");
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => within(c).getByTestId("resume-count").textContent)).toEqual(["1 de 8 passos conferidos", "4 de 8 passos conferidos"]);
  });

  it("sem conseguir ler o rascunho, o quadro aparece sem progresso e só oferece continuar", async () => {
    imports = [clone(DRAFT)];
    await openAccount();

    const card = screen.getByTestId("resume-draft");
    expect(within(card).queryByTestId("resume-badge")).not.toBeInTheDocument();
    expect(card).toHaveTextContent("Não deu para ler o progresso agora.");
    expect(within(card).getByRole("button", { name: "Continuar conciliação" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Concluir agora" })).not.toBeInTheDocument();
  });

  it("Descartar pede confirmação no quadro (com o foco nela) e, confirmado, some com o rascunho", async () => {
    imports = [openDraft(["suggested"])];
    const user = userEvent.setup();
    await openAccount();

    await user.click(within(screen.getByTestId("resume-draft")).getByRole("button", { name: "Descartar" }));
    expect(screen.getByRole("group", { name: "Confirmar descarte do rascunho" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Sim, descartar" }));

    expect(await screen.findByText("Rascunho descartado. Nada mudou nas suas transações.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("resume-draft")).not.toBeInTheDocument());
    expect(calls).toEqual([{ discard: DRAFT.id }]);
  });

  it("Manter rascunho devolve o foco a Descartar", async () => {
    imports = [openDraft(["suggested"])];
    const user = userEvent.setup();
    await openAccount();

    await user.click(within(screen.getByTestId("resume-draft")).getByRole("button", { name: "Descartar" }));
    await user.click(screen.getByRole("button", { name: "Manter rascunho" }));

    expect(within(screen.getByTestId("resume-draft")).getByRole("button", { name: "Descartar" })).toHaveFocus();
  });
});

/** As linhas da confirmação, com o espaço inseparável do Intl trocado por espaço comum. */
const confirmLines = (ask) => within(within(ask).getByTestId("conclude-counts")).getAllByRole("listitem").map((li) => li.textContent.replace(/ /g, " "));
const effectTexts = (root) => within(within(root).getByTestId("summary-pair-changes")).getAllByRole("listitem").map((li) => li.textContent.replace(/ /g, " "));

/** Um rascunho com todos os efeitos de "Revisar e concluir": valor e conta que mudam, fatura paga e já paga. */
const withAllEffects = () => {
  const base = clone(contract.draft);
  const doubts = clone(contract.doubt_draft.entries);
  const invoices = clone(contract.invoice_draft.entries);
  return {
    entries: [
      ...base.entries.map((e) => (e.answer === "create" && !e.description ? { ...e, description: "Mercado" } : e)),
      doubts[2], // par com valor diferente
      doubts[4], // par de outra conta
      invoices[0], // fatura que fica paga
      invoices[2], // fatura já paga
    ],
    summary: { ...base.summary, missing_description: 0, to_pair: 2, invoice_payments: 1, invoices_already_paid: 1 },
  };
};

describe("Concluir agora (tudo conferido)", () => {
  it("o selo fica verde e os botões viram Concluir agora, Abrir conciliação e Descartar", async () => {
    imports = [readyDraft()];
    const user = userEvent.setup();
    await openAccount();

    const card = screen.getByTestId("resume-draft");
    expect(await within(card).findByTestId("resume-badge")).toHaveTextContent("Tudo conferido · só falta concluir");
    // O mesmo número da conciliação, sem contradizer o selo: o que falta é o próprio Revisar e concluir (G4 OBS).
    expect(within(card).getByTestId("resume-count")).toHaveTextContent("7 de 8 passos conferidos · falta só Revisar e concluir");
    expect(within(card).getAllByRole("button").map((b) => b.textContent)).toEqual(["Concluir agora", "Abrir conciliação", "Descartar"]);
    await user.click(within(card).getByRole("button", { name: "Abrir conciliação" }));
    expect(navigate).toHaveBeenCalledWith({ to: `/accounts/${ACCOUNT}/reconcile/${DRAFT.id}` });
  });

  it("a confirmação mostra as contagens de Revisar e concluir, Não classificado e a diferença, com o foco nela", async () => {
    imports = [readyDraft()];
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));

    const ask = screen.getByRole("group", { name: "Confirmar a conclusão" });
    expect(ask).toHaveFocus();
    expect(ask).toHaveTextContent("Concluir a conciliação de 01/10/2026 a 31/10/2026?");
    await within(ask).findByText(/Diferença de saldo que fica registrada/);
    // As linhas com zero ("Já estavam no Fincla: 0") não aparecem.
    expect(confirmLines(ask)).toEqual([
      "Lançamentos no extrato: 6",
      "Serão adicionados: 3",
      "Somados em um lançamento: 2 · em 1 transação",
      "Não serão registrados: 1",
      "3 transações vão para Não classificado.",
      "Diferença de saldo que fica registrada: −R$ 23,06.",
    ]);
    expect(ask).toHaveTextContent("Dá para desfazer depois, em Extratos importados.");
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("os efeitos são os mesmos do passo Revisar e concluir: valor, conta, fatura paga e já paga, exclusão e data", async () => {
    imports = [readyDraft({ ...withAllEffects(), current_step: "summary" })];
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));
    const ask = screen.getByRole("group", { name: "Confirmar a conclusão" });
    const inCard = await waitFor(() => effectTexts(ask));
    const tags = Array.from(within(ask).getByTestId("summary-pair-changes").querySelectorAll("li > span:first-child")).map((t) => t.textContent);
    expect(tags).toEqual(["Valor muda", "Conta muda", "Fatura paga", "Fatura já paga", "Exclusão", "Data muda"]);
    expect(confirmLines(ask)).toContain("Pagamentos de fatura: 1");
    expect(confirmLines(ask)).toContain("Já estavam no Fincla: 2");
    cleanup();

    // A mesma conciliação aberta no passo Revisar e concluir: as mesmas frases, na mesma ordem.
    params = { accountId: ACCOUNT, importId: DRAFT.id };
    render(<StatementReconciliationPage organizationId={ORG} />);
    await screen.findByTestId("summary-pair-changes");
    expect(effectTexts(document.body)).toEqual(inCard);
  });

  it("frases com zero não aparecem; sem saldo no arquivo a diferença é —, nunca zero", async () => {
    imports = [readyDraft({ summary: { ...clone(contract.draft.summary), missing_description: 0, to_create: 1, grouped: 0, groups: 0, ignored: 0, unclassified: 0, total: 1 } })];
    check = { ...clone(contract.balance_check), final_difference: null, points: [], effects: { value_changes: 0, account_moves: 0, invoices_paid: 0, deletions: 0, date_changes: 0 } };
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));
    const ask = screen.getByRole("group", { name: "Confirmar a conclusão" });
    await within(ask).findByText(/Diferença de saldo que fica registrada/);

    expect(confirmLines(ask)).toEqual([
      "Lançamentos no extrato: 1",
      "Serão adicionados: 1",
      "Diferença de saldo que fica registrada: —.",
    ]);
    expect(within(ask).queryByTestId("summary-pair-changes")).not.toBeInTheDocument();
  });

  it("diferença zero aparece como R$ 0,00, sem sinal", async () => {
    imports = [readyDraft()];
    check = { ...clone(contract.balance_check), final_difference: { amount: "0.00", currency: "BRL" } };
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));

    expect(await screen.findByText(/Diferença de saldo que fica registrada/)).toHaveTextContent("Diferença de saldo que fica registrada: R$ 0,00.");
  });

  it("Sim, concluir só fica disponível depois de calcular o que muda", async () => {
    let release;
    server.use(http.get(`${BASE}/:importId/balance-check`, async () => {
      await new Promise((resolve) => { release = resolve; });
      return HttpResponse.json(check);
    }));
    imports = [readyDraft()];
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));

    expect(screen.getByText("Calculando o que muda ao concluir…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sim, concluir" })).toBeDisabled();
    await waitFor(() => expect(release).toBeTypeOf("function"));
    release();
    await waitFor(() => expect(screen.getByRole("button", { name: "Sim, concluir" })).toBeEnabled());
  });

  it("Agora não fecha a confirmação sem concluir e devolve o foco a Concluir agora", async () => {
    imports = [readyDraft()];
    const user = userEvent.setup();
    await openAccount();

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));
    await user.click(screen.getByRole("button", { name: "Agora não" }));

    expect(screen.queryByRole("group", { name: "Confirmar a conclusão" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Concluir agora" })).toHaveFocus();
    expect(calls).toEqual([]);
  });

  it("Sim, concluir chama o concluir, fica desabilitado até a lista recarregada chegar, e o Desfazer fica na linha dela", async () => {
    imports = [readyDraft(), clone(CONCLUDED)];
    const user = userEvent.setup();
    await openAccount();
    const readsBefore = listReads;
    let releaseList;
    server.use(http.get(BASE, async () => {
      listReads += 1;
      await new Promise((resolve) => { releaseList = resolve; });
      return HttpResponse.json({ imports });
    }));

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sim, concluir" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Sim, concluir" }));

    await waitFor(() => expect(listReads).toBeGreaterThan(readsBefore));
    expect(calls).toEqual([{ conclude: DRAFT.id }]);
    // A lista ainda não chegou: nada de "Concluir agora"/"Sim, concluir" clicável (um 2º clique daria 409).
    expect(screen.getByRole("button", { name: "Concluindo…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Concluir agora" })).not.toBeInTheDocument();
    releaseList();

    expect(await screen.findByText(/Conciliação concluída\./)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("resume-draft")).not.toBeInTheDocument());
    const rows = screen.getAllByTestId("imported-statement");
    const undoable = rows.filter((r) => within(r).queryByRole("button", { name: "Desfazer importação" }));
    expect(undoable).toHaveLength(1);
    expect(undoable[0]).toHaveTextContent("01/10/2026 a 31/10/2026");
  });

  it("recusa do servidor ao concluir: mostra o motivo, recarrega a lista e o quadro deixa de oferecer concluir", async () => {
    server.use(http.post(`${BASE}/:importId/conclude`, () => {
      // Em outra aba, a pessoa desfez uma resposta: o rascunho já não está todo conferido.
      details[DRAFT.id] = { ...details[DRAFT.id], reviewed_steps: ["suggested", "doubt"], can_conclude: false, blockers: [{ code: "unanswered", count: 1 }], summary: { ...details[DRAFT.id].summary, unanswered: 1 } };
      return HttpResponse.json({ detail: { code: "business_rule", message: "Ainda falta responder 1 lançamento." } }, { status: 422 });
    }));
    imports = [readyDraft()];
    const user = userEvent.setup();
    await openAccount();
    const readsBefore = listReads;
    const detailsBefore = detailReads;

    await user.click(screen.getByRole("button", { name: "Concluir agora" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sim, concluir" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Sim, concluir" }));

    const card = screen.getByTestId("resume-draft");
    expect(await within(card).findByRole("alert")).toHaveTextContent("Ainda falta responder 1 lançamento.");
    await waitFor(() => expect(within(card).getByTestId("resume-count")).toHaveTextContent("2 de 8 passos conferidos"));
    expect(listReads).toBeGreaterThan(readsBefore);
    expect(detailReads).toBeGreaterThan(detailsBefore);
    expect(within(card).getByTestId("resume-badge")).toHaveTextContent("Em andamento");
    expect(within(card).queryByRole("button", { name: "Concluir agora" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Continuar conciliação" })).toBeInTheDocument();
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
      openDraft(["suggested"]),
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
