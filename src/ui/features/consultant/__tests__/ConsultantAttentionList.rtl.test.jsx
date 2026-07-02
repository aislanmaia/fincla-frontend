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
      <ConsultantAttentionList clients={[client]} total={1} base={10} hasLoaded />
    );
    expect(screen.getByText("Diego Albuquerque")).toBeInTheDocument();
    expect(screen.getByText(/Gasto maior que a renda/)).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("1 de 10")).toBeInTheDocument();
  });

  it("shows the all-clear empty state when loaded with no clients", () => {
    render(
      <ConsultantAttentionList clients={[]} total={0} base={5} hasLoaded />
    );
    expect(screen.getByText("Tudo sob controle")).toBeInTheDocument();
    expect(screen.getByText("0 alertas")).toBeInTheDocument();
  });

  it("does not show the empty state before load", () => {
    render(<ConsultantAttentionList clients={[]} total={0} base={0} hasLoaded={false} />);
    expect(screen.queryByText("Tudo sob controle")).not.toBeInTheDocument();
  });

  it("shows an error state (not the all-clear) when the fetch failed with no data", () => {
    render(
      <ConsultantAttentionList clients={[]} total={0} base={4} hasLoaded error="boom" />
    );
    expect(screen.getByText("Não foi possível carregar")).toBeInTheDocument();
    // must NOT masquerade as a healthy base
    expect(screen.queryByText("Tudo sob controle")).not.toBeInTheDocument();
    expect(screen.queryByText("0 alertas")).not.toBeInTheDocument();
  });

  it("calls onOpenClient with the org id when 'Abrir' is clicked", () => {
    const onOpenClient = vi.fn();
    render(
      <ConsultantAttentionList clients={[client]} total={1} base={10} hasLoaded onOpenClient={onOpenClient} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(onOpenClient).toHaveBeenCalledWith("org-1");
  });
});
