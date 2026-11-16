/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const exportMock = vi.fn();
vi.mock("../../../../api/transactions", () => ({ exportTransactions: (...args) => exportMock(...args) }));
const saveBlobMock = vi.fn();
vi.mock("../saveBlob.js", () => ({ saveBlob: (...args) => saveBlobMock(...args) }));

import { setCurrencyRegistry } from "../../../money/currencyRegistry.js";
import { ExportPanel, buildCsvPreview } from "../ExportPanel.jsx";
import { exportTotalsFromSummary } from "../exportTotals.js";

/**
 * O painel de exportação compartilhado (fincla-api#520/#521). A camada de API é simulada; o painel é real.
 * Os totais vêm do resumo que a tela entrega; o painel não soma nada, e ausência nunca vira zero.
 */

const ONE_CURRENCY = {
  total_transactions: 3, total_income: 1000, total_expenses: 250.4, total_refunds: 20, balance: 769.6,
  currency: "USD", unsettled_count: 1,
  consolidation: { target_currency: "USD", rates: [], unavailable: null },
  result_by_currency: [{ currency: "USD", total_transactions: 3, total_income: 1000, total_expenses: 250.4, total_refunds: 20, balance: 769.6 }],
};
const UNAVAILABLE = {
  total_transactions: 3, total_income: null, total_expenses: null, total_refunds: null, balance: null,
  currency: null, unsettled_count: 1,
  consolidation: { target_currency: "BRL", rates: [], unavailable: "USD" },
  result_by_currency: [
    { currency: "BRL", total_transactions: 1, total_income: 100, total_expenses: 0, total_refunds: 0, balance: 100 },
    { currency: "USD", total_transactions: 2, total_income: 0, total_expenses: 10, total_refunds: 2.5, balance: -7.5 },
  ],
};
const CONVERTED = {
  ...UNAVAILABLE,
  total_income: 100, total_expenses: 50, total_refunds: 12.5, balance: 62.5, currency: "EUR",
  consolidation: {
    target_currency: "EUR",
    rates: [{ base: "USD", quote: "EUR", rate: "0.912345", quoted_on: "2026-11-14" }, { base: "BRL", quote: "EUR", rate: "0.15", quoted_on: "2026-11-14" }],
    unavailable: null,
  },
};
const FILTER_PARAMS = { organization_id: "org-1", description: "padaria", account_id: ["acc-1"], settled: false };

beforeEach(() => {
  setCurrencyRegistry([
    { code: "BRL", name: "Real", symbol: "R$", decimal_places: 2, is_active: true },
    { code: "USD", name: "Dólar", symbol: "US$", decimal_places: 2, is_active: true },
    { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2, is_active: true },
  ]);
  exportMock.mockResolvedValue({ blob: new Blob(["x"]), fileName: "transacoes-2026-11-15.csv" });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPanel = (props = {}) => {
  const onClose = vi.fn();
  render(
    <ExportPanel
      title="Transações"
      filePrefix="transacoes"
      filtersText={["Período: Este mês", "Busca: padaria"]}
      filterParams={FILTER_PARAMS}
      count={3}
      summary={ONE_CURRENCY}
      onClose={onClose}
      {...props}
    />,
  );
  return { onClose, panel: screen.getByRole("dialog", { name: props.selection ? "Exportar seleção" : "Exportar" }) };
};

describe("<ExportPanel>", () => {
  it("passo 1: a contagem do recorte inteiro e os filtros ativos, sem filtros próprios", () => {
    const { panel } = renderPanel({ count: 1234 });
    const step = within(panel).getByRole("region", { name: "Lançamentos exportados" });
    expect(step).toHaveTextContent("Sai o recorte inteiro: 1.234 lançamentos, não só o que está carregado na tela.");
    expect(within(step).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Período: Este mês", "Busca: padaria"]);
    expect(step).toHaveTextContent("Para mudar o recorte, feche o painel e ajuste os filtros da tela.");
    expect(within(panel).queryByRole("textbox")).toBeNull();
    expect(within(panel).queryByRole("combobox")).toBeNull();
  });

  it("passo 3: os totais do resumo na moeda do recorte, com os pendentes incluídos", () => {
    const { panel } = renderPanel();
    const totals = within(panel).getByTestId("export-totals");
    expect(totals).toHaveTextContent(/Resultado\+US\$\s769,60/);
    expect(totals).toHaveTextContent(/Receitas\s*US\$\s1\.000,00/);
    expect(totals).toHaveTextContent(/Despesas\s*US\$\s250,40/);
    expect(totals).toHaveTextContent(/Estornos\s*US\$\s20,00/);
    expect(panel).toHaveTextContent("3 lançamentos · 1 pendentes (incluídos nos totais)");
    expect(panel).not.toHaveTextContent("R$");
    expect(panel).not.toHaveTextContent("Por moeda");
  });

  it("cotação indisponível: 'indisponível' (nunca zero), o resultado de cada moeda e o aviso", () => {
    const { panel } = renderPanel({ summary: UNAVAILABLE });
    const totals = within(panel).getByTestId("export-totals");
    expect(totals.textContent.match(/indisponível/g)).toHaveLength(4);
    expect(totals).not.toHaveTextContent("0,00");
    expect(panel).toHaveTextContent(/Por moeda: BRL \+R\$\s100,00 \(1\) · USD −US\$\s7,50 \(2\)/);
    expect(panel).toHaveTextContent("Cotação para R$ indisponível no momento");
  });

  it("moedas misturadas convertidas: totais na base, cotações com 4 casas e a data", () => {
    const { panel } = renderPanel({ summary: CONVERTED });
    expect(within(panel).getByTestId("export-totals")).toHaveTextContent(/Resultado\+€\s62,50/);
    expect(panel).toHaveTextContent(
      "Totais em €, moeda base da organização. Cotações de 14/11/2026: 1 US$ = € 0,9123 · 1 R$ = € 0,1500. Cada lançamento aparece na moeda da sua conta.",
    );
  });

  it("exporta com os filtros da tela, o título, o prefixo, os filtros em texto e o fuso; salva com o nome do servidor", async () => {
    const { panel, onClose } = renderPanel();
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar CSV" }));

    await waitFor(() => expect(saveBlobMock).toHaveBeenCalledWith(expect.any(Blob), "transacoes-2026-11-15.csv"));
    expect(exportMock).toHaveBeenCalledWith({
      ...FILTER_PARAMS,
      format: "csv",
      title: "Transações",
      filters_text: ["Período: Este mês", "Busca: padaria"],
      file_prefix: "transacoes",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: "pt-BR",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("sem nome no Content-Disposition, o arquivo leva o prefixo, o dia local e a extensão", async () => {
    exportMock.mockResolvedValue({ blob: new Blob(["x"]), fileName: null });
    const { panel } = renderPanel();
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(saveBlobMock).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^transacoes-\d{4}-\d{2}-\d{2}\.csv$/)));
  });

  it.each([
    [{ response: { status: 422, data: { detail: { code: "export_too_large", total: 25000, limit: 20000 } } } },
      "O recorte tem 25.000 lançamentos e o limite por arquivo é 20.000. Estreite os filtros e exporte de novo."],
    [{ response: { status: 409, data: { detail: { code: "export_changed" } } } },
      "O extrato mudou enquanto o arquivo era preparado. Exporte de novo."],
    [new Error("Network Error"), "Não foi possível preparar a exportação. Tente novamente."],
  ])("uma falha aparece no painel, que continua aberto: %#", async (error, message) => {
    exportMock.mockRejectedValue(error);
    const { panel, onClose } = renderPanel();
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar CSV" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent(message);
    expect(onClose).not.toHaveBeenCalled();
    expect(saveBlobMock).not.toHaveBeenCalled();
    expect(within(panel).getByRole("button", { name: "Exportar CSV" })).toBeEnabled();
  });

  it("acima de 20 mil lançamentos avisa antes e não pede o arquivo, em qualquer formato", async () => {
    const { panel } = renderPanel({ count: 20001, formats: ["pdf", "xlsx", "csv"] });
    expect(within(panel).getByRole("alert")).toHaveTextContent("O recorte tem 20.001 lançamentos e o limite por arquivo é 20.000.");
    for (const label of ["PDF", "XLSX", "CSV"]) {
      await userEvent.click(within(panel).getByRole("button", { name: label }));
      expect(within(panel).getByRole("button", { name: `Exportar ${label}` })).toBeDisabled();
    }
    expect(exportMock).not.toHaveBeenCalled();
  });

  it("com PDF disponível ele vem selecionado, e Completo/Só o resumo só aparece no PDF", async () => {
    const { panel } = renderPanel({ formats: ["pdf", "xlsx", "csv"] });
    expect(within(panel).getByRole("button", { name: "PDF" })).toHaveAttribute("aria-pressed", "true");
    const content = within(panel).getByRole("radiogroup", { name: "Conteúdo do PDF" });
    await userEvent.click(within(content).getByRole("radio", { name: /Só o resumo/ }));
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledWith(expect.objectContaining({ format: "pdf", content: "summary" })));

    await userEvent.click(within(panel).getByRole("button", { name: "CSV" }));
    expect(within(panel).queryByRole("radiogroup", { name: "Conteúdo do PDF" })).toBeNull();
  });

  it("nesta entrega só o CSV é oferecido", () => {
    const { panel } = renderPanel({ formats: undefined });
    const group = within(panel).getByRole("group", { name: "Formato do arquivo" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["CSV"]);
  });

  it("Esc, ✕ e Cancelar fecham", async () => {
    const { onClose, panel } = renderPanel();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(panel).getByRole("button", { name: "Fechar" }));
    await userEvent.click(within(panel).getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("o foco fica preso no painel", async () => {
    const { panel } = renderPanel();
    const focusable = within(panel).getAllByRole("button");
    focusable.at(-1).focus();
    await userEvent.tab();
    expect(panel.contains(document.activeElement)).toBe(true);
  });

  it("a seleção (#524) troca o recorte pelos marcados e manda os ids", async () => {
    const { panel } = renderPanel({ selection: { ids: [7, 9], count: 2, summary: ONE_CURRENCY } });
    expect(panel).toHaveTextContent("2 lançamentos selecionados");
    expect(within(panel).queryByRole("list", { name: "Filtros ativos" })).toBeNull();
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledWith(expect.objectContaining({ ids: [7, 9], filters_text: [] })));
  });
});

describe("buildCsvPreview", () => {
  it("segue o arquivo: cabeçalho, bloco de totais, tabela e só o RESULTADO embaixo", () => {
    const preview = buildCsvPreview({
      title: "Transações", filtersText: ["Busca: x"], selection: null, totals: exportTotalsFromSummary(UNAVAILABLE),
    }).split("\n");
    expect(preview[0]).toBe('"","Transações","","","","",""');
    expect(preview).toContain('"","RESULTADO","","","indisponível","BRL",""');
    expect(preview).toContain('"","RESULTADO EM USD","","","-7.50","USD",""');
    expect(preview.at(-1)).toBe('"","RESULTADO","","","indisponível","BRL",""');
    expect(preview.at(-2)).toBe("");
  });
});
