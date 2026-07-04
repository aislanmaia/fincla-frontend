// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultantClientCategoriesTab } from "../ConsultantClientCategoriesTab.jsx";

function cat(over = {}) {
  return { tag_id: "t1", tag_name: "Alimentação", tag_icon_key: null, total: 800, percentage: 40, transaction_count: 12, tag_color: "#059669", ...over };
}

function state(over = {}) {
  return { loading: false, error: "", hasLoaded: true, categories: [cat(), cat({ tag_id: "t2", tag_name: "Transporte", total: 400, percentage: 20, transaction_count: 1 })], ...over };
}

afterEach(() => cleanup());

describe("ConsultantClientCategoriesTab", () => {
  it("lista as categorias ordenadas com % do total, valor e nº de transações", () => {
    render(<ConsultantClientCategoriesTab categories={state()} />);
    expect(screen.getByText("Gasto por categoria · este mês")).toBeInTheDocument();
    expect(screen.getByText("2 categorias ativas")).toBeInTheDocument();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
    expect(screen.getByText("40% do total")).toBeInTheDocument();
    // singular/plural de transações
    expect(screen.getByText("12 transações")).toBeInTheDocument();
    expect(screen.getByText("1 transação")).toBeInTheDocument();
  });

  it("estado de carregamento, erro e vazio", () => {
    const { rerender } = render(<ConsultantClientCategoriesTab categories={state({ loading: true, hasLoaded: false, categories: [] })} />);
    expect(screen.getByText("Carregando categorias…")).toBeInTheDocument();
    rerender(<ConsultantClientCategoriesTab categories={state({ error: "boom", categories: [] })} />);
    expect(screen.getByText("Não foi possível carregar as categorias.")).toBeInTheDocument();
    rerender(<ConsultantClientCategoriesTab categories={state({ categories: [] })} />);
    expect(screen.getByText("Nenhum gasto por categoria neste mês.")).toBeInTheDocument();
  });
});
