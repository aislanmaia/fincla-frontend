/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardsEntryPage } from "../CardsEntryPage.jsx";

let search = {};
vi.mock("@tanstack/react-router", () => ({ useSearch: () => search }));

const renderEntry = (props = {}) => render(
  <CardsEntryPage
    hub={<div>Hub novo</div>}
    classic={<div>Tela clássica</div>}
    dataMode="live"
    organizationId="org-1"
    {...props}
  />,
);

describe("CardsEntryPage", () => {
  beforeEach(() => { search = {}; });
  afterEach(() => cleanup());

  it("mostra a tela clássica em /cards e com view desconhecida", () => {
    const { rerender } = renderEntry();
    expect(screen.getByText("Tela clássica")).toBeInTheDocument();
    search = { view: "classic" };
    rerender(<CardsEntryPage hub={<div>Hub novo</div>} classic={<div>Tela clássica</div>} dataMode="live" organizationId="org-1" />);
    expect(screen.getByText("Tela clássica")).toBeInTheDocument();
  });

  it("abre o Hub apenas com ?view=new e dados reais", () => {
    search = { view: "new" };
    renderEntry();
    expect(screen.getByText("Hub novo")).toBeInTheDocument();
  });

  it("mantém a tela clássica sem dados reais mesmo com ?view=new", () => {
    search = { view: "new" };
    renderEntry({ dataMode: "empty" });
    expect(screen.getByText("Tela clássica")).toBeInTheDocument();
  });
});
