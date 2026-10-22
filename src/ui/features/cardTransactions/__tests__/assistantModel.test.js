import { describe, expect, it } from "vitest";
import { alertsLabel, assistantFailureMessage, assistantFromApi } from "../assistantModel.js";

const item = (kind, extra = {}) => ({ kind, title: kind === "duplicate" ? "Possível duplicata" : kind === "insight" ? "Insight" : "2 itens sem categoria", detail: "d", transaction_ids: [1, 2], suggestions: [], ...extra });

describe("assistente do ledger (resposta do servidor)", () => {
  it("traduz a resposta, separa alertas do insight e mantém as sugestões com seus ids", () => {
    const { items, alertCount, scanned } = assistantFromApi({ scanned: 140, alert_count: 2, items: [
      item("uncategorized", { suggestions: [{ category_tag_id: "c3", category_name: "Lazer", transaction_ids: [1], basis: "b" }] }),
      item("duplicate"),
      item("insight", { transaction_ids: [] }),
    ] });
    expect(items.map((entry) => entry.kind)).toEqual(["uncategorized", "duplicate", "insight"]);
    expect(items[0].rowIds).toEqual([1, 2]);
    expect(items[0].suggestions).toEqual([{ categoryTagId: "c3", categoryName: "Lazer", rowIds: [1], basis: "b" }]);
    expect([alertCount, scanned]).toEqual([2, 140]);
  });

  it("resume um alerta pelo título e detalhe; dois ou mais por tipo, sem repetir duplicatas", () => {
    expect(assistantFromApi({ scanned: 1, items: [item("uncategorized")] }).alertSummary).toBe("2 itens sem categoria: d");
    expect(assistantFromApi({ scanned: 1, items: [item("duplicate"), item("duplicate"), item("uncategorized")] }).alertSummary).toBe("2 possíveis duplicatas · 2 itens sem categoria");
  });

  it("sem resposta (carregando, erro) não há itens nem alertas", () => {
    expect(assistantFromApi(null)).toMatchObject({ items: [], alertCount: 0, scanned: 0 });
  });

  it("plural dos alertas e mensagem do recorte grande demais", () => {
    expect([alertsLabel(1), alertsLabel(3)]).toEqual(["1 alerta", "3 alertas"]);
    expect(assistantFailureMessage({ response: { data: { detail: { code: "slice_too_large", total: 25000, limit: 20000 } } } })).toBe("O recorte tem 25.000 lançamentos e o Assistente analisa até 20.000. Estreite os filtros.");
    expect(assistantFailureMessage(new Error("x"))).toBe("Não foi possível analisar o recorte agora.");
  });
});
