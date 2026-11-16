import { describe, expect, it } from "vitest";

import { reportsExportScope } from "../reportsExport.js";

/**
 * Relatórios no exportador único (fincla-api#526): o período do relatório ("3m"/"6m"/"12m") vira o intervalo de
 * datas que vai ao exportador — o MESMO que os gráficos usam (do 1º dia do mês mais antigo ao último dia do mês
 * atual, como `monthly-evolution` no servidor) — e o nome/linha de filtro que o arquivo leva.
 */
describe("reportsExportScope", () => {
  const today = new Date(2026, 10, 16, 23, 30); // 16/11/2026, 23h30 no fuso local (após 21h: UTC já é dia 17)

  it.each([
    ["3m", "2026-09-01", "2026-11-30", "relatorios-2026-09-a-2026-11", "Período: 01/09/2026 a 30/11/2026"],
    ["6m", "2026-06-01", "2026-11-30", "relatorios-2026-06-a-2026-11", "Período: 01/06/2026 a 30/11/2026"],
    ["12m", "2025-12-01", "2026-11-30", "relatorios-2025-12-a-2026-11", "Período: 01/12/2025 a 30/11/2026"],
  ])("%s → %s a %s", (periodo, dateStart, dateEnd, filePrefix, periodLine) => {
    expect(reportsExportScope(periodo, today)).toEqual({
      dateStart,
      dateEnd,
      title: "Relatórios",
      filePrefix,
      filtersText: [periodLine],
    });
  });

  it("atravessa a virada do ano e termina no último dia do mês atual (fevereiro bissexto)", () => {
    const scope = reportsExportScope("6m", new Date(2028, 1, 3));
    expect(scope.dateStart).toBe("2027-09-01");
    expect(scope.dateEnd).toBe("2028-02-29");
    expect(scope.filePrefix).toBe("relatorios-2027-09-a-2028-02");
  });

  it("período desconhecido cai em 6 meses, como os gráficos", () => {
    expect(reportsExportScope("xpto", today).dateStart).toBe("2026-06-01");
  });

  it("o prefixo passa no formato que o servidor aceita", () => {
    for (const periodo of ["3m", "6m", "12m"]) {
      expect(reportsExportScope(periodo, today).filePrefix).toMatch(/^[a-z0-9][a-z0-9-]{0,99}$/);
    }
  });
});
