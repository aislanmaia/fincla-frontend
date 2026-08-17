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

  it("ordena pela data CRUA, não pelo dia truncado", () => {
    // O backend ordena por `date DESC` no timestamp cheio. Truncar para o dia
    // inverteria a escolha entre dois ajustes do mesmo dia cuja ordem por `date`
    // difere da ordem por `created_at` — e a UI apontaria uma âncora que o backend
    // não usou.
    const anchors = latestAnchorByAccount([
      adj({ id: "a", date: "2026-08-13T18:00:00", created_at: "2026-08-13T08:00:00", asserted_balance: 1 }),
      adj({ id: "b", date: "2026-08-13T09:00:00", created_at: "2026-08-13T20:00:00", asserted_balance: 2 }),
    ]);
    expect(anchors["acc-1"].assertedBalance).toBe(1);
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
    expect(anchorCovering({ accountId: "acc-1", settled: true, paidAt: "2026-08-13T23:30:00" }, anchors)).toBeTruthy();
    expect(anchorCovering({ accountId: "acc-1", settled: true, paidAt: "2026-08-12T10:00:00" }, anchors)).toBeTruthy();
  });

  it("NÃO marca lançamento pendente — ele não entra no saldo por outro motivo", () => {
    // Marcá-lo poria "já está contemplado no acerto" ao lado do badge "A pagar", que
    // diz o contrário. E `PATCH /settle` grava paid_at=agora: ao liquidar, o caixa cai
    // DEPOIS da âncora e o saldo se move, logo após a UI prometer que não se moveria.
    const pendente = { accountId: "acc-1", settled: false, date: "2026-08-10", paidAt: null };
    expect(anchorCovering(pendente, anchors)).toBeNull();
  });

  it("não cobre o dia seguinte", () => {
    expect(anchorCovering({ accountId: "acc-1", settled: true, paidAt: "2026-08-14T00:30:00" }, anchors)).toBeNull();
  });

  it("usa o caixa (paidAt) e não a competência quando os dois existem", () => {
    // Boleto de julho pago em setembro: o caixa é setembro, então NÃO está coberto.
    const entry = { accountId: "acc-1", settled: true, date: "2026-07-01", paidAt: "2026-09-01T10:00:00" };
    expect(anchorCovering(entry, anchors)).toBeNull();
  });

  it("devolve null quando não dá para afirmar — avisar no escuro seria pior", () => {
    expect(anchorCovering({ settled: true, paidAt: "2026-01-01" }, anchors)).toBeNull(); // sem conta
    expect(anchorCovering({ accountId: "acc-9", settled: true, paidAt: "2026-01-01" }, anchors)).toBeNull(); // sem âncora
    expect(anchorCovering({ accountId: "acc-1", settled: true }, anchors)).toBeNull(); // sem data
  });
});

describe("entriesCoveredBy", () => {
  const entries = [
    { accountId: "acc-1", settled: true, date: "10/08/2026", val: -100 },
    { accountId: "acc-1", settled: true, date: "13/08/2026", val: 50 },
    { accountId: "acc-1", settled: true, date: "20/08/2026", val: -7 },
    { accountId: "acc-2", settled: true, date: "01/08/2026", val: -999 },
  ];

  it("conta e devolve o efeito LÍQUIDO do que passaria a ser coberto", () => {
    const { count, net } = entriesCoveredBy(entries, { accountId: "acc-1", ymd: "2026-08-13" });
    expect(count).toBe(2);
    // -100 + 50 = -50. Somar em módulo daria 150, número que não bate com nada que o
    // usuário possa conferir contra um extrato.
    expect(net).toBe(-50);
  });

  it("não conta o que a âncora ATUAL já cobre", () => {
    // Sem o limite inferior, o aviso anunciava "203 lançamentos" onde só 3 mudam de
    // situação — e assusta o usuário para longe de uma reconciliação correta.
    const { count } = entriesCoveredBy(entries, {
      accountId: "acc-1", ymd: "2026-08-13", sinceYmd: "2026-08-10",
    });
    expect(count).toBe(1);
  });

  it("ignora pendentes: âncora não cobre o que não está no saldo", () => {
    const comPendente = [...entries, { accountId: "acc-1", settled: false, date: "05/08/2026", val: -777 }];
    const { count } = entriesCoveredBy(comPendente, { accountId: "acc-1", ymd: "2026-08-13" });
    expect(count).toBe(2);
  });

  it("não mistura contas", () => {
    expect(entriesCoveredBy(entries, { accountId: "acc-2", ymd: "2026-08-13" }).count).toBe(1);
  });

  it("devolve zero sem conta ou sem data", () => {
    expect(entriesCoveredBy(entries, { accountId: null, ymd: "2026-08-13" }).count).toBe(0);
    expect(entriesCoveredBy(entries, { accountId: "acc-1", ymd: "" }).count).toBe(0);
  });
});
