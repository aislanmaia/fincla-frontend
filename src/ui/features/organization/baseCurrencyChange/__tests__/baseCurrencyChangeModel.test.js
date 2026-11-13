import { describe, expect, it } from "vitest";

import {
  buildApplyRequest,
  effectiveMode,
  initialChoices,
  invertRate,
  itemOutcome,
  itemWarningLabel,
  quoteDisplay,
  readTypedValue,
  setGroupMode,
  setItemMode,
  setItemText,
  summarize,
  summaryLine,
} from "../baseCurrencyChangeModel.js";
import { impactPreview } from "./fixtures.js";

const choose = (over = {}) => ({ ...initialChoices(), ...over });
const groupOf = (p, g) => p.groups.find((x) => x.group === g);
const itemOf = (p, key) => p.groups.flatMap((g) => g.items).find((i) => i.key === key);

describe("invertRate", () => {
  it("inverts in integers, HALF_UP, 10 places", () => {
    expect(invertRate("0.1834000000")).toBe("5.4525627045");
    expect(invertRate("0.2")).toBe("5.0000000000");
    expect(invertRate("5.4914", 4)).toBe("0.1821");
  });
  it("refuses zero and garbage instead of inventing a rate", () => {
    expect(invertRate("0")).toBeNull();
    expect(invertRate("0.0000")).toBeNull();
    expect(invertRate("abc")).toBeNull();
    expect(invertRate("1e-3")).toBeNull();
  });
});

describe("quoteDisplay", () => {
  it("shows '1 <new> = <current base> x' with the date, inverting the API's from→to rate only for display", () => {
    expect(quoteDisplay(impactPreview())).toEqual({ pair: "US$ 1 = R$ 5,4526", date: "05/11" });
  });
  it("does not invert a quote that already comes in the displayed direction", () => {
    const p = impactPreview({ quote: { base: "USD", quote: "BRL", rate: "5.4914", quoted_on: "2026-11-03" } });
    expect(quoteDisplay(p)).toEqual({ pair: "US$ 1 = R$ 5,4914", date: "03/11" });
  });
  it("is null without a quote", () => {
    expect(quoteDisplay(impactPreview({ quote: null }))).toBeNull();
  });
  it("going back to BRL still shows '1 <foreign> = R$ x' (#311), never 'R$ 1 = US$ x'", () => {
    // API quote is old base → new base: USD → BRL, already in the displayed direction.
    const p = impactPreview({ from_currency: "USD", to_currency: "BRL",
      quote: { base: "USD", quote: "BRL", rate: "5.6436000000", quoted_on: "2026-11-12" } });
    expect(quoteDisplay(p)).toEqual({ pair: "US$ 1 = R$ 5,6436", date: "12/11" });
  });
  it("without a BRL side, shows '1 <old base> = <new base> x' as the API sends it", () => {
    const eurToUsd = impactPreview({ from_currency: "EUR", to_currency: "USD",
      quote: { base: "EUR", quote: "USD", rate: "1.0832000000", quoted_on: "2026-11-12" } });
    expect(quoteDisplay(eurToUsd)).toEqual({ pair: "€ 1 = US$ 1,0832", date: "12/11" });
    const usdToEur = impactPreview({ from_currency: "USD", to_currency: "EUR",
      quote: { base: "USD", quote: "EUR", rate: "0.9259000000", quoted_on: "2026-11-12" } });
    expect(quoteDisplay(usdToEur)).toEqual({ pair: "US$ 1 = € 0,9259", date: "12/11" });
  });
});

describe("precedence item > group > global", () => {
  const p = impactPreview();
  const mercado = itemOf(p, "budget:b1:amount");
  it("starts with NO global choice (nothing kept or converted silently)", () => {
    expect(effectiveMode(mercado, "budgets", initialChoices())).toBeNull();
    expect(summarize(p, initialChoices()).canApply).toBe(false);
  });
  it("item beats group beats global", () => {
    let c = choose({ mode: "convert" });
    expect(effectiveMode(mercado, "budgets", c)).toBe("convert");
    c = setGroupMode(c, "budgets", "skip");
    expect(effectiveMode(mercado, "budgets", c)).toBe("skip");
    c = setItemMode(c, p, "budgets", mercado, "keep");
    expect(effectiveMode(mercado, "budgets", c)).toBe("keep");
    c = setItemMode(c, p, "budgets", mercado, null);
    expect(effectiveMode(mercado, "budgets", c)).toBe("skip");
  });
  it("a locked item stays as it is under any group or global choice", () => {
    const locked = itemOf(p, "goal:g2:target_amount");
    const c = setGroupMode(choose({ mode: "convert" }), "goals", "keep");
    expect(itemOutcome(locked, "goals", c, "USD")).toEqual({ mode: "skip", after: { amount: "20000.00", currency: "BRL" }, error: null });
  });
});

describe("itemOutcome uses the server's numbers", () => {
  const p = impactPreview();
  const renda = itemOf(p, "organization:x:monthly_income");
  it("keep → kept, convert → converted, never recomputed", () => {
    expect(itemOutcome(renda, "income", choose({ mode: "keep" }), "USD").after).toEqual({ amount: "5000.00", currency: "USD" });
    expect(itemOutcome(renda, "income", choose({ mode: "convert" }), "USD").after).toEqual({ amount: "917.00", currency: "USD" });
  });
  it("convert without a converted amount is an error, not zero", () => {
    const noQuote = { ...renda, converted: null };
    expect(itemOutcome(noQuote, "income", choose({ mode: "convert" }), "USD")).toEqual({ mode: "convert", after: null, error: "Sem cotação para converter" });
  });
  it("typed value is read in the NEW currency", () => {
    const c = setItemText(choose({ mode: "keep" }), renda.key, "1,234.56");
    expect(itemOutcome(renda, "income", c, "USD").after).toEqual({ amount: "1234.56", currency: "USD" });
  });
});

describe("readTypedValue", () => {
  it("accepts up to two decimals and never rounds", () => {
    expect(readTypedValue("52,40", "USD")).toEqual({ amount: "52.40", error: null });
    expect(readTypedValue("1.500,25", "BRL")).toEqual({ amount: "1500.25", error: null });
    expect(readTypedValue("1.234,567", "BRL").error).toBe("No máximo duas casas decimais");
  });
  it("refuses empty, garbage, negative and too large", () => {
    expect(readTypedValue("", "USD").error).toBe("Informe o valor");
    expect(readTypedValue("abc", "USD").error).toBe("Valor inválido");
    expect(readTypedValue("-5", "BRL").error).toBe("O valor não pode ser negativo");
    expect(readTypedValue("1000000000000", "BRL").error).toBe("Valor grande demais");
  });
});

describe("records change currency together", () => {
  const p = impactPreview();
  const alvo = itemOf(p, "goal:g1:target_amount");
  const aporte = itemOf(p, "goal:g1:monthly_target");
  it("skipping one field of a goal skips its sibling", () => {
    const c = setItemMode(choose({ mode: "convert" }), p, "goals", alvo, "skip");
    expect(effectiveMode(aporte, "goals", c)).toBe("skip");
    expect(summarize(p, c).errors).toEqual([]);
  });
  it("un-skipping one field brings the sibling back too", () => {
    let c = setGroupMode(choose({ mode: "convert" }), "goals", "skip");
    c = setItemMode(c, p, "goals", alvo, "keep");
    expect(effectiveMode(aporte, "goals", c)).not.toBe("skip");
    expect(summarize(p, c).errors).toEqual([]);
  });
  it("typing a value on one field of a skipped goal does not force an empty typed value on its sibling", () => {
    let c = setGroupMode(choose({ mode: "convert" }), "goals", "skip");
    c = setItemMode(c, p, "goals", alvo, "value");
    expect(effectiveMode(aporte, "goals", c)).toBe("convert");
    expect(c.items[aporte.key]).toEqual({ mode: "convert" });
    c = setItemText(c, alvo.key, "1,000.00");
    const s = summarize(p, c);
    expect(s.errors).toEqual([]);
    expect(s.canApply).toBe(true);
  });
  it("with no global choice yet, the sibling of a typed field falls back to keep", () => {
    let c = setGroupMode(choose(), "goals", "skip");
    c = setItemMode(c, p, "goals", alvo, "value");
    expect(c.items[aporte.key]).toEqual({ mode: "keep" });
  });
  it("a split record is flagged before the server refuses it", () => {
    const c = choose({ mode: "convert", items: { [alvo.key]: { mode: "skip" } } });
    expect(summarize(p, c).errors.map((e) => e.message)).toContain("Os valores do mesmo registro mudam de moeda juntos");
    expect(summarize(p, c).canApply).toBe(false);
  });
});

describe("summarize", () => {
  it("counts every item, the undisclosed ones following group > global, and locked as staying", () => {
    const s = summarize(impactPreview(), choose({ mode: "convert" }));
    expect(s.counts).toEqual({ keep: 0, convert: 7, skip: 1, value: 0 });
    expect(s.canApply).toBe(true);
    expect(summaryLine(s, "BRL")).toBe("7 convertidos pela cotação · 1 fica em R$");
  });
  it("undisclosed items follow a group override", () => {
    const c = setGroupMode(choose({ mode: "convert" }), "consultant_income", "keep");
    expect(summarize(impactPreview(), c).counts).toEqual({ keep: 2, convert: 5, skip: 1, value: 0 });
  });
  it("without a quote, converting anything (even an undisclosed item) blocks the confirmation", () => {
    const p = impactPreview({ quote: null });
    for (const g of p.groups) for (const i of g.items) i.converted = null;
    const onlyHidden = setGroupMode(setGroupMode(setGroupMode(setGroupMode(choose({ mode: "convert" }), "income", "keep"), "budgets", "keep"), "goals", "keep"), "consultant_income", null);
    const c = setItemMode(onlyHidden, p, "consultant_income", itemOf(p, "consultant_profile:c1:estimated_income"), "keep");
    const s = summarize(p, c);
    expect(s.canApply).toBe(false);
    expect(s.errors.map((e) => e.key)).toEqual(["consultant_income:undisclosed"]);
  });
  it("an invalid typed value blocks the confirmation", () => {
    const c = setItemText(choose({ mode: "keep" }), "organization:x:monthly_income", "abc");
    expect(summarize(impactPreview(), c).canApply).toBe(false);
  });
});

describe("buildApplyRequest", () => {
  it("keep everything: no quote is sent", () => {
    expect(buildApplyRequest(impactPreview(), choose({ mode: "keep" }))).toEqual({
      to: "USD", fingerprint: "fp-1", mode: "keep", quote: null, groups: {}, items: {},
    });
  });
  it("converting sends the quote exactly as previewed", () => {
    const body = buildApplyRequest(impactPreview(), choose({ mode: "convert" }));
    expect(body.quote).toEqual({ rate: "0.1834000000", quoted_on: "2026-11-05" });
  });
  it("keep globally but convert one item still sends the quote", () => {
    const p = impactPreview();
    const c = setItemMode(choose({ mode: "keep" }), p, "budgets", itemOf(p, "budget:b1:amount"), "convert");
    const body = buildApplyRequest(p, c);
    expect(body.quote).toEqual({ rate: "0.1834000000", quoted_on: "2026-11-05" });
    expect(body.items).toEqual({ "budget:b1:amount": { mode: "convert" } });
  });
  it("sends group overrides, typed values as decimal strings, and never a per-item choice on a locked item", () => {
    const p = impactPreview();
    let c = setGroupMode(choose({ mode: "convert" }), "budgets", "skip");
    c = setGroupMode(c, "goals", "keep");
    c = setItemText(c, "organization:x:monthly_income", "1,000.5");
    const body = buildApplyRequest(p, c);
    expect(body.groups).toEqual({ budgets: { mode: "skip" }, goals: { mode: "keep" } });
    expect(body.items).toEqual({ "organization:x:monthly_income": { mode: "value", value: "1000.50" } });
    expect(body.items["goal:g2:target_amount"]).toBeUndefined();
  });
});

describe("itemWarningLabel", () => {
  it("maps known codes to PT-BR, passes server sentences through, hides unknown codes", () => {
    expect(itemWarningLabel("contributions_currency", "USD")).toBe("Os próximos aportes precisam sair de uma conta em US$.");
    expect(itemWarningLabel("Aportes futuros em US$.", "USD")).toBe("Aportes futuros em US$.");
    expect(itemWarningLabel("some_new_code", "USD")).toBeNull();
    expect(itemWarningLabel(null, "USD")).toBeNull();
  });
});
