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
