// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchBar } from "../../filters/search/SearchBar.jsx";
import { DEFAULT_SORT } from "../../filters/search/sortModel.js";

afterEach(cleanup);

function Harness({ initialSearch = "", initialSort = DEFAULT_SORT, onSearch }) {
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState(initialSort);
  return (
    <SearchBar
      search={search}
      setSearch={(v) => {
        setSearch(v);
        onSearch?.(v);
      }}
      sort={sort}
      setSort={setSort}
    />
  );
}

describe("<SearchBar>", () => {
  it("renderiza input + botão de ordenação default", () => {
    render(<Harness />);
    expect(screen.getByPlaceholderText(/Buscar por descrição, valor, tag…/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ordenar transações: Data ↓/i })).toBeInTheDocument();
  });

  it("digitar no input dispara setSearch", async () => {
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} />);
    await userEvent.type(screen.getByRole("textbox", { name: /Buscar transações/i }), "iFood");
    expect(onSearch).toHaveBeenLastCalledWith("iFood");
  });

  it("abrir menu de ordenação esconde o tooltip de hover", async () => {
    render(<Harness initialSort={[{ field: "date", dir: "desc" }]} />);
    const btn = screen.getByRole("button", { name: /Ordenar transações:/i });
    fireEvent.mouseEnter(btn);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await userEvent.click(btn);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Editor de ordenação/i })).toBeInTheDocument();
  });

  it("badge contador aparece com >1 critério", () => {
    render(
      <Harness
        initialSort={[
          { field: "date", dir: "desc" },
          { field: "val", dir: "asc" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /Ordenar transações: Data ↓ · Valor ↑/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/2 critérios/i)).toBeInTheDocument();
  });

  it("3+ critérios viram 'X ↓ · +N'", () => {
    render(
      <Harness
        initialSort={[
          { field: "date", dir: "desc" },
          { field: "val", dir: "asc" },
          { field: "tipo", dir: "desc" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /Ordenar transações: Data ↓ · \+2/i })).toBeInTheDocument();
  });

  it("Esc fecha o menu", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Ordenar transações:/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clique fora fecha o menu", async () => {
    render(
      <div>
        <Harness />
        <button data-testid="outside">fora</button>
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Ordenar transações:/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tooltip mostra todas as regras", () => {
    render(
      <Harness
        initialSort={[
          { field: "date", dir: "desc" },
          { field: "val", dir: "asc" },
        ]}
      />,
    );
    const btn = screen.getByRole("button", { name: /Ordenar transações:/i });
    fireEvent.mouseEnter(btn);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent(/Ordenando por 2 critérios/i);
    expect(tooltip).toHaveTextContent(/Mais recente primeiro/i);
    expect(tooltip).toHaveTextContent(/Menor valor primeiro/i);
  });
});
