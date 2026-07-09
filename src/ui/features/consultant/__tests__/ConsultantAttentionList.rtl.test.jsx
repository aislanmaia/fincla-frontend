// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsultantAttentionList } from "../ConsultantAttentionList.jsx";

afterEach(cleanup);

const client = {
  organization_id: "org-1",
  organization_name: "Org 1",
  client_name: "Diego Albuquerque",
  main_situation: "Gasto maior que a renda",
  current_balance: -1200,
  risk_score: 88,
};

describe("<ConsultantAttentionList>", () => {
  it("lists at-risk clients with situation, count, and a disabled 'Avaliar' when no handler is given", () => {
    render(<ConsultantAttentionList clients={[client]} total={1} base={10} loadedOk />);
    expect(screen.getByText("Diego Albuquerque")).toBeInTheDocument();
    expect(screen.getByText(/Gasto maior que a renda/)).toBeInTheDocument();
    expect(screen.getByText("1 de 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Avaliar/ })).toBeDisabled();
  });

  it("fires onEvaluate for the client when the handler is provided", () => {
    const onEvaluate = vi.fn();
    const onOpenClient = vi.fn();
    render(
      <ConsultantAttentionList clients={[client]} total={1} base={10} loadedOk
        onEvaluate={onEvaluate} onOpenClient={onOpenClient} />
    );
    const avaliar = screen.getByRole("button", { name: /Avaliar/ });
    expect(avaliar).toBeEnabled();
    fireEvent.click(avaliar);
    expect(onEvaluate).toHaveBeenCalledWith(client);
    expect(onOpenClient).not.toHaveBeenCalled();
  });

  it("shows the all-clear empty state when loaded ok with no clients", () => {
    render(<ConsultantAttentionList clients={[]} total={0} base={5} loadedOk />);
    expect(screen.getByText("Tudo sob controle")).toBeInTheDocument();
    expect(screen.getByText("0 alertas")).toBeInTheDocument();
  });

  it("shows a loading state before the first successful load", () => {
    render(<ConsultantAttentionList clients={[]} total={0} base={0} loadedOk={false} />);
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
    expect(screen.queryByText("Tudo sob controle")).not.toBeInTheDocument();
    expect(screen.queryByText("0 alertas")).not.toBeInTheDocument();
  });

  it("shows an error state (not the all-clear) when the first fetch failed", () => {
    render(<ConsultantAttentionList clients={[]} total={0} base={4} loadedOk={false} error="boom" />);
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    expect(screen.queryByText("Tudo sob controle")).not.toBeInTheDocument();
  });

  it("keeps the all-clear on a transient refetch error over a healthy empty base", () => {
    render(<ConsultantAttentionList clients={[]} total={0} base={5} loadedOk error="blip" />);
    expect(screen.getByText("Tudo sob controle")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar")).not.toBeInTheDocument();
  });

  it("opens the client report from the 'Abrir relatório' action", () => {
    const onOpenClient = vi.fn();
    render(<ConsultantAttentionList clients={[client]} total={1} base={10} loadedOk onOpenClient={onOpenClient} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir relatório" }));
    expect(onOpenClient).toHaveBeenCalledWith("org-1");
  });

  it("calls onViewAll from the footer 'Ver todos os clientes'", () => {
    const onViewAll = vi.fn();
    render(<ConsultantAttentionList clients={[client]} total={1} base={10} loadedOk onViewAll={onViewAll} />);
    fireEvent.click(screen.getByRole("button", { name: /Ver todos os clientes/ }));
    expect(onViewAll).toHaveBeenCalled();
  });
});
