import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearCurrencyRegistry, setCurrencyRegistry } from "../../../money/currencyRegistry.js";
import { fmtCardAvailable } from "../NovaTransacaoModal.jsx";

/* fincla-api#534 — o limite disponível do cartão leva as casas da moeda dele pelo registro: "R$ 1.234,50", nunca
   "R$ 1.234,5" nem "R$ 1.500". Uma moeda de três casas prova que a quantidade vem do registro. */
beforeEach(() => {
  setCurrencyRegistry([
    { code: "BRL", symbol: "R$", decimal_places: 2 },
    { code: "USD", symbol: "US$", decimal_places: 2 },
    { code: "KWD", symbol: "KD", decimal_places: 3 },
  ]);
});
afterEach(() => clearCurrencyRegistry());

describe("fmtCardAvailable", () => {
  it("completa as casas da moeda", () => {
    expect(fmtCardAvailable({ moeda: "BRL", disp: 1234.5 })).toBe("R$ 1.234,50");
    expect(fmtCardAvailable({ moeda: "USD", disp: 1500 })).toBe("US$ 1.500,00");
    expect(fmtCardAvailable({ moeda: "KWD", disp: 12.5 })).toBe("KD 12,500");
  });

  it("sem moeda ou sem valor, travessão — nunca R$ chapado nem zero inventado", () => {
    expect(fmtCardAvailable({ moeda: null, disp: 10 })).toBe("—");
    expect(fmtCardAvailable({ moeda: "BRL", disp: null })).toBe("—");
  });
});
