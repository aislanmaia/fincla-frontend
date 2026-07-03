// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
let currentParams = { id: "a" };

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => currentParams,
}));

vi.mock("../../../../api/consultant", () => ({
  getConsultantClients: vi.fn(),
}));

import { getConsultantClients } from "../../../../api/consultant";
import { ConsultantClientReportPage } from "../ConsultantClientReportPage.jsx";

function client(over = {}) {
  return {
    organization_id: over.organization_id ?? "a",
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

beforeEach(() => {
  currentParams = { id: "a" };
  navigate.mockReset();
  vi.mocked(getConsultantClients).mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConsultantClientReportPage", () => {
  it("mostra o cabeçalho do cliente correspondente ao id da URL", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 1, clients: [client()] });
    render(<ConsultantClientReportPage />);

    await waitFor(() => expect(screen.getByText("Mariana Costa")).toBeInTheDocument());
    expect(screen.getByText("Em dia")).toBeInTheDocument();
    expect(screen.getByText("Relatório em construção")).toBeInTheDocument();
  });

  it("volta para a carteira ao clicar em voltar", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 1, clients: [client()] });
    render(<ConsultantClientReportPage />);
    await waitFor(() => expect(screen.getByText("Mariana Costa")).toBeInTheDocument());

    screen.getByRole("button", { name: /voltar para a carteira/i }).click();
    expect(navigate).toHaveBeenCalledWith({ to: "/consultant/clients" });
  });

  it("mostra 'não encontrado' quando o id não é cliente do consultor", async () => {
    currentParams = { id: "zzz" };
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 1, clients: [client()] });
    render(<ConsultantClientReportPage />);

    await waitFor(() => expect(screen.getByText("Cliente não encontrado")).toBeInTheDocument());
  });

  it("mostra erro quando a carga da carteira falha", async () => {
    vi.mocked(getConsultantClients).mockRejectedValue(new Error("boom"));
    render(<ConsultantClientReportPage />);

    await waitFor(() => expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument());
  });
});
