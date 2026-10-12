import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { formatMoney } from "../../money/formatMoney.js";

const LABEL = { ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.09em" };

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Saldo de parcelas pendentes (o mesmo número da tela Parcelas & Compromissos): só é afirmado
 * quando o backend o provou completo e na moeda do cartão; ausente é "não sabemos", nunca zero.
 */
export function summarizeCommitted(future, currency) {
  const balance = future?.remaining_balance;
  if (!currency || balance?.complete !== true || !Array.isArray(balance.series)) return null;
  if (balance.net_amount === null || balance.net_amount === undefined || !Number.isFinite(Number(balance.net_amount))
    || balance.net_amount_currency !== currency) return null;
  const ends = balance.series.map((item) => String(item.last_due_date ?? "")).filter((date) => /^\d{4}-(0[1-9]|1[0-2])/.test(date)).sort();
  if (ends.length !== balance.series.length) return null;
  const last = ends[ends.length - 1];
  return {
    net: balance.net_amount,
    count: balance.series.length,
    until: last ? `${MONTHS[Number(last.slice(5, 7)) - 1]}/${last.slice(0, 4)}` : null,
  };
}

/** Limite disponível (com o percentual usado) e o saldo comprometido em parcelas, que abre o raio-x. */
export function LimitTiles({ card, currency, committed = null, isMobile, onEdit, onOpenCommitments }) {
  const hasLimit = card.credit_limit !== null && card.credit_limit !== undefined && Number(card.credit_limit) > 0;
  const available = hasLimit ? formatMoney(card.available_limit, currency) : null;
  const totalLimit = hasLimit ? formatMoney(card.credit_limit, currency) : null;
  const usage = Number.isFinite(Number(card.limit_usage_percent)) && card.limit_usage_percent !== null
    ? Math.round(Number(card.limit_usage_percent))
    : null;
  const usedPercent = usage === null ? null : Math.min(100, Math.max(0, usage));
  // Passou do limite: disponível é R$ 0,00 (um fato) e o excesso é dito em dinheiro, não só em porcentagem.
  const usedNumber = card.used_limit === null || card.used_limit === undefined ? null : Number(card.used_limit);
  // Em centavos: nada de 0,10000000000000009 nem de "excedido" por fração de centavo.
  const overCents = hasLimit && usedNumber !== null && Number.isFinite(usedNumber) ? Math.round(usedNumber * 100) - Math.round(Number(card.credit_limit) * 100) : 0;
  const overBy = overCents > 0 ? overCents / 100 : null;
  const barColor = usage === null ? T.inkFaint : usage >= 90 ? T.red : usage >= 70 ? T.amber : T.green;
  // Link de verdade: o nome acessível é o conteúdo (valor e %), e só Enter ativa, como em <a>.
  const openProps = onOpenCommitments
    ? { role: "link", tabIndex: 0, onClick: onOpenCommitments, onKeyDown: (event) => { if (event.key === "Enter") onOpenCommitments(); } }
    : {};
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: isMobile ? 10 : 12 }}>
      <div data-testid="kpi-available" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: isMobile ? "12px 14px" : "14px 16px", boxShadow: T.sm }}>
        <div style={{ ...LABEL, marginBottom: 5 }}>{overBy !== null ? "Limite excedido" : "Limite disponível"}</div>
        <div style={{ ...G, ...NUM, fontSize: isMobile ? 16 : 19, fontWeight: 800, color: T.ink }}>
          {available ?? (overBy !== null ? formatMoney(0, currency) : hasLimit ? "Não calculado" : "Sem limite cadastrado")}
        </div>
        {overBy !== null && <div data-testid="limit-over" style={{ ...G, fontSize: 11, fontWeight: 700, color: T.red, marginTop: 5 }}>{formatMoney(overBy, currency) ?? "—"} acima do limite</div>}
        {(available || overBy !== null) && totalLimit ? <>
          <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 5 }}>de {totalLimit} de limite total</div>
          {usedPercent !== null && <>
            <div role="meter" aria-label="Percentual do limite usado" aria-valuemin={0} aria-valuemax={100}
              aria-valuenow={usedPercent} aria-valuetext={usage > 100 ? `${usage}% do limite usado, acima do limite` : undefined}
              style={{ height: 5, background: T.grayLight, borderRadius: 99, overflow: "hidden", marginTop: 9 }}>
              <div style={{ height: "100%", width: `${usedPercent}%`, background: barColor, borderRadius: 99 }} />
            </div>
            <div style={{ ...G, fontSize: 10, color: T.inkMid, marginTop: 5 }}>{usage}% do limite usado</div>
          </>}
        </> : <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 7, lineHeight: 1.45 }}>
          {hasLimit ? "Não foi possível calcular o valor disponível deste cartão." : "Cadastre o limite do cartão para acompanhar quanto ainda pode usar."}
        </div>}
        {!hasLimit && onEdit && <button type="button" onClick={onEdit} style={{ ...G, background: "none", border: 0, color: T.blue, padding: "8px 0 0", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Definir limite</button>}
      </div>
      <div data-testid="kpi-committed" {...openProps} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: isMobile ? "12px 14px" : "14px 16px", boxShadow: T.sm, cursor: onOpenCommitments ? "pointer" : "default" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 8, marginBottom: 5 }}>
          <div style={LABEL}>Comprometido em parcelas</div>
          {onOpenCommitments && <span style={{ ...G, fontSize: 10, color: T.blue, fontWeight: 700, whiteSpace: "nowrap" }}>ver todas →</span>}
        </div>
        <div style={{ ...G, ...NUM, fontSize: isMobile ? 16 : 19, fontWeight: 800, color: T.blue }}>{committed ? formatMoney(committed.net, currency) ?? "—" : "—"}</div>
        <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 8 }}>
          {committed
            ? (committed.count === 0 ? "Nenhuma parcela pendente" : `${committed.count} ${committed.count === 1 ? "ativa" : "ativas"} · até ${committed.until}`)
            : "Saldo exato indisponível"}
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
