/** @vitest-environment jsdom */

import React, { useState } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CardFormSheet } from "./CardFormSheet.jsx";
import { APPLY_FROM, applyFromToSend, cycleDaysChanged } from "./CycleChangeOptions.jsx";

afterEach(cleanup);

const ORIGINAL = { dueDay: 5, closingDay: 25 };

function EditHarness({ onUpdate = () => {}, scheduled = null }) {
  const [dueDay, setDueDay] = useState("5");
  const [closingDay, setClosingDay] = useState("25");
  const [applyFrom, setApplyFrom] = useState(APPLY_FROM.NEXT);
  const [confirmRewrite, setConfirmRewrite] = useState(false);
  return (
    <>
      <output data-testid="apply-from">{applyFrom}</output>
      <CardFormSheet
        open
        isMobile={false}
        isEdit
        draftIssuer="Itaú"
        setDraftIssuer={() => {}}
        draftName="Personnalité"
        setDraftName={() => {}}
        draftLast4="1234"
        setDraftLast4={() => {}}
        draftBrand="Visa"
        setDraftBrand={() => {}}
        draftLimit="5000"
        setDraftLimit={() => {}}
        draftDueDay={dueDay}
        setDraftDueDay={setDueDay}
        draftClosingDay={closingDay}
        setDraftClosingDay={setClosingDay}
        draftSuccess={false}
        saving={false}
        error=""
        onSave={() => {}}
        onUpdate={onUpdate}
        onCancel={() => {}}
        cycleChange={{ original: ORIGINAL, scheduled, applyFrom, setApplyFrom, confirmRewrite, setConfirmRewrite }}
      />
    </>
  );
}

async function changeDueDay(user, value) {
  const input = screen.getByPlaceholderText("ex: 10");
  await user.clear(input);
  await user.type(input, value);
}

describe("CardFormSheet — desde quando os novos dias valem", () => {
  it("não pergunta nada enquanto os dias não mudam", () => {
    render(<EditHarness />);

    expect(screen.queryByText("Os novos dias valem")).toBeNull();
  });

  it("ao mudar o vencimento, oferece as 3 opções com 'a partir da próxima fatura' pré-selecionada", async () => {
    const user = userEvent.setup();
    render(<EditHarness />);

    await changeDueDay(user, "10");

    expect(screen.getByRole("radio", { name: /A partir da próxima fatura/ }).checked).toBe(true);
    expect(screen.getByRole("radio", { name: /A partir da fatura aberta/ }).checked).toBe(false);
    expect(screen.getByRole("radio", { name: /Corrigir todo o histórico/ }).checked).toBe(false);
  });

  it("voltar ao dia original some com as opções", async () => {
    const user = userEvent.setup();
    render(<EditHarness />);

    await changeDueDay(user, "10");
    await changeDueDay(user, "5");

    expect(screen.queryByText("Os novos dias valem")).toBeNull();
  });

  it("corrigir o histórico avisa e só libera salvar depois da confirmação", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<EditHarness onUpdate={onUpdate} />);
    await changeDueDay(user, "10");

    await user.click(screen.getByRole("radio", { name: /Corrigir todo o histórico/ }));

    expect(screen.getByRole("alert").textContent).toMatch(/faturas já pagas/);
    const save = screen.getByRole("button", { name: /Salvar alterações/ });
    expect(save.disabled).toBe(true);

    await user.click(screen.getByRole("checkbox"));
    expect(save.disabled).toBe(false);
    await user.click(save);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("trocar de opção desfaz a confirmação", async () => {
    const user = userEvent.setup();
    render(<EditHarness />);
    await changeDueDay(user, "10");

    await user.click(screen.getByRole("radio", { name: /Corrigir todo o histórico/ }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("radio", { name: /A partir da fatura aberta/ }));
    await user.click(screen.getByRole("radio", { name: /Corrigir todo o histórico/ }));

    expect(screen.getByRole("checkbox").checked).toBe(false);
    expect(screen.getByRole("button", { name: /Salvar alterações/ }).disabled).toBe(true);
  });

  it("mostra a mudança já agendada", () => {
    render(<EditHarness scheduled={{ year: 2026, month: 12, dueDay: 10, closingDay: 3 }} />);

    expect(screen.getByText(/a partir da fatura de dez\/2026, vence dia 10 e fecha dia 3/)).toBeTruthy();
  });
});

describe("quando os dias contam como mudança", () => {
  it("um campo em branco ou inválido não é mudança", () => {
    expect(cycleDaysChanged(ORIGINAL, "", "25")).toBe(false);
    expect(cycleDaysChanged(ORIGINAL, "5", " ")).toBe(false);
    expect(cycleDaysChanged(ORIGINAL, "32", "25")).toBe(false);
    expect(cycleDaysChanged(ORIGINAL, "10", "25")).toBe(true);
  });

  it("limpar o campo para digitar outro valor não abre as opções", async () => {
    const user = userEvent.setup();
    render(<EditHarness />);

    await user.clear(screen.getByPlaceholderText("ex: 10"));

    expect(screen.queryByText("Os novos dias valem")).toBeNull();
  });

  it("voltar aos dias originais descarta a confirmação anterior", async () => {
    const user = userEvent.setup();
    render(<EditHarness />);
    await changeDueDay(user, "10");
    await user.click(screen.getByRole("radio", { name: /Corrigir todo o histórico/ }));
    await user.click(screen.getByRole("checkbox"));

    await changeDueDay(user, "5");
    await changeDueDay(user, "12");

    expect(screen.getByTestId("apply-from").textContent).toBe(APPLY_FROM.NEXT);
    expect(screen.getByRole("radio", { name: /A partir da próxima fatura/ }).checked).toBe(true);
  });
});

describe("applyFromToSend", () => {
  it("não manda nada quando os dias não mudaram", () => {
    expect(applyFromToSend(ORIGINAL, "5", "25", APPLY_FROM.OPEN, false)).toBeUndefined();
  });

  it("manda a escolha quando os dias mudaram", () => {
    expect(applyFromToSend(ORIGINAL, "10", "25", APPLY_FROM.OPEN, false)).toBe(APPLY_FROM.OPEN);
  });

  it("nunca manda a reescrita do histórico sem confirmação", () => {
    expect(applyFromToSend(ORIGINAL, "10", "25", APPLY_FROM.ALL, false)).toBe(APPLY_FROM.NEXT);
    expect(applyFromToSend(ORIGINAL, "10", "25", APPLY_FROM.ALL, true)).toBe(APPLY_FROM.ALL);
  });
});
