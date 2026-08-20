/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OnboardingFlow } from "./OnboardingFlow.jsx";

afterEach(cleanup);

describe("OnboardingFlow — foco nos inputs", () => {
  it("mantem o foco no campo de nome ao digitar varios caracteres", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow onComplete={() => {}} />);

    await user.click(screen.getByRole("button", { name: /Começar configuração/i }));

    const input = screen.getByPlaceholderText(/Família Alves/i);
    await user.click(input);
    expect(document.activeElement).toBe(input);

    await user.keyboard("Familia Castro");

    const after = screen.getByPlaceholderText(/Família Alves/i);
    expect(after.value).toBe("Familia Castro");
    expect(document.activeElement).toBe(after);
  });

  it("pede os 4 digitos do cartao e so libera o passo quando estao completos", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingFlow onComplete={onComplete} />);

    await user.click(screen.getByRole("button", { name: /Começar configuração/i }));
    await user.click(screen.getByRole("button", { name: /Pular etapa/i })); // org -> categorias
    await user.click(screen.getByRole("button", { name: /Pular etapa/i })); // categorias -> cartoes

    await user.click(screen.getByText(/Sim, usamos/i));
    await user.type(screen.getByPlaceholderText(/Nome do cartão/i), "Nubank Roxinho");

    // Nome preenchido sem os dígitos: avanço bloqueado e aviso visível.
    expect(screen.getByText(/Informe os 4 últimos dígitos/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Continuar|Próximo|Avançar/i }).disabled).toBe(true);

    await user.type(screen.getByPlaceholderText(/4 últimos dígitos/i), "12a3456");
    expect(screen.getByPlaceholderText(/4 últimos dígitos/i).value).toBe("1234");
    expect(screen.queryByText(/Informe os 4 últimos dígitos/i)).toBeNull();
  });
});
