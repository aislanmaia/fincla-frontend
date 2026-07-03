// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsultantClientReportTabs } from "../ConsultantClientReportTabs.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConsultantClientReportTabs", () => {
  it("marca a aba ativa como selecionada", () => {
    render(<ConsultantClientReportTabs active="overview" onSelect={() => {}} />);
    expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute("aria-selected", "true");
  });

  it("abas 'em breve' ficam desabilitadas", () => {
    render(<ConsultantClientReportTabs active="overview" onSelect={() => {}} />);
    expect(screen.getByRole("tab", { name: /Transações/ })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /Cartões/ })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /Categorias/ })).toBeDisabled();
  });

  it("clicar numa aba ativa chama onSelect com o id", () => {
    const onSelect = vi.fn();
    render(<ConsultantClientReportTabs active="overview" onSelect={onSelect} />);
    // A aba ativa também dispara onSelect ao clicar (idempotente); usa a única aba habilitada
    fireEvent.click(screen.getByRole("tab", { name: "Visão geral" }));
    expect(onSelect).toHaveBeenCalledWith("overview");
  });

  it("clicar numa aba 'em breve' não chama onSelect", () => {
    const onSelect = vi.fn();
    render(<ConsultantClientReportTabs active="overview" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("tab", { name: /Transações/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
