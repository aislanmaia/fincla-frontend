// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsultantSidebar } from "../ConsultantSidebar.jsx";

afterEach(cleanup);

const user = { first_name: "Helena", last_name: "Castro", email: "helena@x.com" };

describe("<ConsultantSidebar>", () => {
  it("renderiza marca, seções e itens de navegação", () => {
    render(<ConsultantSidebar pathname="/consultant" onNav={vi.fn()} user={user} />);
    expect(screen.getByText("Consultor")).toBeInTheDocument();
    for (const sec of ["PRINCIPAL", "ANÁLISE", "RELACIONAMENTO", "INTELIGÊNCIA", "CONTA"]) {
      expect(screen.getByText(sec)).toBeInTheDocument();
    }
    for (const label of ["Painel da base", "Clientes", "Insights", "Mensagens", "Copiloto IA", "Perfil"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("clicar num item navegável chama onNav com a rota", () => {
    const onNav = vi.fn();
    render(<ConsultantSidebar pathname="/consultant" onNav={onNav} user={user} />);
    screen.getByRole("button", { name: /clientes/i }).click();
    expect(onNav).toHaveBeenCalledWith("/consultant/clients");
  });

  it("Mensagens e Copiloto IA aparecem como 'em breve', desabilitados e não navegam", () => {
    const onNav = vi.fn();
    render(<ConsultantSidebar pathname="/consultant" onNav={onNav} user={user} />);
    expect(screen.getAllByText(/em breve/i).length).toBeGreaterThanOrEqual(2);

    const mensagens = screen.getByRole("button", { name: /mensagens/i });
    const copiloto = screen.getByRole("button", { name: /copiloto ia/i });
    expect(mensagens).toBeDisabled();
    expect(copiloto).toBeDisabled();
    mensagens.click();
    copiloto.click();
    expect(onNav).not.toHaveBeenCalled();
  });

  it("destaca o item ativo conforme a rota atual (aria-current)", () => {
    render(<ConsultantSidebar pathname="/consultant/clients" onNav={vi.fn()} user={user} />);
    expect(screen.getByRole("button", { name: /clientes/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /painel da base/i })).not.toHaveAttribute("aria-current");
  });

  it("mostra nome e iniciais do consultor no rodapé", () => {
    render(<ConsultantSidebar pathname="/consultant" onNav={vi.fn()} user={user} />);
    expect(screen.getByText("Helena Castro")).toBeInTheDocument();
    expect(screen.getByText("HC")).toBeInTheDocument();
  });
});
