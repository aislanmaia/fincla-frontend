import { describe, expect, it } from "vitest";

import { CLIENT_ROW_ACTIONS, isClientActionEnabled } from "../consultantClientActions.js";

describe("CLIENT_ROW_ACTIONS", () => {
  it("lista abrir/avaliar/mensagem com ids em inglês", () => {
    expect(CLIENT_ROW_ACTIONS.map((a) => a.id)).toEqual(["open", "evaluate", "message"]);
  });
  it("só 'open' está ativa; avaliar/mensagem são 'em breve' (Trilha B)", () => {
    const open = CLIENT_ROW_ACTIONS.find((a) => a.id === "open");
    const evaluate = CLIENT_ROW_ACTIONS.find((a) => a.id === "evaluate");
    const message = CLIENT_ROW_ACTIONS.find((a) => a.id === "message");
    expect(open.soon).toBe(false);
    expect(evaluate.soon).toBe(true);
    expect(message.soon).toBe(true);
  });
  it("labels em PT-BR", () => {
    expect(CLIENT_ROW_ACTIONS.map((a) => a.label)).toEqual([
      "Abrir relatório",
      "Avaliar com IA",
      "Enviar mensagem",
    ]);
  });
});

describe("isClientActionEnabled", () => {
  it("verdadeiro só para ações sem 'soon'", () => {
    expect(isClientActionEnabled({ soon: false })).toBe(true);
    expect(isClientActionEnabled({ soon: true })).toBe(false);
    expect(isClientActionEnabled({})).toBe(true);
  });
});
