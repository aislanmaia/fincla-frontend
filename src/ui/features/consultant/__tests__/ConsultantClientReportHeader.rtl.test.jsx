// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultantClientReportHeader } from "../ConsultantClientReportHeader.jsx";

function client(over = {}) {
  return {
    organization_id: "org-1",
    organization_name: over.organization_name ?? "Família Silva",
    client_name: over.client_name ?? "Mariana Costa",
    health: over.health ?? 82,
    balance: over.balance ?? "1200.00",
    trend: over.trend ?? "up",
    last_active: over.last_active ?? "2026-06-28",
    patrimonio: over.patrimonio ?? "50000.00",
  };
}

afterEach(() => cleanup());

describe("ConsultantClientReportHeader", () => {
  it("mostra nome, iniciais no avatar, faixa de saúde e o anel (score)", () => {
    render(<ConsultantClientReportHeader client={client()} />);
    expect(screen.getByText("Mariana Costa")).toBeInTheDocument();
    expect(screen.getByText("MC")).toBeInTheDocument(); // avatar
    expect(screen.getByText("Em dia")).toBeInTheDocument(); // RiskBadge (health 82)
    expect(screen.getByText("82")).toBeInTheDocument(); // HealthRing
  });

  it("mostra o nome da org e a última atividade na linha de contexto", () => {
    render(<ConsultantClientReportHeader client={client()} />);
    expect(screen.getByText(/Família Silva/)).toBeInTheDocument();
    expect(screen.getByText(/ativo em 28\/06\/2026/)).toBeInTheDocument();
  });

  it("as ações de IA/mensagem ficam como stub 'em breve' (desabilitadas)", () => {
    render(<ConsultantClientReportHeader client={client()} />);
    const ai = screen.getByRole("button", { name: /Avaliar com IA/ });
    const msg = screen.getByRole("button", { name: /Enviar mensagem/ });
    expect(ai).toBeDisabled();
    expect(msg).toBeDisabled();
  });
});
