// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TransactionsFilterChips } from "../../filters/TransactionsFilterChips.jsx";

afterEach(cleanup);

const FACETS = [
  { key: "periodo", label: "Período", value: "Este ano", icon: "calendar", active: true },
  { key: "tipo", label: "Tipo", value: "Despesa", icon: "trending-down", active: true },
  { key: "forma", label: "Forma de pagamento", value: "Pix", icon: "wallet", active: true },
  { key: "categoria", label: "Categoria", value: "Alimentação", icon: "circle", active: true },
  { key: "valor", label: "Valor", value: "≥ R$ 100", icon: "wallet", active: true },
  { key: "situacao", label: "Situação", value: "A pagar", icon: "check", active: true },
  { key: "tag", label: "Tags", value: "—", icon: "tag", active: false },
];

function renderChips(props = {}) {
  const onOpenFacet = vi.fn();
  const onClearFacet = vi.fn();
  const onClearAll = vi.fn();
  render(
    <TransactionsFilterChips
      facets={FACETS}
      onOpenFacet={onOpenFacet}
      onClearFacet={onClearFacet}
      onClearAll={onClearAll}
      {...props}
    />,
  );
  return { onOpenFacet, onClearFacet, onClearAll };
}

describe("<TransactionsFilterChips>", () => {
  it("não renderiza nada quando não há filtro ativo", () => {
    const { container } = render(
      <TransactionsFilterChips facets={FACETS.map((f) => ({ ...f, active: false }))} />,
    );
    // Uma faixa vazia ocupando altura é o oposto do que esta tela resolve.
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra só as facets ativas", () => {
    renderChips({ maxVisible: 10 });
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    // A facet "Tags" está inativa — não pode virar chip.
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("o corpo do chip ABRE a facet e o × REMOVE só aquele filtro", async () => {
    const { onOpenFacet, onClearFacet } = renderChips({ maxVisible: 10 });

    await userEvent.click(
      screen.getByRole("button", { name: /Filtro aplicado — Tipo, Despesa/i }),
    );
    expect(onOpenFacet).toHaveBeenCalledWith("tipo");

    await userEvent.click(screen.getByRole("button", { name: "Remover filtro Tipo" }));
    expect(onClearFacet).toHaveBeenCalledWith("tipo");
    // Abrir e remover são ações distintas: uma não pode disparar a outra.
    expect(onOpenFacet).toHaveBeenCalledTimes(1);
  });

  it("o nome acessível do chip NÃO colide com o card da FacetBar", () => {
    // O card da barra se chama "Tipo: Despesa". Dois controles com o mesmo
    // nome fazendo coisas diferentes são indistinguíveis no leitor de tela.
    renderChips({ maxVisible: 10 });
    expect(screen.queryByRole("button", { name: /^Tipo: Despesa$/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Filtro aplicado — Tipo, Despesa/i }),
    ).toBeInTheDocument();
  });

  it("excedentes viram +N e o popover lista o resto", async () => {
    const { onOpenFacet } = renderChips({ maxVisible: 2 });

    // 6 ativas, 2 visíveis → 4 escondidas.
    const more = screen.getByRole("button", { name: "Mais 4 filtros" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Alimentação")).not.toBeInTheDocument();

    await userEvent.click(more);
    expect(screen.getByText("Alimentação")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /Filtro aplicado — Categoria, Alimentação/i }),
    );
    expect(onOpenFacet).toHaveBeenCalledWith("categoria");
    // Abrir a facet fecha o popover — senão ele fica sobre o painel que abriu.
    expect(screen.queryByText("Alimentação")).not.toBeInTheDocument();
  });

  it("Esc fecha o popover de excedentes", async () => {
    renderChips({ maxVisible: 2 });
    await userEvent.click(screen.getByRole("button", { name: "Mais 4 filtros" }));
    expect(screen.getByText("Alimentação")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("Alimentação")).not.toBeInTheDocument();
  });

  it("a busca ativa também vira chip, com a mesma remoção", async () => {
    const { onClearFacet } = renderChips({
      facets: [],
      searchActive: true,
      searchLabel: "uber",
      maxVisible: 10,
    });
    expect(screen.getByText('"uber"')).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remover filtro Busca" }));
    expect(onClearFacet).toHaveBeenCalledWith("busca");
  });

  it("Limpar tudo avisa o consumidor", async () => {
    const { onClearAll } = renderChips({ maxVisible: 10 });
    await userEvent.click(screen.getByRole("button", { name: "Limpar tudo" }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("os chips ficam num grupo rotulado", () => {
    renderChips({ maxVisible: 10 });
    const group = screen.getByRole("group", { name: "Filtros aplicados" });
    expect(within(group).getByText("Despesa")).toBeInTheDocument();
  });
});
