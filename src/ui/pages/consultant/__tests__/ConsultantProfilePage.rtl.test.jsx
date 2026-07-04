// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../routing/finclaPageContext.jsx", () => ({
  useFinclaPages: () => ({
    user: {
      first_name: "Helena",
      last_name: "Castro",
      email: "helena@fincla.dev",
      subscription: { plan: "consultant_pro", status: "active" },
    },
  }),
}));

vi.mock("../../../../api/consultant", () => ({ getConsultantClients: vi.fn() }));

import { getConsultantClients } from "../../../../api/consultant";
import { ConsultantProfilePage } from "../ConsultantProfilePage.jsx";

beforeEach(() => {
  vi.mocked(getConsultantClients).mockResolvedValue({
    total: 2,
    clients: [
      { organization_id: "a", health: 80, patrimonio: "40000.00" },
      { organization_id: "b", health: 50, patrimonio: "10000.00" },
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<ConsultantProfilePage> (S6)", () => {
  it("mostra a conta real (nome/plano/e-mail) + stats reais e stubs honestos", async () => {
    render(<ConsultantProfilePage />);

    expect(screen.getByText("Helena Castro")).toBeInTheDocument();
    expect(screen.getByText("Consultor financeiro")).toBeInTheDocument();
    // plano legível a partir do slug
    expect(screen.getByText("Consultant Pro")).toBeInTheDocument();
    expect(screen.getByText("helena@fincla.dev")).toBeInTheDocument();

    // stats reais (2 clientes) após o load
    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());
    expect(screen.getByText("Patrimônio sob gestão")).toBeInTheDocument();

    // stubs honestos
    expect(screen.getByText("Honorários recorrentes")).toBeInTheDocument();
    expect(screen.getByText("Notificações de risco")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Editar/ })).toBeDisabled();
  });
});
