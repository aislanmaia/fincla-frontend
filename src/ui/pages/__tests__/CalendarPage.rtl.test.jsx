// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { navigateMock, searchMock } = vi.hoisted(() => ({ navigateMock: vi.fn(), searchMock: { value: {} } }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useSearch: () => searchMock.value,
}));

import { CalendarPage } from "../CalendarPage.jsx";

afterEach(() => {
  cleanup();
  navigateMock.mockClear();
  searchMock.value = {};
});

describe("<CalendarPage> v2 (URL-driven)", () => {
  it("renderiza KPIs, mini-calendário, filtros e grade (mock)", () => {
    const { container } = render(<CalendarPage dataMode="mock" organizationId={null} />);
    const t = container.textContent;
    expect(t).toContain("Calendário");
    expect(t).toContain("Financeiro");
    expect(t).toContain("Entradas");
    expect(t).toContain("Saídas");
    expect(t).toContain("Saldo do mês");
    expect(t).toContain("Semana");
    expect(t).toContain("Exibir");
    expect(t).toContain("Salário");
  });

  it("clicar numa transação navega para abrir o Painel (fc_tx + fc_modal)", () => {
    const { getAllByText } = render(<CalendarPage dataMode="mock" organizationId={null} />);
    fireEvent.click(getAllByText(/Salário/)[0]);
    expect(navigateMock).toHaveBeenCalled();
    const arg = navigateMock.mock.calls[0][0];
    const next = typeof arg.search === "function" ? arg.search({}) : arg.search;
    expect(next.fc_tx).toBe("m1");
    expect(next.fc_modal).toBe("new-transaction");
  });

  it("clicar no mês muda a URL (fc_cal_m) via replace", () => {
    const { getAllByLabelText } = render(<CalendarPage dataMode="mock" organizationId={null} />);
    fireEvent.click(getAllByLabelText("Próximo mês")[0]);
    expect(navigateMock).toHaveBeenCalled();
    const call = navigateMock.mock.calls.find((c) => c[0]?.replace);
    expect(call).toBeTruthy();
    const next = call[0].search({});
    expect(next.fc_cal_m).toMatch(/^\d{4}-\d{2}$/);
  });
});
