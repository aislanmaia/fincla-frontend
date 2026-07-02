import { T } from "../../tokens";
import { fmtAbs } from "../../formatters";
import { clientHealthBand } from "./consultantClientsView";

export const DASH = "—";
const LOADING = "…";

/**
 * Formata um valor agregado do consultor distinguindo os 3 estados:
 * carregando ("…"), carregado-vazio ("—") e com dado (via `format`).
 * Compartilhado por `consultantKpis` e `consultantRiskSemaphore` para não
 * duplicar a regra de placeholder.
 */
export function aggregateValue(raw, hasLoaded, format) {
  if (raw != null) return format(raw);
  return hasLoaded ? DASH : LOADING;
}

// --- Apresentação por-cliente (compartilhado entre o card e a tabela da carteira) ---

/** Tom (cor/fundo/rótulo) por faixa de saúde 0–100. */
export function healthTone(health) {
  const band = clientHealthBand(health);
  if (band === "healthy") return { color: T.green, bg: T.greenLight, label: "Em dia" };
  if (band === "attention") return { color: T.amber, bg: T.amberLight, label: "Atenção" };
  return { color: T.red, bg: T.redLight, label: "Em risco" };
}

/** Dinheiro (patrimônio/saldo cru) com sinal só quando negativo. `fmtSgn` força "+". */
export function fmtMoney(value) {
  const n = Number(value) || 0;
  return (n < 0 ? "−" : "") + fmtAbs(n);
}

/** Percentual com 1 casa, robusto a valor ausente/não-finito. */
export function fmtPct(value) {
  const n = Number(value);
  return `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`;
}

/** Seta de tendência do saldo mês a mês. */
export function trendGlyph(trend) {
  if (trend === "up") return { glyph: "↑", color: T.green };
  if (trend === "down") return { glyph: "↓", color: T.red };
  return { glyph: "→", color: T.inkLight };
}

/** Última atividade em pt-BR (YYYY-MM-DD → dd/mm/aaaa), ou "—". */
export function fmtLastActive(iso) {
  if (!iso) return DASH;
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return DASH;
  return `${d}/${m}/${y}`;
}
