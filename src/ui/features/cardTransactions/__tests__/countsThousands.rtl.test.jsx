/** @vitest-environment jsdom */
/* G3-P-08 (fincla-api#534): as contagens do ledger do cartão levam o separador de milhar — o ledger vive de
   contagens grandes. Componentes reais; o teste lê o texto que se vê. */
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CardTransactionsSummary } from "../CardTransactionsSummary.jsx";
import { LedgerSummaryRow } from "../LedgerMobileBars.jsx";
import { CardTransactionsTable } from "../CardTransactionsTable.jsx";

afterEach(cleanup);
const text = () => document.body.textContent.replace(/\s+/g, " ");
const noop = () => {};
const SUMMARY = { total_transactions: 1235, by_currency: [{ currency: "BRL", amount: "10.00" }], breakdown: { by_category: [] } };

describe("ledger do cartão — contagens com milhar", () => {
  it("resumo do recorte: '1.235 lançamentos'", () => {
    render(<CardTransactionsSummary summary={SUMMARY} loading={false} error={null} isCategorySelected={() => false} onToggleCategory={noop} />);
    expect(text()).toContain("1.235 lançamentos");
    expect(text()).not.toContain("1235");
  });

  it("linha de resumo do celular: '1.235 lançamentos'", () => {
    render(<LedgerSummaryRow summary={SUMMARY} loading={false} error={null} onOpen={noop} />);
    expect(text()).toContain("1.235 lançamentos");
    expect(text()).not.toContain("1235");
  });

  it("dia recolhido: '1.001 itens', '1.001 selecionados' e '1.001 em dias recolhidos'", () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      id: String(i + 1), date: "2026-10-27T00:00:00", description: `Compra ${i}`, value: 1, value_currency: "BRL",
      type: "expense", status: "confirmed", category: "Moradia",
    }));
    render(
      <CardTransactionsTable rows={rows} total={1001} cardCurrency="BRL" selected={rows.map((r) => r.id)} onSelected={noop}
        onExportSelected={noop} onInspect={noop} onMore={noop} grouped collapsible collapsedKeys={new Set(["2026-10-27"])}
        onToggleGroup={noop} />,
    );
    expect(text()).toContain("1.001 itens");
    expect(text()).toContain("1.001 selecionados");
    expect(text()).toContain("1.001 em dias recolhidos");
    expect(text()).not.toMatch(/\b1001\b/);
  });
});
