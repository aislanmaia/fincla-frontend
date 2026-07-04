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

  it("todas as abas do relatório (Visão geral, Transações, Cartões, Categorias) estão ativas", () => {
    render(<ConsultantClientReportTabs active="overview" onSelect={() => {}} />);
    expect(screen.getByRole("tab", { name: "Visão geral" })).not.toBeDisabled();
    expect(screen.getByRole("tab", { name: /Transações/ })).not.toBeDisabled();
    expect(screen.getByRole("tab", { name: /Cartões/ })).not.toBeDisabled();
    expect(screen.getByRole("tab", { name: /Categorias/ })).not.toBeDisabled();
    expect(screen.queryByText("em breve")).not.toBeInTheDocument();
  });

  it("clicar numa aba ativa chama onSelect com o id", () => {
    const onSelect = vi.fn();
    render(<ConsultantClientReportTabs active="overview" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("tab", { name: /Transações/ }));
    expect(onSelect).toHaveBeenCalledWith("transactions");
  });

  it("clicar em Categorias chama onSelect com o id", () => {
    const onSelect = vi.fn();
    render(<ConsultantClientReportTabs active="overview" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("tab", { name: /Categorias/ }));
    expect(onSelect).toHaveBeenCalledWith("categories");
  });
});
