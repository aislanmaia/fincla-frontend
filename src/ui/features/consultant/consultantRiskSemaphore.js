import { T } from "../../tokens";

/**
 * Modelo puro do semáforo da carteira (A1.3). Com os endpoints atuais só dá
 * para dividir a base em **2 vias derivadas**: "Precisam de atenção" (o total
 * de `/clients-at-risk`) e "Em dia" (o restante da base = `organizations_count`
 * do health-index menos os em risco). A divisão em 3 vias (saudável / atenção /
 * em risco) exige saúde por-cliente — deferida para pós-A2.0. Não rotulamos o
 * verde como "Saudável" (seria overclaim): "Em dia" = não sinalizado em risco.
 *
 * `centerValue` = saúde média agregada (health-index.index), arredondada;
 * "…" antes de carregar, "—" se carregado sem dado.
 *
 * @param {{ atRiskTotal?: number, organizationsCount?: number, healthIndex?: number|null, hasLoaded?: boolean }} input
 */
export function buildRiskSemaphore({ atRiskTotal, organizationsCount, healthIndex, hasLoaded = false } = {}) {
  const base = organizationsCount ?? 0;
  const atRisk = Math.max(0, Math.min(atRiskTotal ?? 0, base));
  const emDia = Math.max(0, base - atRisk);

  const segments = [
    { id: "attention", label: "Precisam de atenção", value: atRisk, color: T.red },
    { id: "ok", label: "Em dia", value: emDia, color: T.green },
  ];

  let centerValue;
  if (healthIndex != null) centerValue = String(Math.round(healthIndex));
  else centerValue = hasLoaded ? "—" : "…";

  return { segments, base, centerValue };
}
