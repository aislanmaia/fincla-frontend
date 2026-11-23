// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("convite da primeira senha → fala em criar, não em redefinir (#342)", async () => {
    const onValidateToken = vi.fn().mockResolvedValue({ valid: true, first_password: true });
    render(<PasswordResetPage token="invite" onValidateToken={onValidateToken} onResetPassword={vi.fn()} onComplete={vi.fn()} />);
    expect(await screen.findByText("Crie sua senha")).toBeInTheDocument();
    expect(screen.getByText("Criar senha")).toBeInTheDocument();
    expect(screen.queryByText(/nova senha/i)).not.toBeInTheDocument();
  });
});

describe("<PasswordResetPage> link vencido: pedir um novo ali mesmo", () => {
  const expired = (props = {}) => render(
    <PasswordResetPage token="old" onValidateToken={vi.fn().mockResolvedValue({ valid: false })} onResetPassword={vi.fn()} onComplete={vi.fn()} {...props} />,
  );

  it("pede o e-mail e envia o novo link sem passar pelo login", async () => {
    const onRequestNewLink = vi.fn().mockResolvedValue(undefined);
    expired({ onRequestNewLink });
    expect(await screen.findByText("Link inválido ou expirado")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: " lead@exemplo.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar novo link" }));
    expect(await screen.findByText(/Se lead@exemplo.com tiver conta no Fincla, enviamos um novo link/)).toBeInTheDocument();
    expect(screen.getByText("Enviamos um novo link")).toBeInTheDocument();
    expect(onRequestNewLink).toHaveBeenCalledWith("lead@exemplo.com");
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para o login" })).toBeInTheDocument();
  });

  it("e-mail inválido não chama a API", async () => {
    const onRequestNewLink = vi.fn();
    expired({ onRequestNewLink });
    fireEvent.click(await screen.findByRole("button", { name: "Enviar novo link" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o e-mail da sua conta.");
    expect(onRequestNewLink).not.toHaveBeenCalled();
  });

  it("falha no envio mantém o formulário com a mensagem de erro", async () => {
    const onRequestNewLink = vi.fn().mockRejectedValue(new Error("Muitas tentativas. Aguarde um minuto."));
    expired({ onRequestNewLink });
    fireEvent.change(await screen.findByLabelText("E-mail"), { target: { value: "lead@exemplo.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar novo link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Muitas tentativas. Aguarde um minuto.");
    expect(screen.getByRole("button", { name: "Enviar novo link" })).toBeEnabled();
  });

  it("sem como pedir (painel admin) continua só com 'Ir para o login'", async () => {
    expired();
    expect(await screen.findByText(/Peça um novo link e tente novamente/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar novo link" })).not.toBeInTheDocument();
  });

  it("Enter repetido durante o envio não manda um segundo link (revisão #348)", async () => {
    let resolve;
    const onRequestNewLink = vi.fn(() => new Promise((r) => { resolve = r; }));
    expired({ onRequestNewLink });
    const input = await screen.findByLabelText("E-mail");
    fireEvent.change(input, { target: { value: "lead@exemplo.com" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /Enviando/ }));
    expect(onRequestNewLink).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Ir para o login" })).toBeDisabled();
    resolve();
    expect(await screen.findByText("Enviamos um novo link")).toBeInTheDocument();
  });

  it("depois de enviar dá para corrigir o e-mail e pedir de novo", async () => {
    const onRequestNewLink = vi.fn().mockResolvedValue(undefined);
    expired({ onRequestNewLink });
    fireEvent.change(await screen.findByLabelText("E-mail"), { target: { value: "lead@exemplo.con" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar novo link" }));
    fireEvent.click(await screen.findByRole("button", { name: "Usar outro e-mail" }));
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "lead@exemplo.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar novo link" }));
    await waitFor(() => expect(onRequestNewLink).toHaveBeenLastCalledWith("lead@exemplo.com"));
    expect(onRequestNewLink).toHaveBeenCalledTimes(2);
  });
});
