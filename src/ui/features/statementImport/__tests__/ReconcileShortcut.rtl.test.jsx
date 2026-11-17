/** @vitest-environment jsdom */
// O atalho "Conciliar extrato" da tela de Transações (decisão do Owner de 2026-11-17, telas T1–T4).
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

const renderShortcut = (props = {}) => {
  const onOpen = vi.fn();
  render(
    <div>
      <button type="button">fora</button>
      <ReconcileShortcut organizationId="org-1" accounts={[A, B, C]} filteredIds={[]} baseCurrency="BRL" onOpen={onOpen} {...props} />
    </div>,
  );
  return onOpen;
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
    expect(menu).toHaveTextContent("Cartões de crédito não aparecem: a fatura não é conciliada por extrato.");
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

  it("teclado: abre com o foco na primeira conta, setas e Tab percorrem, Esc fecha e devolve o foco ao botão", async () => {
    renderShortcut();
    const btn = await screen.findByRole("button", { name: "Conciliar extrato…" });
    btn.focus();
    await userEvent.keyboard("{Enter}");
    const items = within(await screen.findByRole("menu")).getAllByRole("menuitem");
    await waitFor(() => expect(items[0]).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await userEvent.tab();
    expect(items[2]).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(items[2]).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(items[1]).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(btn).toHaveFocus();
    expect(btn).toHaveAttribute("aria-expanded", "false");
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
    const menu = await screen.findByRole("menu");
    const left = parseFloat(menu.style.left);
    const width = parseFloat(menu.style.width);
    expect(left).toBeGreaterThanOrEqual(16);
    expect(left + width).toBeLessThanOrEqual(390 - 16);
  });
});
