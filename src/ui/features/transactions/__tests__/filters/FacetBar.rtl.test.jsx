// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FacetBar } from "../../filters/facetBar/FacetBar.jsx";

afterEach(cleanup);

const FACETS = [
  { key: "periodo", label: "Período", value: "Este mês", icon: "calendar", active: true },
  { key: "tipo", label: "Tipo", value: "Despesa", icon: "trending-down", active: true, color: "#DC2626" },
  { key: "categoria", label: "Categoria", value: "2 categorias", icon: "circle", active: true, multi: 2 },
  { key: "tag", label: "Tags", value: "—", icon: "tag", active: false },
  { key: "cartao", label: "Cartão", value: "Nubank", icon: "card", active: true },
  { key: "valor", label: "Valor", value: "Qualquer", icon: "wallet", active: false },
  { key: "recorrencia", label: "Recorrência", value: "Todas", icon: "repeat", active: false },
];

function Harness({ onToggle = vi.fn(), onClearAll = vi.fn(), expanded = null, hasAnyActive = true }) {
  const [exp, setExp] = useState(expanded);
  return (
    <FacetBar
      facets={FACETS}
      expanded={exp}
      onToggle={(key) => {
        onToggle(key);
        setExp(exp === key ? null : key);
      }}
      onClearAll={onClearAll}
      hasAnyActive={hasAnyActive}
    />
  );
}

describe("<FacetBar>", () => {
  it("renderiza todos os 7 facets", () => {
    render(<Harness />);
    for (const f of FACETS) {
      expect(screen.getByRole("button", { name: new RegExp(`${f.label}:`) })).toBeInTheDocument();
    }
  });

  it("clicar num card abre o facet correspondente (aria-expanded)", async () => {
    const onToggle = vi.fn();
    render(<Harness onToggle={onToggle} />);
    const btn = screen.getByRole("button", { name: /Período: Este mês/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(onToggle).toHaveBeenCalledWith("periodo");
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("badge +N aparece em multi-seleção", () => {
    render(<Harness />);
    const cat = screen.getByRole("button", { name: /Categoria: 2 categorias/i });
    expect(cat).toHaveTextContent("2");
  });

  it("Limpar tudo chama callback quando há ativo", async () => {
    const onClearAll = vi.fn();
    render(<Harness onClearAll={onClearAll} />);
    await userEvent.click(screen.getByRole("button", { name: /Limpar todos os filtros/i }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("Limpar tudo fica desabilitado quando nada está ativo", () => {
    render(<Harness hasAnyActive={false} />);
    expect(screen.getByRole("button", { name: /Limpar todos os filtros/i })).toBeDisabled();
  });

  it("apenas um facet pode estar expandido por vez", async () => {
    render(<Harness />);
    const periodo = screen.getByRole("button", { name: /Período:/i });
    const tipo = screen.getByRole("button", { name: /Tipo:/i });
    await userEvent.click(periodo);
    expect(periodo).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(tipo);
    expect(periodo).toHaveAttribute("aria-expanded", "false");
    expect(tipo).toHaveAttribute("aria-expanded", "true");
  });
});
