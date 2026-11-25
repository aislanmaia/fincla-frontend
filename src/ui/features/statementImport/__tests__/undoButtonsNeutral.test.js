// "Desfazer" de uma ESCOLHA dentro dos passos é neutro (G3, decisão de 2026-11-16): vermelho no app
// sinaliza ação que apaga. Só "Desfazer importação" (lista de extratos), o "Desfazer conciliação" da
// lista de faturas conciliadas (o mesmo desfazer, da fatura, fincla-api#556) e "Descartar" ficam em vermelho.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join(__dirname, "..");
const sources = readdirSync(DIR)
  .filter((name) => name.endsWith(".jsx"))
  .map((name) => ({ name, text: readFileSync(join(DIR, name), "utf8") }));

// Cada <Btn …>Desfazer…</Btn>, com os atributos e o texto.
// (`=>` das funções de clique não fecha a tag.)
const UNDO_BUTTON = /<Btn\b((?:=>|[^>])*?)>\s*(Desfazer[^<]*)<\/Btn>/g;

describe("os botões Desfazer da conciliação", () => {
  it("só o Desfazer da importação inteira (listas de extratos e de faturas) é vermelho", () => {
    const red = [];
    let found = 0;
    for (const { name, text } of sources) {
      for (const [, attributes, label] of text.matchAll(UNDO_BUTTON)) {
        found += 1;
        if (!attributes.includes("outRed")) continue;
        const whole = attributes.includes("Desfazer importação") ? " (importação)" : attributes.includes("Desfazer conciliação") ? " (conciliação)" : "";
        red.push(`${name}: ${label.trim()}${whole}`);
      }
    }
    expect(found).toBeGreaterThanOrEqual(10);
    expect(red.sort()).toEqual(["ImportedStatements.jsx: Desfazer (importação)", "ReconciledInvoices.jsx: Desfazer (conciliação)"]);
  });

  it("os desfazer que escolhem a cor numa variável também são neutros", () => {
    const pickers = sources.flatMap(({ name, text }) =>
      [...text.matchAll(/(undo\w*|variant)=?\s*[:=]?\s*\{?\s*inRow \? "ghost" : "(\w+)"/gi)].map((m) => `${name}: ${m[2]}`),
    );
    expect(pickers.length).toBeGreaterThanOrEqual(2);
    expect(pickers.filter((p) => p.endsWith("outRed"))).toEqual([]);
  });
});
