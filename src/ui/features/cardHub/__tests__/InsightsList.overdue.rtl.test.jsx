// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { InsightsList } from "../InsightsList.jsx";

afterEach(cleanup);

describe("InsightsList — fatura vencida", () => {
  it("mostra a ação 'Já paguei' e leva à fatura ao tocar", async () => {
    const onOpen = vi.fn();
    render(<InsightsList onOpen={onOpen} insights={[{ type: "overdue_invoices", message: "Você tem 1 fatura vencida — R$ 10,00", href: "/cards/x/invoices/2026/8", actionLabel: "Já paguei — marcar como paga" }]} />);
    expect(screen.getByTestId("insight-action")).toHaveTextContent("Já paguei — marcar como paga");
    await userEvent.setup().click(screen.getByTestId("insight-overdue_invoices"));
    expect(onOpen).toHaveBeenCalledWith("/cards/x/invoices/2026/8");
  });

  it("insight sem ação não mostra o chamado", () => {
    render(<InsightsList onOpen={() => {}} insights={[{ type: "limit_warning", message: "Limite alto", href: null }]} />);
    expect(screen.queryByTestId("insight-action")).toBeNull();
  });
});
