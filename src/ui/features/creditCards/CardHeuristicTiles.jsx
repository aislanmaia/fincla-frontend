import { T } from "../../tokens";
import { G, NUM } from "../../typography";

const LABEL_STYLE = {
  ...G, fontSize: 11, fontWeight: 700, color: T.inkLight,
  textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10,
};
const TILE_STYLE = {
  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px",
};

/**
 * Os três cartões de heurística (Velocidade de gasto, Score de saúde, Melhor dia
 * para compras). Compartilhado pela aba Análises e pelo Hub; os números vêm
 * de `computeCardKpis` (cardKpis.js).
 */
export function CardHeuristicTiles({ kpis, formatBRL, isMobile }) {
  const {
    cycleProgressPercent, spentPercent, hasPaceData, onPace, projection,
    healthScore, healthColor, healthLabel, bestPurchaseDay, closingDay,
  } = kpis;
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
      <div style={TILE_STYLE}>
        <div style={LABEL_STYLE}>Velocidade de gasto</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ ...G, fontSize: 11, color: T.inkMid }}>Avançamos {cycleProgressPercent}% do ciclo</span>
            <span style={{ ...G, fontSize: 11, fontWeight: 700, color: !hasPaceData ? T.inkMid : onPace ? T.green : T.red }}>
              {spentPercent}% do limite gasto
            </span>
          </div>
          <div style={{ height: 8, background: T.grayLight, borderRadius: 99, overflow: "hidden", position: "relative" }}>
            <div style={{ height: "100%", width: `${cycleProgressPercent}%`, background: T.border, borderRadius: 99 }} />
            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${spentPercent}%`, background: !hasPaceData ? T.inkFaint : `linear-gradient(90deg,${onPace ? T.green : T.red}99,${onPace ? T.green : T.red})`, borderRadius: 99, transition: "width 0.8s" }} />
          </div>
        </div>
        <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.6 }}>
          {!hasPaceData
            ? <>Poucos dados ainda neste ciclo: a projeção de fechamento aparece quando houver lançamentos e mais de um dia de ciclo.</>
            : onPace
              ? <>✅ Ritmo controlado. Projeção de fechamento: <strong>{formatBRL(projection)}</strong>.</>
              : <>🔴 Gasto acelerado. Projeção: <strong style={{ color: T.red }}>{formatBRL(projection)}</strong> — acima do ritmo.</>}
        </div>
      </div>
      <div style={TILE_STYLE}>
        <div style={LABEL_STYLE}>Score de saúde</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
          <svg width={60} height={60} viewBox="0 0 60 60">
            <circle cx={30} cy={30} r={24} fill="none" stroke={T.grayLight} strokeWidth={6} />
            <circle cx={30} cy={30} r={24} fill="none" stroke={healthColor} strokeWidth={6}
              strokeDasharray={`${((healthScore ?? 0) / 100) * 150.8} 150.8`}
              strokeLinecap="round" transform="rotate(-90 30 30)"
              style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)" }} />
            <text x={30} y={35} textAnchor="middle" fontSize={14} fontWeight={800} fill={healthColor} fontFamily="Geist Mono,monospace">{healthScore === null ? "—" : Math.round(healthScore)}</text>
          </svg>
          <div>
            <div style={{ ...G, fontSize: 14, fontWeight: 700, color: healthColor }}>{healthLabel}</div>
            <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>{healthScore === null ? "fatura aberta indisponível" : "de 100 pontos"}</div>
          </div>
        </div>
        <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.6 }}>
          Uso ideal do limite: abaixo de 30% preserva seu score de crédito.
        </div>
      </div>
      <div style={TILE_STYLE}>
        <div style={LABEL_STYLE}>Melhor dia para compras</div>
        <div style={{ ...G, ...NUM, fontSize: 36, fontWeight: 800, color: T.blue, marginBottom: 6 }}>
          Dia {bestPurchaseDay}
        </div>
        <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.65 }}>
          Compras feitas logo após o fechamento (dia {closingDay}) têm quase <strong>30 dias extras</strong> de prazo sem juros.
        </div>
      </div>
    </div>
  );
}
