/** @vitest-environment jsdom */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const exportMock = vi.fn();
vi.mock("../../../../api/transactions", () => ({ exportTransactions: (...args) => exportMock(...args) }));
const saveBlobMock = vi.fn();
vi.mock("../saveBlob.js", () => ({ saveBlob: (...args) => saveBlobMock(...args) }));

import { setCurrencyRegistry } from "../../../money/currencyRegistry.js";
import { ExportPanel, buildCsvPreview, buildPdfPreview, buildXlsxPreview } from "../ExportPanel.jsx";
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
    expect(panel).toHaveTextContent("3 lançamentos · 1 pendente (incluído nos totais)");
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
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar PDF" }));

    await waitFor(() => expect(saveBlobMock).toHaveBeenCalledWith(expect.any(Blob), "transacoes-2026-11-15.csv"));
    expect(exportMock).toHaveBeenCalledWith({
      ...FILTER_PARAMS,
      format: "pdf",
      content: "full",
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
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(saveBlobMock).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^transacoes-\d{4}-\d{2}-\d{2}\.pdf$/)));
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
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar PDF" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent(message);
    expect(onClose).not.toHaveBeenCalled();
    expect(saveBlobMock).not.toHaveBeenCalled();
    expect(within(panel).getByRole("button", { name: "Exportar PDF" })).toBeEnabled();
  });

  it("acima de 20 mil lançamentos avisa antes e não pede o arquivo, em qualquer formato", async () => {
    const { panel } = renderPanel({ count: 20001 });
    expect(within(panel).getByRole("alert")).toHaveTextContent("O recorte tem 20.001 lançamentos e o limite por arquivo é 20.000.");
    for (const label of ["PDF", "XLSX", "CSV"]) {
      await userEvent.click(within(panel).getByRole("button", { name: label }));
      expect(within(panel).getByRole("button", { name: `Exportar ${label}` })).toBeDisabled();
    }
    expect(exportMock).not.toHaveBeenCalled();
  });

  it("os três formatos na ordem PDF, XLSX, CSV, cada um com a frase de uso; o PDF vem selecionado", async () => {
    const { panel } = renderPanel();
    const group = within(panel).getByRole("group", { name: "Formato do arquivo" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["PDF", "XLSX", "CSV"]);
    expect(within(group).getByRole("button", { name: "PDF" })).toHaveAttribute("aria-pressed", "true");
    expect(panel).toHaveTextContent("Para ler e enviar.");
    expect(within(panel).getByRole("button", { name: "Exportar PDF" })).toBeInTheDocument();
    await userEvent.click(within(group).getByRole("button", { name: "CSV" }));
    expect(panel).toHaveTextContent("Texto simples, para outros sistemas.");
  });

  it("Completo/Só o resumo só aparece no PDF, Completo é o padrão e o pedido leva a escolha", async () => {
    const { panel } = renderPanel();
    const content = within(panel).getByRole("radiogroup", { name: "Conteúdo do PDF" });
    expect(within(content).getByRole("radio", { name: /Completo/ })).toBeChecked();
    await userEvent.click(within(content).getByRole("radio", { name: /Só o resumo/ }));
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledWith(expect.objectContaining({ format: "pdf", content: "summary" })));

    for (const label of ["XLSX", "CSV"]) {
      await userEvent.click(within(panel).getByRole("button", { name: label }));
      expect(within(panel).queryByRole("radiogroup", { name: "Conteúdo do PDF" })).toBeNull();
    }
  });

  it("CSV escolhido depois de 'Só o resumo': o pedido não leva `content` (só o PDF tem conteúdo)", async () => {
    const { panel } = renderPanel();
    await userEvent.click(within(panel).getByRole("radio", { name: /Só o resumo/ }));
    await userEvent.click(within(panel).getByRole("button", { name: "CSV" }));
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar CSV" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledTimes(1));
    const [params] = exportMock.mock.calls[0];
    expect(params.format).toBe("csv");
    expect(params).not.toHaveProperty("content");
  });

  it("a prévia do PDF acompanha o conteúdo: Completo traz a lista e o rodapé; Só o resumo, a nota", async () => {
    const { panel } = renderPanel();
    const preview = () => within(panel).getByTestId("export-preview");
    expect(preview()).toHaveTextContent("Prévia do arquivo (PDF)");
    const pdf = () => within(preview()).getByTestId("export-preview-pdf");
    expect(pdf()).toHaveTextContent("Resultado do recorte");
    expect(pdf()).toHaveTextContent(/\+US\$\s769,60/);
    expect(pdf()).toHaveTextContent("Totais do recorte");
    expect(pdf()).toHaveTextContent("… 3 lançamentos, um por linha …");
    expect(pdf()).not.toHaveTextContent("Versão resumida");

    await userEvent.click(within(panel).getByRole("radio", { name: /Só o resumo/ }));
    expect(pdf()).toHaveTextContent("Versão resumida: a lista dos 3 lançamentos não está neste arquivo.");
    expect(pdf()).not.toHaveTextContent("Totais do recorte");
    expect(pdf()).not.toHaveTextContent("um por linha");

    await userEvent.click(within(panel).getByRole("button", { name: "XLSX" }));
    expect(preview()).toHaveTextContent("Prévia do arquivo (XLSX)");
    expect(within(preview()).queryByTestId("export-preview-pdf")).toBeNull();
  });

  it("trocar para XLSX diz para que serve, mostra a planilha na prévia e pede format=xlsx (sem conteúdo de PDF)", async () => {
    exportMock.mockResolvedValue({ blob: new Blob(["x"]), fileName: "transacoes-2026-11-15.xlsx" });
    const { panel } = renderPanel({ formats: undefined });
    await userEvent.click(within(panel).getByRole("button", { name: "XLSX" }));

    expect(within(panel).getByRole("button", { name: "XLSX" })).toHaveAttribute("aria-pressed", "true");
    expect(panel).toHaveTextContent("Planilha do Excel, para editar e fazer contas.");
    expect(within(panel).queryByRole("radiogroup", { name: "Conteúdo do PDF" })).toBeNull();
    const preview = within(panel).getByTestId("export-preview");
    expect(preview).toHaveTextContent("Prévia do arquivo (XLSX)");
    expect(within(preview).getByTestId("export-preview-sheet")).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "Exportar XLSX" }));
    await waitFor(() => expect(saveBlobMock).toHaveBeenCalledWith(expect.any(Blob), "transacoes-2026-11-15.xlsx"));
    expect(exportMock).toHaveBeenCalledTimes(1);
    const [params] = exportMock.mock.calls[0];
    expect(params).toEqual({
      ...FILTER_PARAMS,
      format: "xlsx",
      title: "Transações",
      filters_text: ["Período: Este mês", "Busca: padaria"],
      file_prefix: "transacoes",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: "pt-BR",
    });
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
    await userEvent.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(exportMock).toHaveBeenCalledWith(expect.objectContaining({ ids: [7, 9], filters_text: [] })));
    // Os filtros do recorte são ignorados pelo servidor na seleção e só ocupariam a URL (limite de 16 KiB, G3-2-07).
    const asked = exportMock.mock.calls[0][0];
    expect(asked.organization_id).toBe("org-1");
    for (const key of ["description", "account_id", "settled"]) expect(asked, key).not.toHaveProperty(key);
  });

  it("sem totais (resumo carregando ou falhou) o botão Exportar fica parado (G3-2-03)", async () => {
    const { panel } = renderPanel({ summary: null });
    expect(within(panel).getByText("Os totais ainda estão carregando.")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
    cleanup();
    const failed = renderPanel({ summary: null, summaryError: "o servidor não respondeu." }).panel;
    expect(within(failed).getByRole("alert")).toHaveTextContent("Não foi possível calcular os totais: o servidor não respondeu.");
    expect(within(failed).getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
    await userEvent.click(within(failed).getByRole("button", { name: "Exportar PDF" }));
    expect(exportMock).not.toHaveBeenCalled();
  });

  it("sem contagem da tela, enquanto o resumo carrega diz 'contando…', nunca 0 lançamentos (G3-2-04)", () => {
    const { panel } = renderPanel({ count: undefined, summary: null });
    const step = within(panel).getByRole("region", { name: "Lançamentos exportados" });
    expect(step).toHaveTextContent("Sai o recorte inteiro: contando…");
    expect(step).not.toHaveTextContent(/\b0 lançamentos/);
    cleanup();
    const failed = renderPanel({ count: undefined, summary: null, summaryError: "falhou." }).panel;
    const failedStep = within(failed).getByRole("region", { name: "Lançamentos exportados" });
    expect(failedStep).toHaveTextContent("contagem indisponível");
    expect(failedStep).not.toHaveTextContent(/\b0 lançamentos/);
    cleanup();
    // Quando o resumo chega, a contagem é a dele.
    const loaded = renderPanel({ count: undefined }).panel;
    expect(within(loaded).getByRole("region", { name: "Lançamentos exportados" })).toHaveTextContent("Sai o recorte inteiro: 3 lançamentos");
  });
});

const ONE_ENTRY = {
  ...ONE_CURRENCY, total_transactions: 1, unsettled_count: 1,
  result_by_currency: [{ ...ONE_CURRENCY.result_by_currency[0], total_transactions: 1 }],
};

describe("<ExportPanel> — singular e plural (QA BUG-03)", () => {
  it("com 1 lançamento e 1 pendente: passo 1, passo 3 e prévia no singular", async () => {
    const { panel } = renderPanel({ count: 1, summary: ONE_ENTRY });
    expect(within(panel).getByTestId("export-preview")).toHaveTextContent("1 lançamento · 1 pendente, incluído nos totais");
    await userEvent.click(within(panel).getByRole("button", { name: "CSV" }));
    expect(within(panel).getByRole("region", { name: "Lançamentos exportados" }))
      .toHaveTextContent("Sai o recorte inteiro: 1 lançamento, não só o que está carregado na tela.");
    expect(panel).toHaveTextContent("1 lançamento · 1 pendente (incluído nos totais)");
    const preview = within(panel).getByTestId("export-preview").textContent;
    expect(preview).toContain('"LANÇAMENTOS: 1 (1 pendente, incluído nos totais)"');
    expect(preview).toContain("… 1 lançamento, um por linha …");
    expect(panel).not.toHaveTextContent(/1 lançamentos|1 pendentes/);
  });

  it("com 2 lançamentos e 0 pendentes, plural", async () => {
    const { panel } = renderPanel({ count: 2, summary: { ...ONE_ENTRY, total_transactions: 2, unsettled_count: 0 } });
    await userEvent.click(within(panel).getByRole("button", { name: "CSV" }));
    expect(panel).toHaveTextContent("2 lançamentos · 0 pendentes (incluídos nos totais)");
    expect(within(panel).getByTestId("export-preview")).toHaveTextContent("LANÇAMENTOS: 2 (0 pendentes, incluídos nos totais)");
  });

  it("seleção de 1 lançamento no singular, no painel e na prévia", async () => {
    const { panel } = renderPanel({ selection: { ids: [7], count: 1, summary: ONE_ENTRY } });
    await userEvent.click(within(panel).getByRole("button", { name: "CSV" }));
    expect(panel).toHaveTextContent("1 lançamento selecionado. Saem só os que você marcou.");
    expect(within(panel).getByTestId("export-preview")).toHaveTextContent('"1 lançamento selecionado"');
  });
});

describe("<ExportPanel> — prévia lateral só com espaço (QA BUG-02)", () => {
  const stubViewport = (width) => {
    window.matchMedia = vi.fn((query) => {
      const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1]);
      return {
        matches: Number.isFinite(max) ? width <= max : false,
        media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      };
    });
  };
  const original = window.matchMedia;
  afterEach(() => { window.matchMedia = original; });

  it.each([390, 699])("com %i px a prévia não aparece e os passos ocupam a largura", (width) => {
    stubViewport(width);
    const { panel } = renderPanel();
    expect(within(panel).queryByTestId("export-preview")).toBeNull();
    expect(within(panel).getByRole("region", { name: "Totais do relatório" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Exportar PDF" })).toBeEnabled();
  });

  it.each([700, 1440])("com %i px a prévia continua ao lado dos passos", (width) => {
    stubViewport(width);
    const { panel } = renderPanel();
    expect(within(panel).getByTestId("export-preview")).toHaveTextContent("Prévia do arquivo (PDF)");
  });
});

describe("<ExportPanel> — modo celular: tela cheia e prévia em tela cheia (#527)", () => {
  const stubViewport = (width) => {
    window.matchMedia = vi.fn((query) => {
      const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1]);
      return {
        matches: Number.isFinite(max) ? width <= max : false,
        media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      };
    });
  };
  const original = window.matchMedia;
  afterEach(() => { window.matchMedia = original; });

  const steps = (panel) => ["Lançamentos exportados", "Formato do arquivo", "Totais do relatório"]
    .map((name) => within(panel).queryByRole("region", { name }));

  it.each([390, 699])("com %i px o painel ocupa a tela inteira, só com os três passos e o link da prévia", (width) => {
    stubViewport(width);
    const { panel } = renderPanel();
    expect(panel).toHaveAttribute("data-full-screen", "true");
    expect(panel.style.width).toBe("100%");
    expect(panel.style.height).toBe("100%");
    // Sem `vh` (o app-shell não usa): a altura vem do contêiner fixo.
    expect(panel.getAttribute("style")).not.toMatch(/vh/);
    // A área segura do aparelho fica fora do cabeçalho e do rodapé.
    expect(screen.getByTestId("export-panel-header").style.paddingTop).toContain("safe-area-inset-top");
    expect(screen.getByTestId("export-panel-footer").style.paddingBottom).toContain("safe-area-inset-bottom");
    expect(steps(panel).every(Boolean)).toBe(true);
    expect(within(panel).queryByTestId("export-preview")).toBeNull();
    expect(within(panel).getByRole("button", { name: "Ver prévia do arquivo" })).toBeInTheDocument();
  });

  it.each([700, 1440])("com %i px nada muda: drawer lateral com a prévia ao lado e sem o link", (width) => {
    stubViewport(width);
    const { panel } = renderPanel();
    expect(panel).not.toHaveAttribute("data-full-screen", "true");
    // jsdom descarta `min(100%, 820px)` no CSSOM; basta provar que não virou a tela inteira.
    expect(panel.style.width).not.toBe("100%");
    expect(screen.getByTestId("export-panel-header").style.paddingTop).not.toContain("safe-area");
    expect(within(panel).getByTestId("export-preview")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Ver prévia do arquivo" })).toBeNull();
  });

  it("o link abre a prévia em tela cheia; voltar devolve o painel com formato e conteúdo mantidos", async () => {
    stubViewport(390);
    const user = userEvent.setup();
    const { panel, onClose } = renderPanel();
    await user.click(within(panel).getByRole("radio", { name: /Só o resumo/ }));
    await user.click(within(panel).getByRole("button", { name: "Ver prévia do arquivo" }));

    const preview = within(panel).getByTestId("export-preview");
    expect(preview).toHaveTextContent("Prévia do arquivo (PDF)");
    // A prévia é do conteúdo escolhido: "Só o resumo" (sem a lista).
    expect(within(preview).getByTestId("export-preview-pdf")).toHaveTextContent("Versão resumida");
    expect(within(preview).queryByText("Lançamentos")).toBeNull();
    // Em tela cheia a prévia substitui os passos (não fica espremida ao lado).
    expect(steps(panel).some(Boolean)).toBe(false);
    expect(panel).toHaveAttribute("data-full-screen", "true");
    expect(panel.contains(document.activeElement)).toBe(true);

    await user.click(within(panel).getAllByRole("button", { name: "Voltar ao painel" })[0]);
    expect(onClose).not.toHaveBeenCalled();
    expect(steps(panel).every(Boolean)).toBe(true);
    expect(within(panel).queryByTestId("export-preview")).toBeNull();
    expect(within(panel).getByRole("button", { name: "PDF" })).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByRole("radio", { name: /Só o resumo/ })).toBeChecked();
    // O foco volta para o link que abriu a prévia.
    expect(within(panel).getByRole("button", { name: "Ver prévia do arquivo" })).toHaveFocus();
  });

  it("Esc na prévia volta ao painel (com o formato mantido); Esc no painel fecha", async () => {
    stubViewport(699);
    const user = userEvent.setup();
    const { panel, onClose } = renderPanel();
    await user.click(within(panel).getByRole("button", { name: "XLSX" }));
    await user.click(within(panel).getByRole("button", { name: "Ver prévia do arquivo" }));
    expect(within(panel).getByTestId("export-preview-sheet")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(within(panel).queryByTestId("export-preview")).toBeNull();
    expect(within(panel).getByRole("button", { name: "XLSX" })).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("o ✕ da prévia volta ao painel, não fecha a exportação", async () => {
    stubViewport(390);
    const user = userEvent.setup();
    const { panel, onClose } = renderPanel();
    await user.click(within(panel).getByRole("button", { name: "CSV" }));
    await user.click(within(panel).getByRole("button", { name: "Ver prévia do arquivo" }));
    expect(within(panel).queryByRole("button", { name: "Fechar" })).toBeNull();
    const back = within(panel).getAllByRole("button", { name: "Voltar ao painel" });
    expect(back.length).toBeGreaterThanOrEqual(1);
    await user.click(back[back.length - 1]);
    expect(onClose).not.toHaveBeenCalled();
    expect(within(panel).getByRole("button", { name: "CSV" })).toHaveAttribute("aria-pressed", "true");
  });

  it("dá para exportar direto da prévia, com o formato e o conteúdo escolhidos", async () => {
    stubViewport(390);
    const user = userEvent.setup();
    const { panel, onClose } = renderPanel();
    await user.click(within(panel).getByRole("radio", { name: /Só o resumo/ }));
    await user.click(within(panel).getByRole("button", { name: "Ver prévia do arquivo" }));
    await user.click(within(panel).getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(exportMock).toHaveBeenCalledWith(expect.objectContaining({ format: "pdf", content: "summary" }));
  });

  it("se a tela alargar para 700 px com a prévia aberta, volta o drawer com os passos e a prévia ao lado", () => {
    let width = 390;
    const listeners = new Set();
    window.matchMedia = vi.fn((query) => {
      const max = Number(/max-width:\s*(\d+)px/.exec(query)?.[1]);
      return {
        get matches() { return width <= max; },
        media: query,
        addEventListener: (_t, fn) => listeners.add(fn),
        removeEventListener: (_t, fn) => listeners.delete(fn),
      };
    });
    const { panel } = renderPanel();
    within(panel).getByRole("button", { name: "Ver prévia do arquivo" }).click();
    width = 700;
    act(() => listeners.forEach((fn) => fn({ matches: false })));
    expect(steps(panel).every(Boolean)).toBe(true);
    expect(within(panel).getByTestId("export-preview")).toBeInTheDocument();
    expect(panel).not.toHaveAttribute("data-full-screen", "true");
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

describe("buildXlsxPreview", () => {
  const sheet = (summary, extra = {}) =>
    buildXlsxPreview({ title: "Transações", filtersText: ["Busca: x"], selection: null, totals: exportTotalsFromSummary(summary), ...extra });
  const byLabel = (preview, label) => preview.rows.filter((r) => r.cells[0] === label);

  it("uma moeda: totais em fórmula sobre as linhas da tabela, topo congelado até o cabeçalho", () => {
    const preview = sheet(ONE_CURRENCY);
    // Topo (3 linhas), branco, 6 linhas de totais, branco, cabeçalho na linha 12; lançamentos de 13 a 15.
    expect(preview.headerRow).toBe(12);
    expect(preview.rows[11].cells).toEqual(["Data", "Descrição", "Categoria", "Tipo", "Valor", "Moeda", "Situação"]);
    expect(preview.formulas).toBe(true);
    const [top, bottom] = byLabel(preview, "RESULTADO");
    expect(top.formula).toBe("=SOMA(E13:E15)");
    expect(top.cells.slice(4, 6)).toEqual(["769,60", "USD"]);
    expect(byLabel(preview, "DESPESAS")[0].formula).toBe('=SOMASE(D13:D15;"Despesa";E13:E15)');
    expect(byLabel(preview, "DESPESAS")[0].cells[4]).toBe("-250,40");
    expect(byLabel(preview, "PENDENTES (incluídos nos totais)")[0].formula).toBe('=CONT.VALORES(G13:G15)-CONT.SE(G13:G15;"Paga")');
    // Abaixo dos lançamentos, só o Resultado; depois o resumo por categoria.
    expect(preview.rows.indexOf(bottom)).toBe(13);
    expect(preview.rows.slice(14).map((r) => r.cells[0])).toEqual([undefined, "Categoria", "… uma linha por categoria e moeda …"]);
    expect(preview.rows.some((r) => r.cells.join("").includes("R$"))).toBe(false);
  });

  it("moedas misturadas: valores fixos, o aviso com os símbolos e o resultado de cada moeda", () => {
    const preview = sheet(CONVERTED);
    expect(preview.formulas).toBe(false);
    expect(preview.rows.every((r) => r.formula === null)).toBe(true);
    expect(preview.rows.map((r) => r.cells[0])).toContain(
      "Totais fixos, sem fórmula: o recorte tem lançamentos em R$, US$, e somar a coluna Valor juntaria moedas diferentes.",
    );
    expect(byLabel(preview, "RESULTADO EM USD")[0].cells.slice(4, 6)).toEqual(["-7,50", "USD"]);
    expect(byLabel(preview, "RESULTADO")[0].cells.slice(4, 6)).toEqual(["62,50", "EUR"]);
  });

  it("cotação indisponível: 'indisponível', nunca zero, e sem fórmula", () => {
    const preview = sheet(UNAVAILABLE);
    expect(byLabel(preview, "RESULTADO").map((r) => r.cells[4])).toEqual(["indisponível", "indisponível"]);
    expect(preview.formulas).toBe(false);
  });

  it("recorte vazio: totais fixos (não há linhas para a fórmula)", () => {
    const empty = { ...ONE_CURRENCY, total_transactions: 0, balance: 0, total_income: 0, total_expenses: 0, total_refunds: 0, unsettled_count: 0 };
    expect(sheet(empty).formulas).toBe(false);
  });
});

describe("buildPdfPreview", () => {
  const pdf = (summary, content = "full", extra = {}) =>
    buildPdfPreview({ title: "Transações", filtersText: ["Busca: x"], selection: null, totals: exportTotalsFromSummary(summary), content, ...extra });

  it("Completo: Resultado com sinal, barras proporcionais, a lista e as caixas de totais do resumo", () => {
    const preview = pdf(ONE_CURRENCY);
    expect(preview.result).toMatch(/^\+US\$\s769,60$/);
    expect(preview.flow.map((item) => [item.label, item.share])).toEqual([["Receitas", 1], ["Estornos", 0.02], ["Despesas", 0.2504]]);
    expect(preview.list.boxes.map((box) => box.label)).toEqual(["Resultado", "Receitas", "Despesas", "Estornos"]);
    expect(preview.list.boxes[2].text).toMatch(/^US\$\s250,40$/);
    expect(preview.summaryNote).toBeNull();
    expect(preview.scope).toEqual(["Busca: x"]);
  });

  it("Só o resumo: sem lista, com a nota no singular para 1 lançamento", () => {
    const preview = pdf(ONE_ENTRY, "summary");
    expect(preview.list).toBeNull();
    expect(preview.summaryNote).toBe("Versão resumida: o 1 lançamento do recorte não está listado neste arquivo. Exporte em “Completo” para vê-lo.");
  });

  it("cotação indisponível: 'indisponível' (nunca zero), o resultado de cada moeda e o aviso", () => {
    const preview = pdf(UNAVAILABLE);
    expect(preview.result).toBe("indisponível");
    expect(preview.flow.map((item) => item.text)).toEqual(["indisponível", "indisponível", "indisponível"]);
    expect(preview.byCurrency).toMatch(/^BRL \+R\$\s100,00 \(1\) · USD −US\$\s7,50 \(2\)$/);
    expect(preview.noteWarning).toBe(true);
    expect(preview.note).toContain("Cotação para R$ indisponível");
  });

  it("seleção troca os filtros pela contagem marcada", () => {
    expect(pdf(ONE_CURRENCY, "full", { selection: { count: 2 } }).scope).toEqual(["2 lançamentos selecionados"]);
  });
});
