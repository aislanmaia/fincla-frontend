// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarPage } from "../CalendarPage.jsx";

afterEach(cleanup);

describe("<CalendarPage> v2", () => {
  it("renderiza KPIs, mini-calendário, filtros e grade (mock)", () => {
    const { container } = render(<CalendarPage dataMode="mock" organizationId={null} />);
    const t = container.textContent;
    expect(t).toContain("Calendário");
    expect(t).toContain("Financeiro");
    // KPIs em destaque
    expect(t).toContain("Entradas");
    expect(t).toContain("Saídas");
    expect(t).toContain("Saldo do mês");
    // toggle Semana/Mês
    expect(t).toContain("Semana");
    expect(t).toContain("Mês");
    // filtros + evento mock
    expect(t).toContain("Exibir");
    expect(t).toContain("Forma de pagamento");
    expect(t).toContain("Salário");
  });

  it("clicar numa transação chama onEditTransaction com o id", () => {
    const onEdit = vi.fn();
    const { getAllByText } = render(
      <CalendarPage dataMode="mock" organizationId={null} onEditTransaction={onEdit} />,
    );
    // "Salário" aparece na grade (chip clicável) — clicar dispara edição com id "m1"
    fireEvent.click(getAllByText(/Salário/)[0]);
    expect(onEdit).toHaveBeenCalledWith("m1");
  });
});
