/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "../authViews.jsx";

describe("LoginPage (RTL)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("chama onLogin com e-mail e senha", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginPage onLogin={onLogin} />);
    const panel = screen.getByTestId("login-form-panel");
    await user.type(within(panel).getByPlaceholderText("seu@email.com"), "dev@test.local");
    await user.type(within(panel).getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: /Entrar na conta/i }));
    expect(onLogin).toHaveBeenCalledWith("dev@test.local", "secret123");
  });

  it("durante login mostra Entrando, barra de progresso e desabilita campos", async () => {
    let resolveLogin;
    const onLogin = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<LoginPage onLogin={onLogin} />);
    const panel = screen.getByTestId("login-form-panel");
    await user.type(within(panel).getByPlaceholderText("seu@email.com"), "dev@test.local");
    await user.type(within(panel).getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: /Entrar na conta/i }));

    expect(await screen.findByRole("button", { name: /Entrando/i })).toBeDisabled();
    expect(screen.getByRole("progressbar", { name: /Carregando/i })).toBeInTheDocument();
    expect(within(panel).getByPlaceholderText("seu@email.com")).toBeDisabled();

    resolveLogin(undefined);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Entrar na conta/i })).toBeInTheDocument();
    });
  });

  it("após ~2,6s exibe dica de conexão ao servidor (cold start)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    let resolveLogin;
    const onLogin = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<LoginPage onLogin={onLogin} />);
    const panel = screen.getByTestId("login-form-panel");
    await user.type(within(panel).getByPlaceholderText("seu@email.com"), "dev@test.local");
    await user.type(within(panel).getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: /Entrar na conta/i }));

    await screen.findByRole("button", { name: /Entrando/i });

    await vi.advanceTimersByTimeAsync(2700);

    expect(
      screen.getByText(/Conectando ao servidor/i),
    ).toBeInTheDocument();

    resolveLogin(undefined);
    await waitFor(() => {
      expect(screen.queryByText(/Conectando ao servidor/i)).not.toBeInTheDocument();
    });
  });
});
