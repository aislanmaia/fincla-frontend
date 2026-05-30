import { ChevronLeft, ChevronRight } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { M_MONO } from "../moodV4";
import { safePctOrFallback as safe } from "../../data/creditCardsAdapter.js";

/* ── CardVisual ─────────────────────────────────────────────── */
export function CardVisual({ c, selected, size = "md", onClick }) {
  const W = size === "sm" ? 130 : size === "md" ? 200 : 260;
  const H = Math.round(W / 1.586);
  const pct = safe(c.limite - c.disponivel, c.limite);
  return (
    <div onClick={() => onClick?.(c.id)} style={{
      width: W, height: H, borderRadius: size === "sm" ? 12 : 16, flexShrink: 0, cursor: "pointer",
      position: "relative", overflow: "hidden",
      background: `linear-gradient(135deg, ${c.cor1} 0%, ${c.cor2} 100%)`,
      boxShadow: selected ? `0 20px 50px ${c.cor2}55,0 0 0 2px ${c.corChip}88` : "0 4px 20px rgba(0,0,0,0.18)",
      transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
      transform: selected ? "translateY(-4px) scale(1.02)" : "none",
      padding: size === "sm" ? "11px 13px" : "16px 18px",
      display: "flex", flexDirection: "column", justifyContent: "space-between", userSelect: "none",
    }}>
      <div style={{ position: "absolute", top: -W * 0.3, right: -W * 0.2, width: W * 0.8, height: W * 0.8, borderRadius: "50%", background: `${c.corChip}12`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -W * 0.2, left: -W * 0.1, width: W * 0.55, height: W * 0.55, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
        <div style={{ ...G, fontSize: size === "sm" ? 8 : 10, fontWeight: 800, color: c.corChip, textTransform: "uppercase", letterSpacing: "0.16em" }}>{c.banco}</div>
        <svg width={size === "sm" ? 14 : 17} height={size === "sm" ? 18 : 22} viewBox="0 0 17 22" fill="none">
          <circle cx="4" cy="11" r="2" fill="rgba(255,255,255,0.7)" />
          <path d="M7 6 Q14 11 7 16" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" strokeLinecap="round" fill="none" />
          <path d="M10 3 Q20 11 10 19" stroke="rgba(255,255,255,0.3)" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      {size !== "sm" && (
        <div style={{ width: 30, height: 22, borderRadius: 4, alignSelf: "flex-start", background: "linear-gradient(135deg,#C9A84C 0%,#F0D060 45%,#C9A84C 100%)", position: "relative" }}>
          <div style={{ position: "absolute", top: "40%", left: 0, right: 0, height: "1px", background: "rgba(0,0,0,0.2)" }} />
          <div style={{ position: "absolute", left: "33%", top: 0, bottom: 0, width: "1px", background: "rgba(0,0,0,0.15)" }} />
        </div>
      )}
      <div style={{ ...M_MONO, ...NUM, fontSize: size === "sm" ? 9 : 11, color: "rgba(255,255,255,0.65)", letterSpacing: "0.18em" }}>
        ···· ···· ···· {c.dig}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", position: "relative" }}>
        <div>
          <div style={{ ...G, fontSize: size === "sm" ? 7.5 : 9, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>vence dia {c.vencimento}</div>
          <div style={{ ...G, fontSize: size === "sm" ? 10 : 12, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>{c.nome}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          {pct >= 70 && (
            <div style={{ ...G, fontSize: 7, fontWeight: 800, color: pct >= 90 ? "#7F1D1D" : "#78350F", background: pct >= 90 ? "#FCA5A5" : "#FCD34D", borderRadius: 5, padding: "2px 6px" }}>{pct}%</div>
          )}
          <div style={{ ...G, fontSize: size === "sm" ? 7 : 8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{c.bandeira}</div>
        </div>
      </div>
    </div>
  );
}

/* ── InvoiceNav ─────────────────────────────────────────────── */
export function InvoiceNav({ compact = false, invoice, previousInvoice, nextInvoice, onPrev, onNext }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 12 }}>
      <button onClick={onPrev} disabled={!previousInvoice}
        style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${T.border}`, background: previousInvoice ? T.surface : T.grayLight, cursor: previousInvoice ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", opacity: previousInvoice ? 1 : 0.3, transition: "all 0.15s" }}>
        <ChevronLeft size={14} color={T.inkMid} />
      </button>
      <div style={{ textAlign: "center", minWidth: compact ? 80 : 100 }}>
        <div style={{ ...G, ...NUM, fontSize: compact ? 12 : 14, fontWeight: 800, color: T.ink }}>{invoice?.mes}</div>
        {invoice?.atual && <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.blue, textTransform: "uppercase", letterSpacing: "0.09em" }}>Atual</div>}
      </div>
      <button onClick={onNext} disabled={!nextInvoice}
        style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${T.border}`, background: nextInvoice ? T.surface : T.grayLight, cursor: nextInvoice ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", opacity: nextInvoice ? 1 : 0.3, transition: "all 0.15s" }}>
        <ChevronRight size={14} color={T.inkMid} />
      </button>
    </div>
  );
}

/* ── KpiStrip ───────────────────────────────────────────────── */
export function KpiStrip({
  card,
  invoice,
  previousInvoice,
  formatBRL,
  diffPercent,
  usageColor,
  averageValue,
  cardInvoices,
  isMobile,
}) {
  const usagePercent = safe(card.limite - card.disponivel, card.limite);
  const healthLabel = usagePercent <= 30 ? "Saudável" : usagePercent <= 60 ? "Regular" : usagePercent <= 80 ? "Atenção" : "Crítico";
  const healthColor = usagePercent <= 30 ? T.green : usagePercent <= 60 ? T.blue : usagePercent <= 80 ? T.amber : T.red;
  const items = [
    { label: "Fatura atual", val: formatBRL(invoice?.val || 0), sub: diffPercent !== 0 ? `${diffPercent > 0 ? "↑" : "↓"} ${Math.abs(diffPercent)}% vs ${previousInvoice?.mes || "—"}` : "Primeira fatura", color: diffPercent > 0 ? T.red : T.green },
    { label: "Disponível", val: formatBRL(card.disponivel), sub: `${100 - usagePercent}% do limite livre`, color: usageColor },
    { label: "Média mensal", val: formatBRL(averageValue), sub: `últimos ${cardInvoices.length} meses`, color: T.blue },
    { label: "Saúde do cartão", val: healthLabel, sub: `${usagePercent}% do limite utilizado`, color: healthColor },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 10 : 12 }}>
      {items.map((k, i) => (
        <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: isMobile ? "12px 14px" : "14px 16px" }}>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 5 }}>{k.label}</div>
          <div style={{ ...G, ...NUM, fontSize: isMobile ? 15 : 18, fontWeight: 800, color: k.color, lineHeight: 1.2 }}>{k.val}</div>
          <div style={{ ...G, fontSize: 10, color: T.inkMid, marginTop: 4 }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ── LimitBar ───────────────────────────────────────────────── */
export function LimitBar({ card, usagePercent, usageColor, formatBRL }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        <span style={{ ...G, fontSize: 11, color: T.inkMid }}>Limite utilizado</span>
        <span style={{ ...G, fontSize: 11, fontWeight: 700, color: usageColor }}>{usagePercent}%</span>
      </div>
      <div style={{ height: 6, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${usagePercent}%`, background: `linear-gradient(90deg,${usageColor}88,${usageColor})`, borderRadius: 99, transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkLight }}>{formatBRL(card.limite - card.disponivel)} usados</span>
        <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkLight }}>limite {formatBRL(card.limite)}</span>
      </div>
    </div>
  );
}

/* ── CategoryBars ──────────────────────────────────────────── */
export function CategoryBars({ categoryTotals, filterCategory, setFilterCategory, formatBRL }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {categoryTotals.map((c, i) => (
        <div key={i} onClick={() => setFilterCategory(filterCategory === c.cat ? null : c.cat)}
          style={{ cursor: "pointer", opacity: filterCategory && filterCategory !== c.cat ? 0.35 : 1, transition: "opacity 0.15s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
              <span style={{ ...G, fontSize: 12, color: T.ink, fontWeight: filterCategory === c.cat ? 700 : 400 }}>{c.cat}</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ ...G, ...NUM, fontSize: 12, fontWeight: 700, color: T.ink }}>{formatBRL(c.val)}</span>
              <span style={{ ...G, fontSize: 10, color: T.inkLight, minWidth: 28, textAlign: "right" }}>{c.pct}%</span>
            </div>
          </div>
          <div style={{ height: 4, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${c.pct}%`, background: c.color, borderRadius: 99, transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
          </div>
        </div>
      ))}
      {filterCategory && (
        <button onClick={() => setFilterCategory(null)}
          style={{ ...G, fontSize: 11, color: T.inkMid, background: "none", border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", alignSelf: "flex-start" }}>
          ✕ Limpar filtro
        </button>
      )}
    </div>
  );
}
