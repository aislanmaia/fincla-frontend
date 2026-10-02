// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../api/admin", () => ({ getAdminMe: mocks.getAdminMe }));
vi.mock("../api/auth", () => ({ login: mocks.login, logout: mocks.logout }));

import { AdminApp } from "./AdminApp.jsx";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("painel do administrador Fincla", () => {
  it("mostra o painel somente após a API confirmar a permissão administrativa", async () => {
    mocks.login.mockImplementation(async () => {
      localStorage.setItem("auth_token", "admin-token");
    });
    mocks.getAdminMe.mockResolvedValue({
      id: "admin-1",
      email: "aislan.sousamaia@gmail.com",
      is_admin: true,
    });

    render(<AdminApp />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "aislan.sousamaia@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar no painel" }));

    expect(await screen.findByText("Acesso administrativo ativo")).toBeInTheDocument();
    expect(mocks.login).toHaveBeenCalledWith("aislan.sousamaia@gmail.com", "senha-segura");
    fireEvent.click(screen.getAllByRole("button", { name: "Sair" })[1]);
    expect(mocks.logout).toHaveBeenCalled();
  });

  it("nega o painel ao proprietário sem permissão administrativa", async () => {
    mocks.login.mockImplementation(async () => {
      localStorage.setItem("auth_token", "owner-token");
    });
    mocks.getAdminMe.mockRejectedValue({ response: { status: 403 } });

    render(<AdminApp />);
    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar no painel" }));

    expect(await screen.findByText("Esta conta não tem acesso ao painel administrativo.")).toBeInTheDocument();
    expect(screen.queryByText("Acesso administrativo ativo")).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.logout).toHaveBeenCalled());
  });
});
