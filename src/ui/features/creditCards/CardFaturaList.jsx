import { useState } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";

import { T } from "../../tokens";
import { G } from "../../typography";

/**
 * Linha de transação dentro de uma fatura: cabeçalho (descrição + categoria
 * + valor) + bloco expansível com chips de detalhe, progresso de parcelamento,
 * banner de estornos vinculados e CTA pra lançar novo estorno.
 */
export function TxRow({ item, card, catColor, fmtBRL, onLancarEstorno }) {
  const isParcela = item.parcela && item.parcela.n;
  const parcelaVal = isParcela
    ? (item.parcela.val != null && Number.isFinite(Number(item.parcela.val))
      ? item.parcela.val
      : item.val)
    : 0;
  const parcelaTotal = isParcela
    ? (item.parcela.total != null && Number.isFinite(Number(item.parcela.total))
      ? item.parcela.total
      : parcelaVal * item.parcela.t)
    : 0;
  const cc = catColor(item);
  const [expanded, setExpanded] = useState(false);
  const hasLinkedRefunds = !!(item.refundsSummary && item.refundsSummary.count > 0);
  const canLancarEstorno =
    !item.isRefund && item.transactionId != null && !!onLancarEstorno && !hasLinkedRefunds;
  const expandable = !!(item.method || isParcela || hasLinkedRefunds || canLancarEstorno);

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
            {isParcela && (
              <span style={{ ...G, fontSize: 10, fontWeight: 800, color: T.blue, background: T.blueLight, borderRadius: 6, padding: "1px 6px", flexShrink: 0, letterSpacing: "0.02em" }}>
                {item.parcela.n}/{item.parcela.t}×
              </span>
            )}
            {item.rec && (
              <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.purple, background: T.purpleLight, borderRadius: 6, padding: "1px 6px", flexShrink: 0 }}>↻</span>
            )}
            {hasLinkedRefunds && !item.isRefund && (
              <span title={`${item.refundsSummary.count} estorno${item.refundsSummary.count !== 1 ? "s" : ""} relacionado${item.refundsSummary.count !== 1 ? "s" : ""} · ${fmtBRL(item.refundsSummary.totalValue)} abatido${item.refundsSummary.count !== 1 ? "s" : ""}`}
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
            {isParcela && (
              <>
                <span style={{ color: T.border }}>·</span>
                <span style={{ ...G, fontSize: 11, color: T.inkLight }}>{fmtBRL(parcelaVal)}/mês</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, paddingLeft: 12 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...G, fontFamily: "'Geist Mono',monospace", fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: "-0.01em" }}>
              {fmtBRL(item.val)}
            </div>
            {isParcela && (
              <div style={{ ...G, fontSize: 10, color: T.blue, fontFamily: "'Geist Mono',monospace" }}>
                total {fmtBRL(parcelaTotal)}
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
          isParcela && { label: "Parcela", val: `${item.parcela.n}ª de ${item.parcela.t}` },
          isParcela && { label: "Valor mensal", val: fmtBRL(parcelaVal), mono: true },
          isParcela && { label: "Total compra", val: fmtBRL(parcelaTotal), mono: true },
          isParcela && { label: "Restante", val: fmtBRL(parcelaTotal - item.parcela.n * parcelaVal), mono: true, color: T.blue },
        ].filter(Boolean);
        if (detailChips.length === 0 && !isParcela && !hasLinkedRefunds && !canLancarEstorno) return null;
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
            {isParcela && (
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
                      {fmtBRL(item.refundsSummary.totalValue)}
                    </span>
                    {" abatido"}{item.refundsSummary.count !== 1 ? "s" : ""}{" no total"}
                  </div>
                </div>
              </div>
            )}
            {canLancarEstorno && (
              <div style={{ marginTop: 10 }}>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); onLancarEstorno(item, card); }}
                  style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px dashed ${T.green}66`, background: "transparent", color: T.green, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = T.greenLight; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <RotateCcw size={12} /> Lançar estorno desta compra
                </button>
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
  expandedDate,
  setExpandedDate,
  catColor,
  fmtBRL,
  onLancarEstorno,
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
          {fmtBRL(total)}
        </span>
      </div>
      {isOpen && items.map((item) => (
        <TxRow key={item.id} item={item} card={card} catColor={catColor} fmtBRL={fmtBRL} onLancarEstorno={onLancarEstorno} />
      ))}
    </div>
  );
}
