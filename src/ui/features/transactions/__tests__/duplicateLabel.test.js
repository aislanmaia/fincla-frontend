import { describe, it, expect } from "vitest";
import { nextDuplicateLabel } from "../duplicateLabel.js";

describe("nextDuplicateLabel", () => {
  it("acrescenta (1) na primeira cópia", () => {
    expect(nextDuplicateLabel("Uber")).toBe("Uber (1)");
  });

  it("incrementa em vez de empilhar", () => {
    expect(nextDuplicateLabel("Uber (1)")).toBe("Uber (2)");
    expect(nextDuplicateLabel("Uber (9)")).toBe("Uber (10)");
  });

  it("não confunde parêntese que faz parte da descrição", () => {
    expect(nextDuplicateLabel("Uber (ida)")).toBe("Uber (ida) (1)");
    // `(0)` e `(007)` são texto de alguém, não sufixo nosso
    expect(nextDuplicateLabel("Nota (0)")).toBe("Nota (0) (1)");
    expect(nextDuplicateLabel("Nota (007)")).toBe("Nota (007) (1)");
  });

  it("normaliza espaço em volta do sufixo", () => {
    expect(nextDuplicateLabel("Uber  (1)")).toBe("Uber (2)");
    expect(nextDuplicateLabel("  Uber  ")).toBe("Uber (1)");
  });

  it("devolve vazio para entrada vazia ou inválida", () => {
    expect(nextDuplicateLabel("")).toBe("");
    expect(nextDuplicateLabel(null)).toBe("");
    expect(nextDuplicateLabel(undefined)).toBe("");
  });

  it("um parêntese sozinho não vira sufixo", () => {
    expect(nextDuplicateLabel("(3)")).toBe("(3) (1)");
  });
});
