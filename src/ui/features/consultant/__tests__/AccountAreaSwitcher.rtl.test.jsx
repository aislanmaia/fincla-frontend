// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

import { AccountAreaSwitcher } from "../AccountAreaSwitcher.jsx";

const consultant = {
  // `is_consultant` vem do backend e passou a ser o que decide a área: a feature
  // sozinha mandava todo usuário beta para o painel do consultor (§1.7).
  is_consultant: true,
  subscription: { status: "active", features: ["multi_org_dashboard", "client_list"] },
};
const plainOwner = { subscription: { status: "active", features: ["basic_reports"] } };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<AccountAreaSwitcher>", () => {
  it("não renderiza para quem não tem a área do consultor", () => {
    const { container } = render(<AccountAreaSwitcher current="personal" user={plainOwner} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra a área atual e abre o menu com as duas áreas", () => {
    render(<AccountAreaSwitcher current="consultant" user={consultant} />);
    expect(screen.getByText("Área do consultor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Você está em/ }));
    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Minha conta/ })).toBeInTheDocument();
  });

  it("do consultor → 'Minha conta' navega para /dashboard", () => {
    render(<AccountAreaSwitcher current="consultant" user={consultant} />);
    fireEvent.click(screen.getByRole("button", { name: /Você está em/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Minha conta/ }));
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  });

  it("do app pessoal → 'Área do consultor' navega para /consultant", () => {
    render(<AccountAreaSwitcher current="personal" user={consultant} />);
    fireEvent.click(screen.getByRole("button", { name: /Você está em/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Área do consultor/ }));
    expect(navigate).toHaveBeenCalledWith({ to: "/consultant" });
  });

  it("clicar na área atual não navega (é a mesma)", () => {
    const onNavigate = vi.fn();
    render(<AccountAreaSwitcher current="consultant" user={consultant} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /Você está em/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Área do consultor/ }));
    expect(navigate).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
