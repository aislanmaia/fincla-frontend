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

function Harness({ initialViews = [], filteredCount = 2 } = {}) {
  const filter = useTransactionsFilterState();
  const [views, setViews] = useState(initialViews);
  const [active, setActive] = useState(null);

  return (
    <TransactionsFilterBar
      filter={filter}
      categories={CATEGORIES}
      cards={CARDS}
      allTags={ALL_TAGS}
      filteredCount={filteredCount}
      savedViews={{
        items: views,
        active,
        onActivate: (id) => setActive((prev) => (prev === id ? null : id)),
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

describe("<TransactionsFilterBar>", { timeout: 15000 }, () => {
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

  it("mudar facet atualiza o card com o valor formatado e fecha o painel (apply & dismiss)", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Tipo:/i }));
    await userEvent.click(within(screen.getByRole("region")).getByRole("button", { name: "Despesa" }));
    expect(screen.getByRole("button", { name: /Tipo: Despesa/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Filtro: tipo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Limpar todos os filtros/i })).toBeEnabled();
  });

  it("preset de período aplica e fecha o painel inline", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Período:/i }));
    await userEvent.click(within(screen.getByRole("region")).getByRole("button", { name: "Preset: Este mês" }));
    expect(screen.getByRole("button", { name: /Período: Este mês/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Filtro: periodo/i })).not.toBeInTheDocument();
  });

  it("período personalizado exibe intervalo amigável no facet card", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Período:/i }));
    const region = screen.getByRole("region", { name: /Filtro: periodo/i });
    const fromInput = within(region).getByLabelText(/^De$/i);
    fireEvent.change(fromInput, { target: { value: "01/10/2026" } });
    fireEvent.blur(fromInput);
    const toInput = within(region).getByLabelText(/^Até$/i);
    fireEvent.change(toInput, { target: { value: "15/10/2026" } });
    fireEvent.blur(toInput);
    expect(screen.getByRole("button", { name: /Período: 1–15 out/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Personalizado/i })).not.toBeInTheDocument();
  });

  it("período personalizado aberto: só De exibe A partir de no facet", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Período:/i }));
    const region = screen.getByRole("region", { name: /Filtro: periodo/i });
    const fromInput = within(region).getByLabelText(/^De$/i);
    fireEvent.change(fromInput, { target: { value: "01/05/2026" } });
    fireEvent.blur(fromInput);
    expect(screen.getByRole("button", { name: /Período: A partir de 1 mai/i })).toBeInTheDocument();
  });

  it("CTA Ver N transações fecha painel multi-select sem reverter filtro", async () => {
    render(<Harness filteredCount={5} />);
    await userEvent.click(screen.getByRole("button", { name: /Categoria:/i }));
    await userEvent.click(within(screen.getByRole("region")).getByRole("button", { name: "Alimentação" }));
    expect(screen.getByRole("button", { name: /Categoria: Alimentação/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Ver 5 transações/i }));
    expect(screen.queryByRole("region", { name: /Filtro: categoria/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Categoria: Alimentação/i })).toBeInTheDocument();
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

  it("criar saved view via + Nova; segundo clique desaplica", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Tipo:/i }));
    await userEvent.click(within(screen.getByRole("region")).getByRole("button", { name: "Despesa" }));
    await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
    await userEvent.type(screen.getByLabelText(/Nome da visualização/i), "Minha view");
    await userEvent.click(screen.getByRole("button", { name: /Salvar como nova visualização/i }));
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

  describe("modo compact (mobile sheet)", () => {
    function CompactHarness({ hideSearch = false } = {}) {
      const filter = useTransactionsFilterState();
      const [views, setViews] = useState([]);
      const [active, setActive] = useState(null);
      return (
        <TransactionsFilterBar
          filter={filter}
          categories={CATEGORIES}
          cards={CARDS}
          allTags={ALL_TAGS}
          filteredCount={3}
          compact
          hideSearch={hideSearch}
          savedViews={{
            items: views,
            active,
            onActivate: (id) => setActive((prev) => (prev === id ? null : id)),
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

    it("compact: renderiza SearchBar quando hideSearch=false e oculta search quando hideSearch=true (mas mantém Sort)", () => {
      const { rerender } = render(<CompactHarness />);
      expect(screen.getByLabelText(/Buscar transações/i)).toBeInTheDocument();
      // Sort button presente
      expect(screen.getByRole("button", { name: /Ordenar transações:/i })).toBeInTheDocument();

      rerender(<CompactHarness hideSearch />);
      expect(screen.queryByLabelText(/Buscar transações/i)).not.toBeInTheDocument();
      // Sort button continua presente
      expect(screen.getByRole("button", { name: /Ordenar transações:/i })).toBeInTheDocument();
    });

    it("compact: preset de tipo fecha o painel inline (apply & dismiss)", async () => {
      render(<CompactHarness hideSearch />);
      await userEvent.click(screen.getByRole("button", { name: /Tipo:/i }));
      await userEvent.click(within(screen.getByRole("region")).getByRole("button", { name: "Despesa" }));
      expect(screen.queryByRole("region", { name: /Filtro: tipo/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Tipo: Despesa/i })).toBeInTheDocument();
    });

    it("compact: expandir facet renderiza o painel inline (sem absolute, no fluxo)", async () => {
      render(<CompactHarness hideSearch />);
      await userEvent.click(screen.getByRole("button", { name: /Tipo:/i }));
      const region = screen.getByRole("region", { name: /Filtro: tipo/i });
      expect(region).toBeInTheDocument();
      // Stacked vertical: o region é irmão dos cards no DOM, não absolute
      expect(region.style.position).not.toBe("absolute");
    });

    it("compact: SortMenu inline (não absolute) ao abrir dentro do sheet", async () => {
      render(<CompactHarness hideSearch />);
      await userEvent.click(screen.getByRole("button", { name: /Ordenar transações:/i }));
      const dialog = screen.getByRole("dialog", { name: /Editor de ordenação/i });
      expect(dialog.style.position).toBe("relative");
    });

    it("compact: NewViewForm popover renderiza inline (no fluxo, não absolute)", async () => {
      render(<CompactHarness hideSearch />);
      await userEvent.click(screen.getByRole("button", { name: /^Nova$/ }));
      // O dialog do formulário existe no DOM via input "Nome da visualização"
      const input = screen.getByLabelText(/Nome da visualização/i);
      expect(input).toBeInTheDocument();
      // Caminhamos até o ancestor com style.position
      let el = input.parentElement;
      let foundStatic = false;
      while (el) {
        if (el.style && el.style.position === "relative" && el.style.marginTop === "10px") {
          foundStatic = true;
          break;
        }
        el = el.parentElement;
      }
      expect(foundStatic).toBe(true);
    });
  });
});
