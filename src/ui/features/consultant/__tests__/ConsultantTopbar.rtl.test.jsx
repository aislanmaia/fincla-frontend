// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsultantTopbar } from "../ConsultantTopbar.jsx";

afterEach(cleanup);

const user = { first_name: "Helena", last_name: "Castro", email: "helena@x.com" };

describe("<ConsultantTopbar>", () => {
  it("renderiza a busca com atalho ⌘K (stub)", () => {
    render(<ConsultantTopbar isMobile={false} onNav={vi.fn()} onAddClient={vi.fn()} user={user} />);
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("'Adicionar cliente' (stub) dispara onAddClient", () => {
    const onAddClient = vi.fn();
    render(<ConsultantTopbar isMobile={false} onNav={vi.fn()} onAddClient={onAddClient} user={user} />);
    screen.getByRole("button", { name: /adicionar cliente/i }).click();
    expect(onAddClient).toHaveBeenCalledTimes(1);
  });

  it("'Perguntar à IA' aparece como 'em breve' e desabilitado (IA é Trilha B)", () => {
    render(<ConsultantTopbar isMobile={false} onNav={vi.fn()} onAddClient={vi.fn()} user={user} />);
    const ia = screen.getByRole("button", { name: /perguntar à ia/i });
    expect(ia).toBeDisabled();
    expect(screen.getByText(/em breve/i)).toBeInTheDocument();
  });

  it("clicar no avatar navega para o perfil do consultor", () => {
    const onNav = vi.fn();
    render(<ConsultantTopbar isMobile={false} onNav={onNav} onAddClient={vi.fn()} user={user} />);
    screen.getByRole("button", { name: /conta de helena castro/i }).click();
    expect(onNav).toHaveBeenCalledWith("/consultant/profile");
  });

  it("no mobile, mostra o botão de menu e dispara onOpenMenu", () => {
    const onOpenMenu = vi.fn();
    render(
      <ConsultantTopbar isMobile onOpenMenu={onOpenMenu} onNav={vi.fn()} onAddClient={vi.fn()} user={user} />,
    );
    screen.getByRole("button", { name: /abrir menu/i }).click();
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });
});
