// OBS-40 (fincla-api#507): "a fileira de respostas do pendente está à vista" é medida no grupo de
// botões S/A/N de cada passo da lista, marcado com `data-answer-row`. Um passo que perca a marca
// volta, sem aviso, ao comportamento antigo (o atalho só leva até o cartão).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join(__dirname, "..");
const STEPS = ["StatementEntryCard.jsx", "DoubtStep.jsx", "SuggestedPairsStep.jsx"];

describe("a fileira de respostas de cada passo da lista", () => {
  for (const name of STEPS) {
    it(`${name}: o grupo de respostas tem data-answer-row (uma vez só)`, () => {
      const text = readFileSync(join(DIR, name), "utf8");
      const marked = [...text.matchAll(/<div role="group" data-answer-row="" aria-label=\{(\w+)\}/g)];
      expect(marked).toHaveLength(1);
      expect(text.match(/data-answer-row/g)).toHaveLength(1);
    });
  }
});
