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

  it("abas ativas (Visão geral, Transações) não ficam desabilitadas; as 'em breve' ficam", () => {
    render(<ConsultantClientReportTabs active="overview" onSelect={() => {}} />);
    expect(screen.getByRole("tab", { name: "Visão geral" })).not.toBeDisabled();
    expect(screen.getByRole("tab", { name: /Transações/ })).not.toBeDisabled();
    expect(screen.getByRole("tab", { name: /Cartões/ })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /Categorias/ })).toBeDisabled();
  });

  it("clicar numa aba ativa chama onSelect com o id", () => {
    const onSelect = vi.fn();
    render(<ConsultantClientReportTabs active="overview" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("tab", { name: /Transações/ }));
    expect(onSelect).toHaveBeenCalledWith("transactions");
  });

  it("clicar numa aba 'em breve' não chama onSelect", () => {
    const onSelect = vi.fn();
    render(<ConsultantClientReportTabs active="overview" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("tab", { name: /Cartões/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
