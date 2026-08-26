// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  /* `fireEvent.click`, não `userEvent`, nos testes de ROTEAMENTO: o que eles
     afirmam é "clicar no corpo chama `onFacetChange` com a faceta", e para isso
     a simulação de ponteiro não acrescenta nada. Acrescenta CUSTO — cada
     movimento passa pelo `<Tip>`, que mede o alvo e avisa os outros tooltips
     para fecharem —, e dois cliques num worker carregado estouravam os 5 s.
     Os testes de tooltip abaixo continuam no `userEvent`, porque lá o hover É
     o comportamento sob teste. */
  it("leva ao painel da faceta, e cada valor leva ao mesmo lugar", () => {
    const { onFacetChange } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Editar filtro Categoria: Transporte" }));
    expect(onFacetChange).toHaveBeenCalledWith("categoria");
    fireEvent.click(screen.getByRole("button", { name: "Editar filtro Situação: A pagar" }));
    expect(onFacetChange).toHaveBeenLastCalledWith("situacao");
  });

  it("o item de busca manda o cursor para o campo, não para um painel", () => {
    const { onFacetChange, onFocusSearch } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Editar filtro Busca: uber" }));
    expect(onFocusSearch).toHaveBeenCalledTimes(1);
    expect(onFacetChange).not.toHaveBeenCalled();
  });

  it("cada ação se anuncia no hover — o corpo abre, o ✕ remove", async () => {
    const user = userEvent.setup();
    montar();
    /* Os dois alvos ficam colados e a outra ação DESTRÓI o filtro: sem o
       tooltip, nada distingue "abrir" de "remover" antes do clique. */
    await user.hover(screen.getByRole("button", { name: "Editar filtro Categoria: Transporte" }));
    expect(await screen.findByText("Abrir Categoria")).toBeInTheDocument();

    await user.hover(screen.getByRole("button", { name: "Remover filtro Categoria: Transporte" }));
    expect(await screen.findByText("Remover Categoria")).toBeInTheDocument();
  });

  it("o corpo ocupa o cartão e o ✕ fica na borda — o Tip não pode roubar o flex", () => {
    montar();
    /* O `<span>` do Tip virou o item de flex no lugar do botão. Sem devolver
       `flex`/`alignSelf` ao invólucro, o ✕ desencostava da direita e o botão
       parava de cobrir a altura do cartão — clique na folga não fazia nada. */
    const corpo = screen.getByRole("button", { name: "Editar filtro Categoria: Transporte" });
    const involucro = corpo.parentElement;
    expect(involucro).toHaveStyle({
      flex: "1", minWidth: "0px", alignSelf: "stretch", alignItems: "stretch",
    });
  });

  it("o rótulo aparece também para quem chega pelo teclado", () => {
    montar();
    const corpo = screen.getByRole("button", { name: "Editar filtro Categoria: Transporte" });
    fireEvent.focus(corpo);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Abrir Categoria");
    fireEvent.blur(corpo);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("a busca não promete um painel que não existe", async () => {
    const user = userEvent.setup();
    montar();
    await user.hover(screen.getByRole("button", { name: "Editar filtro Busca: uber" }));
    expect(await screen.findByText("Ir para a busca")).toBeInTheDocument();
  });

  it("o ✕ segue removendo, e só ele — o corpo não remove nada", () => {
    const { onClearFacet, onFacetChange } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Remover filtro Categoria: Alimentação" }));
    expect(onClearFacet).toHaveBeenCalledWith("categoria:alim");
    expect(onFacetChange).not.toHaveBeenCalled();
  });
});
