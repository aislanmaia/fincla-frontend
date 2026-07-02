// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../api/consultant", () => ({
  getConsultantClients: vi.fn(),
}));

import { getConsultantClients } from "../../../../api/consultant";
import { ConsultantClientsPage } from "../ConsultantClientsPage.jsx";

function client(over = {}) {
  return {
    organization_id: over.organization_id ?? "org-x",
    organization_name: over.organization_name ?? "Org X",
    role: "consultant",
    membership_created_at: "2026-06-01T00:00:00Z",
    client_name: over.client_name ?? "Cliente X",
    health: over.health ?? 80,
    balance: over.balance ?? "1000.00",
    savings_pct: over.savings_pct ?? 10,
    debt_pct: over.debt_pct ?? 20,
    trend: over.trend ?? "flat",
    last_active: over.last_active ?? "2026-06-28",
    patrimonio: over.patrimonio ?? "5000.00",
  };
}

const ana = client({ organization_id: "a", client_name: "Ana Beatriz", health: 92, patrimonio: "50000.00" });
const carla = client({ organization_id: "c", client_name: "Carla Dias", health: 30, patrimonio: "12000.00" });

beforeEach(() => {
  vi.mocked(getConsultantClients).mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConsultantClientsPage", () => {
  it("renderiza os cards da carteira (default) e o total", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 2, clients: [ana, carla] });
    render(<ConsultantClientsPage />);

    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());
    expect(screen.getByText("Carla Dias")).toBeInTheDocument();
    expect(screen.getByText("2 clientes sob sua gestão.")).toBeInTheDocument();
  });

  it("alterna para a visão de tabela", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 2, clients: [ana, carla] });
    render(<ConsultantClientsPage />);
    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
    const table = screen.getByRole("table");
    expect(within(table).getByText("Patrimônio")).toBeInTheDocument();
    expect(within(table).getByText("Ana Beatriz")).toBeInTheDocument();
  });

  it("filtra por faixa de risco (Em risco → só Carla)", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 2, clients: [ana, carla] });
    render(<ConsultantClientsPage />);
    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Em risco" }));
    expect(screen.getByText("Carla Dias")).toBeInTheDocument();
    expect(screen.queryByText("Ana Beatriz")).not.toBeInTheDocument();
  });

  it("busca por nome", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 2, clients: [ana, carla] });
    render(<ConsultantClientsPage />);
    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Buscar cliente"), { target: { value: "carla" } });
    expect(screen.getByText("Carla Dias")).toBeInTheDocument();
    expect(screen.queryByText("Ana Beatriz")).not.toBeInTheDocument();
  });

  it("mostra estado sem-resultado quando o filtro não casa", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 2, clients: [ana, carla] });
    render(<ConsultantClientsPage />);
    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Buscar cliente"), { target: { value: "zzz" } });
    expect(screen.getByText("Nenhum cliente encontrado")).toBeInTheDocument();
  });

  it("mostra a carteira vazia quando não há clientes", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 0, clients: [] });
    render(<ConsultantClientsPage />);
    await waitFor(() => expect(screen.getByText("Sua carteira está vazia")).toBeInTheDocument());
  });

  it("mostra erro total quando a carga falha", async () => {
    vi.mocked(getConsultantClients).mockRejectedValue(new Error("boom"));
    render(<ConsultantClientsPage />);
    await waitFor(() => expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument());
  });
});
