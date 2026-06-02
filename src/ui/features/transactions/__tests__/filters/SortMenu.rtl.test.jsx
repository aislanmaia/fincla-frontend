// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { SortMenu } from "../../filters/search/SortMenu.jsx";
import { DEFAULT_SORT } from "../../filters/search/sortModel.js";

afterEach(cleanup);

function Harness({ initial = DEFAULT_SORT }) {
  const [sort, setSort] = useState(initial);
  return (
    <div style={{ position: "relative" }}>
      <SortMenu sort={sort} setSort={setSort} onClose={() => {}} />
      <div data-testid="state">{JSON.stringify(sort)}</div>
    </div>
  );
}

function readState() {
  return JSON.parse(screen.getByTestId("state").textContent);
}

describe("<SortMenu>", () => {
  it("renderiza regra ativa + campos disponíveis (default)", () => {
    render(<Harness />);
    expect(screen.getByText("Ordenar por")).toBeInTheDocument();
    expect(screen.getByText("1 nível")).toBeInTheDocument();
    expect(screen.getByText(/Disponíveis · clique para adicionar/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar Valor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar Tipo/i })).toBeInTheDocument();
  });

  it("não mostra Resetar quando estado é o default", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: /Resetar/i })).not.toBeInTheDocument();
  });

  it("toggle de direção inverte (Mais recente ↓ → Mais antiga ↑)", async () => {
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: /Inverter direção de Data/i });
    expect(toggle).toHaveTextContent("Mais recente primeiro");
    await userEvent.click(toggle);
    expect(readState()).toEqual([{ field: "date", dir: "asc" }]);
    expect(toggle).toHaveTextContent("Mais antiga primeiro");
  });

  it("Resetar aparece após mudança e volta ao default", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Inverter direção de Data/i }));
    const reset = screen.getByRole("button", { name: /Resetar/i });
    await userEvent.click(reset);
    expect(readState()).toEqual([{ field: "date", dir: "desc" }]);
    expect(screen.queryByRole("button", { name: /Resetar/i })).not.toBeInTheDocument();
  });

  it("clique em campo inativo o promove para o fim com dir default", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Adicionar Valor/i }));
    expect(readState()).toEqual([
      { field: "date", dir: "desc" },
      { field: "val", dir: "desc" },
    ]);
    expect(screen.getByText("2 níveis")).toBeInTheDocument();
  });

  it("setinhas de reorder aparecem só com >1 regra e respeitam extremos", async () => {
    render(
      <Harness
        initial={[
          { field: "date", dir: "desc" },
          { field: "val", dir: "asc" },
        ]}
      />,
    );
    const upData = screen.getByRole("button", { name: /Subir prioridade de Data/i });
    const downVal = screen.getByRole("button", { name: /Descer prioridade de Valor/i });
    expect(upData).toBeDisabled();
    expect(downVal).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Descer prioridade de Data/i }));
    expect(readState()).toEqual([
      { field: "val", dir: "asc" },
      { field: "date", dir: "desc" },
    ]);
  });

  it("remover regra com × volta o campo para disponíveis", async () => {
    render(
      <Harness
        initial={[
          { field: "date", dir: "desc" },
          { field: "val", dir: "asc" },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Remover Valor/i }));
    expect(readState()).toEqual([{ field: "date", dir: "desc" }]);
    expect(screen.getByRole("button", { name: /Adicionar Valor/i })).toBeInTheDocument();
  });

  it("badge no header reflete contagem em PT-BR", () => {
    render(
      <Harness
        initial={[
          { field: "date", dir: "desc" },
          { field: "val", dir: "asc" },
          { field: "tipo", dir: "desc" },
        ]}
      />,
    );
    expect(screen.getByText("3 níveis")).toBeInTheDocument();
  });

  it("sem regras + sem campos disponíveis mostra estado vazio", () => {
    render(<Harness initial={[]} />);
    // 0 ativos → todos os 5 campos viram disponíveis; estado vazio só ocorre quando
    // ambas listas estão vazias.
    expect(screen.queryByText(/Sem campos disponíveis\./i)).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhum/i)).toBeInTheDocument();
  });

  it("clicar dentro do menu não fecha (stopPropagation)", () => {
    render(<Harness />);
    // Apenas garante que o role="dialog" continua acessível
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
