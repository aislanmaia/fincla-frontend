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
  last_invoice_status: "overdue",
  risk_score: 88,
};

describe("<ConsultantAttentionList>", () => {
  it("lists at-risk clients with situation and count", () => {
    render(
      <ConsultantAttentionList clients={[client]} total={1} base={10} loadedOk />
    );
    expect(screen.getByText("Diego Albuquerque")).toBeInTheDocument();
    expect(screen.getByText(/Gasto maior que a renda/)).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("1 de 10")).toBeInTheDocument();
  });

  it("shows the all-clear empty state when loaded ok with no clients", () => {
    render(<ConsultantAttentionList clients={[]} total={0} base={5} loadedOk />);
    expect(screen.getByText("Tudo sob controle")).toBeInTheDocument();
    expect(screen.getByText("0 alertas")).toBeInTheDocument();
  });

  it("shows a loading state before the first successful load", () => {
    render(<ConsultantAttentionList clients={[]} total={0} base={0} loadedOk={false} />);
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
    // no scary red 0 badge, no false all-clear
    expect(screen.queryByText("Tudo sob controle")).not.toBeInTheDocument();
    expect(screen.queryByText("0 alertas")).not.toBeInTheDocument();
  });

  it("shows an error state (not the all-clear) when the first fetch failed", () => {
    render(
      <ConsultantAttentionList clients={[]} total={0} base={4} loadedOk={false} error="boom" />
    );
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    expect(screen.queryByText("Tudo sob controle")).not.toBeInTheDocument();
    expect(screen.queryByText("0 alertas")).not.toBeInTheDocument();
  });

  it("keeps the all-clear on a transient refetch error over a healthy empty base", () => {
    // loadedOk stayed true from a prior success; a later error must NOT flip it.
    render(
      <ConsultantAttentionList clients={[]} total={0} base={5} loadedOk error="blip" />
    );
    expect(screen.getByText("Tudo sob controle")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar")).not.toBeInTheDocument();
  });

  it("calls onOpenClient with the org id when 'Abrir' is clicked", () => {
    const onOpenClient = vi.fn();
    render(
      <ConsultantAttentionList clients={[client]} total={1} base={10} loadedOk onOpenClient={onOpenClient} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(onOpenClient).toHaveBeenCalledWith("org-1");
  });
});
