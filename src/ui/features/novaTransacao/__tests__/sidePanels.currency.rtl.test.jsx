// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RefundLinkPanel } from "../RefundLinkPanel.jsx";
import { NovaTransacaoImpactPanel } from "../../../components/NovaTransacaoImpactPanel.jsx";
import { fmtImpactMoney } from "../../../data/novaTransacaoImpactUtils.js";
import { fmtSaldoLine } from "../useNovaTransacaoPeriodSaldo.js";

/**
 * #315 — os painéis laterais da Nova transação escreviam "R$" chapado. O que é do
 * LANÇAMENTO (compra estornada) sai na moeda dele; o que é da ORGANIZAÇÃO
 * (orçamento, ritmo, resultado do mês) sai na moeda que a API declara — a base.
 */
afterEach(cleanup);
const text = () => document.body.textContent ?? "";

describe("formatadores do impacto e do resultado do mês", () => {
  it("BRL byte a byte como antes, inclusive o sinal da margem estourada", () => {
    expect(fmtImpactMoney(1234.5, "BRL")).toBe("R$ 1.234,50");
    expect(fmtImpactMoney(-12, "BRL")).toBe("R$ -12,00");
    expect(fmtSaldoLine(-201.34, "BRL")).toBe("−R$ 201,34");
  });
  it("USD escreve US$; moeda desconhecida é travessão", () => {
    expect(fmtImpactMoney(10, "USD")).toBe("US$ 10,00");
    expect(fmtSaldoLine(10, "USD")).toBe("US$ 10,00");
    expect(fmtImpactMoney(10, null)).toBe("—");
    expect(fmtSaldoLine(10, null)).toBe("—");
  });
});

describe("RefundLinkPanel — moeda da compra", () => {
  const base = {
    refundPickerOpen: true, refundPickerQuery: "", refundPickerLoading: false,
    onOpenPicker: vi.fn(), onCloseAndReset: vi.fn(), onQueryChange: vi.fn(), onLink: vi.fn(), onUnlink: vi.fn(),
  };
  it("candidata em € sai em €, a sem moeda cai na do estorno (US$)", () => {
    render(
      <RefundLinkPanel {...base} refundLinkedTx={null} currency="USD"
        refundPickerCandidates={[
          { id: 1, desc: "Hotel", date: "01/11", val: -80, currency: "EUR" },
          { id: 2, desc: "Loja", date: "02/11", val: -15, currency: null },
        ]} />,
    );
    expect(text()).toContain("€ 80,00");
    expect(text()).toContain("US$ 15,00");
    expect(text()).not.toMatch(/R\$/);
  });
  it("compra vinculada na moeda dela", () => {
    render(<RefundLinkPanel {...base} refundPickerOpen={false} currency="BRL"
      refundLinkedTx={{ id: 1, desc: "Hotel", dateLabel: "01/11", val: 80, currency: "USD" }} refundPickerCandidates={[]} />);
    expect(text()).toContain("US$ 80,00");
  });
});

describe("NovaTransacaoImpactPanel — moeda que a API declara (base)", () => {
  const panel = (currency, preview = null) => (
    <NovaTransacaoImpactPanel
      impactLive
      valorNum={10}
      modalCategoryChoices={[]}
      cat="Alimentação"
      financialImpact={{ currency, preview, chartData: [], refLineDay: null, showProjLine: false, previewLoading: false, previewError: "", spendingLoading: false, spendingError: "" }}
      impactKpis={{ afterVal: "x", afterSub: "", projVal: "", projSub: "", projExplain: "", marginVal: "", marginSub: "",
        displayCat: "Alimentação", catIconKey: null, catBefore: 90, catAfter: 100, catLimit: 500, catPct: 20, catHasBudget: true, catOverBudget: false }}
    />
  );
  it("gasto da categoria e limite em US$", () => {
    render(panel("USD"));
    expect(text()).toContain("US$ 90,00");
    expect(text()).toContain("limite US$ 500,00");
    expect(text()).not.toMatch(/R\$/);
  });
  it("BRL como antes", () => {
    render(panel("BRL"));
    expect(text()).toContain("R$ 90,00");
  });
  it("rascunho em US$ num orçamento em R$: explica que ele não entra no consumo (fincla-api#503)", () => {
    render(panel("BRL", { draft_currency: "USD" }));
    expect(screen.getByTestId("impact-draft-other-currency").textContent).toContain(
      "Este lançamento é em US$: ele não entra no orçamento em R$",
    );
  });
  it("rascunho na moeda do orçamento: nenhuma nota", () => {
    render(panel("BRL", { draft_currency: "BRL" }));
    expect(screen.queryByTestId("impact-draft-other-currency")).toBeNull();
  });
  it("resposta sem a moeda do rascunho (forma antiga): nenhuma nota inventada", () => {
    render(panel("BRL", {}));
    expect(screen.queryByTestId("impact-draft-other-currency")).toBeNull();
  });
});
