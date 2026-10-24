// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HubInvoices } from "../HubInvoices.jsx";

afterEach(cleanup);

const NOW = new Date(2026, 9, 24);
const invoice = (over = {}) => ({
  key: "2026-10", year: 2026, month: 10, status: "closed", total: 1000, itemsCount: 3, isEmpty: false,
  dueDate: "2026-10-05", overdue: false, paidDate: null, vsPercent: null, limitUsagePercent: null, ...over,
});
const setup = (current, { isMobile = false, onMarkPaid = vi.fn() } = {}) => {
  render(<HubInvoices invoices={[current]} currentKey={current.key} cardId={1} currency="BRL" isMobile={isMobile} now={NOW} onNavigate={() => {}} onMarkPaid={onMarkPaid} />);
  return onMarkPaid;
};
const dateButton = () => screen.getByRole("button", { name: /Data do pagamento/ });
const payButton = () => screen.getByRole("button", { name: /marcar como paga/i });

describe("HubInvoices — fatura atual vencida", () => {
  it("oferece 'Já paguei' com o vencimento pré-selecionado, aviso e dica de desfazer", async () => {
    const onMarkPaid = setup(invoice({ overdue: true }));
    expect(payButton()).toHaveTextContent("Já paguei — marcar como paga");
    expect(dateButton()).toHaveAttribute("data-date-value", "2026-10-05");
    expect(screen.getByTestId("paid-outside-notice")).toHaveTextContent("não contar duas vezes");
    expect(screen.getByTestId("paid-outside-notice")).toHaveTextContent("desfazer o pagamento no dashboard da fatura");
    await userEvent.setup().click(payButton());
    expect(onMarkPaid).toHaveBeenCalledWith(expect.objectContaining({ key: "2026-10" }), "2026-10-05");
  });

  it("fatura não vencida segue com o fluxo de sempre, em hoje", () => {
    setup(invoice({ overdue: false }));
    expect(payButton()).toHaveTextContent("Marcar como paga");
    expect(payButton()).not.toHaveTextContent("Já paguei");
    expect(screen.queryByTestId("paid-outside-notice")).toBeNull();
    expect(dateButton()).toHaveAttribute("data-date-value", "2026-10-24");
  });

  it("no mobile também", () => {
    setup(invoice({ overdue: true }), { isMobile: true });
    expect(payButton()).toHaveTextContent("Já paguei");
    expect(screen.getByTestId("paid-outside-notice")).toBeInTheDocument();
  });

  it("a data escolhida pelo usuário sobrevive a uma atualização que muda o vencimento", async () => {
    const user = userEvent.setup();
    const props = { currentKey: "2026-10", cardId: 1, currency: "BRL", isMobile: false, now: NOW, onNavigate: () => {}, onMarkPaid: () => {} };
    const view = render(<HubInvoices {...props} invoices={[invoice({ overdue: true })]} />);
    await user.click(dateButton());
    await user.click(within(screen.getByRole("dialog", { name: "Calendário" })).getByRole("button", { name: "3", exact: true }));
    expect(dateButton()).toHaveAttribute("data-date-value", "2026-10-03");
    view.rerender(<HubInvoices {...props} invoices={[invoice({ overdue: true, dueDate: "2026-10-07" })]} />);
    expect(dateButton()).toHaveAttribute("data-date-value", "2026-10-03");
  });
});
