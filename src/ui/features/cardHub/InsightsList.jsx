import { T } from "../../tokens";
import { G } from "../../typography";

const TONE = {
  limit_warning: { bg: T.amberLight, dot: T.amber },
  decreasing_trend: { bg: T.greenLight, dot: T.green },
  best_month: { bg: T.greenLight, dot: T.green },
  ending_commitment: { bg: T.blueLight, dot: T.blue },
  no_commitments: { bg: T.grayLight, dot: T.inkFaint },
  overdue_invoices: { bg: T.redLight, dot: T.red },
};

/**
 * Só o que o backend afirma: cada linha é a `message` de um insight (future-commitments ou faturas vencidas).
 * Um insight com `href` vira um botão que leva até a fatura, via `onOpen`.
 */
export function InsightsList({ insights, onOpen }) {
  return (
    <div data-testid="insights-list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {insights.map((insight, i) => {
        const tone = TONE[insight.type] ?? TONE.no_commitments;
        const rowStyle = { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: tone.bg, borderRadius: 10 };
        const body = (
          <>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: tone.dot, flexShrink: 0 }} />
            <span style={{ ...G, fontSize: 12, color: T.ink, lineHeight: 1.5, flex: 1, minWidth: 0 }}>
              {insight.message}
              {insight.href && insight.actionLabel && <span data-testid="insight-action" style={{ display: "block", color: T.blue, fontWeight: 700 }}>{insight.actionLabel} →</span>}
            </span>
          </>
        );
        return insight.href && onOpen ? (
          <button key={`${insight.type}-${i}`} type="button" data-testid={`insight-${insight.type}`} onClick={() => onOpen(insight.href)}
            style={{ ...rowStyle, border: "none", width: "100%", textAlign: "left", cursor: "pointer" }}>
            {body}
          </button>
        ) : (
          <div key={`${insight.type}-${i}`} data-testid={`insight-${insight.type}`} style={rowStyle}>{body}</div>
        );
      })}
    </div>
  );
}
