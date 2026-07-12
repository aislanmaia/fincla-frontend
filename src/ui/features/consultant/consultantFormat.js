import { T } from "../../tokens";
import { fmtAbs } from "../../formatters";
import { HEALTH_BAND_NONE, clientHealthBand } from "./consultantClientsView";

export const DASH = "—";
const LOADING = "…";

/**
 * Formata um valor agregado do consultor distinguindo os 3 estados:
 * carregando ("…"), carregado-vazio ("—") e com dado (via `format`).
 * Compartilhado por `consultantKpis` (KPIs do Painel) para não
 * duplicar a regra de placeholder.
 */
export function aggregateValue(raw, hasLoaded, format) {
  if (raw != null) return format(raw);
  return hasLoaded ? DASH : LOADING;
}

// --- Apresentação por-cliente (compartilhado entre o card e a tabela da carteira) ---

/**
 * Tom (cor/fundo/rótulo) por faixa de saúde 0–100.
 *
 * `health == null` (score ainda não calculado) recebe um tom NEUTRO. Cair no
 * `return` vermelho pintaria de "Em risco" um cliente que ninguém avaliou.
 */
export function healthTone(health) {
  const band = clientHealthBand(health);
  if (band === HEALTH_BAND_NONE) return { color: T.inkGhost, bg: T.grayLight, label: "Sem score" };
  if (band === "healthy") return { color: T.green, bg: T.greenLight, label: "Saudável" };
  if (band === "attention") return { color: T.amber, bg: T.amberLight, label: "Atenção" };
  // "Frágil", não "Em risco": risco é o gatilho por regras do Painel, com motivo.
  return { color: T.red, bg: T.redLight, label: "Frágil" };
}

/** Dinheiro (patrimônio/saldo cru) com sinal só quando negativo. `fmtSgn` força "+". */
export function fmtMoney(value) {
  const n = Number(value) || 0;
  return (n < 0 ? "−" : "") + fmtAbs(n);
}

/** Dinheiro pt-BR sem centavos (R$ 1.234), sinal só quando negativo. Espelha o
 * `fmtBRL0` da referência de design do consultor. */
export function fmtBRL0(value) {
  const n = Math.round(Number(value) || 0);
  return (n < 0 ? "−" : "") + "R$ " + Math.abs(n).toLocaleString("pt-BR");
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

/**
 * "há 3 minutos" — quando uma avaliação em cache foi de fato calculada.
 *
 * Recebe o `computed_at` do backend: ISO **com offset**. O offset não é detalhe:
 * sem ele o JS interpretaria o timestamp como hora local e um servidor em UTC
 * daria 3h de erro para um browser em BRT — o drawer anunciaria "há 3 horas"
 * numa avaliação de 3 minutos.
 *
 * Devolve `null` (e não uma string qualquer) quando não há o que dizer: quem
 * chama decide se some com o rótulo, em vez de exibir um "—" sem sentido.
 */
export function fmtComputedAt(iso, now = Date.now()) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const seconds = Math.round((now - then) / 1000);
  // Relógios de cliente e servidor divergem; um "há -2 minutos" seria absurdo na
  // tela. Tudo que parece futuro vira "agora mesmo".
  if (seconds < 60) return "agora mesmo";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;

  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}
