/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditCardDialog } from "../EditCardDialog.jsx";

const card = { id: 7, brand: "Visa", description: "Azul", last4: "7112", credit_limit: 5000, due_day: 10, closing_day: 3, color: null };

function setup(overrides = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<EditCardDialog card={{ ...card, ...overrides }} organizationId="org" isMobile={false} onSave={onSave} onClose={() => {}} />);
  return { onSave, save: () => screen.getByRole("button", { name: /Salvar/ }) };
}

afterEach(cleanup);

describe("EditCardDialog — o fechamento é obrigatório", () => {
  it("salva com o fechamento atual", async () => {
    const { onSave, save } = setup();
    expect(save()).toBeEnabled();
    await userEvent.setup().click(save());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ closing_day: 3 }));
  });

  it("não deixa salvar com o fechamento vazio e sugere 7 dias antes do vencimento", async () => {
    const user = userEvent.setup();
    const { save } = setup();
    await user.clear(screen.getAllByLabelText("Dia do fechamento")[0]);
    expect(save()).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Usar dia 3/ }));
    expect(screen.getAllByLabelText("Dia do fechamento")[0]).toHaveValue("3");
    expect(save()).toBeEnabled();
  });
});

describe("EditCardDialog — desde quando os novos dias valem", () => {
  it("manda apply_from escolhido quando o vencimento muda, com a próxima fatura pré-selecionada", async () => {
    const user = userEvent.setup();
    const { onSave, save } = setup();
    const due = screen.getAllByLabelText("Dia do vencimento")[0];
    await user.clear(due);
    await user.type(due, "15");

    expect(screen.getByRole("radio", { name: /A partir da próxima fatura/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /A partir da fatura aberta/ }));
    await user.click(save());

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ due_day: 15, apply_from: "open_invoice" }));
  });

  it("não manda apply_from quando os dias não mudam", async () => {
    const { onSave, save } = setup();
    await userEvent.setup().click(save());

    expect(onSave.mock.calls[0][0]).not.toHaveProperty("apply_from");
  });

  it("corrigir o histórico só salva depois da confirmação", async () => {
    const user = userEvent.setup();
    const { onSave, save } = setup();
    const due = screen.getAllByLabelText("Dia do vencimento")[0];
    await user.clear(due);
    await user.type(due, "15");

    await user.click(screen.getByRole("radio", { name: /Corrigir todo o histórico/ }));
    expect(save()).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(save());

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ apply_from: "all_history" }));
  });
});

describe("EditCardDialog — cancelar a mudança agendada", () => {
  const withSchedule = {
    due_day: 10, closing_day: 3,
    cycle_rules: [
      { effective_year: 1900, effective_month: 1, due_day: 10, closing_day: 3 },
      { effective_year: 2099, effective_month: 3, due_day: 20, closing_day: 13 },
    ],
  };

  it("oferece cancelar quando há mudança agendada e chama o handler do hub", async () => {
    const onCancelScheduled = vi.fn().mockResolvedValue(undefined);
    render(<EditCardDialog card={{ ...card, ...withSchedule }} organizationId="org" isMobile={false} onSave={vi.fn()} onCancelScheduled={onCancelScheduled} onClose={() => {}} />);

    expect(screen.getByText(/a partir da fatura de mar\/2099, vence dia 20 e fecha dia 13/)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: /Cancelar mudança agendada/ }));

    expect(onCancelScheduled).toHaveBeenCalledTimes(1);
  });

  it("sem mudança agendada não há o que cancelar", () => {
    render(<EditCardDialog card={card} organizationId="org" isMobile={false} onSave={vi.fn()} onCancelScheduled={vi.fn()} onClose={() => {}} />);

    expect(screen.queryByRole("button", { name: /Cancelar mudança agendada/ })).toBeNull();
  });
});
