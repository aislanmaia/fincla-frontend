// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TransactionsFilterBar,
  useTransactionsFilterState,
} from "../../filters/index.js";

afterEach(cleanup);

const CATEGORIES = [
  { id: "alim", label: "Alimentação", color: "#059669", icon: "🍽" },
  { id: "trans", label: "Transporte", color: "#2563EB", icon: "🚗" },
];
const CARDS = [
  { id: "nub", label: "Nubank", last4: "1177", color: "#7C3AED" },
];
const ALL_TAGS = ["trabalho", "casa"];

function Harness({ initialViews = [] } = {}) {
  const filter = useTransactionsFilterState();
  const [views, setViews] = useState(initialViews);
  const [active, setActive] = useState(null);

  return (
    <TransactionsFilterBar
      filter={filter}
      categories={CATEGORIES}
      cards={CARDS}
      allTags={ALL_TAGS}
      savedViews={{
        items: views,
        active,
        onActivate: setActive,
        onCreate: ({ name, icon, color }) => {
          const v = { id: "v" + (views.length + 1), label: name, icon, color, hint: "" };
          setViews([...views, v]);
          setActive(v.id);
        },
        onDelete: (id) => {
          setViews(views.filter((v) => v.id !== id));
          if (active === id) setActive(null);
        },
      }}
    />
  );
}

describe("<TransactionsFilterBar>", () => {
  it("renderiza Search + FacetBar; sem saved views se lista vazia", () => {
    render(<Harness />);
    expect(screen.getByLabelText(/Buscar transações/i)).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: /Filtros de transações/i })).toBeInTheDocument();
    expect(screen.getByText(/Visualizações salvas/i)).toBeInTheDocument();
  });

  it("clicar num facet card abre o painel inline correspondente", async () => {
    render(<Harness />);
    const tipoCard = screen.getByRole("button", { name: /Tipo:/i });
    expect(tipoCard).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(tipoCard);
    expect(tipoCard).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: /Filtro: tipo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Despesa" })).toBeInTheDocument();
  });

  it("apenas um painel por vez (alternar facet fecha o anterior)", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Período:/i }));
    expect(screen.getByRole("region", { name: /Filtro: periodo/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Categoria:/i }));
    expect(screen.queryByRole("region", { name: /Filtro: periodo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Filtro: categoria/i })).toBeInTheDocument();
  });

  it("Esc fecha o painel inline", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Tipo:/i }));
    expect(screen.getByRole("region", { name: /Filtro: tipo/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("region", { name: /Filtro: tipo/i })).not.toBeInTheDocument();
  });

  it("mudar facet atualiza o card com o valor formatado", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Tipo:/i }));
    await userEvent.click(within(screen.getByRole("region")).getByRole("button", { name: "Despesa" }));
    expect(screen.getByRole("button", { name: /Tipo: Despesa/i })).toBeInTheDocument();
    // botão Limpar tudo fica habilitado
    expect(screen.getByRole("button", { name: /Limpar todos os filtros/i })).toBeEnabled();
  });

  it("Limpar tudo zera filtros e fecha o painel", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Categoria:/i }));
    await userEvent.click(within(screen.getByRole("region")).getByRole("button", { name: "Alimentação" }));
    expect(screen.getByRole("button", { name: /Categoria: Alimentação/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Limpar todos os filtros/i }));
    expect(screen.getByRole("button", { name: /Categoria: Todas/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Filtro: categoria/i })).not.toBeInTheDocument();
  });

  it("criar saved view via + Nova e clicar ativa/desativa", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    await userEvent.type(screen.getByLabelText(/Nome da visualização/i), "Minha view");
    await userEvent.click(screen.getByRole("button", { name: /Salvar visualização/i }));
    const card = screen.getByRole("button", { name: "Minha view" });
    expect(card).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "false");
  });

  it("ordenação multi-nível: adicionar 2º critério vira badge contador na barra", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Ordenar transações:/i }));
    await userEvent.click(screen.getByRole("button", { name: /Adicionar Valor/i }));
    expect(
      screen.getByRole("button", { name: /Ordenar transações: Data ↓ · Valor ↓/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/2 critérios/i)).toBeInTheDocument();
  });

  it("integração checklist: criar view, abrir delete, cancelar mantém view", async () => {
    render(<Harness initialViews={[{ id: "v1", label: "Existente", icon: "bookmark", color: "#000", hint: "" }]} />);
    fireEvent.click(screen.getByRole("button", { name: /Excluir Existente/i }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Cancelar/i }));
    expect(screen.getByRole("button", { name: "Existente" })).toBeInTheDocument();
  });
});
