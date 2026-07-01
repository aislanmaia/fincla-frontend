// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultantKpiCards } from "../ConsultantKpiCards.jsx";

afterEach(cleanup);

describe("ConsultantKpiCards", () => {
  it("renders the 4 KPI labels", () => {
    render(<ConsultantKpiCards healthIndex={null} />);
    expect(screen.getByText("Clientes ativos")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio acompanhado")).toBeInTheDocument();
    expect(screen.getByText("Saúde média da base")).toBeInTheDocument();
    expect(screen.getByText("Honorários recorrentes")).toBeInTheDocument();
  });

  it("shows real values for clients and health once loaded", () => {
    render(
      <ConsultantKpiCards
        healthIndex={{ organizations_count: 8, index: 72 }}
        hasLoaded
      />
    );
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
  });

  it("marks the deferred KPIs with a dash value and a single 'em breve' badge each", () => {
    render(
      <ConsultantKpiCards
        healthIndex={{ organizations_count: 8, index: 72 }}
        hasLoaded
      />
    );
    // With real data present, only patrimonio and mrr render as "—".
    expect(screen.getAllByText("—")).toHaveLength(2);
    // "em breve" appears exactly twice — one badge per deferred card, not
    // doubled in the card's sub text.
    expect(screen.getAllByText("em breve")).toHaveLength(2);
  });
});
