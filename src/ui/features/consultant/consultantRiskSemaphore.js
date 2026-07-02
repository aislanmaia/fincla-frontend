import { T } from "../../tokens";
import { aggregateValue } from "./consultantFormat";

/**
 * Modelo puro do semáforo da carteira (A1.3). Com os endpoints atuais só dá
 * para dividir a base em **2 vias derivadas**: "Precisam de atenção" (o total
 * de `/clients-at-risk`) e "Em dia" (o restante da base = `organizations_count`
 * do health-index menos os em risco). A divisão em 3 vias (saudável / atenção /
 * em risco) exige saúde por-cliente — deferida para pós-A2.0. Não rotulamos o
 * verde como "Saudável" (seria overclaim): "Em dia" = não sinalizado em risco.
 *
 * A divisão só é confiável quando **ambos** os dados carregaram: o total em
 * risco (`atRiskTotal != null`) e a base (`organizationsCount != null`, do
 * health-index). Passe `null`/`undefined` em qualquer um p/ sinalizar que ainda
 * não há dado — aí `splitAvailable=false` e a divisão não é exibida (não
 * inventamos "todos em dia", nem colapsamos os em risco a 0 por base
 * desconhecida). `centerValue` = saúde média agregada arredondada ("…" antes de
 * carregar, "—" carregado sem dado — depende só do health-index/`hasLoaded`).
 *
 * @param {{ atRiskTotal?: number|null, organizationsCount?: number|null, healthIndex?: number|null, hasLoaded?: boolean }} input
 */
export function buildRiskSemaphore({ atRiskTotal, organizationsCount, healthIndex, hasLoaded = false } = {}) {
  const base = organizationsCount ?? 0;
  const splitAvailable = atRiskTotal != null && organizationsCount != null;

  let segments = [];
  if (splitAvailable) {
    const atRisk = Math.min(Math.max(0, atRiskTotal), base);
    segments = [
      { id: "attention", label: "Precisam de atenção", value: atRisk, color: T.red },
      { id: "ok", label: "Em dia", value: base - atRisk, color: T.green },
    ];
  }

  const centerValue = aggregateValue(healthIndex, hasLoaded, (n) => String(Math.round(n)));

  return { segments, base, centerValue, splitAvailable };
}
