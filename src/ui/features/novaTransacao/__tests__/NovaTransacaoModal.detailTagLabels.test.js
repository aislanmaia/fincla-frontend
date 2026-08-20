import { describe, expect, it } from "vitest";
import {
  resolveDetailTagRowLabel,
  sortDetailTagRowsByLabelPt,
} from "../NovaTransacaoModal.jsx";

// Regressão do review adversarial da PR #97: o modal de nova transação
// mostrava `row.name` cru do seed ("grocery", "health_plan"...) nos chips de
// sugestão de tag detalhe e ordenava a lista pelo nome cru — a tela mostrava
// o rótulo traduzido fora de ordem alfabética em PT-BR.
describe("resolveDetailTagRowLabel", () => {
  it("traduz a tag detalhe do seed (is_default: true)", () => {
    expect(resolveDetailTagRowLabel({ name: "grocery", is_default: true })).toBe("mercado");
    expect(resolveDetailTagRowLabel({ name: "health_plan", is_default: true })).toBe(
      "plano de saúde",
    );
  });

  it("deixa passar tag do usuário sem tradução (is_default: false)", () => {
    expect(resolveDetailTagRowLabel({ name: "Pix solidário", is_default: false })).toBe(
      "Pix solidário",
    );
  });

  it("linha nula/sem nome não quebra", () => {
    expect(resolveDetailTagRowLabel(null)).toBe("");
    expect(resolveDetailTagRowLabel({ name: null, is_default: true })).toBe("");
  });
});

describe("sortDetailTagRowsByLabelPt", () => {
  it("ordena pelo rótulo PT exibido, não pelo nome cru da API", () => {
    // Cru em ordem alfabética EN: bus, fuel, uber. Traduzido: combustível
    // (fuel), ônibus (bus), uber — a ordem PT inverte bus/fuel.
    const rows = [
      { id: "bus-id", name: "bus", is_default: true },
      { id: "fuel-id", name: "fuel", is_default: true },
      { id: "uber-id", name: "uber", is_default: true },
    ];
    const sorted = sortDetailTagRowsByLabelPt(rows);
    // combustível < ônibus < uber
    expect(sorted.map((r) => r.id)).toEqual(["fuel-id", "bus-id", "uber-id"]);
  });

  it("não muta o array original e tolera entrada vazia/nula", () => {
    const rows = [{ id: "1", name: "uber", is_default: true }];
    const sorted = sortDetailTagRowsByLabelPt(rows);
    expect(sorted).not.toBe(rows);
    expect(sortDetailTagRowsByLabelPt(null)).toEqual([]);
  });
});
