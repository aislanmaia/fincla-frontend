// O atalho "Conciliar extrato" da tela de Transações (decisão do Owner de 2026-11-17): para onde ele
// leva, qual rascunho de cada conta vale e até quando foi a última conciliação concluída.
import { describe, expect, it } from "vitest";

import { latestConcludedEnd, latestDraftByAccount, shortcutTarget } from "../reconcileShortcut.js";

const A = { id: "acc-a", label: "Corrente Smoke", currency: "BRL" };
const B = { id: "acc-b", label: "Poupança Smoke", currency: "BRL" };
const C = { id: "acc-c", label: "Conta USD Smoke", currency: "USD" };

describe("shortcutTarget", () => {
  it("sem conta elegível: sem atalho", () => {
    expect(shortcutTarget({ accounts: [], filteredIds: [] })).toBeNull();
  });

  it("exatamente uma conta elegível filtrada: direto para ela", () => {
    expect(shortcutTarget({ accounts: [A, B, C], filteredIds: ["acc-b"] })).toEqual({ kind: "direct", account: B });
  });

  it("a organização tem UMA conta elegível: direto, mesmo sem filtro", () => {
    expect(shortcutTarget({ accounts: [A], filteredIds: [] })).toEqual({ kind: "direct", account: A });
  });

  it("várias contas sem filtro: menu", () => {
    expect(shortcutTarget({ accounts: [A, B], filteredIds: [] })).toEqual({ kind: "menu" });
  });

  it("várias filtradas: menu", () => {
    expect(shortcutTarget({ accounts: [A, B, C], filteredIds: ["acc-a", "acc-c"] })).toEqual({ kind: "menu" });
  });

  it("conta filtrada que não é elegível (desativada) não conta: uma elegível + uma desativada vai direto", () => {
    expect(shortcutTarget({ accounts: [A, B], filteredIds: ["acc-old", "acc-a"] })).toEqual({ kind: "direct", account: A });
    expect(shortcutTarget({ accounts: [A, B], filteredIds: ["acc-old"] })).toEqual({ kind: "menu" });
  });
});

describe("latestDraftByAccount", () => {
  it("um rascunho por conta: o de atividade mais recente, qualquer que seja a ordem da lista", () => {
    const drafts = [
      { id: "d-old", account_id: "acc-a", last_activity_at: "2026-11-10T10:00:00" },
      { id: "d-b", account_id: "acc-b", last_activity_at: "2026-11-01T10:00:00" },
      { id: "d-new", account_id: "acc-a", last_activity_at: "2026-11-15T09:00:00" },
      { id: "d-mid", account_id: "acc-a", last_activity_at: "2026-11-12T10:00:00" },
    ];
    const byAccount = latestDraftByAccount(drafts);
    expect(Object.keys(byAccount).sort()).toEqual(["acc-a", "acc-b"]);
    expect(byAccount["acc-a"].id).toBe("d-new");
    expect(byAccount["acc-b"].id).toBe("d-b");
  });

  it("ignora o que não é rascunho", () => {
    expect(latestDraftByAccount([{ id: "x", account_id: "acc-a", status: "concluded", last_activity_at: "2026-11-01" }])).toEqual({});
  });
});

describe("latestConcludedEnd", () => {
  it("o maior fim de período entre as concluídas; desfeitas e rascunhos não contam", () => {
    const items = [
      { status: "concluded", period: { start: "2026-09-01", end: "2026-09-30" } },
      { status: "undone", period: { start: "2026-11-01", end: "2026-11-30" } },
      { status: "concluded", period: { start: "2026-10-01", end: "2026-10-31" } },
      { status: "draft", period: { start: "2026-12-01", end: "2026-12-31" } },
    ];
    expect(latestConcludedEnd(items)).toBe("2026-10-31");
  });

  it("sem concluída: null", () => {
    expect(latestConcludedEnd([{ status: "undone", period: { end: "2026-11-30" } }])).toBeNull();
    expect(latestConcludedEnd([])).toBeNull();
  });
});
