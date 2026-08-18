import { describe, expect, it } from "vitest";
import { getMoodActions, MOODS } from "../moodV4.jsx";
import { isAuthRouteSegment } from "../../routing/appSegments.js";
import { isPlanningArea } from "../planning/planningAreas.js";

/**
 * Os botões do Insight ficaram sem `onClick` do protótipo até agosto/2026. Ao ligá-los,
 * a primeira tentativa usou os ids `goals` e `simulation` — que EXISTEM no código como
 * chamadas de `onNav`, mas não estão em `AUTH_ROUTE_SEGMENTS`: migraram para o hub
 * `planning` e sobraram só como rotas de redirect. `navTo` ignora silenciosamente
 * qualquer alvo fora daquela lista, então 4 dos 10 botões continuavam sem fazer nada —
 * o bug que a correção existia para remover, sobrevivendo à correção.
 *
 * Um teste com `onNav` mockado passa nos dois mundos e não serve para nada aqui. Este
 * confere contra os MESMOS predicados que o despachante usa em runtime.
 */
describe("ações do Insight — todo destino navega de verdade", () => {
  const FAIXAS = Object.keys(MOODS);

  it("toda ação aponta para um segmento que `navTo` de fato despacha", () => {
    const invalidos = [];
    for (const faixa of FAIXAS) {
      for (const acao of getMoodActions(faixa)) {
        if (!isAuthRouteSegment(acao.nav)) {
          invalidos.push(`${faixa}: "${acao.label}" → ${acao.nav}`);
        }
      }
    }
    expect(invalidos).toEqual([]);
  });

  it("quando o destino é o hub, a sub-área existe", () => {
    const invalidos = [];
    for (const faixa of FAIXAS) {
      for (const acao of getMoodActions(faixa)) {
        if (acao.nav !== "planning") continue;
        if (!isPlanningArea(acao.navOpts?.area)) {
          invalidos.push(`${faixa}: "${acao.label}" → área ${acao.navOpts?.area}`);
        }
      }
    }
    expect(invalidos).toEqual([]);
  });

  it("toda faixa tem ação, e toda ação tem rótulo, ícone e destino", () => {
    for (const faixa of FAIXAS) {
      const acoes = getMoodActions(faixa);
      expect([faixa, acoes.length > 0]).toEqual([faixa, true]);
      for (const a of acoes) {
        expect([faixa, a.label?.length > 0, Boolean(a.Icon), Boolean(a.nav)]).toEqual([
          faixa,
          true,
          true,
          true,
        ]);
      }
    }
  });
});
