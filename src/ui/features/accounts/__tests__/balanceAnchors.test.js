import { describe, expect, it } from "vitest";
import {
  anchorCovering,
  entriesCoveredBy,
  latestAnchorByAccount,
  toYmd,
} from "../balanceAnchors.js";

const adj = (over = {}) => ({
  id: "a1",
  account_id: "acc-1",
  amount: 0,
  asserted_balance: 100,
  date: "2026-08-13T12:00:00",
  reason: "conciliação",
  created_at: "2026-08-13T12:00:00",
  ...over,
});

describe("toYmd", () => {
  it("aceita as três formas que circulam na UI", () => {
    expect(toYmd("2026-08-13T12:00:00")).toBe("2026-08-13");
    expect(toYmd("2026-08-13")).toBe("2026-08-13");
    expect(toYmd("13/08/2026")).toBe("2026-08-13"); // formato de exibição da lista
    expect(toYmd(new Date(2026, 7, 13))).toBe("2026-08-13");
  });

  it("devolve vazio no que não dá para interpretar, em vez de inventar", () => {
    expect(toYmd(null)).toBe("");
    expect(toYmd("")).toBe("");
    expect(toYmd("ontem")).toBe("");
    expect(toYmd(new Date("nada"))).toBe("");
  });
});

describe("latestAnchorByAccount", () => {
  it("pega a mais recente de cada conta", () => {
    const anchors = latestAnchorByAccount([
      adj({ id: "a", date: "2026-08-10T12:00:00", asserted_balance: 10 }),
      adj({ id: "b", date: "2026-08-13T12:00:00", asserted_balance: 20 }),
      adj({ id: "c", account_id: "acc-2", date: "2026-01-05T12:00:00", asserted_balance: 30 }),
    ]);
    expect(anchors["acc-1"].assertedBalance).toBe(20);
    expect(anchors["acc-2"].assertedBalance).toBe(30);
  });

  it("desempata por created_at e depois por id — a MESMA ordem do backend", () => {
    // Se divergisse, a UI diria que um lançamento está coberto por uma âncora que o
    // backend não usou, e o aviso mentiria.
    const sameDay = "2026-08-13T12:00:00";
    const byCreated = latestAnchorByAccount([
      adj({ id: "a", date: sameDay, created_at: "2026-08-13T09:00:00", asserted_balance: 1 }),
      adj({ id: "b", date: sameDay, created_at: "2026-08-13T18:00:00", asserted_balance: 2 }),
    ]);
    expect(byCreated["acc-1"].assertedBalance).toBe(2);

    const byId = latestAnchorByAccount([
      adj({ id: "a", date: sameDay, created_at: sameDay, asserted_balance: 1 }),
      adj({ id: "z", date: sameDay, created_at: sameDay, asserted_balance: 2 }),
    ]);
    expect(byId["acc-1"].assertedBalance).toBe(2);
  });

  it("ignora linhas sem conta ou sem data em vez de quebrar", () => {
    expect(latestAnchorByAccount([{ id: "x" }, adj({ date: null })])).toEqual({});
    expect(latestAnchorByAccount(null)).toEqual({});
  });

  it("não vaza a chave interna de ordenação", () => {
    const anchors = latestAnchorByAccount([adj()]);
    expect(Object.keys(anchors["acc-1"]).sort()).toEqual(["assertedBalance", "reason", "ymd"]);
  });
});

describe("anchorCovering", () => {
  const anchors = latestAnchorByAccount([adj({ date: "2026-08-13T12:00:00" })]);

  it("cobre o dia inteiro da âncora — inclusive mais tarde no mesmo dia", () => {
    expect(anchorCovering({ accountId: "acc-1", paidAt: "2026-08-13T23:30:00" }, anchors)).toBeTruthy();
    expect(anchorCovering({ accountId: "acc-1", paidAt: "2026-08-12T10:00:00" }, anchors)).toBeTruthy();
  });

  it("não cobre o dia seguinte", () => {
    expect(anchorCovering({ accountId: "acc-1", paidAt: "2026-08-14T00:30:00" }, anchors)).toBeNull();
  });

  it("usa o caixa (paidAt) e não a competência quando os dois existem", () => {
    // Boleto de julho pago em setembro: o caixa é setembro, então NÃO está coberto.
    const entry = { accountId: "acc-1", date: "2026-07-01", paidAt: "2026-09-01T10:00:00" };
    expect(anchorCovering(entry, anchors)).toBeNull();
  });

  it("devolve null quando não dá para afirmar — avisar no escuro seria pior", () => {
    expect(anchorCovering({ paidAt: "2026-01-01" }, anchors)).toBeNull(); // sem conta
    expect(anchorCovering({ accountId: "acc-9", paidAt: "2026-01-01" }, anchors)).toBeNull(); // sem âncora
    expect(anchorCovering({ accountId: "acc-1" }, anchors)).toBeNull(); // sem data
  });
});

describe("entriesCoveredBy", () => {
  const entries = [
    { accountId: "acc-1", date: "10/08/2026", val: -100 },
    { accountId: "acc-1", date: "13/08/2026", val: 50 },
    { accountId: "acc-1", date: "20/08/2026", val: -7 },
    { accountId: "acc-2", date: "01/08/2026", val: -999 },
  ];

  it("conta e soma o que uma âncora nesta data passaria a cobrir", () => {
    const { count, total } = entriesCoveredBy(entries, { accountId: "acc-1", ymd: "2026-08-13" });
    expect(count).toBe(2);
    expect(total).toBe(150); // valor absoluto: é tamanho do efeito, não resultado
  });

  it("não mistura contas", () => {
    expect(entriesCoveredBy(entries, { accountId: "acc-2", ymd: "2026-08-13" }).count).toBe(1);
  });

  it("devolve zero sem conta ou sem data", () => {
    expect(entriesCoveredBy(entries, { accountId: null, ymd: "2026-08-13" })).toEqual({ count: 0, total: 0 });
    expect(entriesCoveredBy(entries, { accountId: "acc-1", ymd: "" })).toEqual({ count: 0, total: 0 });
  });
});
