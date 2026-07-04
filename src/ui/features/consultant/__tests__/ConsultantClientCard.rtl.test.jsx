// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsultantClientCard } from "../ConsultantClientCard.jsx";

const client = {
  organization_id: "org-1",
  organization_name: "Família Silva",
  client_name: "Mariana Costa",
  health: 46,
  balance: "-3000.00",
  savings_pct: -10,
  debt_pct: 70,
  trend: "down",
  last_active: "2026-06-28",
  patrimonio: "8000.00",
};

afterEach(cleanup);

describe("<ConsultantClientCard>", () => {
  it("mostra nome, org, mini-stats e o selo de risco", () => {
    render(<ConsultantClientCard client={client} onOpenClient={() => {}} />);
    expect(screen.getByText("Mariana Costa")).toBeInTheDocument();
    expect(screen.getByText("Família Silva")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio")).toBeInTheDocument();
    expect(screen.getByText("Comprom.")).toBeInTheDocument();
    // health 46 → faixa "Atenção" (RiskBadge)
    expect(screen.getByText("Atenção")).toBeInTheDocument();
  });

  it("é clicável e abre o relatório pela org", () => {
    const onOpenClient = vi.fn();
    render(<ConsultantClientCard client={client} onOpenClient={onOpenClient} />);
    fireEvent.click(screen.getByText("Mariana Costa"));
    expect(onOpenClient).toHaveBeenCalledWith("org-1");
  });

  it("cliente pendente mostra a ação 'gerar novo link' e chama onRegenerate", () => {
    const onRegenerate = vi.fn();
    render(<ConsultantClientCard client={{ ...client, pending_activation: true }} onOpenClient={() => {}} onRegenerate={onRegenerate} />);
    fireEvent.click(screen.getByRole("button", { name: /gerar novo link/i }));
    expect(onRegenerate).toHaveBeenCalledWith("org-1");
  });

  it("cliente não-pendente não mostra a ação de gerar link", () => {
    render(<ConsultantClientCard client={client} onOpenClient={() => {}} onRegenerate={() => {}} />);
    expect(screen.queryByRole("button", { name: /gerar novo link/i })).not.toBeInTheDocument();
  });

  it("Avaliar/Mensagem são stubs desabilitados (Trilha B) e não abrem o relatório", () => {
    const onOpenClient = vi.fn();
    render(<ConsultantClientCard client={client} onOpenClient={onOpenClient} />);
    const avaliar = screen.getByRole("button", { name: /Avaliar com IA/ });
    expect(avaliar).toBeDisabled();
    fireEvent.click(avaliar);
    expect(onOpenClient).not.toHaveBeenCalled();
  });
});
