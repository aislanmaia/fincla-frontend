/**
 * Tokens visuais únicos para todos os calendários (Fincla).
 * Base: dropdown de período em Minhas Transações; legenda de dias = estilo Visão Geral (Intl short).
 */
import { T } from "../tokens";

/** Sombra do painel de período / popover de calendário (Transações). */
export const FINCLA_CALENDAR_SHADOW =
  "0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)";

/** Raio do cartão que envolve o grid (popover solto ou seção interna). */
export const FINCLA_CALENDAR_SURFACE_RADIUS = 16;

/** Tamanho da célula circular do dia (Transações / grid principal). */
export const FINCLA_CAL_DAY_PX = 28;

/** Legenda dos dias da semana: mesma leitura que o LocaleDatePicker (Visão Geral). */
export const finclaCalendarWeekdayCellStyle = {
  fontSize: 10,
  fontWeight: 700,
  color: T.inkLight,
  textAlign: "center",
  padding: "2px 0",
  lineHeight: 1.1,
};

/** Botões de mês anterior/próximo (setas) — fundo só no hover. */
export function finclaCalNavButtonBase() {
  return {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "4px 8px",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    color: T.inkMid,
  };
}

/** Título "Mês ano" central no cabeçalho do grid. */
export const finclaCalMonthTitleStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: T.ink,
  textAlign: "center",
  flex: 1,
  padding: "0 4px",
};
