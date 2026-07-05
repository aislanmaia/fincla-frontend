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
    expect(screen.getByText("Precisam de atenção")).toBeInTheDocument();
  });

  it("shows real values for all 4 KPIs once loaded", () => {
    render(
      <ConsultantKpiCards
        healthIndex={{ organizations_count: 10, index: 92 }}
        hasLoaded
        patrimonio={384210}
        patrimonioLoaded
        attention={1}
        attentionLoaded
      />
    );
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("92")).toBeInTheDocument();
    expect(screen.getByText("R$ 384.210")).toBeInTheDocument();
    expect(screen.getByText("de 10 clientes")).toBeInTheDocument();
  });

  it("has no 'em breve' badge — all KPIs are backed by real data now", () => {
    render(
      <ConsultantKpiCards
        healthIndex={{ organizations_count: 8, index: 72 }}
        hasLoaded
        patrimonio={1000}
        patrimonioLoaded
        attention={0}
        attentionLoaded
      />
    );
    expect(screen.queryByText("em breve")).not.toBeInTheDocument();
  });
});
