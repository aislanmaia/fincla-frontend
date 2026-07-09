import { describe, expect, it } from "vitest";

import { healthTone } from "../consultantFormat";
import {
  HEALTH_BAND_NONE,
  buildClientsCsv,
  clientHealthBand,
  countClientsByBand,
  selectConsultantClients,
} from "../consultantClientsView";

/**
 * `health == null` = "ainda não calculado", e NÃO zero.
 *
 * Todo o caminho antigo fazia `Number(health) || 0`, o que transformava `null` em
 * 0 e pintava de "Em risco" um cliente que ninguém avaliou. O backend passou a
 * devolver `null` quando não há snapshot canônico (`financial_health_scores`).
 */

const client = (health, extra = {}) => ({
  organization_id: `org-${health ?? "null"}${extra.tag ?? ""}`,
  organization_name: "Org",
  client_name: `C${health ?? "x"}`,
  health,
  patrimonio: "1000.00",
  balance: "0.00",
  savings_pct: 0,
  debt_pct: 0,
  ...extra,
});

describe("health nulo não é zero", () => {
  it("clientHealthBand devolve a faixa neutra, não 'risk'", () => {
    expect(clientHealthBand(null)).toBe(HEALTH_BAND_NONE);
    expect(clientHealthBand(undefined)).toBe(HEALTH_BAND_NONE);
    expect(clientHealthBand(0)).toBe("risk"); // zero de verdade continua sendo risco
    expect(clientHealthBand(39)).toBe("risk");
    expect(clientHealthBand(40)).toBe("attention");
  });

  it("healthTone não pinta de vermelho quem não foi avaliado", () => {
    const tone = healthTone(null);
    expect(tone.label).toBe("Sem score");
    expect(tone.color).not.toBe(healthTone(10).color);
  });

  it("countClientsByBand conta 'none' separado das faixas de risco", () => {
    const counts = countClientsByBand([client(90), client(null), client(20)]);
    expect(counts).toEqual({ all: 3, healthy: 1, attention: 0, risk: 1, none: 1 });
  });

  it("cliente sem score não aparece em nenhum filtro de risco", () => {
    const list = [client(90), client(null), client(20)];
    for (const f of ["healthy", "attention", "risk"]) {
      const visible = selectConsultantClients(list, { riskFilter: f });
      expect(visible.every((c) => c.health != null)).toBe(true);
    }
    expect(selectConsultantClients(list, { riskFilter: "none" })).toHaveLength(1);
    expect(selectConsultantClients(list, { riskFilter: "all" })).toHaveLength(3);
  });

  it("ordena sem-score por último, nas DUAS direções", () => {
    const list = [client(null), client(20), client(90)];

    const asc = selectConsultantClients(list, { sortKey: "health", sortDir: "asc" });
    expect(asc.map((c) => c.health)).toEqual([20, 90, null]);

    // Sem score não é "o melhor" quando a ordem inverte: ele não tem diagnóstico.
    const desc = selectConsultantClients(list, { sortKey: "health", sortDir: "desc" });
    expect(desc.map((c) => c.health)).toEqual([90, 20, null]);
  });

  it("CSV exporta vazio, não 0 — uma planilha com 0 vira diagnóstico falso", () => {
    const csv = buildClientsCsv([client(null), client(42)]);
    const [, semScore, comScore] = csv.split("\n");
    expect(semScore.split(";")[2]).toBe("");
    expect(comScore.split(";")[2]).toBe("42");
  });
});
