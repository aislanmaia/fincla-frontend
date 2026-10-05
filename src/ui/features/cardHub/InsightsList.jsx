import { T } from "../../tokens";
import { G } from "../../typography";

const TONE = {
  limit_warning: { bg: T.amberLight, dot: T.amber },
  decreasing_trend: { bg: T.greenLight, dot: T.green },
  best_month: { bg: T.greenLight, dot: T.green },
  ending_commitment: { bg: T.blueLight, dot: T.blue },
  no_commitments: { bg: T.grayLight, dot: T.inkFaint },
};

/** Só o que o backend afirma: cada linha é a `message` de um insight de future-commitments. */
export function InsightsList({ insights }) {
  return (
    <div data-testid="insights-list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {insights.map((insight, i) => {
        const tone = TONE[insight.type] ?? TONE.no_commitments;
        return (
          <div key={`${insight.type}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: tone.bg, borderRadius: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: tone.dot, flexShrink: 0 }} />
            <span style={{ ...G, fontSize: 12, color: T.ink, lineHeight: 1.5 }}>{insight.message}</span>
          </div>
        );
      })}
    </div>
  );
}
