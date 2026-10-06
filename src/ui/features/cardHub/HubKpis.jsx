import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { formatMoney } from "../../money/formatMoney.js";

const LABEL = { ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.09em" };

/** Disponível e Comprometido em parcelas: os dois números de limite que o backend entrega. */
export function LimitTiles({ card, currency, isMobile }) {
  const available = formatMoney(card.available_limit, currency) ?? "—";
  const used = formatMoney(card.used_limit, currency) ?? "—";
  const usage = Number.isFinite(Number(card.limit_usage_percent)) && card.limit_usage_percent !== null
    ? Math.round(Number(card.limit_usage_percent))
    : null;
  const barColor = usage === null ? T.inkFaint : usage >= 90 ? T.red : usage >= 70 ? T.amber : T.green;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: isMobile ? 10 : 12 }}>
      <div data-testid="kpi-available" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: isMobile ? "12px 14px" : "14px 16px", boxShadow: T.sm }}>
        <div style={{ ...LABEL, marginBottom: 5 }}>Disponível</div>
        <div style={{ ...G, ...NUM, fontSize: isMobile ? 16 : 19, fontWeight: 800, color: T.ink }}>{available}</div>
        <div style={{ height: 4, background: T.grayLight, borderRadius: 99, overflow: "hidden", marginTop: 8 }}>
          <div style={{ height: "100%", width: `${usage === null ? 0 : Math.min(100, Math.max(0, 100 - usage))}%`, background: T.green, borderRadius: 99 }} />
        </div>
      </div>
      <div data-testid="kpi-committed" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: isMobile ? "12px 14px" : "14px 16px", boxShadow: T.sm }}>
        <div style={{ ...LABEL, marginBottom: 5 }}>{isMobile ? "Comprometido" : "Comprometido em parcelas"}</div>
        <div style={{ ...G, ...NUM, fontSize: isMobile ? 16 : 19, fontWeight: 800, color: T.blue }}>{used}</div>
        <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 8 }}>
          {usage === null ? "Limite não informado" : `${usage}% do limite`}
        </div>
      </div>
    </div>
  );
}

/** Versão compacta (mobile) das três heurísticas: um número por coluna, sem texto explicativo. */
export function CompactKpiStrip({ kpis }) {
  const { spentPercent, hasPaceData, onPace, healthScore, healthColor, healthLabel, bestPurchaseDay } = kpis;
  const paceColor = !hasPaceData ? T.inkMid : onPace ? T.green : T.red;
  const col = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 };
  const caption = { ...G, fontSize: 11, color: T.inkLight, textAlign: "center", lineHeight: 1.2 };
  return (
    <div data-testid="compact-kpis" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 8px", display: "flex", alignItems: "center", boxShadow: T.sm }}>
      <div style={col}>
        <span aria-hidden="true" style={{ fontSize: 15 }}>⚡</span>
        <div style={{ ...G, ...NUM, fontSize: 15, fontWeight: 800, color: paceColor }}>{spentPercent === null ? "—" : `${spentPercent}%`}</div>
        <div style={caption}>{!hasPaceData ? "poucos dados no ciclo" : onPace ? "ritmo controlado" : "gasto acelerado"}</div>
      </div>
      <div style={{ width: 1, height: 40, background: T.border, flexShrink: 0 }} />
      <div style={col}>
        <svg width="26" height="26" viewBox="0 0 60 60" aria-hidden="true">
          <circle cx="30" cy="30" r="24" fill="none" stroke={T.grayLight} strokeWidth="9" />
          <circle cx="30" cy="30" r="24" fill="none" stroke={healthColor} strokeWidth="9"
            strokeDasharray={`${((healthScore ?? 0) / 100) * 150.8} 150.8`} strokeLinecap="round" transform="rotate(-90 30 30)" />
        </svg>
        <div style={{ ...G, ...NUM, fontSize: 15, fontWeight: 800, color: healthColor }}>{healthScore === null ? "—" : Math.round(healthScore)}</div>
        <div style={caption}>{healthScore === null ? "score sem dados" : `score ${healthLabel.toLowerCase()}`}</div>
      </div>
      <div style={{ width: 1, height: 40, background: T.border, flexShrink: 0 }} />
      <div style={col}>
        <span aria-hidden="true" style={{ fontSize: 15 }}>📅</span>
        <div style={{ ...G, ...NUM, fontSize: 15, fontWeight: 800, color: T.blue }}>Dia {bestPurchaseDay}</div>
        <div style={caption}>melhor para comprar</div>
      </div>
    </div>
  );
}
