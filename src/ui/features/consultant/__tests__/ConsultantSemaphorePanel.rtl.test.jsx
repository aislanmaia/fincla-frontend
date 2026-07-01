// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultantSemaphorePanel } from "../ConsultantSemaphorePanel.jsx";

afterEach(cleanup);

describe("<ConsultantSemaphorePanel>", () => {
  it("renders the legend counts and the average-health center", () => {
    render(
      <ConsultantSemaphorePanel
        atRiskTotal={3}
        organizationsCount={10}
        healthIndex={72}
        hasLoaded
      />
    );
    expect(screen.getByText("Precisam de atenção")).toBeInTheDocument();
    expect(screen.getByText("Em dia")).toBeInTheDocument();
    // legend values: 3 attention, 7 em dia
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    // donut center = rounded average health
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("saúde média")).toBeInTheDocument();
  });

  it("pluralizes the client count line", () => {
    render(
      <ConsultantSemaphorePanel atRiskTotal={0} organizationsCount={1} healthIndex={100} hasLoaded />
    );
    expect(screen.getByText("1 cliente na carteira")).toBeInTheDocument();
  });
});
