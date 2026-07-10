// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultantSemaphorePanel } from "../ConsultantSemaphorePanel.jsx";

afterEach(cleanup);

const clients = [
  { organization_id: "a", health: 85 }, // saudável
  { organization_id: "b", health: 90 }, // saudável
  { organization_id: "c", health: 55 }, // atenção
  { organization_id: "d", health: 30 }, // em risco
];

describe("<ConsultantSemaphorePanel>", () => {
  it("renders the health-band legend and the average-health center", () => {
    render(<ConsultantSemaphorePanel clients={clients} hasLoaded healthIndex={72} />);
    expect(screen.getByText("Semáforo da carteira")).toBeInTheDocument();
    expect(screen.getByText("Saudável")).toBeInTheDocument();
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    expect(screen.getByText("Frágil")).toBeInTheDocument();
    expect(screen.getByText("4 clientes por nível de saúde")).toBeInTheDocument();
    // legend counts: 2 saudável, 1 atenção, 1 em risco
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2);
    // donut center = rounded average health
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("saúde média")).toBeInTheDocument();
  });

  it("pluralizes the client count line", () => {
    render(<ConsultantSemaphorePanel clients={[{ organization_id: "x", health: 90 }]} hasLoaded healthIndex={100} />);
    expect(screen.getByText("1 cliente por nível de saúde")).toBeInTheDocument();
  });

  it("shows a loading note (not a fabricated split) while data is unresolved", () => {
    render(<ConsultantSemaphorePanel clients={[]} hasLoaded={false} healthIndex={null} loading />);
    expect(screen.getByText("Carregando distribuição…")).toBeInTheDocument();
    expect(screen.queryByText("Saudável")).not.toBeInTheDocument();
  });

  it("shows 'indisponível' when settled with an empty base", () => {
    render(<ConsultantSemaphorePanel clients={[]} hasLoaded healthIndex={80} loading={false} />);
    expect(screen.getByText("Distribuição de risco indisponível.")).toBeInTheDocument();
  });
});
