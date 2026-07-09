// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

// O gate de "Avaliar com IA" lê o usuário do contexto de páginas.
const pageUser = { subscription: { status: "active", features: [] } };
vi.mock("../../../routing/finclaPageContext.jsx", () => ({
  useFinclaPages: () => ({ user: pageUser }),
}));

vi.mock("../../../../api/consultant", () => ({
  getConsultantClients: vi.fn(),
  // A Carteira cruza `clients-at-risk` para marcar o selo de alerta no card:
  // risco é outro eixo que saúde, e sem isto ele ficaria invisível aqui.
  getClientsAtRisk: vi.fn(() => Promise.resolve({ clients: [], total: 0 })),
  recomputeClientHealth: vi.fn(),
  evaluateClientWithAi: vi.fn(),
  newEvaluationRequestId: vi.fn(() => "11111111-1111-4111-8111-111111111111"),
}));

import { evaluateClientWithAi, getConsultantClients } from "../../../../api/consultant";
import { ConsultantAddClientProvider } from "../../../features/consultant/ConsultantAddClientContext.jsx";
import { ConsultantClientsPage } from "../ConsultantClientsPage.jsx";

function renderWithVersion(clientsVersion) {
  return render(
    <ConsultantAddClientProvider openAddClient={() => {}} clientsVersion={clientsVersion} notifyClientsChanged={() => {}}>
      <ConsultantClientsPage />
    </ConsultantAddClientProvider>,
  );
}

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
  navigate.mockReset();
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
    // kicker: "2 clientes · R$ … sob acompanhamento"
    expect(screen.getByText(/2 clientes ·/)).toBeInTheDocument();
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

  it("filtra por faixa de saúde (Frágil → só Carla)", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 2, clients: [ana, carla] });
    render(<ConsultantClientsPage />);
    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Frágil/ }));
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

  it("atualiza a lista quando um cliente é criado (clientsVersion muda)", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 1, clients: [ana] });
    const { rerender } = renderWithVersion(0);
    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());
    expect(getConsultantClients).toHaveBeenCalledTimes(1);

    // Criação do cliente → clientsVersion incrementa → refetch (agora com Carla).
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 2, clients: [ana, carla] });
    rerender(
      <ConsultantAddClientProvider openAddClient={() => {}} clientsVersion={1} notifyClientsChanged={() => {}}>
        <ConsultantClientsPage />
      </ConsultantAddClientProvider>,
    );
    await waitFor(() => expect(getConsultantClients).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Carla Dias")).toBeInTheDocument();
  });

  it("cota cheia → mostra 'Limite do plano atingido' (botão segue ativo → abre o paywall)", async () => {
    const c3 = client({ organization_id: "x3", client_name: "Cli Tres" });
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 3, clients: [ana, carla, c3] });
    render(
      <ConsultantAddClientProvider openAddClient={() => {}} clientsVersion={0} notifyClientsChanged={() => {}} quota={{ limit: 3, used: 3, remaining: 0 }}>
        <ConsultantClientsPage />
      </ConsultantAddClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());
    expect(screen.getByText("Limite do plano atingido")).toBeInTheDocument();
    // Botão continua ativo — o paywall aparece no modal, não desabilitamos a ação.
    expect(screen.getByRole("button", { name: /Adicionar cliente/ })).not.toBeDisabled();
  });

  it("cota disponível → mostra vagas restantes e botão habilitado", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 2, clients: [ana, carla] });
    render(
      <ConsultantAddClientProvider openAddClient={() => {}} clientsVersion={0} notifyClientsChanged={() => {}} quota={{ limit: 5, used: 2, remaining: 3 }}>
        <ConsultantClientsPage />
      </ConsultantAddClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());
    expect(screen.getByText("3 vagas restantes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar cliente/ })).not.toBeDisabled();
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

  it("clicar no card navega para o relatório do cliente com o id da org", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 1, clients: [ana] });
    render(<ConsultantClientsPage />);
    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());

    // O card inteiro é clicável (fiel à referência) — clicar o nome abre o relatório.
    fireEvent.click(screen.getByText("Ana Beatriz"));
    expect(navigate).toHaveBeenCalledWith({ to: "/consultant/clients/$id", params: { id: "a" } });
  });
});

/**
 * A Carteira habilita "Avaliar com IA" nos cards e na tabela. Sem o drawer
 * montado na página, o botão fica habilitado e o clique não faz nada — foi
 * exatamente esse o bug encontrado no review da etapa 9.
 */
describe("<ConsultantClientsPage> — Avaliar com IA", () => {
  beforeEach(() => {
    pageUser.subscription = { status: "active", features: ["consultant_ai"] };
  });

  it("abre o drawer de avaliação ao clicar em 'Avaliar com IA'", async () => {
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 1, clients: [ana] });
    vi.mocked(evaluateClientWithAi).mockReturnValue(new Promise(() => {})); // fica carregando

    renderWithVersion(0);
    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const avaliar = screen.getAllByRole("button", { name: /Avaliar com IA/ })[0];
    expect(avaliar).toBeEnabled();
    fireEvent.click(avaliar);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Ana Beatriz")).toBeInTheDocument();
    expect(within(dialog).getByText(/Analisando dados de Ana/)).toBeInTheDocument();
    expect(evaluateClientWithAi).toHaveBeenCalledWith("a", "11111111-1111-4111-8111-111111111111");
  });

  // O backend barra com 403; o gate no cliente evita o round-trip e comunica o
  // motivo antes do clique.
  it("mantém 'Avaliar com IA' trancado quando o plano não inclui consultant_ai", async () => {
    pageUser.subscription = { status: "active", features: ["multi_org_dashboard"] };
    vi.mocked(getConsultantClients).mockResolvedValue({ total: 1, clients: [ana] });

    renderWithVersion(0);
    await waitFor(() => expect(screen.getByText("Ana Beatriz")).toBeInTheDocument());

    const avaliar = screen.getAllByRole("button", { name: /Avaliar com IA/ })[0];
    expect(avaliar).toBeDisabled();
    expect(avaliar).toHaveAttribute("title", expect.stringContaining("plano Pro"));

    fireEvent.click(avaliar);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(evaluateClientWithAi).not.toHaveBeenCalled();
  });
});
