// O atalho "Conciliar extrato" da tela de Transações (decisão do Owner de 2026-11-17): para onde ele
// leva, qual rascunho de cada conta vale e até quando foi a última conciliação concluída.
import { describe, expect, it } from "vitest";

import { latestConcludedEnd, latestDraftByAccount, mobileShortcutChip, shortcutTarget } from "../reconcileShortcut.js";

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

describe("mobileShortcutChip (celular, decisão do Owner de 2026-11-22: M1b / M3 / M2)", () => {
  const dA = { id: "d-a", account_id: "acc-a" };
  const dB = { id: "d-b", account_id: "acc-b" };
  const dC = { id: "d-c", account_id: "acc-c" };
  const chip = (accounts, filteredIds, draftByAccount) =>
    mobileShortcutChip({ target: shortcutTarget({ accounts, filteredIds }), accounts, filteredIds, draftByAccount });

  it("sem destino (nenhuma conta elegível) ou rascunhos ainda não carregados/erro: sem chip", () => {
    expect(chip([], [], {})).toBeNull();
    expect(chip([A, B], [], null)).toBeNull();
  });

  it("M1b — conta filtrada com rascunho: continua a dela, mesmo com rascunhos em outras contas", () => {
    expect(chip([A, B, C], ["acc-b"], { "acc-a": dA, "acc-b": dB, "acc-c": dC })).toEqual({ kind: "continue", account: B, draft: dB });
  });

  it("M1b — organização com UMA conta elegível, com rascunho", () => {
    expect(chip([A], [], { "acc-a": dA })).toEqual({ kind: "continue", account: A, draft: dA });
  });

  it("M1b — sem destino direto e exatamente UM rascunho: leva a ele", () => {
    expect(chip([A, B, C], [], { "acc-c": dC })).toEqual({ kind: "continue", account: C, draft: dC });
  });

  it("M3 — sem destino direto e dois ou mais rascunhos: a lista, na ordem das contas", () => {
    expect(chip([A, B, C], [], { "acc-c": dC, "acc-a": dA })).toEqual({
      kind: "many", started: [{ account: A, draft: dA }, { account: C, draft: dC }],
    });
  });

  // Decisão do orquestrador (2026-11-22, G3 achado 3): com filtro de conta, só as conciliações
  // começadas das contas FILTRADAS e ativas contam; o chip nunca leva para fora do recorte.
  it("conta filtrada sem rascunho, mesmo com duas outras com: sem chip (fora do recorte)", () => {
    expect(chip([A, B, C], ["acc-b"], { "acc-a": dA, "acc-c": dC })).toBeNull();
  });

  it("filtro A+B com rascunho só na C: sem chip", () => {
    expect(chip([A, B, C], ["acc-a", "acc-b"], { "acc-c": dC })).toBeNull();
  });

  it("filtro A+B com rascunho em A e B (e na C): M3 só com A e B, na ordem das contas", () => {
    expect(chip([A, B, C], ["acc-b", "acc-a"], { "acc-c": dC, "acc-b": dB, "acc-a": dA })).toEqual({
      kind: "many", started: [{ account: A, draft: dA }, { account: B, draft: dB }],
    });
  });

  it("filtro A+B com rascunho só na A (e na C): M1b da A", () => {
    expect(chip([A, B, C], ["acc-a", "acc-b"], { "acc-a": dA, "acc-c": dC })).toEqual({ kind: "continue", account: A, draft: dA });
  });

  it("filtro só por conta desativada: ela não vale e nenhuma outra entra (sem chip)", () => {
    expect(chip([A, B], ["acc-old"], { "acc-a": dA, "acc-b": dB })).toBeNull();
    expect(chip([A], ["acc-old"], { "acc-a": dA })).toBeNull();
  });

  it("filtro desativada + A: só a A conta", () => {
    expect(chip([A, B], ["acc-old", "acc-a"], { "acc-a": dA, "acc-b": dB })).toEqual({ kind: "continue", account: A, draft: dA });
  });

  it("conta filtrada sem rascunho e UMA outra com: sem chip (não leva a outra conta com a tela filtrada)", () => {
    expect(chip([A, B, C], ["acc-b"], { "acc-a": dA })).toBeNull();
  });

  it("M2 — nada começado: sem chip", () => {
    expect(chip([A, B], [], {})).toBeNull();
    expect(chip([A], [], {})).toBeNull();
  });

  it("rascunho de conta que não é elegível (desativada/cartão) não conta", () => {
    expect(chip([A, B], [], { "acc-x": { id: "d-x", account_id: "acc-x" }, "acc-a": dA })).toEqual({ kind: "continue", account: A, draft: dA });
  });
});
