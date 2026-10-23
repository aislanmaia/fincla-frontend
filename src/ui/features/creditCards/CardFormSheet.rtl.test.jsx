/** @vitest-environment jsdom */

import React, { useState } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CardFormSheet } from "./CardFormSheet.jsx";

afterEach(cleanup);

/**
 * O sheet é controlado: o pai guarda os rascunhos. Este harness reproduz
 * exatamente o ciclo "digitou → setState no pai → re-render do sheet",
 * que é onde o input perdia o foco a cada caractere.
 */
function Harness({ onCancel = () => {}, isMobile = false }) {
  const [issuer, setIssuer] = useState("");
  const [name, setName] = useState("");
  const [last4, setLast4] = useState("");
  const [limit, setLimit] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [closingDay, setClosingDay] = useState("");
  return (
    <CardFormSheet
      open
      isMobile={isMobile}
      isEdit={false}
      draftIssuer={issuer}
      setDraftIssuer={setIssuer}
      draftName={name}
      setDraftName={setName}
      draftLast4={last4}
      setDraftLast4={setLast4}
      draftBrand=""
      setDraftBrand={() => {}}
      draftLimit={limit}
      setDraftLimit={setLimit}
      draftDueDay={dueDay}
      setDraftDueDay={setDueDay}
      draftClosingDay={closingDay}
      setDraftClosingDay={setClosingDay}
      draftSuccess={false}
      saving={false}
      error=""
      onSave={() => {}}
      onUpdate={() => {}}
      onCancel={onCancel}
    />
  );
}

describe("CardFormSheet — foco nos campos", () => {
  it("mantem o foco no campo de nome ao digitar varios caracteres", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByPlaceholderText(/Nubank Roxinho/i);
    await user.click(input);
    await user.keyboard("Nubank");

    const after = screen.getByPlaceholderText(/Nubank Roxinho/i);
    expect(after.value).toBe("Nubank");
    expect(document.activeElement).toBe(after);
  });

  it("mantem o foco no campo de 4 digitos ao digitar", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByPlaceholderText("1234");
    await user.click(input);
    await user.keyboard("4321");

    const after = screen.getByPlaceholderText("1234");
    expect(after.value).toBe("4321");
    expect(document.activeElement).toBe(after);
  });

  it("aceita apenas digitos e no maximo 4 no campo de 4 digitos", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByPlaceholderText("1234");
    await user.click(input);
    await user.keyboard("12a34567");

    expect(screen.getByPlaceholderText("1234").value).toBe("1234");
  });

  it("so libera salvar com os 4 digitos completos", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText(/Nubank, Itaú/i), "Nubank");
    await user.type(screen.getByPlaceholderText(/Nubank Roxinho/i), "Roxinho");
    await user.type(screen.getByPlaceholderText("0,00"), "5000");
    await user.type(screen.getByPlaceholderText("ex: 10"), "10");
    await user.type(screen.getByPlaceholderText("ex: 3"), "3");

    const salvar = screen.getByRole("button", { name: /Salvar|Adicionar cartão/i });
    await user.type(screen.getByPlaceholderText("1234"), "123");
    expect(salvar.disabled).toBe(true);

    await user.type(screen.getByPlaceholderText("1234"), "4");
    expect(screen.getByRole("button", { name: /Salvar|Adicionar cartão/i }).disabled).toBe(false);
  });

  it("exige o dia de fechamento e oferece a sugestão (7 dias antes do vencimento) em um toque", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByPlaceholderText(/Nubank, Itaú/i), "Nubank");
    await user.type(screen.getByPlaceholderText(/Nubank Roxinho/i), "Roxinho");
    await user.type(screen.getByPlaceholderText("0,00"), "5000");
    await user.type(screen.getByPlaceholderText("1234"), "1234");
    await user.type(screen.getByPlaceholderText("ex: 10"), "10");

    expect(screen.getByRole("button", { name: /Salvar|Adicionar cartão/i }).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: /Usar dia 3/ }));
    expect(screen.getByPlaceholderText("ex: 3").value).toBe("3");
    expect(screen.getByRole("button", { name: /Salvar|Adicionar cartão/i }).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /Usar dia/ })).not.toBeInTheDocument();
  });
});

describe("CardFormSheet — diálogo", () => {
  it.each([[false], [true]])("é um diálogo nomeado, com botão de fechar acessível (mobile=%s)", (isMobile) => {
    render(<Harness isMobile={isMobile} />);
    expect(screen.getByRole("dialog", { name: "Adicionar cartão" })).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
  });

  it("fecha com Esc, como os demais diálogos do app", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<Harness onCancel={onCancel} />);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("marca com asterisco todo campo que bloqueia o botão de salvar", () => {
    render(<Harness />);
    for (const label of ["Banco / Emissor", "Nome do cartão", "4 últimos dígitos", "Limite total", "Dia do vencimento", "Dia do fechamento"]) {
      expect(screen.getByText(new RegExp(`^${label} \\*$`))).toBeInTheDocument();
    }
  });
});
