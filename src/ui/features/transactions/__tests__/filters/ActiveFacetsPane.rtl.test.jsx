// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TransactionsFilterPanel,
  facetaDoItemAtivo,
} from "../../filters/TransactionsFilterPanel.jsx";

afterEach(cleanup);

/* O painel só lê contadores de `filter`; o pane de Ativos não toca em mais nada. */
const FILTER = {
  period: "mes", type: "todos", cats: [], tags: [], method: [], cardSel: [],
  valueMin: "", valueMax: "", rec: "any", settlement: "todas",
};

const ATIVOS = [
  { key: "busca", label: "Busca", value: "uber" },
  { key: "categoria:alim", label: "Categoria", value: "Alimentação" },
  { key: "categoria:trans", label: "Categoria", value: "Transporte" },
  { key: "situacao", label: "Situação", value: "A pagar" },
];

function montar(extra = {}) {
  const props = { onFacetChange: vi.fn(), onFocusSearch: vi.fn(), onClearFacet: vi.fn(), ...extra };
  render(
    <TransactionsFilterPanel
      filter={FILTER}
      facet="ativos"
      activeFacets={ATIVOS}
      {...props}
    />,
  );
  return props;
}

describe("facetaDoItemAtivo", () => {
  it("um valor ou vários, a faceta de destino é a mesma", () => {
    expect(facetaDoItemAtivo("categoria")).toBe("categoria");
    expect(facetaDoItemAtivo("categoria:alim")).toBe("categoria");
  });

  it("a busca não tem painel na dock", () => {
    expect(facetaDoItemAtivo("busca")).toBeNull();
  });
});

describe("<ActiveFacetsPane> — clique no corpo", () => {
  it("leva ao painel da faceta, e cada valor leva ao mesmo lugar", async () => {
    const user = userEvent.setup();
    const { onFacetChange } = montar();
    await user.click(screen.getByRole("button", { name: "Editar filtro Categoria: Transporte" }));
    expect(onFacetChange).toHaveBeenCalledWith("categoria");
    await user.click(screen.getByRole("button", { name: "Editar filtro Situação: A pagar" }));
    expect(onFacetChange).toHaveBeenLastCalledWith("situacao");
  });

  it("o item de busca manda o cursor para o campo, não para um painel", async () => {
    const user = userEvent.setup();
    const { onFacetChange, onFocusSearch } = montar();
    await user.click(screen.getByRole("button", { name: "Editar filtro Busca: uber" }));
    expect(onFocusSearch).toHaveBeenCalledTimes(1);
    expect(onFacetChange).not.toHaveBeenCalled();
  });

  it("o ✕ segue removendo, e só ele — o corpo não remove nada", async () => {
    const user = userEvent.setup();
    const { onClearFacet, onFacetChange } = montar();
    await user.click(screen.getByRole("button", { name: "Remover filtro Categoria: Alimentação" }));
    expect(onClearFacet).toHaveBeenCalledWith("categoria:alim");
    expect(onFacetChange).not.toHaveBeenCalled();
  });
});
