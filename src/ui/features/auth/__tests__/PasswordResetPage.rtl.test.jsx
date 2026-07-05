// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PasswordResetPage } from "../PasswordResetPage.jsx";

afterEach(cleanup);

describe("<PasswordResetPage> token pre-validation", () => {
  it("token válido → mostra o formulário de nova senha", async () => {
    const onValidateToken = vi.fn().mockResolvedValue({ valid: true });
    render(<PasswordResetPage token="good" onValidateToken={onValidateToken} onResetPassword={vi.fn()} onComplete={vi.fn()} />);
    expect(await screen.findByText("Nova senha")).toBeInTheDocument();
    expect(screen.getByText(/Salvar nova senha/i)).toBeInTheDocument();
    expect(onValidateToken).toHaveBeenCalledWith("good");
  });

  it("token inválido/usado → mostra 'Link inválido' e esconde o formulário", async () => {
    const onValidateToken = vi.fn().mockResolvedValue({ valid: false });
    render(<PasswordResetPage token="used" onValidateToken={onValidateToken} onResetPassword={vi.fn()} onComplete={vi.fn()} />);
    expect(await screen.findByText("Link inválido ou expirado")).toBeInTheDocument();
    expect(screen.queryByText(/Salvar nova senha/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Ir para o login/i)).toBeInTheDocument();
  });

  it("sem token → 'Link inválido' sem chamar a validação", () => {
    const onValidateToken = vi.fn();
    render(<PasswordResetPage token="" onValidateToken={onValidateToken} onResetPassword={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByText("Link inválido ou expirado")).toBeInTheDocument();
    expect(onValidateToken).not.toHaveBeenCalled();
  });

  it("erro de rede na validação → fail-open, mostra o formulário", async () => {
    const onValidateToken = vi.fn().mockRejectedValue(new Error("network"));
    render(<PasswordResetPage token="x" onValidateToken={onValidateToken} onResetPassword={vi.fn()} onComplete={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Salvar nova senha/i)).toBeInTheDocument());
  });
});
