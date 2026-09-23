// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

vi.mock("../../../../api/consultant", () => ({
  createConsultantClient: vi.fn(),
  listConsultantCategoryTemplates: vi.fn().mockResolvedValue([]),
}));

import { createConsultantClient, listConsultantCategoryTemplates } from "../../../../api/consultant";
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

  it("no limite do plano → mostra o paywall com CTA comercial, não o wizard", () => {
    render(<ConsultantAddClientWizard open onClose={() => {}} quota={{ limit: 3, used: 3, remaining: 0 }} />);
    expect(screen.getByText("Limite de clientes atingido")).toBeInTheDocument();
    expect(screen.getByText(/Falar com o time comercial/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Ex.: Mariana Torres")).not.toBeInTheDocument();
  });

  it("com créditos disponíveis → mostra o wizard normalmente", () => {
    render(<ConsultantAddClientWizard open onClose={() => {}} quota={{ limit: 10, used: 2, remaining: 8 }} />);
    expect(screen.getByPlaceholderText("Ex.: Mariana Torres")).toBeInTheDocument();
    expect(screen.queryByText("Limite de clientes atingido")).not.toBeInTheDocument();
  });

  it("oferece categorias de receita e negócio no ponto de partida", () => {
    render(<ConsultantAddClientWizard open onClose={() => {}} />);
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    fireEvent.change(screen.getByPlaceholderText("Ex.: Finanças de Mariana"), { target: { value: "Finanças da Marina" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(screen.getByRole("button", { name: /Trabalho e salário/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Serviços prestados/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Transferências recebidas/ })).toBeInTheDocument();
  });

  it("mostra a personalização do modelo no seletor de categorias em destaque", async () => {
    vi.mocked(listConsultantCategoryTemplates).mockResolvedValue([
      {
        id: "template-1",
        name: "Família personalizada",
        definition: {
          categories: [{
            system_key: "food_groceries",
            custom_name: "Mercado e Refeições",
            custom_icon_key: "utensils",
            color: "#0F766E",
            is_onboarding_highlight: true,
          }],
          custom_categories: [{
            name: "Projeto Especial",
            icon_key: "briefcase",
            color: "#2563EB",
            is_onboarding_highlight: true,
          }],
        },
      },
    ]);

    render(<ConsultantAddClientWizard open onClose={() => {}} />);
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));
    await screen.findByRole("option", { name: "Família personalizada" });
    fireEvent.change(screen.getByPlaceholderText("Ex.: Finanças de Mariana"), { target: { value: "Finanças da Marina" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "template-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(screen.getByRole("button", { name: /Mercado e Refeições/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Alimentação$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Projeto Especial/ })).toBeInTheDocument();
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
