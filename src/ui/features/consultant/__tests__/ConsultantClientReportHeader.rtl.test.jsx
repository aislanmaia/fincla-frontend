// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsultantClientReportHeader } from "../ConsultantClientReportHeader.jsx";

function client(over = {}) {
  return {
    organization_id: "org-1",
    organization_name: over.organization_name ?? "Família Silva",
    client_name: over.client_name ?? "Mariana Costa",
    health: over.health ?? 82,
    balance: over.balance ?? "1200.00",
    savings_pct: over.savings_pct ?? 15,
    debt_pct: over.debt_pct ?? 20,
    trend: over.trend ?? "up",
    last_active: over.last_active ?? "2026-06-28",
    patrimonio: over.patrimonio ?? "50000.00",
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConsultantClientReportHeader", () => {
  it("mostra nome, situação de saúde e patrimônio do cliente", () => {
    render(<ConsultantClientReportHeader client={client()} onBack={() => {}} />);
    expect(screen.getByText("Mariana Costa")).toBeInTheDocument();
    expect(screen.getByText("Em dia")).toBeInTheDocument(); // health 82 → healthy
    expect(screen.getByText("Patrimônio")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
  });

  it("mostra o nome da org quando difere do nome do cliente", () => {
    render(<ConsultantClientReportHeader client={client()} onBack={() => {}} />);
    expect(screen.getByText("Família Silva")).toBeInTheDocument();
  });

  it("omite o nome da org quando igual ao nome do cliente", () => {
    render(<ConsultantClientReportHeader client={client({ organization_name: "Mariana Costa" })} onBack={() => {}} />);
    // "Mariana Costa" aparece só uma vez (o título), não repetido como org
    expect(screen.getAllByText("Mariana Costa")).toHaveLength(1);
  });

  it("chama onBack ao clicar em voltar", () => {
    const onBack = vi.fn();
    render(<ConsultantClientReportHeader client={client()} onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /voltar para a carteira/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
