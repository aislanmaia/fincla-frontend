/** @vitest-environment jsdom */
/* Uma categoria tem UMA cor em toda tela (QA display-and-pagination BUG-02 + orquestrador 2026-11-17).
   Regra única: a cor da própria categoria na API (a que a pessoa edita em Configurações → Categorias), senão a
   chave estável do sistema (`system_key`), senão o mapa por rótulo.

   Cada tela entra pelo caminho de verdade, com a resposta da API crua que a alimenta:
   - Transações: `GET /v1/transactions` → `mapApiTransactionToUi` → `TxRow` (cor do chip lida no DOM);
   - Resumo do recorte do cartão: `GET /v1/tags/categories` → `mapCategoryCatalogForUi` → `categoryColorResolver`
     → `CardTransactionsSummary` (cor do ponto lida no DOM; o resumo da API só traz o nome);
   - Visão Geral (Gastos por categoria): transações + `/analytics/by-category` → `buildDashboardCategoryRows`;
   - Relatórios (composição): `/analytics/by-category` → `buildCategoryComposition`. */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { buildDashboardCategoryRows } from "../../features/dashboard/useDashboardData.js";
import { CardTransactionsSummary } from "../../features/cardTransactions/CardTransactionsSummary.jsx";
import { categoryColorResolver } from "../../features/cardTransactions/cardTransactionsModel.js";
import { TxRow } from "../../pages/TransacoesPage.jsx";
import { buildCategoryComposition } from "../reportsAdapter.js";
import { mapCategoryCatalogForUi } from "../tagsAdapter.js";
import { mapApiTransactionToUi } from "../transactionsAdapter.js";

afterEach(cleanup);

/** "#DC2626" → "rgb(220, 38, 38)", como o DOM devolve. */
function rgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/** A categoria como as respostas da API a trazem em cada tela. */
function scenario({ id, name, label, systemKey, color, isDefault }) {
  const tag = {
    id, name, label, custom_name: isDefault && label !== name ? label : null, system_key: systemKey,
    color, is_default: isDefault, is_active: true, tag_type: { name: "categoria" },
  };
  const apiTx = {
    id: `tx-${id}`, organization_id: "org-1", type: "expense", description: "Compra", value: 40, amount: 40,
    value_currency: "BRL", currency: "BRL", date: "2026-11-10", payment_method: "pix", settled: true,
    tags: { categoria: [tag] },
  };
  const catalogItem = { id, label, system_key: systemKey, icon_key: null, color, is_fallback: false, details: [] };
  const byCategory = { tag_id: id, tag_name: name, tag_label: label, tag_system_key: systemKey, tag_color: color, total: 40 };
  return { apiTx, catalogItem, byCategory };
}

/** A cor que cada tela pinta para a categoria. */
function colorsOnEveryScreen(category) {
  const { apiTx, catalogItem, byCategory } = scenario(category);

  // Transações: o chip da linha.
  const tx = mapApiTransactionToUi(apiTx);
  render(
    <TxRow tx={tx} isMobile={false} isSelected={false} onSelect={vi.fn()} coveringAnchor={null}
      dateLabel={{ top: "10 nov", sub: "ter" }} />,
  );
  const chip = screen.getAllByText(category.label).map((el) => el.style.color).find(Boolean);
  cleanup();

  // Resumo do recorte do cartão: o ponto ao lado do nome.
  const catalog = mapCategoryCatalogForUi([catalogItem]).map((row) => ({
    id: String(row.id), label: row.labelPt, apiName: row.apiName, systemKey: row.systemKey ?? null, color: row.color,
  }));
  const summary = {
    total_transactions: 1, by_currency: [{ currency: "BRL", amount: "40.00" }],
    breakdown: { by_category: [{ category: category.label, amount: "40", amount_currency: "BRL" }] },
  };
  render(<CardTransactionsSummary summary={summary} isCategorySelected={() => false} onToggleCategory={() => {}}
    colorForCategory={categoryColorResolver(catalog)} />);
  const name = within(screen.getByRole("list", { name: "Categorias em BRL" })).getByTitle(category.label);
  const cardDot = name.previousElementSibling.style.background;
  cleanup();

  // Visão Geral: linha vinda das transações e linha só da API (período sem transações carregadas).
  const [fromTx] = buildDashboardCategoryRows([apiTx], "2026-11-01", "2026-11-30", [byCategory], new Map(), "BRL", []);
  const [fromApi] = buildDashboardCategoryRows([], "2026-11-01", "2026-11-30", [byCategory], new Map(), "BRL", []);

  // Relatórios: composição.
  const [report] = buildCategoryComposition([byCategory]);

  return { chip, cardDot, dashboardFromTx: rgb(fromTx.color), dashboardFromApi: rgb(fromApi.color), report: rgb(report.color),
    names: [fromTx.name, fromApi.name, report.name] };
}

describe("uma categoria, uma cor em toda tela", () => {
  it("Saúde renomeada pela organização: a cor de Saúde (do catálogo da API) nas telas todas", () => {
    const seen = colorsOnEveryScreen({
      id: "cat-h", name: "Health", label: "Saude da Familia QA", systemKey: "health", color: "#DC2626", isDefault: true,
    });
    const red = rgb("#DC2626");
    expect(seen).toEqual({ chip: red, cardDot: red, dashboardFromTx: red, dashboardFromApi: red, report: red,
      names: ["Saude da Familia QA", "Saude da Familia QA", "Saude da Familia QA"] });
  });

  it("Saúde renomeada numa resposta sem cor própria: a chave do sistema dá a mesma cor nas telas todas", () => {
    const seen = colorsOnEveryScreen({
      id: "cat-h", name: "Health", label: "Saude da Familia QA", systemKey: "health", color: null, isDefault: true,
    });
    const red = rgb("#DC2626");
    expect([seen.chip, seen.cardDot, seen.dashboardFromTx, seen.dashboardFromApi, seen.report]).toEqual([red, red, red, red, red]);
  });

  it("categoria do sistema com a cor editada pela pessoa: a cor editada nas telas todas, não a do catálogo", () => {
    const edited = rgb("#7E22CE");
    const seen = colorsOnEveryScreen({
      id: "cat-t", name: "Transport", label: "Transporte", systemKey: "transport", color: "#7E22CE", isDefault: true,
    });
    expect([seen.chip, seen.cardDot, seen.dashboardFromTx, seen.dashboardFromApi, seen.report])
      .toEqual([edited, edited, edited, edited, edited]);
    expect(seen.chip).not.toBe(rgb("#2563EB")); // a cor de Transporte do catálogo
  });

  it("categoria criada pela organização: a cor dela nas telas todas (as Transações não caem mais no cinza)", () => {
    const own = rgb("#0F766E");
    const seen = colorsOnEveryScreen({
      id: "cat-pet", name: "Pet da Casa", label: "Pet da Casa", systemKey: null, color: "#0F766E", isDefault: false,
    });
    expect([seen.chip, seen.cardDot, seen.dashboardFromTx, seen.dashboardFromApi, seen.report])
      .toEqual([own, own, own, own, own]);
    expect(seen.chip).not.toBe(rgb("#374151")); // o cinza de antes nas Transações
  });
});
