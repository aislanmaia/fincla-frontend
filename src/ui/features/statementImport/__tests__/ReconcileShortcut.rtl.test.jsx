/** @vitest-environment jsdom */
// O atalho "Conciliar extrato" da tela de Transações (decisão do Owner de 2026-11-17, telas T1–T4).
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import contract from "../../../../api/__fixtures__/statement_import.example.json";
import { normalizeStatementImport } from "../../../../api/statementImports";
import { passedStepsOf, stepProgress } from "../reconciliationSteps.js";

const listDraftsMock = vi.fn();
const getImportMock = vi.fn();
const listImportsMock = vi.fn();
vi.mock("../../../../api/statementImports", async (importOriginal) => ({
  ...(await importOriginal()),
  listStatementImportDrafts: (...args) => listDraftsMock(...args),
  getStatementImport: (...args) => getImportMock(...args),
  listStatementImports: (...args) => listImportsMock(...args),
}));

import { ReconcileShortcut } from "../ReconcileShortcut.jsx";
import { useReconcileShortcutData } from "../useReconcileShortcutData.js";

const A = { id: "acc-a", label: "Corrente Smoke", currency: "BRL" };
const B = { id: "acc-b", label: "Poupança Smoke", currency: "BRL" };
const C = { id: "acc-c", label: "Conta USD Smoke", currency: "USD" };

/** O rascunho do contrato com quatro passos vistos: o N vem da MESMA conta da conciliação. */
const draftDetail = (accountId, id, reviewed) => ({
  ...normalizeStatementImport(contract.draft),
  id,
  account_id: accountId,
  reviewed_steps: reviewed,
});
const REVIEWED = ["suggested", "doubt", "invoice", "yield"];
const draftItem = (accountId, id, lastActivity = "2026-11-14T10:00:00") => ({
  id, account_id: accountId, status: "draft", last_activity_at: lastActivity, period: { start: "2026-10-01", end: "2026-10-31" },
});

beforeEach(() => {
  listDraftsMock.mockResolvedValue([]);
  listImportsMock.mockResolvedValue([]);
  getImportMock.mockImplementation((accountId, _org, id) => Promise.resolve(draftDetail(accountId, id, REVIEWED)));
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Como a página: os dados vêm do hook do nível da página; o botão só os lê. */
function Harness({ organizationId = "org-1", accounts = [A, B, C], ...props }) {
  const data = useReconcileShortcutData({ organizationId, enabled: accounts.length > 0 });
  return (
    <div>
      <button type="button">fora</button>
      <ReconcileShortcut data={data} accounts={accounts} filteredIds={[]} baseCurrency="BRL" {...props} />
      <button type="button">depois</button>
    </div>
  );
}

const renderShortcut = (props = {}) => {
  const onOpen = vi.fn();
  const view = render(<Harness onOpen={onOpen} {...props} />);
  return Object.assign(onOpen, { rerenderWith: (next) => view.rerender(<Harness onOpen={onOpen} {...props} {...next} />) });
};

/** Uma promessa que o teste resolve quando quiser. */
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const expectedN = () => {
  const detail = draftDetail("acc-a", "d-1", REVIEWED);
  return stepProgress(detail, passedStepsOf(detail)).done;
};

describe("ReconcileShortcut — destino direto", () => {
  it("exatamente uma conta filtrada: 'Conciliar extrato da <conta>' vai à conciliação dela", async () => {
    const onOpen = renderShortcut({ filteredIds: ["acc-b"] });
    const btn = await screen.findByRole("button", { name: "Conciliar extrato da Poupança Smoke" });
    await userEvent.click(btn);
    expect(onOpen).toHaveBeenCalledWith("acc-b", null);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("a organização tem uma conta elegível só: vai direto, sem filtro", async () => {
    const onOpen = renderShortcut({ accounts: [A] });
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato da Corrente Smoke" }));
    expect(onOpen).toHaveBeenCalledWith("acc-a", null);
  });

  it("conta de destino com rascunho: 'Continuar conciliação' com 'N de 8 passos' (o N do stepProgress) e leva ao rascunho mais recente", async () => {
    listDraftsMock.mockResolvedValue([
      draftItem("acc-a", "d-old", "2026-11-10T10:00:00"),
      draftItem("acc-a", "d-new", "2026-11-15T10:00:00"),
      draftItem("acc-b", "d-b", "2026-11-16T10:00:00"),
    ]);
    const onOpen = renderShortcut({ filteredIds: ["acc-a"] });
    const n = expectedN();
    expect(n).toBe(4);
    const btn = await screen.findByRole("button", { name: /Continuar conciliação/ });
    await waitFor(() => expect(btn).toHaveTextContent(`Continuar conciliação${n} de 8 passos`));
    // Só o detalhe do rascunho necessário: o da conta de destino.
    expect(getImportMock).toHaveBeenCalledTimes(1);
    expect(getImportMock).toHaveBeenCalledWith("acc-a", "org-1", "d-new");
    await userEvent.click(btn);
    expect(onOpen).toHaveBeenCalledWith("acc-a", "d-new");
  });

  it("detalhe do rascunho falha: continua 'Continuar conciliação' sem o selo, levando ao rascunho", async () => {
    listDraftsMock.mockResolvedValue([draftItem("acc-a", "d-1")]);
    getImportMock.mockRejectedValue(new Error("boom"));
    const onOpen = renderShortcut({ accounts: [A] });
    const btn = await screen.findByRole("button", { name: "Continuar conciliação" });
    await waitFor(() => expect(getImportMock).toHaveBeenCalled());
    expect(btn).not.toHaveTextContent(/passos/);
    await userEvent.click(btn);
    expect(onOpen).toHaveBeenCalledWith("acc-a", "d-1");
  });

  it("erro na lista de rascunhos: cai no texto básico e vai à conciliação da conta", async () => {
    listDraftsMock.mockRejectedValue(new Error("500"));
    const onOpen = renderShortcut({ filteredIds: ["acc-a"] });
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalled());
    const btn = await screen.findByRole("button", { name: "Conciliar extrato da Corrente Smoke" });
    await userEvent.click(btn);
    expect(onOpen).toHaveBeenCalledWith("acc-a", null);
  });

  it("sem conta elegível: nada aparece e nada é pedido", () => {
    renderShortcut({ accounts: [] });
    expect(screen.queryByRole("button", { name: /Conciliar|Continuar/ })).toBeNull();
    expect(listDraftsMock).not.toHaveBeenCalled();
  });
});

describe("ReconcileShortcut — escolher a conta (T4)", () => {
  it("várias contas sem filtro: 'Conciliar extrato…' abre o menu com uma linha por conta elegível e o rodapé dos cartões", async () => {
    listDraftsMock.mockResolvedValue([draftItem("acc-a", "d-1")]);
    listImportsMock.mockImplementation((accountId) => Promise.resolve(accountId === "acc-c"
      ? [
          { id: "i-1", account_id: "acc-c", status: "concluded", period: { start: "2026-09-01", end: "2026-09-30" } },
          { id: "i-2", account_id: "acc-c", status: "concluded", period: { start: "2026-10-01", end: "2026-10-31" } },
        ]
      : []));
    const onOpen = renderShortcut();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    expect(btn).toHaveAttribute("aria-haspopup", "menu");
    // A última concluída só é pedida quando o menu abre.
    expect(listImportsMock).not.toHaveBeenCalled();
    await userEvent.click(btn);
    const menu = await screen.findByRole("menu", { name: "Conciliar o extrato de qual conta?" });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent.split(/Conciliação|Nenhum|Última/)[0])).toEqual([
      "Corrente Smoke", "Poupança Smoke", "Conta USD Smoke · USD",
    ]);
    await waitFor(() => expect(items[0]).toHaveTextContent(`Conciliação começada · ${expectedN()} de 8 passos`));
    expect(items[0]).toHaveTextContent("Continuar");
    await waitFor(() => expect(items[1]).toHaveTextContent("Nenhum extrato importado ainda"));
    await waitFor(() => expect(items[2]).toHaveTextContent("Última conciliação até 31/10/2026"));
    // A conta com rascunho não precisa da lista: o rascunho já responde.
    expect(listImportsMock).not.toHaveBeenCalledWith("acc-a", "org-1");
    expect(menu).toHaveAccessibleDescription("Cartões de crédito não aparecem: a fatura não é conciliada por extrato.");
    await userEvent.click(items[0]);
    expect(onOpen).toHaveBeenCalledWith("acc-a", "d-1");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("várias filtradas: menu; escolher conta sem rascunho leva à conciliação dela", async () => {
    const onOpen = renderShortcut({ filteredIds: ["acc-a", "acc-b"] });
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato…" }));
    const menu = await screen.findByRole("menu");
    await userEvent.click(within(menu).getByRole("menuitem", { name: /Poupança Smoke/ }));
    expect(onOpen).toHaveBeenCalledWith("acc-b", null);
  });

  it("só importações desfeitas: diz que nenhuma foi concluída, não que nada foi importado", async () => {
    listImportsMock.mockResolvedValue([{ id: "u", status: "undone", period: { start: "2026-10-01", end: "2026-10-31" } }]);
    renderShortcut({ accounts: [A, B] });
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato…" }));
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveTextContent("Nenhuma conciliação concluída ainda"));
  });

  it("erro ao ler os extratos de uma conta: a linha fica só com o nome, o menu segue", async () => {
    listImportsMock.mockRejectedValue(new Error("x"));
    const onOpen = renderShortcut({ accounts: [A, B] });
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato…" }));
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(listImportsMock).toHaveBeenCalledTimes(2));
    expect(items[0].textContent).toBe("Corrente Smoke");
    await userEvent.click(items[1]);
    expect(onOpen).toHaveBeenCalledWith("acc-b", null);
  });

  it("teclado: abre com o foco na primeira conta, setas percorrem em ciclo, Esc fecha e devolve o foco ao botão", async () => {
    renderShortcut();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    btn.focus();
    await userEvent.keyboard("{Enter}");
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(items[2]).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(items[2]).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(btn).toHaveFocus();
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("Tab não prende: fecha o menu e o foco segue para o que vem depois do botão (G3 achado 6)", async () => {
    renderShortcut();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    await userEvent.click(btn);
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveFocus());
    await userEvent.tab();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "depois" })).toHaveFocus();
  });

  it("Shift+Tab também fecha e o foco volta para antes do botão", async () => {
    renderShortcut();
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato…" }));
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveFocus());
    await userEvent.tab({ shift: true });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "fora" })).toHaveFocus();
  });

  it("seta para baixo no botão fechado abre com o foco na primeira conta; seta para cima, na última", async () => {
    renderShortcut();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    btn.focus();
    await userEvent.keyboard("{ArrowDown}");
    let items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    expect(btn).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(items[2]).toHaveFocus());
  });

  it("Espaço no botão abre o menu", async () => {
    renderShortcut();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    btn.focus();
    await userEvent.keyboard(" ");
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveFocus());
  });

  it("o rodapé dos cartões fica FORA do role=menu e descreve o menu (aria-describedby)", async () => {
    renderShortcut();
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato…" }));
    const menu = await screen.findByRole("menu");
    expect(menu).not.toHaveTextContent("Cartões de crédito");
    // Dentro do menu, só itens de menu (o título é decorativo e repetido no aria-label).
    for (const child of menu.children) expect(child.getAttribute("role") === "menuitem" || child.getAttribute("aria-hidden") === "true").toBe(true);
    const footer = document.getElementById(menu.getAttribute("aria-describedby"));
    expect(footer).toHaveTextContent("Cartões de crédito não aparecem: a fatura não é conciliada por extrato.");
    expect(menu).toHaveAccessibleDescription("Cartões de crédito não aparecem: a fatura não é conciliada por extrato.");
  });

  it("rolar a página com o menu aberto fecha o menu (ele não fica parado longe do botão)", async () => {
    renderShortcut();
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato…" }));
    const menu = await screen.findByRole("menu");
    // Rolar dentro do próprio menu (lista longa) não fecha.
    fireEvent.scroll(menu);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.scroll(screen.getByRole("button", { name: "fora" }).parentElement);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("clique fora fecha o menu sem navegar", async () => {
    const onOpen = renderShortcut();
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato…" }));
    await screen.findByRole("menu");
    await userEvent.click(screen.getByRole("button", { name: "fora" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("clicar no botão de novo fecha o menu", async () => {
    renderShortcut();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    await userEvent.click(btn);
    await screen.findByRole("menu");
    await userEvent.click(btn);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("no celular (390px) o menu cabe na tela", async () => {
    window.innerWidth = 390;
    renderShortcut({ compact: true });
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato…" }));
    // A caixa posicionada envolve o menu e o rodapé dos cartões.
    const box = (await screen.findByRole("menu")).parentElement;
    const left = parseFloat(box.style.left);
    const width = parseFloat(box.style.width);
    expect(left).toBeGreaterThanOrEqual(16);
    expect(left + width).toBeLessThanOrEqual(390 - 16);
  });
});

describe("ReconcileShortcut — pedidos (G3 achados 2, 4 e 5)", () => {
  it("modo menu: o detalhe dos rascunhos só é pedido quando o menu abre, e reabrir não pede de novo", async () => {
    listDraftsMock.mockResolvedValue([draftItem("acc-a", "d-a"), draftItem("acc-b", "d-b")]);
    renderShortcut();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalledTimes(1));
    // Dá tempo de qualquer pedido indevido sair.
    await act(async () => { await Promise.resolve(); });
    expect(getImportMock).not.toHaveBeenCalled();
    expect(listImportsMock).not.toHaveBeenCalled();

    await userEvent.click(btn);
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveTextContent(`Conciliação começada · ${expectedN()} de 8 passos`));
    await waitFor(() => expect(items[1]).toHaveTextContent(`Conciliação começada · ${expectedN()} de 8 passos`));
    await waitFor(() => expect(items[2]).toHaveTextContent("Nenhum extrato importado ainda"));
    expect(getImportMock.mock.calls.map((c) => c[2]).sort()).toEqual(["d-a", "d-b"]);
    expect(listImportsMock.mock.calls).toEqual([["acc-c", "org-1"]]);

    await userEvent.click(btn);
    expect(screen.queryByRole("menu")).toBeNull();
    await userEvent.click(btn);
    const again = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    // Na reabertura, tudo já está à vista, sem esperar.
    expect(again[0]).toHaveTextContent(`Conciliação começada · ${expectedN()} de 8 passos`);
    expect(again[2]).toHaveTextContent("Nenhum extrato importado ainda");
    expect(getImportMock).toHaveBeenCalledTimes(2);
    expect(listImportsMock).toHaveBeenCalledTimes(1);
    expect(listDraftsMock).toHaveBeenCalledTimes(1);
  });

  it("menu aberto antes de os rascunhos chegarem: espera por eles e pede a lista só das contas sem rascunho, uma vez", async () => {
    const drafts = deferred();
    listDraftsMock.mockReturnValue(drafts.promise);
    renderShortcut();
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato…" }));
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await act(async () => { await Promise.resolve(); });
    expect(listImportsMock).not.toHaveBeenCalled();
    await act(async () => { drafts.resolve([draftItem("acc-b", "d-b")]); });
    await waitFor(() => expect(items[1]).toHaveTextContent(`Conciliação começada · ${expectedN()} de 8 passos`));
    await waitFor(() => expect(listImportsMock).toHaveBeenCalledTimes(2));
    expect(listImportsMock.mock.calls.map((c) => c[0]).sort()).toEqual(["acc-a", "acc-c"]);
    expect(getImportMock.mock.calls.map((c) => c[2])).toEqual(["d-b"]);
  });

  it("lista de rascunhos falhou: o menu pede a última concluída de todas as contas", async () => {
    listDraftsMock.mockRejectedValue(new Error("500"));
    renderShortcut();
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole("button", { name: "Conciliar extrato…" }));
    await screen.findByRole("menu");
    await waitFor(() => expect(listImportsMock).toHaveBeenCalledTimes(3));
    expect(getImportMock).not.toHaveBeenCalled();
  });

  it("lista de extratos de uma conta falhou: a próxima abertura tenta de novo só aquela", async () => {
    listImportsMock.mockImplementation((id) => (id === "acc-b" ? Promise.reject(new Error("x")) : Promise.resolve([])));
    renderShortcut();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalled());
    await userEvent.click(btn);
    await screen.findByRole("menu");
    await waitFor(() => expect(listImportsMock).toHaveBeenCalledTimes(3));
    await userEvent.click(btn);
    await userEvent.click(btn);
    await screen.findByRole("menu");
    await waitFor(() => expect(listImportsMock).toHaveBeenCalledTimes(4));
    expect(listImportsMock.mock.calls[3][0]).toBe("acc-b");
  });

  it("achado 4: o filtro muda com o detalhe em voo; a resposta que chega depois não se perde e o 'N de 8 passos' volta", async () => {
    listDraftsMock.mockResolvedValue([draftItem("acc-a", "d-a"), draftItem("acc-b", "d-b")]);
    const detailA = deferred();
    getImportMock.mockImplementation((accountId, _org, id) => (id === "d-a" ? detailA.promise : Promise.resolve(draftDetail(accountId, id, REVIEWED))));
    const view = renderShortcut({ filteredIds: ["acc-a"] });
    await screen.findByRole("button", { name: /Continuar conciliação/ });
    await waitFor(() => expect(getImportMock).toHaveBeenCalledWith("acc-a", "org-1", "d-a"));
    // Acrescenta a Poupança ao filtro antes da resposta: o atalho vira menu.
    view.rerenderWith({ filteredIds: ["acc-a", "acc-b"] });
    await screen.findByRole("button", { name: "Conciliar extrato…" });
    await act(async () => { detailA.resolve(draftDetail("acc-a", "d-a", REVIEWED)); });
    // Volta a filtrar só pela Corrente: o número está lá, sem novo pedido.
    view.rerenderWith({ filteredIds: ["acc-a"] });
    const btn = screen.getByRole("button", { name: /Continuar conciliação/ });
    expect(btn).toHaveTextContent(`Continuar conciliação${expectedN()} de 8 passos`);
    expect(getImportMock.mock.calls.filter((c) => c[2] === "d-a")).toHaveLength(1);
    // E o menu também mostra o número da Corrente.
    view.rerenderWith({ filteredIds: [] });
    await userEvent.click(screen.getByRole("button", { name: "Conciliar extrato…" }));
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    expect(items[0]).toHaveTextContent(`Conciliação começada · ${expectedN()} de 8 passos`);
  });

  it("troca de organização: a resposta atrasada da organização anterior não aparece", async () => {
    const oldDrafts = deferred();
    listDraftsMock.mockImplementation((org) => (org === "org-1" ? oldDrafts.promise : Promise.resolve([])));
    const view = renderShortcut({ filteredIds: ["acc-a"] });
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalledWith("org-1"));
    view.rerenderWith({ organizationId: "org-2" });
    await waitFor(() => expect(listDraftsMock).toHaveBeenCalledWith("org-2"));
    await act(async () => { oldDrafts.resolve([draftItem("acc-a", "d-old-org")]); });
    expect(screen.getByRole("button", { name: "Conciliar extrato da Corrente Smoke" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Continuar conciliação/ })).toBeNull();
    expect(getImportMock).not.toHaveBeenCalled();
  });
});

describe("ReconcileShortcut — rótulo longo (G3 achado 7)", () => {
  it("o botão encolhe e o rótulo corta com reticências, numa linha só", async () => {
    const long = { id: "acc-l", label: "Conta Corrente Banco do Brasil Ag 1234", currency: "BRL" };
    renderShortcut({ accounts: [long] });
    const btn = await screen.findByRole("button", { name: `Conciliar extrato da ${long.label}` });
    expect(btn.style.flex).toBe("0 1 auto");
    expect(btn.style.minWidth).toBe("0px");
    const text = within(btn).getByText(`Conciliar extrato da ${long.label}`);
    expect(text.style.overflow).toBe("hidden");
    expect(text.style.textOverflow).toBe("ellipsis");
    expect(text.style.whiteSpace).toBe("nowrap");
    expect(text.style.minWidth).toBe("0px");
  });
});
