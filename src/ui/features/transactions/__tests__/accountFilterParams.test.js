import { describe, expect, it } from "vitest";

import { buildTransactionsQuery, buildTransactionsSummaryQuery, buildTransactionsFacetsQuery } from "../../../data/transactionsAdapter.js";
import { filtersToLegacyParams } from "../filters/filtersToLegacyParams.js";
import { mergeTransferRows, transfersToRows } from "../transferRows.js";
import { resolveTransactionsDeepLink } from "../transactionsDeepLink.js";
import { FC, mergeNavSearch } from "../../../routing/searchContract.js";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";

describe("filtro Conta (#268) — da tela à API", () => {
  it("accountSel vira accountIds, e accountIds vira account_id repetível na LISTA, no RESUMO e nas FACETS", () => {
    const legacy = filtersToLegacyParams({ type: "todos", method: [], cats: [], period: "mes", accountSel: [A, B] }, { limit: 10 });
    expect(legacy.accountIds).toEqual([A, B]);
    const list = buildTransactionsQuery({ organizationId: "org", ...legacy });
    const summary = buildTransactionsSummaryQuery({ organizationId: "org", ...legacy });
    const facets = buildTransactionsFacetsQuery({ organizationId: "org", ...legacy });
    expect(list.account_id).toEqual([A, B]);
    expect(summary.account_id).toEqual([A, B]);
    expect(facets.account_id).toEqual([A, B]);
  });

  it("sem conta selecionada, nenhum account_id", () => {
    const legacy = filtersToLegacyParams({ type: "todos", method: [], cats: [], period: "mes", accountSel: [] }, { limit: 10 });
    expect(buildTransactionsQuery({ organizationId: "org", ...legacy })).not.toHaveProperty("account_id");
    expect(buildTransactionsSummaryQuery({ organizationId: "org", ...legacy })).not.toHaveProperty("account_id");
  });
});

describe("deep link fc_account", () => {
  it("lê uma ou mais contas (UUID) e ignora o resto", () => {
    expect(resolveTransactionsDeepLink({ [FC.TX_ACCOUNT]: `${A},lixo,${B},${A}` }).accountSel).toEqual([A, B]);
    expect(resolveTransactionsDeepLink({ [FC.TX_ACCOUNT]: "lixo" })).not.toHaveProperty("accountSel");
  });
  it("navTo('transactions', {accountId}) põe fc_account; outra navegação limpa", () => {
    expect(mergeNavSearch({}, "transactions", { accountId: B })[FC.TX_ACCOUNT]).toBe(B);
    expect(mergeNavSearch({ [FC.TX_ACCOUNT]: B }, "dashboard", {})).not.toHaveProperty(FC.TX_ACCOUNT);
  });
});

describe("transferências no extrato de uma conta", () => {
  const byId = { [A]: { label: "Itaú" }, [B]: { label: "Wise" } };
  const transfers = [
    { id: "out", from_account_id: B, to_account_id: A, amount: 100, to_amount: 548, from_currency: "USD", to_currency: "BRL", date: "2026-11-05T12:00:00" },
    { id: "in", from_account_id: A, to_account_id: B, amount: 548, to_amount: 100, from_currency: "BRL", to_currency: "USD", date: "2026-11-08T12:00:00" },
  ];
  it("valor na moeda da conta filtrada: amount na origem, to_amount no destino", () => {
    const rows = transfersToRows(transfers, B, byId);
    const out = rows.find((r) => r.transfer.id === "out");
    const inn = rows.find((r) => r.transfer.id === "in");
    expect(out).toMatchObject({ desc: "Transferência para Itaú", val: -100, currency: "USD", kind: "transfer" });
    expect(inn).toMatchObject({ desc: "Transferência de Itaú", val: 100, currency: "USD" });
  });
  it("linha de baixo sem 'Transferência' repetida: nota e, entre moedas, o outro lado", () => {
    const rows = transfersToRows([{ ...transfers[1], note: "reserva" }, { ...transfers[0], from_currency: "USD", to_currency: "USD", to_amount: 100 }], B, byId);
    const inn = rows.find((r) => r.transfer.id === "in");
    const out = rows.find((r) => r.transfer.id === "out");
    expect(inn.method).toMatch(/^reserva · saiu R\$\s?548,00$/);
    expect(inn.method).not.toMatch(/Transferência/);
    expect(out.method).toBe("");
  });
  it("respeita o período", () => {
    expect(transfersToRows(transfers, B, byId, { dateStart: "2026-11-06", dateEnd: "2026-11-30" }).map((r) => r.transfer.id)).toEqual(["in"]);
  });
  it("intercala por data e, com mais páginas por vir, só entra o que cai na janela carregada", () => {
    const rows = [{ id: 1, date: "10/11/2026" }, { id: 2, date: "06/11/2026" }];
    const tRows = transfersToRows(transfers, B, byId);
    expect(mergeTransferRows(rows, tRows).map((r) => r.id)).toEqual([1, "transfer:in", 2, "transfer:out"]);
    expect(mergeTransferRows(rows, tRows, { hasMore: true }).map((r) => r.id)).toEqual([1, "transfer:in", 2]);
  });
});
