/** @vitest-environment jsdom */

import React, { useState } from "react";
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CardFormSheet } from "./CardFormSheet.jsx";

afterEach(cleanup);

/**
 * O sheet é controlado: o pai guarda os rascunhos. Este harness reproduz
 * exatamente o ciclo "digitou → setState no pai → re-render do sheet",
 * que é onde o input perdia o foco a cada caractere.
 */
function Harness() {
  const [issuer, setIssuer] = useState("");
  const [name, setName] = useState("");
  const [last4, setLast4] = useState("");
  const [limit, setLimit] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [closingDay, setClosingDay] = useState("");
  return (
    <CardFormSheet
      open
      isMobile={false}
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
      onCancel={() => {}}
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
});
