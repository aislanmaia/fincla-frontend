// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

vi.mock("../../../../api/consultant", () => ({ createConsultantClient: vi.fn() }));

import { createConsultantClient } from "../../../../api/consultant";
import { ConsultantAddClientWizard } from "../ConsultantAddClientWizard.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fillStep1() {
  fireEvent.change(screen.getByPlaceholderText("Ex.: Mariana Torres"), { target: { value: "Mariana Torres" } });
  fireEvent.change(screen.getByPlaceholderText("mariana@email.com"), { target: { value: "mariana@email.com" } });
}

describe("<ConsultantAddClientWizard>", () => {
  it("não renderiza quando fechado", () => {
    render(<ConsultantAddClientWizard open={false} onClose={() => {}} />);
    expect(screen.queryByPlaceholderText("Ex.: Mariana Torres")).not.toBeInTheDocument();
  });

  it("passo 1: 'Continuar' só habilita com nome + e-mail válidos", () => {
    render(<ConsultantAddClientWizard open onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeDisabled();
    fillStep1();
    expect(screen.getByRole("button", { name: /Continuar/ })).not.toBeDisabled();
  });

  it("cria o cliente pela API e mostra o link de definir senha", async () => {
    vi.mocked(createConsultantClient).mockResolvedValue({
      organization_id: "org-1",
      client_name: "Mariana Torres",
      set_password_link: "https://app/login?reset_token=abc",
    });
    render(<ConsultantAddClientWizard open onClose={() => {}} />);
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → org
    fireEvent.change(screen.getByPlaceholderText("Ex.: Finanças de Mariana"), { target: { value: "Finanças de Mariana" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → início
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → cartão
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → receita
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → perfil
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → revisar

    fireEvent.click(screen.getByRole("button", { name: /Criar cliente/ }));

    await waitFor(() => expect(createConsultantClient).toHaveBeenCalledTimes(1));
    expect(createConsultantClient).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: "Mariana", last_name: "Torres", email: "mariana@email.com", org_name: "Finanças de Mariana" })
    );
    expect(await screen.findByText("Cliente adicionado!")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://app/login?reset_token=abc")).toBeInTheDocument();
  }, 15000);
});
