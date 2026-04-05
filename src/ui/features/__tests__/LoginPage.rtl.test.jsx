/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "../authViews.jsx";

describe("LoginPage (RTL)", () => {
  it("chama onLogin com e-mail e senha", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);
    render(<LoginPage onLogin={onLogin} />);
    await user.type(screen.getByPlaceholderText("seu@email.com"), "dev@test.local");
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: /Entrar na conta/i }));
    expect(onLogin).toHaveBeenCalledWith("dev@test.local", "secret123");
  });
});
