// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdjustBalanceModal } from "../AdjustBalanceModal.jsx";

afterEach(cleanup);

const account = { id: "acc-1", name: "Conta principal", balance: 200 };

function setup(overrides = {}) {
  const onSubmit = vi.fn();
  const onDeleteAdjustment = vi.fn().mockResolvedValue(undefined);
  const loadAdjustments = vi.fn().mockResolvedValue(overrides.history ?? []);
  const utils = render(
    <AdjustBalanceModal
      account={account}
      onClose={() => {}}
      onSubmit={onSubmit}
      isSaving={false}
      error=""
      loadAdjustments={loadAdjustments}
      onDeleteAdjustment={onDeleteAdjustment}
    />,
  );
  return { ...utils, onSubmit, onDeleteAdjustment, loadAdjustments };
}

/** Render com props extras (ex.: `countCoveredEntries`), sem os espiões do setup. */
function renderModal(props = {}) {
  return render(
    <AdjustBalanceModal
      account={account}
      onClose={() => {}}
      onSubmit={vi.fn()}
      isSaving={false}
      error=""
      loadAdjustments={vi.fn().mockResolvedValue([])}
      onDeleteAdjustment={vi.fn()}
      {...props}
    />,
  );
}

describe("<AdjustBalanceModal>", () => {
  it("mostra saldo atual e calcula o delta a partir do saldo desejado", () => {
    const { getByPlaceholderText, container } = setup();
    expect(container.textContent).toContain("Saldo atual");
    expect(container.textContent).toContain("200,00");
    fireEvent.change(getByPlaceholderText("R$ 0,00"), { target: { value: "150" } });
    // delta = 150 - 200 = -50
    expect(container.textContent).toContain("Ajuste a aplicar");
    expect(container.textContent).toMatch(/-\s?R\$\s?50,00/);
  });

  it("submete amount = desejado − atual, com justificativa e data", () => {
    const { getByPlaceholderText, getByText, onSubmit } = setup();
    fireEvent.change(getByPlaceholderText("R$ 0,00"), { target: { value: "150" } });
    fireEvent.change(getByPlaceholderText(/conciliação/i), { target: { value: "reconc extrato" } });
    fireEvent.click(getByText("Depois"));
    fireEvent.click(getByText("Aplicar ajuste"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.amount).toBe(-50);
    expect(arg.reason).toBe("reconc extrato");
    expect(arg.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("não submete sem justificativa", () => {
    const { getByPlaceholderText, getByText, onSubmit } = setup();
    fireEvent.change(getByPlaceholderText("R$ 0,00"), { target: { value: "150" } });
    fireEvent.click(getByText("Aplicar ajuste"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("aceita reafirmar o MESMO saldo — é como se fixa uma âncora numa data", () => {
    // Antes o delta 0 era rejeitado. No modelo de âncora, "meu saldo neste dia era
    // exatamente este" é uma afirmação legítima e útil: ela passa a cobrir tudo que
    // veio antes, mesmo sem mudar o número.
    const { getByPlaceholderText, getByText, onSubmit } = setup();
    fireEvent.change(getByPlaceholderText("R$ 0,00"), { target: { value: "200" } }); // = saldo atual
    fireEvent.change(getByPlaceholderText(/conciliação/i), { target: { value: "bate com o extrato" } });
    fireEvent.click(getByText("Depois"));
    fireEvent.click(getByText("Aplicar ajuste"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].asserted_balance).toBe(200);
    expect(onSubmit.mock.calls[0][0].amount).toBe(0);
  });

  it("manda o saldo AFIRMADO, não só o delta", () => {
    const { getByPlaceholderText, getByText, onSubmit } = setup();
    fireEvent.change(getByPlaceholderText("R$ 0,00"), { target: { value: "150" } });
    fireEvent.change(getByPlaceholderText(/conciliação/i), { target: { value: "reconc" } });
    fireEvent.click(getByText("Depois"));
    fireEvent.click(getByText("Aplicar ajuste"));
    // O delta foi calculado contra o saldo que ESTA tela exibia (corte "agora"), que
    // não é o saldo da data escolhida — por isso a afirmação vai explícita.
    expect(onSubmit.mock.calls[0][0].asserted_balance).toBe(150);
  });

  it("avisa quantos lançamentos o acerto passa a cobrir", () => {
    const countCoveredEntries = vi.fn(() => ({ count: 3, total: 420 }));
    const { container } = renderModal({ countCoveredEntries });
    expect(container.textContent).toMatch(/3 lançamentos desta conta/);
    expect(container.textContent).toMatch(/não alteram mais o saldo/);
  });

  it("não avisa nada quando o acerto não cobre lançamento nenhum", () => {
    const countCoveredEntries = vi.fn(() => ({ count: 0, total: 0 }));
    const { container } = renderModal({ countCoveredEntries });
    expect(container.textContent).not.toMatch(/passam? a ser cobert/);
  });

  it("carrega e exclui ajustes do histórico", async () => {
    const history = [{ id: "adj-1", amount: -100, date: "2026-05-29", reason: "reconc maio", created_at: "x" }];
    const { findByText, getByLabelText, onDeleteAdjustment } = setup({ history });
    expect(await findByText("reconc maio")).toBeTruthy();
    fireEvent.click(getByLabelText("Excluir ajuste"));
    await waitFor(() => expect(onDeleteAdjustment).toHaveBeenCalledWith("adj-1"));
  });
});

describe("<AdjustBalanceModal> — antes ou depois dos lançamentos do dia", () => {
  it("NÃO pré-seleciona nada e bloqueia o salvar até responder", () => {
    // Sem default de propósito: os dois casos são frequentes em qualquer data e nada
    // no dado os distingue. Chutar produz saldo errado sem nada denunciando.
    const { getByPlaceholderText, getByText, onSubmit } = setup();
    fireEvent.change(getByPlaceholderText("R$ 0,00"), { target: { value: "150" } });
    fireEvent.change(getByPlaceholderText(/conciliação/i), { target: { value: "x" } });

    // `getByText` devolve o <span> interno; o estado está no botão.
    expect(getByText("Depois").closest("button").getAttribute("aria-checked")).toBe("false");
    expect(getByText("Antes").closest("button").getAttribute("aria-checked")).toBe("false");

    fireEvent.click(getByText("Aplicar ajuste"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("manda a resposta escolhida no payload", () => {
    const { getByPlaceholderText, getByText, onSubmit } = setup();
    fireEvent.change(getByPlaceholderText("R$ 0,00"), { target: { value: "150" } });
    fireEvent.change(getByPlaceholderText(/conciliação/i), { target: { value: "x" } });
    fireEvent.click(getByText("Antes"));
    fireEvent.click(getByText("Aplicar ajuste"));

    expect(onSubmit.mock.calls[0][0].includes_same_day).toBe(false);
  });

  it("a explicação do rodapé muda conforme a resposta", () => {
    const { getByPlaceholderText, getByText, container } = setup();
    fireEvent.change(getByPlaceholderText("R$ 0,00"), { target: { value: "150" } });

    fireEvent.click(getByText("Depois"));
    expect(container.textContent).toMatch(/\(inclusive\) para trás/);

    fireEvent.click(getByText("Antes"));
    expect(container.textContent).toMatch(/desse mesmo dia continuam contando/);
  });

  it("mostra a cobertura de cada ajuste na lista e permite trocá-la", async () => {
    const onEditAdjustment = vi.fn().mockResolvedValue(undefined);
    const history = [
      { id: "adj-1", amount: 100, asserted_balance: 100, includes_same_day: true,
        date: "2026-08-13T12:00:00", reason: "conciliação",
        created_at: "2026-08-13T12:00:00", updated_at: "2026-08-13T12:00:00" },
    ];
    const { container, findByLabelText } = renderModal({
      loadAdjustments: vi.fn().mockResolvedValue(history),
      onEditAdjustment,
    });

    // A resposta fica visível na lista: é o que mais se erra e o que muda o saldo.
    expect(await findByLabelText(/Trocar para antes do dia/i)).toBeInTheDocument();
    expect(container.textContent).toMatch(/depois do dia/);

    fireEvent.click(await findByLabelText(/Trocar para antes do dia/i));
    expect(onEditAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({ id: "adj-1" }),
      { includes_same_day: false },
    );
  });

  it("marca ajuste editado, para a mudança não ser invisível", async () => {
    const history = [
      { id: "adj-1", amount: 100, asserted_balance: 100, includes_same_day: false,
        date: "2026-08-13T12:00:00", reason: "conciliação",
        created_at: "2026-08-13T12:00:00", updated_at: "2026-08-15T09:00:00" },
    ];
    const { findByText } = renderModal({
      loadAdjustments: vi.fn().mockResolvedValue(history),
      onEditAdjustment: vi.fn(),
    });
    expect(await findByText(/editado em 15\/08\/2026/)).toBeInTheDocument();
  });
});
