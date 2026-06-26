import { useEffect, useState } from "react";
import { ChevronRight, ExternalLink, RotateCcw, Trash2 } from "lucide-react";

import { T } from "../../tokens";
import { G } from "../../typography";

/**
 * Cache module-level do estado expandido por item.id. Sobrevive a remounts
 * de `TxRow` causados por refetch do cartão (a árvore pai do tabContentBundle
 * usa `key={tab + cardId}` — qualquer toggle de prop dispara remount e
 * resetaria `useState`). Não polui localStorage; some no reload.
 */
const expandedItemRegistry = new Map();

const MONTH_SHORT_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatInvoiceRef(year, month) {
  if (!year || !month) return "";
  return `${MONTH_SHORT_PT[month - 1] || String(month).padStart(2, "0")}/${String(year).slice(-2)}`;
}

function shiftYearMonth(year, month, delta) {
  const base = new Date(year, month - 1 + delta, 1);
  return { year: base.getFullYear(), month: base.getMonth() + 1 };
}

function buildAffectedInvoices(item, invoice) {
  if (!invoice?.year || !invoice?.month) return [];
  if (!item?.parcela?.n || !item?.parcela?.t) {
    return [{ year: invoice.year, month: invoice.month, label: formatInvoiceRef(invoice.year, invoice.month) }];
  }
  const installmentsTotal = Number(item.parcela.t) || 1;
  const installmentPosition = Number(item.parcela.n) || 1;
  const first = shiftYearMonth(invoice.year, invoice.month, -(installmentPosition - 1));
  return Array.from({ length: installmentsTotal }, (_, index) => {
    const ref = shiftYearMonth(first.year, first.month, index);
    return { ...ref, label: formatInvoiceRef(ref.year, ref.month) };
  });
}

/**
 * Linha de transação dentro de uma fatura: cabeçalho (descrição + categoria
 * + valor) + bloco expansível com chips de detalhe, progresso de parcelamento,
 * banner de estornos vinculados e CTA pra lançar novo estorno.
 */
export function TxRow({ item, card, invoice, categoryColor, formatBRL, onLaunchRefund, onOpenTransaction, onDeleteTransaction }) {
  const isInstallment = item.parcela && item.parcela.n;
  const installmentValue = isInstallment
    ? (item.parcela.val != null && Number.isFinite(Number(item.parcela.val))
      ? item.parcela.val
      : item.val)
    : 0;
  const installmentTotal = isInstallment
    ? (item.parcela.total != null && Number.isFinite(Number(item.parcela.total))
      ? item.parcela.total
      : installmentValue * item.parcela.t)
    : 0;
  const cc = categoryColor(item);
  const [expanded, setExpandedState] = useState(() => expandedItemRegistry.get(item.id) === true);
  const setExpanded = (updater) => {
    setExpandedState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      expandedItemRegistry.set(item.id, next);
      return next;
    });
  };
  useEffect(() => {
    const cached = expandedItemRegistry.get(item.id) === true;
    if (cached !== expanded) setExpandedState(cached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);
  const hasLinkedRefunds = !!(item.refundsSummary && item.refundsSummary.count > 0);
  const canOpenTransaction = item.transactionId != null && !!onOpenTransaction;
  const canDeleteTransaction = item.transactionId != null && !!onDeleteTransaction;
  const openTransactionLabel = isRefund
    ? "Abrir lançamento do estorno"
    : isInstallment
      ? "Abrir lançamento da compra"
      : "Abrir lançamento";
  const canLaunchRefund =
    !item.isRefund && item.transactionId != null && !!onLaunchRefund && !hasLinkedRefunds;
  const expandable = !!(item.method || isInstallment || hasLinkedRefunds || canLaunchRefund);

  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      <div
        onClick={() => expandable && setExpanded((e) => !e)}
        style={{
          display: "flex", alignItems: "center", gap: 0,
          padding: "0 20px", cursor: expandable ? "pointer" : "default",
          background: expanded ? `${cc}06` : "transparent",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => { if (!expanded && expandable) e.currentTarget.style.background = T.bg; }}
        onMouseLeave={(e) => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
      >
        <div style={{ width: 3, alignSelf: "stretch", background: expanded ? cc : "transparent", borderRadius: 99, marginRight: 14, flexShrink: 0, transition: "background 0.15s" }} />
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: `${cc}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, margin: "12px 14px 12px 0" }}>
          {item.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: "13px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.desc}
            </span>
            {isInstallment && (
              <span style={{ ...G, fontSize: 10, fontWeight: 800, color: T.blue, background: T.blueLight, borderRadius: 6, padding: "1px 6px", flexShrink: 0, letterSpacing: "0.02em" }}>
                {item.parcela.n}/{item.parcela.t}×
              </span>
            )}
            {item.rec && (
              <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.purple, background: T.purpleLight, borderRadius: 6, padding: "1px 6px", flexShrink: 0 }}>↻</span>
            )}
            {hasLinkedRefunds && !item.isRefund && (
              <span title={`${item.refundsSummary.count} estorno${item.refundsSummary.count !== 1 ? "s" : ""} relacionado${item.refundsSummary.count !== 1 ? "s" : ""} · ${formatBRL(item.refundsSummary.totalValue)} abatido${item.refundsSummary.count !== 1 ? "s" : ""}`}
                style={{ ...G, fontSize: 10, fontWeight: 700, color: T.green, background: T.greenLight, borderRadius: 99, padding: "1px 6px", flexShrink: 0, cursor: "help", whiteSpace: "nowrap" }}>
                ↺ Estorno
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: cc, flexShrink: 0 }} />
            <span style={{ ...G, fontSize: 11, color: cc, fontWeight: 600 }}>{item.cat}</span>
            <span style={{ color: T.border }}>·</span>
            <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{item.data}</span>
            {isInstallment && (
              <>
                <span style={{ color: T.border }}>·</span>
                <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{formatBRL(installmentValue)}/mês</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, paddingLeft: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...G, fontFamily: "'Geist Mono',monospace", fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: "-0.01em" }}>
              {formatBRL(item.val)}
            </div>
            {isInstallment && (
              <div style={{ ...G, fontSize: 10, color: T.blue, fontFamily: "'Geist Mono',monospace" }}>
                total {formatBRL(installmentTotal)}
              </div>
            )}
          </div>
          <ChevronRight size={13} color={expanded ? cc : T.inkGhost}
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.18s ease", flexShrink: 0, opacity: expandable ? 1 : 0.22 }} />
        </div>
      </div>
      {expanded && expandable && (() => {
        const detailChips = [
          item.method && { label: "Método", val: item.method },
          isInstallment && { label: "Parcela", val: `${item.parcela.n}ª de ${item.parcela.t}` },
          isInstallment && { label: "Valor mensal", val: formatBRL(installmentValue), mono: true },
          isInstallment && { label: "Total compra", val: formatBRL(installmentTotal), mono: true },
          isInstallment && { label: "Restante", val: formatBRL(installmentTotal - item.parcela.n * installmentValue), mono: true, color: T.blue },
        ].filter(Boolean);
        if (detailChips.length === 0 && !isInstallment && !hasLinkedRefunds && !canLaunchRefund) return null;
        return (
          <div style={{ padding: "0 20px 14px 71px", background: `${cc}06`, animation: "fadeIn 0.15s ease" }}>
            {detailChips.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {detailChips.map((chip, i) => (
                  <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "6px 12px" }}>
                    <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>
                      {chip.label}
                    </div>
                    <div style={{ ...G, fontSize: 12, fontWeight: 700, fontFamily: chip.mono ? "'Geist Mono',monospace" : "inherit", color: chip.color || T.ink }}>
                      {chip.val}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isInstallment && (
              <div style={{ marginTop: detailChips.length > 0 ? 10 : 0 }}>
                <div style={{ height: 4, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 99, width: `${Math.round((item.parcela.n / item.parcela.t) * 100)}%`, background: `linear-gradient(to right, ${cc}, ${T.blue})`, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                </div>
                <div style={{ ...G, fontSize: 10, color: T.inkLight, marginTop: 4 }}>
                  {Math.round((item.parcela.n / item.parcela.t) * 100)}% pago · {item.parcela.t - item.parcela.n} parcelas restantes
                </div>
              </div>
            )}
            {hasLinkedRefunds && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: T.greenLight, border: `1px solid ${T.green}33`, borderRadius: 9, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: T.green }}>↺</span>
                <div style={{ flex: 1 }}>
                  <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.green }}>
                    Esta compra possui estorno relacionado
                  </div>
                  <div style={{ ...G, fontSize: 10, color: T.inkMid, marginTop: 2 }}>
                    {item.refundsSummary.count} lançamento{item.refundsSummary.count !== 1 ? "s" : ""} de estorno
                    {" · "}
                    <span style={{ fontFamily: "'Geist Mono',monospace", fontWeight: 700 }}>
                      {formatBRL(item.refundsSummary.totalValue)}
                    </span>
                    {" abatido"}{item.refundsSummary.count !== 1 ? "s" : ""}{" no total"}
                  </div>
                </div>
              </div>
            )}
            {canLaunchRefund && (
              <div style={{ marginTop: 10 }}>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); onLaunchRefund(item, card); }}
                  style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px dashed ${T.green}66`, background: "transparent", color: T.green, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = T.greenLight; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <RotateCcw size={12} /> Lançar estorno desta compra
                </button>
              </div>
            )}
            {(canOpenTransaction || canDeleteTransaction) && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {canOpenTransaction && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTransaction(item.transactionId);
                    }}
                    style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, color: T.ink, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    <ExternalLink size={12} /> {openTransactionLabel}
                  </button>
                )}
                {canDeleteTransaction && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTransaction({
                        transactionId: item.transactionId,
                        description: item.desc,
                        amount: item.val,
                        isInstallment,
                        installmentLabel: isInstallment ? `${item.parcela.n}/${item.parcela.t}` : null,
                        affectedInvoices: buildAffectedInvoices(item, invoice),
                      });
                    }}
                    style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.red}33`, background: T.surface, color: T.red, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    <Trash2 size={12} /> Excluir lançamento
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/**
 * Cabeçalho colapsável agrupando todas as transações de uma data, com total
 * do dia. Renderiza uma `<TxRow/>` por item; o open/close é controlado pelo
 * pai via `expandedDate` (modo "um aberto por vez" ou `null` para todos).
 */
export function DateGroup({
  date,
  items,
  card,
  invoice,
  expandedDate,
  setExpandedDate,
  categoryColor,
  formatBRL,
  onLaunchRefund,
  onOpenTransaction,
  onDeleteTransaction,
}) {
  const total = items.reduce((s, i) => s + i.val, 0);
  const isOpen = expandedDate === null || expandedDate === date;
  const dayLabel = (() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, mo, d] = date.split("-").map(Number);
      const dt = new Date(y, mo - 1, d);
      const wd = dt.toLocaleDateString("pt-BR", { weekday: "short" });
      const dm = dt.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
      return { weekday: wd.replace(".", ""), full: dm };
    }
    const parts = date.split("/");
    if (parts.length < 2) return date;
    const d = new Date(2026, +parts[1] - 1, +parts[0]);
    const wd = d.toLocaleDateString("pt-BR", { weekday: "short" });
    const dm = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
    return { weekday: wd.replace(".", ""), full: dm };
  })();

  return (
    <div style={{ marginBottom: 0 }}>
      <div onClick={() => setExpandedDate(expandedDate === date ? null : date)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px", cursor: "pointer", userSelect: "none", background: T.bg, borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, zIndex: 1 }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#EFEEEB")}
        onMouseLeave={(e) => (e.currentTarget.style.background = T.bg)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ChevronRight size={11} color={T.inkLight}
            style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.18s" }} />
          <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.07em", minWidth: 28 }}>
            {typeof dayLabel === "string" ? dayLabel : dayLabel.weekday}
          </span>
          <span style={{ ...G, fontSize: 12, fontWeight: 700, color: T.inkMid }}>
            {typeof dayLabel === "string" ? "" : dayLabel.full}
          </span>
          <span style={{ ...G, fontSize: 11, color: T.inkGhost, fontWeight: 500 }}>
            · {items.length} {items.length === 1 ? "item" : "itens"}
          </span>
        </div>
        <span style={{ ...G, fontFamily: "'Geist Mono',monospace", fontSize: 12, fontWeight: 700, color: T.inkMid, letterSpacing: "-0.01em" }}>
          {formatBRL(total)}
        </span>
      </div>
      {isOpen && items.map((item) => (
        <TxRow key={item.id} item={item} card={card} invoice={invoice} categoryColor={categoryColor} formatBRL={formatBRL} onLaunchRefund={onLaunchRefund} onOpenTransaction={onOpenTransaction} onDeleteTransaction={onDeleteTransaction} />
      ))}
    </div>
  );
}
