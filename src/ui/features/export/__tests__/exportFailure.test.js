import { describe, expect, it } from "vitest";

import { EXPORT_MAX_ROWS, exportFailureMessage } from "../exportFailure.js";

const refusal = (status, detail) => ({ response: { status, data: { detail } } });

describe("exportFailureMessage", () => {
  it("recorte grande diz o tamanho e o limite", () => {
    expect(exportFailureMessage(refusal(422, { code: "export_too_large", message: "x", total: 25000, limit: EXPORT_MAX_ROWS }))).toBe(
      "O recorte tem 25.000 lançamentos e o limite por arquivo é 20.000. Estreite os filtros e exporte de novo.",
    );
  });

  it("extrato que mudou durante a leitura convida a exportar de novo", () => {
    expect(exportFailureMessage(refusal(409, { code: "export_changed", message: "x" }))).toMatch(/Exporte de novo/);
  });

  it("totais que não conferem (500) NÃO mandam exportar de novo: exportar de novo dá o mesmo erro", () => {
    const text = exportFailureMessage(refusal(500, { code: "export_inconsistent", message: "x" }));
    expect(text).toBe(
      "Não conseguimos conferir os totais do arquivo com os lançamentos. O problema foi registrado; tente com outro recorte ou fale com o suporte.",
    );
    expect(text).not.toMatch(/Tente novamente|Exporte de novo/);
  });

  it("filtros longos demais para o cabeçalho dizem o que fazer", () => {
    expect(exportFailureMessage(refusal(422, { code: "filters_text_too_long", message: "x", max_items: 50, max_length: 300 }))).toBe(
      "Há filtros demais para descrever no arquivo. Tire alguns filtros e exporte de novo.",
    );
  });

  it("falha sem causa conhecida convida a tentar de novo", () => {
    expect(exportFailureMessage(new Error("network"))).toBe("Não foi possível preparar a exportação. Tente novamente.");
  });
});
