// Decisão do Owner (fincla-api#507, 2026-11-23): nenhum temporizador nem espera antes de minimizar
// um cartão da conciliação. Responder minimiza no clique, só com a animação de recolher. Esta
// varredura garante que nenhum passo volte a segurar o cartão aberto ("Minimizando…", setTimeout).
// A única espera permitida é a da busca no Fincla, que aguarda a pessoa parar de digitar.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join(__dirname, "..");
const ALLOWED = new Set(["FinclaSearchDialog.jsx"]);
const sources = [
  ...readdirSync(DIR).filter((name) => /\.jsx?$/.test(name)).map((name) => ({ name, path: join(DIR, name) })),
  { name: "StatementReconciliationPage.jsx", path: join(DIR, "../../pages/StatementReconciliationPage.jsx") },
].map(({ name, path }) => ({ name, text: readFileSync(path, "utf8") }));

describe("minimizar um cartão da conciliação", () => {
  it("não passa por temporizador em nenhum passo nem na página", () => {
    expect(sources.length).toBeGreaterThanOrEqual(10);
    const timers = sources
      .filter(({ name }) => !ALLOWED.has(name))
      .filter(({ text }) => /\b(setTimeout|setInterval|requestIdleCallback)\s*\(/.test(text))
      .map(({ name }) => name);
    expect(timers).toEqual([]);
  });

  it("não mostra um estado de espera antes de minimizar", () => {
    const holding = sources.filter(({ text }) => /Minimizando/.test(text)).map(({ name }) => name);
    expect(holding).toEqual([]);
  });
});
