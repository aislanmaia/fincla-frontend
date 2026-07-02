// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsultantClientActionsMenu } from "../ConsultantClientActionsMenu.jsx";

afterEach(() => cleanup());

describe("ConsultantClientActionsMenu", () => {
  it("abre o menu no clique do kebab e lista as 3 ações", () => {
    render(<ConsultantClientActionsMenu organizationId="org-1" clientName="Ana" onOpen={vi.fn()} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ações de Ana" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Abrir relatório")).toBeInTheDocument();
    expect(within(menu).getByText("Avaliar com IA")).toBeInTheDocument();
    expect(within(menu).getByText("Enviar mensagem")).toBeInTheDocument();
  });

  it("'Abrir relatório' chama onOpen(organizationId) e fecha o menu", () => {
    const onOpen = vi.fn();
    render(<ConsultantClientActionsMenu organizationId="org-42" clientName="Ana" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Ações de Ana" }));

    fireEvent.click(screen.getByRole("menuitem", { name: /Abrir relatório/ }));
    expect(onOpen).toHaveBeenCalledWith("org-42");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("'Avaliar com IA' e 'Enviar mensagem' estão desabilitadas (em breve) e não agem", () => {
    const onOpen = vi.fn();
    render(<ConsultantClientActionsMenu organizationId="org-1" clientName="Ana" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Ações de Ana" }));

    const evaluate = screen.getByRole("menuitem", { name: /Avaliar com IA/ });
    const message = screen.getByRole("menuitem", { name: /Enviar mensagem/ });
    expect(evaluate).toBeDisabled();
    expect(message).toBeDisabled();
    fireEvent.click(evaluate);
    fireEvent.click(message);
    expect(onOpen).not.toHaveBeenCalled();
    // menu permanece aberto (ações desabilitadas não fazem nada)
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("fecha ao clicar de novo no kebab (toggle)", () => {
    render(<ConsultantClientActionsMenu organizationId="org-1" onOpen={vi.fn()} />);
    const kebab = screen.getByRole("button", { name: "Ações do cliente" });
    fireEvent.click(kebab);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(kebab);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
