import { describe, expect, it } from "vitest";

import {
  DASH,
  aggregateValue,
  fmtLastActive,
  fmtMoney,
  fmtMoneyIn,
  fmtPct,
  healthTone,
  trendGlyph,
} from "../consultantFormat.js";

describe("aggregateValue", () => {
  it("formats a present value", () => {
    expect(aggregateValue(8, true, (n) => String(n))).toBe("8");
    expect(aggregateValue(0, true, (n) => String(n))).toBe("0");
  });

  it("shows the loading placeholder before load", () => {
    expect(aggregateValue(null, false, String)).toBe("…");
    expect(aggregateValue(undefined, false, String)).toBe("…");
  });

  it("shows a dash once loaded with no value", () => {
    expect(aggregateValue(null, true, String)).toBe("—");
  });
});

describe("fmtPct — robusto a valor ausente/não-finito", () => {
  it("formata número com 1 casa (inclui negativo)", () => {
    expect(fmtPct(-17.6)).toBe("-17.6%");
    expect(fmtPct(0)).toBe("0.0%");
    expect(fmtPct(53)).toBe("53.0%");
  });
  it("degrada para 0.0% em null/undefined/NaN/Infinity (não quebra o render)", () => {
    expect(fmtPct(null)).toBe("0.0%");
    expect(fmtPct(undefined)).toBe("0.0%");
    expect(fmtPct(Number.NaN)).toBe("0.0%");
    expect(fmtPct(Number.POSITIVE_INFINITY)).toBe("0.0%");
  });
});

describe("fmtMoney — sinal só quando negativo", () => {
  it("aceita string decimal e número", () => {
    expect(fmtMoney("18280.00")).toBe("R$ 18.280,00");
    expect(fmtMoney("-3340.00")).toBe("−R$ 3.340,00");
    expect(fmtMoney(0)).toBe("R$ 0,00");
  });
  it("valor ausente vira '—', não R$ 0,00", () => {
    // Este caso afirmava o contrário até o backend passar a devolver
    // `patrimonio: null` quando não dá para consolidar (fincla-api#144). "R$ 0,00"
    // afirma que o cliente não tem patrimônio; "—" diz que nós é que não sabemos.
    expect(fmtMoney(null)).toBe("—");
  });

  it("mas zero de verdade continua R$ 0,00", () => {
    // Distinguir "não sei" de "é zero" é o ponto inteiro da mudança.
    expect(fmtMoney(0)).toBe("R$ 0,00");
  });
});

/**
 * `fmtMoneyIn` — dinheiro na moeda que veio COM ele (#205).
 *
 * A renda estimada do perfil sai do backend rotulada com a base da organização
 * DO CLIENTE. `fmtMoney`/`fmtBRL0` carimbam "R$" no que recebem, e usá-los aqui
 * desenharia a renda de um cliente português em real: número certo, unidade
 * errada.
 */
describe("fmtMoneyIn — a moeda do valor, não a da tela", () => {
  // NBSP e afins: o Intl separa símbolo e número com espaço estreito, que não é
  // um espaço comum. Comparar com string literal falharia por invisível.
  const semEspacos = (v) => v.replace(/\s/g, " ");

  it("formata na moeda recebida", () => {
    expect(semEspacos(fmtMoneyIn(8000, "BRL"))).toBe("R$ 8.000,00");
    expect(semEspacos(fmtMoneyIn(3200, "EUR"))).toBe("€ 3.200,00");
  });

  it("não converte nem re-rotula: euro sai euro", () => {
    expect(fmtMoneyIn(3200, "EUR")).not.toContain("R$");
  });

  it("ausência vira travessão, nunca zero", () => {
    // "R$ 0,00" afirmaria que o cliente não ganha nada; `null` diz que nós é que
    // não sabemos — o backend omite o valor quando não pode rotulá-lo.
    expect(fmtMoneyIn(null, "BRL")).toBe(DASH);
    expect(fmtMoneyIn(undefined, "BRL")).toBe(DASH);
    expect(fmtMoneyIn("", "BRL")).toBe(DASH);
    expect(fmtMoneyIn(Number.NaN, "BRL")).toBe(DASH);
  });

  it("zero declarado é um valor, e sai formatado", () => {
    expect(semEspacos(fmtMoneyIn(0, "BRL"))).toBe("R$ 0,00");
  });

  it("sem moeda cai em BRL — cobre o backend na forma antiga", () => {
    // Mesmo último recurso de `normalizeAccountBalance`: string nua era a forma
    // pré-#178, em que "R$" era a unidade implícita de toda a UI.
    expect(semEspacos(fmtMoneyIn(8000, null))).toBe("R$ 8.000,00");
  });
});

describe("fmtLastActive", () => {
  it("YYYY-MM-DD → dd/mm/aaaa", () => {
    expect(fmtLastActive("2026-06-28")).toBe("28/06/2026");
    expect(fmtLastActive("2026-06-28T10:00:00Z")).toBe("28/06/2026");
  });
  it("null/malformado → DASH", () => {
    expect(fmtLastActive(null)).toBe(DASH);
    expect(fmtLastActive("")).toBe(DASH);
    expect(fmtLastActive("nope")).toBe(DASH);
  });
});

describe("healthTone — faixa por saúde", () => {
  it("rotula em dia / atenção / em risco", () => {
    expect(healthTone(92).label).toBe("Saudável");
    expect(healthTone(55).label).toBe("Atenção");
    expect(healthTone(30).label).toBe("Frágil");
  });
});

describe("trendGlyph", () => {
  it("mapeia up/down/flat (default →)", () => {
    expect(trendGlyph("up").glyph).toBe("↑");
    expect(trendGlyph("down").glyph).toBe("↓");
    expect(trendGlyph("flat").glyph).toBe("→");
    expect(trendGlyph(undefined).glyph).toBe("→");
  });
});
