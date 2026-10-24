// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PayControls } from "../PayControls.jsx";
import { defaultPaidDate } from "../../cardHub/paidOutside.jsx";

afterEach(cleanup);

const NOW = new Date(2026, 9, 24);
const idle = { pending: false, error: "" };
const setup = (props = {}) => render(
  <PayControls status="closed" paidDate={null} mutation={idle} onMarkPaid={() => {}} onUnmarkPaid={() => {}} now={NOW} {...props} />,
);
const dateButton = () => screen.getByRole("button", { name: /Data do pagamento/ });

describe("defaultPaidDate", () => {
  it("usa o vencimento, e hoje quando o vencimento é futuro ou inválido", () => {
    expect(defaultPaidDate("2026-08-10", "2026-10-24")).toBe("2026-08-10");
    expect(defaultPaidDate("2026-10-24", "2026-10-24")).toBe("2026-10-24");
    expect(defaultPaidDate("2026-11-05", "2026-10-24")).toBe("2026-10-24");
    expect(defaultPaidDate(null, "2026-10-24")).toBe("2026-10-24");
  });
});

describe("PayControls — fatura vencida (pagou por fora)", () => {
  it("fatura vencida oferece 'Já paguei', com o vencimento pré-selecionado e o aviso de efeito", () => {
    setup({ overdue: true, dueDate: "2026-08-10" });
    expect(screen.getByTestId("mark-paid")).toHaveTextContent("Já paguei — marcar como paga");
    expect(dateButton()).toHaveAttribute("data-date-value", "2026-08-10");
    const notice = screen.getByTestId("paid-outside-notice");
    expect(notice).toHaveTextContent("nenhum dinheiro é movimentado");
    expect(notice).toHaveTextContent("O valor sai do seu saldo na data escolhida e o limite do cartão é liberado.");
    expect(notice).toHaveTextContent("não marque aqui para não contar duas vezes");
  });

  it("marca com a data do vencimento", async () => {
    const onMarkPaid = vi.fn();
    setup({ overdue: true, dueDate: "2026-08-10", onMarkPaid });
    await userEvent.setup().click(screen.getByTestId("mark-paid"));
    expect(onMarkPaid).toHaveBeenCalledWith("2026-08-10");
  });

  it("fatura não vencida segue como antes: sem 'Já paguei', sem aviso, data de hoje", () => {
    setup({ overdue: false, dueDate: "2026-11-05" });
    expect(screen.getByTestId("mark-paid")).toHaveTextContent("Marcar como paga");
    expect(screen.getByTestId("mark-paid")).not.toHaveTextContent("Já paguei");
    expect(screen.queryByTestId("paid-outside-notice")).toBeNull();
    expect(dateButton()).toHaveAttribute("data-date-value", "2026-10-24");
  });

  it("vencimento futuro nunca vira data futura: cai em hoje", () => {
    setup({ overdue: true, dueDate: "2026-12-01" });
    expect(dateButton()).toHaveAttribute("data-date-value", "2026-10-24");
  });

  it("depois de paga mostra o desfazer já existente, sem aviso", () => {
    setup({ status: "paid", paidDate: "2026-08-10", overdue: false });
    expect(screen.getByTestId("unmark-paid")).toBeInTheDocument();
    expect(screen.queryByTestId("paid-outside-notice")).toBeNull();
  });

  it("no mobile (empilhado) mantém ação, data e aviso", () => {
    setup({ overdue: true, dueDate: "2026-08-10", stacked: true });
    expect(screen.getByTestId("mark-paid")).toHaveTextContent("Já paguei");
    expect(dateButton()).toHaveAttribute("data-date-value", "2026-08-10");
    expect(screen.getByTestId("paid-outside-notice")).toBeInTheDocument();
  });
});
