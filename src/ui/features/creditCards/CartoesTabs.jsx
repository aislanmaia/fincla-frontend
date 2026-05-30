import { useState } from "react";
import {
  AlertTriangle, Check, ChevronDown, RefreshCw, Repeat, RotateCcw,
} from "lucide-react";
import {
  Bar, BarChart as ReBarChart, CartesianGrid, Cell, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { M_MONO } from "../moodV4";
import { CAT_COLORS_CARD } from "../../data/creditCardsMockData.js";
import { safePctOrFallback as safe } from "../../data/creditCardsAdapter.js";
import { TxRow } from "./CardFaturaList.jsx";

const TODAY_DAY = 18;

/* ── RecurringTab ─────────────────────────────────────────── */
export function RecurringTab({
  recurringItems, recurringTotal, invoice, card, isMobile, formatBRL, categoryColor, onLaunchRefund,
}) {
  const hasItems = recurringItems.length > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: T.purpleLight, border: `1px solid ${T.purple}22`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Repeat size={15} color={T.purple} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.purple, marginBottom: 3 }}>Assinaturas e cobranças recorrentes</div>
          <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.65 }}>
            {hasItems
              ? <>{recurringItems.length} cobranças automáticas totalizam <strong style={{ color: T.ink }}>{formatBRL(recurringTotal)}</strong>/mês. São {(invoice?.val || 0) > 0 ? Math.round(recurringTotal / (invoice.val) * 100) : 0}% da fatura atual.</>
              : "Nenhuma recorrência identificada nesta fatura."}
          </div>
        </div>
      </div>
      {hasItems && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 10 }}>
            {[
              { label: "Total mensal", val: formatBRL(recurringTotal), sub: `${recurringItems.length} assinaturas ativas` },
              { label: "Total anual", val: formatBRL(recurringTotal * 12), sub: "projeção 12 meses" },
              { label: "% da fatura", val: `${(invoice?.val || 0) > 0 ? Math.round(recurringTotal / (invoice?.val || 0) * 100) : 0}%`, sub: "das cobranças são fixas" },
            ].map((k, i) => (
              <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 5 }}>{k.label}</div>
                <div style={{ ...G, ...NUM, fontSize: 16, fontWeight: 800, color: T.purple }}>{k.val}</div>
                <div style={{ ...G, fontSize: 10, color: T.inkMid, marginTop: 3 }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "0 16px" }}>
            <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink, padding: "13px 0", borderBottom: `1px solid ${T.border}` }}>
              Cobranças automáticas
            </div>
            {recurringItems.map((item) => (
              <TxRow key={item.id} item={item} card={card} categoryColor={categoryColor} formatBRL={formatBRL} onLaunchRefund={onLaunchRefund} />
            ))}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
              <span style={{ ...G, fontSize: 12, color: T.inkMid }}>{recurringItems.length} recorrências</span>
              <span style={{ ...M_MONO, ...NUM, fontSize: 14, fontWeight: 800, color: T.purple }}>{formatBRL(recurringTotal)}</span>
            </div>
          </div>
          <div style={{ background: T.amberLight, border: `1px solid ${T.amber}22`, borderRadius: 12, padding: "12px 16px" }}>
            <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.amber, marginBottom: 4 }}>💡 Revisão de assinaturas</div>
            <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.65 }}>
              Consultores financeiros recomendam revisar assinaturas a cada 3 meses. Cancele o que não usa — uma assinatura de {formatBRL(recurringItems[0]?.val || 0)} representa <strong>{formatBRL((recurringItems[0]?.val || 0) * 12)}/ano</strong>.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── HistoryTab ────────────────────────────────────────────── */
export function HistoryTab({ cardInvoices, isMobile, formatBRL }) {
  const monthlyAverage = Math.round(cardInvoices.reduce((s, f) => s + f.val, 0) / cardInvoices.length);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 10 }}>
        {[
          { label: "Total de faturas", val: cardInvoices.length, sub: "histórico disponível" },
          { label: "Valor total", val: formatBRL(cardInvoices.reduce((s, f) => s + f.val, 0)), sub: "período completo" },
          { label: "Média mensal", val: formatBRL(monthlyAverage), sub: `últimos ${cardInvoices.length} meses` },
        ].map((k, i) => (
          <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 5 }}>{k.label}</div>
            <div style={{ ...G, ...NUM, fontSize: 18, fontWeight: 800, color: T.ink }}>{k.val}</div>
            <div style={{ ...G, fontSize: 10, color: T.inkLight, marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr auto" : "2fr 1fr 1fr auto", padding: "10px 18px", borderBottom: `1px solid ${T.border}`, background: T.bg, gap: 12 }}>
          {(isMobile ? ["Mês", "Valor"] : ["Mês / Ano", "Vencimento", "Valor", "Status"]).map((h) => (
            <div key={h} style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em" }}>{h}</div>
          ))}
        </div>
        {[...cardInvoices].reverse().map((f, i) => {
          const overdue = !f.pago && !f.atual;
          const statusColor = f.pago ? T.green : f.atual ? T.blue : T.red;
          const statusLabel = f.pago ? "Paga" : f.atual ? "Aberta" : "Vencida";
          return (
            <div key={f.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr auto" : "2fr 1fr 1fr auto", gap: 12, padding: "13px 18px", alignItems: "center", borderBottom: i < cardInvoices.length - 1 ? `1px solid ${T.border}` : "none", background: f.atual ? `${T.blueLight}55` : "transparent" }}>
              <div>
                <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>{f.mes}</div>
                {f.atual && <div style={{ ...G, fontSize: 10, color: T.blue }}>Fatura atual</div>}
              </div>
              {!isMobile && <div style={{ ...G, fontSize: 12, color: T.inkMid }}>{f.venc}</div>}
              <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: overdue ? T.red : T.ink }}>{formatBRL(f.val)}</div>
              <span style={{ ...G, fontSize: 10, fontWeight: 700, color: statusColor, background: f.pago ? "#DCFCE7" : f.atual ? "#EFF6FF" : "#FEF2F2", borderRadius: 8, padding: "3px 10px", whiteSpace: "nowrap" }}>{statusLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── PlanningTab ───────────────────────────────────────────── */
export function PlanningTab({ card, cardInstallments, isMobile, formatBRL }) {
  const planningMonths = card?.planejamento?.length ? card.planejamento : null;
  const months = planningMonths ? planningMonths.map((item) => item.mes) : ["Abr'26", "Mai'26", "Jun'26", "Jul'26", "Ago'26", "Set'26"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: T.blueLight, border: `1px solid ${T.blue}22`, borderRadius: 12, padding: "12px 16px" }}>
        <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.blue, marginBottom: 3 }}>Compromissos futuros</div>
        <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.65 }}>
          Parcelas já aprovadas que vão aparecer nas próximas faturas. Use para planejar seu orçamento com antecedência.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
        {months.map((month, idx) => {
          const monthData = planningMonths?.find((item) => item.mes === month) || null;
          const activeInstallments = monthData ? monthData.itens : cardInstallments.filter((p) => p.pago + idx + 1 <= p.total);
          const total = monthData ? monthData.total : activeInstallments.reduce((s, p) => s + p.vParcela, 0);
          const totalCount = monthData?.count ?? activeInstallments.length;
          const isNext = idx === 0;
          return (
            <div key={month} style={{ background: isNext ? `${T.blueLight}80` : T.surface, border: `1.5px solid ${isNext ? T.blue : T.border}`, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ ...G, fontSize: 13, fontWeight: 800, color: T.ink }}>{month}</div>
                {isNext && <span style={{ ...G, fontSize: 10, fontWeight: 700, color: "#fff", background: T.blue, borderRadius: 6, padding: "2px 8px" }}>Próximo</span>}
              </div>
              <div style={{ ...G, fontSize: 10, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 4 }}>Total previsto</div>
              <div style={{ ...G, ...NUM, fontSize: 20, fontWeight: 800, color: T.ink, marginBottom: 10 }}>
                {total > 0 ? formatBRL(total) : "R$ 0,00"}
              </div>
              {activeInstallments.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ ...G, fontSize: 10, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 3 }}>
                    {totalCount} parcela{totalCount !== 1 ? "s" : ""}
                  </div>
                  {activeInstallments.slice(0, 3).map((p) => (
                    <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "5px 0", borderTop: `1px solid ${T.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ ...G, fontSize: 11, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{p.desc}</span>
                        <span style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.ink, flexShrink: 0 }}>{formatBRL(monthData ? p.val : p.vParcela)}</span>
                      </div>
                      {p.hasRefundsLinked && (
                        <div title={`Esta compra tem ${p.refundsCount} estorno${p.refundsCount !== 1 ? "s" : ""} vinculado${p.refundsCount !== 1 ? "s" : ""} totalizando ${formatBRL(p.refundsTotalValue || 0)}. Considere isso ao planejar o orçamento.`}
                          style={{ ...G, fontSize: 9.5, color: T.green, display: "flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
                          <RotateCcw size={9} /> Tem estorno{p.refundsTotalValue > 0 ? ` · ${formatBRL(p.refundsTotalValue)} abatido${p.refundsCount !== 1 ? "s" : ""}` : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ ...G, fontSize: 11, color: T.inkLight, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={13} color={T.green} /> Sem parcelas previstas
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── InstallmentsTab ───────────────────────────────────────── */
export function InstallmentsTab({
  cardInstallments, card, totalInstallments, totalRefunds, hasRefundedInstallments,
  isMobile, formatBRL, onMoveInstallment,
}) {
  const [expandedInstallment, setExpandedInstallment] = useState(null);
  const [sortBy, setSortBy] = useState("value");
  const monthlyTotal = cardInstallments.reduce((s, p) => s + p.vParcela, 0);
  const monthlyPercent = safe(monthlyTotal, card.limite);
  const limitColor = monthlyPercent >= 40 ? T.amber : T.green;
  const sorted = [...cardInstallments].sort((a, b) => {
    if (sortBy === "value")     return b.vParcela - a.vParcela;
    if (sortBy === "progress")  return Math.round(a.pago / a.total * 100) - Math.round(b.pago / b.total * 100);
    if (sortBy === "remaining") return (b.total - b.pago) * b.vParcela - (a.total - a.pago) * a.vParcela;
    return 0;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 12 }}>
        {[
          { label: "Parcelas ativas", val: cardInstallments.length, valSuffix: cardInstallments.length === 1 ? " item" : " itens", sub: "em andamento neste cartão", color: T.blue, icon: "🧩" },
          { label: "Total comprometido", val: formatBRL(totalInstallments), valSuffix: "", sub: hasRefundedInstallments ? `líquido após ${formatBRL(totalRefunds)} em estornos` : "soma de todas as parcelas futuras", color: T.ink, icon: "💳" },
          { label: "Comprometimento mensal", val: `${monthlyPercent}%`, valSuffix: "", sub: `${formatBRL(monthlyTotal)}/mês do limite`, color: limitColor, icon: monthlyPercent >= 40 ? "⚠️" : "✅" },
        ].map((k, i) => (
          <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkMid }}>{k.label}</span>
              <span style={{ fontSize: 16 }}>{k.icon}</span>
            </div>
            <div style={{ ...G, ...NUM, fontSize: isMobile ? 20 : 22, fontWeight: 800, color: k.color, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              {k.val}<span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600 }}>{k.valSuffix}</span>
            </div>
            <div style={{ ...G, fontSize: 11, color: T.inkLight, lineHeight: 1.5 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ background: T.blueLight, border: `1px solid ${T.blue}22`, borderRadius: 12, padding: "12px 16px" }}>
        <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.blue, marginBottom: 4 }}>💡 Estratégia financeira</div>
        <div style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.7 }}>
          Ao quitar uma parcela antecipadamente, você libera espaço no limite e reduz o juros implícito.
          Priorize as de maior valor por parcela. Use "Mover" para distribuir o impacto em meses com mais folga.
        </div>
      </div>
      {monthlyPercent >= 30 && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: T.amberLight, border: `1px solid ${T.amber}33`, borderRadius: 12, padding: "12px 16px" }}>
          <AlertTriangle size={15} color={T.amber} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.amber, marginBottom: 2 }}>Comprometimento elevado</div>
            <div style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.6 }}>
              {formatBRL(monthlyTotal)}/mês em parcelas representa {monthlyPercent}% do limite.
              Consultores recomendam manter abaixo de 30% para preservar margem de segurança.
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span style={{ ...G, fontSize: 12, fontWeight: 600, color: T.inkMid }}>
          {sorted.length} parcela{sorted.length !== 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...G, fontSize: 11, color: T.inkLight }}>Ordenar:</span>
          {[["value", "Valor"], ["progress", "Progresso"], ["remaining", "Restante"]].map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key)}
              style={{ ...G, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 8, border: `1.5px solid ${sortBy === key ? T.ink : T.border}`, background: sortBy === key ? T.ink : T.surface, color: sortBy === key ? "#fff" : T.inkMid, cursor: "pointer", transition: "all 0.12s" }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
        {sorted.map((p, idx) => {
          const pct = Math.round(p.pago / p.total * 100);
          const remainingCount = p.total - p.pago;
          const remainingValue = remainingCount * p.vParcela;
          const rowColor = CAT_COLORS_CARD[p.cat] || T.inkMid;
          const isOpen = expandedInstallment === p.id;
          const isLast = idx === sorted.length - 1;
          return (
            <div key={p.id}>
              <div onClick={() => setExpandedInstallment(isOpen ? null : p.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: isLast && !isOpen ? "none" : `1px solid ${T.border}`, cursor: "pointer", userSelect: "none", background: isOpen ? T.bg : "transparent", transition: "background 0.12s" }}
                onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = T.bg; }}
                onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${rowColor}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>
                  {p.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
                    <span style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.desc}</span>
                    <span style={{ ...G, fontSize: 10, fontWeight: 700, color: rowColor, background: `${rowColor}14`, borderRadius: 5, padding: "1px 6px", flexShrink: 0 }}>
                      {p.cat}
                    </span>
                    {p.refundsSummary && p.refundsSummary.count > 0 && (
                      <span title={`${p.refundsSummary.count} estorno${p.refundsSummary.count !== 1 ? "s" : ""} · ${formatBRL(p.refundsSummary.totalValue)} abatido${p.refundsSummary.count !== 1 ? "s" : ""}`}
                        style={{ ...G, fontSize: 10, fontWeight: 700, color: T.green, background: T.greenLight, borderRadius: 5, padding: "1px 6px", flexShrink: 0, cursor: "default" }}>
                        ↺ Estornado
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: rowColor, borderRadius: 99, transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
                    </div>
                    <span style={{ ...G, fontSize: 10, color: T.inkMid, flexShrink: 0, minWidth: 40, textAlign: "right" }}>
                      {p.pago}/{p.total}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...G, ...NUM, fontSize: 14, fontWeight: 700, color: T.ink }}>{formatBRL(p.vParcela)}</div>
                    <div style={{ ...G, fontSize: 10, color: T.inkLight }}>{remainingCount}× restam</div>
                  </div>
                  <ChevronDown size={14} color={T.inkLight}
                    style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                </div>
              </div>
              {isOpen && (
                <div style={{ padding: "14px 16px 16px", borderBottom: isLast ? "none" : `1px solid ${T.border}`, background: T.bg, animation: "tabIn 0.15s ease-out" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 0, background: T.surface, borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}`, marginBottom: 12 }}>
                    {[
                      { label: "Por parcela", val: formatBRL(p.vParcela) },
                      { label: `${remainingCount}× restam`, val: formatBRL(remainingValue) },
                      { label: "Total original", val: formatBRL(p.vTotal) },
                    ].map((s, i) => (
                      <div key={i} style={{ flex: 1, padding: "10px 12px", borderLeft: i > 0 ? `1px solid ${T.border}` : "none", textAlign: i === 2 ? "right" : "left" }}>
                        <div style={{ ...G, fontSize: 10, fontWeight: 500, color: T.inkLight, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                        <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: T.ink }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ ...G, fontSize: 12, color: T.inkMid }}>{p.pago} de {p.total} parcelas pagas</span>
                      <span style={{ ...G, ...NUM, fontSize: 12, fontWeight: 700, color: rowColor }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: rowColor, borderRadius: 99, transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onMoveInstallment?.(p); }}
                    style={{ ...G, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: T.blue, background: T.blueLight, border: "none", borderRadius: 9, padding: "8px 14px", cursor: "pointer" }}>
                    <RefreshCw size={12} /> Mover para outra fatura
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── AnalyticsTab ──────────────────────────────────────────── */
export function AnalyticsTab({
  cardInvoices, cardTrend, invoice, card, usagePercent, totalInstallments, totalRefunds,
  hasRefundedInstallments, categoryAlerts, averageValue, projection, cardInstallments,
  isMobile, formatBRL, formatK,
}) {
  const hasData = cardInvoices.length > 0 || cardTrend.length > 0;
  if (!hasData) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 12, textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>📊</div>
      <div style={{ ...G, fontSize: 15, fontWeight: 700, color: T.ink }}>Sem histórico ainda</div>
      <div style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.65, maxWidth: 320 }}>
        As análises aparecem após o primeiro mês de uso do cartão.
      </div>
    </div>
  );
  const trendCategories = (cardTrend && cardTrend.length > 0) ? Object.keys(cardTrend[0]).filter((k) => k !== "mes") : [];
  const trendColors = trendCategories.reduce((m, c) => ({ ...m, [c]: CAT_COLORS_CARD[c] || T.inkMid }), {});
  const daysInMonth = 30;
  const monthProgressPercent = safe(TODAY_DAY, daysInMonth);
  const spentPercent = safe((invoice?.val || 0), card.limite);
  const onPace = spentPercent <= monthProgressPercent;
  const healthScore = card.limite > 0
    ? Math.max(0, 100 - usagePercent - (totalInstallments / card.limite * 30))
    : (usagePercent === 0 ? 100 : 0);
  const healthColor = healthScore >= 70 ? T.green : healthScore >= 40 ? T.amber : T.red;
  const bestPurchaseDay = card.fechamento + 1 > 28 ? 1 : card.fechamento + 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {categoryAlerts.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.amber}44`, borderRadius: 14, padding: "14px 18px" }}>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.amber, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>⚠ Alertas de comportamento</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categoryAlerts.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: T.amberLight, borderRadius: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS_CARD[a.cat] || T.inkMid, flexShrink: 0 }} />
                <span style={{ ...G, fontSize: 12, color: T.ink, flex: 1 }}>
                  <strong>{a.cat}</strong> cresceu <strong style={{ color: T.amber }}>+{a.pct}%</strong> em relação ao mês anterior
                </span>
                <span style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.amber }}>{formatBRL(a.val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>Velocidade de gasto</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ ...G, fontSize: 11, color: T.inkMid }}>Avançamos {monthProgressPercent}% do mês</span>
              <span style={{ ...G, fontSize: 11, fontWeight: 700, color: onPace ? T.green : T.red }}>
                {spentPercent}% do limite gasto
              </span>
            </div>
            <div style={{ height: 8, background: T.grayLight, borderRadius: 99, overflow: "hidden", position: "relative" }}>
              <div style={{ height: "100%", width: `${monthProgressPercent}%`, background: T.border, borderRadius: 99 }} />
              <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${spentPercent}%`, background: `linear-gradient(90deg,${onPace ? T.green : T.red}99,${onPace ? T.green : T.red})`, borderRadius: 99, transition: "width 0.8s" }} />
            </div>
          </div>
          <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.6 }}>
            {onPace
              ? <>✅ Ritmo controlado. Projeção de fechamento: <strong>{formatBRL(projection)}</strong>.</>
              : <>🔴 Gasto acelerado. Projeção: <strong style={{ color: T.red }}>{formatBRL(projection)}</strong> — acima do ritmo.</>}
          </div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>Score de saúde</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            <svg width={60} height={60} viewBox="0 0 60 60">
              <circle cx={30} cy={30} r={24} fill="none" stroke={T.grayLight} strokeWidth={6} />
              <circle cx={30} cy={30} r={24} fill="none" stroke={healthColor} strokeWidth={6}
                strokeDasharray={`${(healthScore / 100) * 150.8} 150.8`}
                strokeLinecap="round" transform="rotate(-90 30 30)"
                style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)" }} />
              <text x={30} y={35} textAnchor="middle" fontSize={14} fontWeight={800} fill={healthColor} fontFamily="Geist Mono,monospace">{Math.round(healthScore)}</text>
            </svg>
            <div>
              <div style={{ ...G, fontSize: 14, fontWeight: 700, color: healthColor }}>
                {healthScore >= 70 ? "Saudável" : healthScore >= 40 ? "Regular" : "Atenção"}
              </div>
              <div style={{ ...G, fontSize: 10, color: T.inkLight, marginTop: 2 }}>de 100 pontos</div>
            </div>
          </div>
          <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.6 }}>
            Uso ideal do limite: abaixo de 30% preserva seu score de crédito.
          </div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px" }}>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>Melhor dia para compras</div>
          <div style={{ ...G, ...NUM, fontSize: 36, fontWeight: 800, color: T.blue, marginBottom: 6 }}>
            Dia {bestPurchaseDay}
          </div>
          <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.65 }}>
            Compras feitas logo após o fechamento (dia {card.fechamento}) têm quase <strong>30 dias extras</strong> de prazo sem juros.
          </div>
        </div>
      </div>

      {cardTrend && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>Tendência por categoria</div>
              <div style={{ ...G, fontSize: 10, color: T.inkLight, marginTop: 2 }}>Evolução dos gastos nos últimos 6 meses</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
            <ReBarChart data={cardTrend} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barCategoryGap="32%">
              <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
              <XAxis dataKey="mes" tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} />
              <YAxis tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + formatK(v)} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div style={{ ...G, background: T.ink, borderRadius: 10, padding: "8px 12px", boxShadow: T.dark }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 5 }}>{label}</div>
                    {payload.map((p, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: p.fill }} />
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{p.dataKey}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", marginLeft: "auto" }}>R$ {formatK(p.value)}</span>
                      </div>
                    ))}
                  </div>
                );
              }} />
              {trendCategories.map((cat) => (
                <Bar key={cat} dataKey={cat} stackId="a" fill={trendColors[cat]} maxBarSize={28}
                  radius={cat === trendCategories[trendCategories.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </ReBarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {trendCategories.map((cat) => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: trendColors[cat] }} />
                <span style={{ ...G, fontSize: 10, color: T.inkMid }}>{cat}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px" }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14 }}>Comparativo de faturas</div>
        <ResponsiveContainer width="100%" height={isMobile ? 140 : 170}>
          <ReBarChart data={cardInvoices} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barCategoryGap="38%">
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="mes" tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} />
            <YAxis tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} tickFormatter={(v) => "R$" + formatK(v)} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{ ...G, background: T.ink, borderRadius: 10, padding: "8px 12px" }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{label}</div>
                  <div style={{ ...NUM, fontSize: 13, fontWeight: 700, color: "#fff" }}>{formatBRL(d.val)}</div>
                  <div style={{ fontSize: 10, color: d.pago ? "#86efac" : d.atual ? "#FCD34D" : "#9CA3AF", marginTop: 3 }}>
                    {d.pago ? "✓ Paga" : d.atual ? "Em aberto" : "—"}
                  </div>
                </div>
              );
            }} />
            <ReferenceLine y={averageValue} stroke={T.blue} strokeDasharray="4 3"
              label={{ value: `Média R$ ${formatK(averageValue)}`, position: "right", fontSize: 8, fill: T.blue, fontFamily: "Geist,sans-serif" }} />
            <Bar dataKey="val" maxBarSize={26} radius={[4, 4, 0, 0]}>
              {cardInvoices.map((f, i) => (
                <Cell key={i} fill={f.atual ? (card.corChip || T.blue) : f.pago ? T.green : T.inkGhost} fillOpacity={f.atual ? 0.9 : 0.65} />
              ))}
            </Bar>
          </ReBarChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {[["Paga", T.green], ["Atual", card.corChip || T.blue], ["Média", T.blue]].map(([l, c]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
              <span style={{ ...G, fontSize: 10, color: T.inkMid }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>Exposição de parcelas</div>
          <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: T.blue }}>{formatBRL(totalInstallments)}</div>
        </div>
        <div style={{ ...G, fontSize: 11, color: T.inkMid, marginBottom: hasRefundedInstallments ? 4 : 12, lineHeight: 1.65 }}>
          Total comprometido em parcelas futuras · {Math.round(cardInstallments.reduce((s, p) => s + p.vParcela, 0) / card.limite * 100)}% do limite mensal · {formatBRL(cardInstallments.reduce((s, p) => s + p.vParcela, 0))}/mês.
        </div>
        {hasRefundedInstallments && (
          <div style={{ ...G, fontSize: 10, color: T.green, fontWeight: 600, marginBottom: 12 }}>
            ↓ {formatBRL(totalRefunds)} em estornos abatidos · líquido {formatBRL(totalInstallments)}
          </div>
        )}
        {cardInstallments.map((p, i) => {
          const exposurePercent = safe(p.vParcela, card.limite);
          const hasRefund = p.refundsSummary && p.refundsSummary.count > 0;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 15 }}>{p.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, alignItems: "center", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                    <span style={{ ...G, fontSize: 12, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.desc}</span>
                    {hasRefund && (
                      <span title={`${p.refundsSummary.count} estorno${p.refundsSummary.count !== 1 ? "s" : ""} · ${formatBRL(p.refundsSummary.totalValue)} abatido${p.refundsSummary.count !== 1 ? "s" : ""}`}
                        style={{ ...G, fontSize: 9, color: T.green, background: T.greenLight, borderRadius: 99, padding: "1px 6px", fontWeight: 700, whiteSpace: "nowrap", cursor: "default" }}>
                        ↺ Estornado
                      </span>
                    )}
                  </div>
                  <span style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.ink }}>{formatBRL(p.vParcela * (p.total - p.pago))}</span>
                </div>
                <div style={{ height: 3, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${exposurePercent}%`, background: T.blue, borderRadius: 99 }} />
                </div>
              </div>
              <span style={{ ...G, fontSize: 10, color: T.inkLight, minWidth: 28, textAlign: "right" }}>{exposurePercent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
