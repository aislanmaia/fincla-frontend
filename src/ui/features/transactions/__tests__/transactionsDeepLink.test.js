import { describe, expect, it } from "vitest";
import { resolveTransactionsDeepLink } from "../transactionsDeepLink.js";

describe("resolveTransactionsDeepLink", () => {
  it("traduz o contrato inteiro para o vocabulário do filtro", () => {
    expect(
      resolveTransactionsDeepLink({ fc_from: "2026-10-01", fc_to: "2026-10-31", fc_type: "expense", fc_status: "paid" }),
    ).toEqual({ period: "custom", customFrom: "2026-10-01", customTo: "2026-10-31", type: "despesa", settlement: "pagas" });
    expect(resolveTransactionsDeepLink({ fc_type: "income", fc_status: "to_pay" })).toEqual({
      type: "receita",
      settlement: "a-pagar",
    });
  });

  it("aceita dia único (from == to)", () => {
    expect(resolveTransactionsDeepLink({ fc_from: "2026-10-05", fc_to: "2026-10-05" })).toMatchObject({
      period: "custom",
      customFrom: "2026-10-05",
      customTo: "2026-10-05",
    });
  });

  it("from > to descarta o período inteiro, mantém tipo/status", () => {
    expect(
      resolveTransactionsDeepLink({ fc_from: "2026-10-31", fc_to: "2026-10-01", fc_type: "expense" }),
    ).toEqual({ type: "despesa" });
  });

  it("período pela metade (só uma ponta) é ignorado", () => {
    expect(resolveTransactionsDeepLink({ fc_from: "2026-10-01" })).toEqual({});
    expect(resolveTransactionsDeepLink({ fc_to: "2026-10-31" })).toEqual({});
  });

  it("data inexistente e valores fora do contrato são ignorados", () => {
    expect(
      resolveTransactionsDeepLink({ fc_from: "2026-02-31", fc_to: "2026-03-01", fc_type: "transfer", fc_status: "settled" }),
    ).toEqual({});
  });

  it("entradas nulas ou estranhas não explodem", () => {
    expect(resolveTransactionsDeepLink(undefined)).toEqual({});
    expect(resolveTransactionsDeepLink(null)).toEqual({});
    expect(resolveTransactionsDeepLink({ fc_from: 20261001, fc_to: ["x"], fc_type: {} })).toEqual({});
  });
});
