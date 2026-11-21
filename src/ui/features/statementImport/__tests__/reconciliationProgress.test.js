// O progresso em passos conferidos e o selo pelas faixas (G3, decisão do Owner de 2026-11-16):
// a mesma função serve o "Seu progresso" da conciliação e o quadro "Continue de onde parou".
import { describe, expect, it } from "vitest";

import contract from "../../../../api/__fixtures__/statement_import.example.json";
import { normalizeStatementImport } from "../../../../api/statementImports";
import { STEPS, progressBadge, stepProgress } from "../reconciliationSteps.js";

const BEFORE_SUMMARY = STEPS.map((s) => s.key).filter((k) => k !== "summary");

describe("progressBadge: as faixas, com as bordas exatas", () => {
  it.each([
    [0, 10, "Pronta para começar"],
    [1, 10, "Em andamento"],
    [4, 10, "Em andamento"],
    // 49,9% ainda é "Em andamento"; 50% exatos já "Passou da metade".
    [499, 1000, "Em andamento"],
    [5, 10, "Passou da metade"],
    [3, 6, "Passou da metade"],
    [4, 8, "Passou da metade"],
    [7, 10, "Passou da metade"],
    // 79,9% ainda é "Passou da metade"; 80% exatos já "Quase lá".
    [799, 1000, "Passou da metade"],
    [8, 10, "Quase lá · falta pouco!"],
    [9, 10, "Quase lá · falta pouco!"],
  ])("%i de %i conferidos → %s", (done, total, badge) => {
    expect(progressBadge({ done, total, allPassed: false }, true)).toEqual({ badge, ready: false });
  });

  it("todos os passos antes de Revisar e concluir vistos e dá para concluir: Tudo conferido, o único estado pronto", () => {
    expect(progressBadge({ done: 7, total: 8, allPassed: true }, true)).toEqual({ badge: "Tudo conferido · só falta concluir", ready: true });
  });

  it("todos vistos mas bloqueado: Quase lá, sem concluir (mesmo com poucos passos conferidos)", () => {
    expect(progressBadge({ done: 6, total: 8, allPassed: true }, false)).toEqual({ badge: "Quase lá · falta pouco!", ready: false });
  });

  it("dá para concluir mas nenhum passo foi visto (recém-enviado): Pronta para começar, nunca pronto", () => {
    expect(progressBadge({ done: 0, total: 8, allPassed: false }, true)).toEqual({ badge: "Pronta para começar", ready: false });
  });
});

describe("stepProgress: o mesmo cálculo do rascunho", () => {
  const draft = normalizeStatementImport(contract.draft);

  it("recém-enviado: 0 de 8, nada visto", () => {
    expect(stepProgress(draft, new Set())).toEqual({ done: 0, total: 8, allPassed: false });
  });

  it("um passo visto com pendência (lançamento sem descrição) não conta como conferido", () => {
    expect(draft.summary.missing_description).toBe(1);
    expect(stepProgress(draft, new Set(BEFORE_SUMMARY))).toEqual({ done: 6, total: 8, allPassed: true });
    // Só o passo "Adicionar lançamentos novos" fica de fora.
    const ready = { ...draft, summary: { ...draft.summary, missing_description: 0 } };
    expect(stepProgress(ready, new Set(BEFORE_SUMMARY)).done).toBe(7);
  });

  it("sem pendência, os 7 passos vistos são conferidos (Conferir o saldo inclusive); Revisar e concluir nunca conta", () => {
    const ready = { ...draft, summary: { ...draft.summary, missing_description: 0 } };
    expect(stepProgress(ready, new Set([...BEFORE_SUMMARY, "summary"]))).toEqual({ done: 7, total: 8, allPassed: true });
  });
});
