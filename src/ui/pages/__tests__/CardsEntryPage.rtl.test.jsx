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

  it("abre o Hub em /cards com dados reais, com ou sem ?view=new", () => {
    const { rerender } = renderEntry();
    expect(screen.getByText("Hub novo")).toBeInTheDocument();
    search = { view: "new" };
    rerender(<CardsEntryPage hub={<div>Hub novo</div>} classic={<div>Tela clássica</div>} dataMode="live" organizationId="org-1" />);
    expect(screen.getByText("Hub novo")).toBeInTheDocument();
  });

  it("mantém a tela clássica sem dados reais (demo/vazio)", () => {
    renderEntry({ dataMode: "empty" });
    expect(screen.getByText("Tela clássica")).toBeInTheDocument();
  });
});
