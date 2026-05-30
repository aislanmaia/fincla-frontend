import { Calendar, Check, Download, RefreshCw } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { InvoiceNav, LimitBar } from "./cartoesPanels.jsx";

/**
 * Cabeçalho da fatura selecionada: navegação entre meses + valor total +
 * `<LimitBar/>` + rodapé com vencimento e ações (CSV, marcar como paga).
 */
export function CardsInvoiceHeader({
  variant,
  card,
  invoice,
  previousInvoice,
  nextInvoice,
  diffPercent,
  usagePercent,
  usageColor,
  isCurrent,
  isPaid,
  markingPaid,
  formatBRL,
  onPrevInvoice,
  onNextInvoice,
  onOpenExport,
  onMarkPaid,
}) {
  const isMobile = variant === "mobile";
  const dims = isMobile
    ? {
      wrapStyle: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 18px", marginBottom: 14 },
      headerMb: 12,
      labelFontSize: 10,
      labelMb: 3,
      valueFontSize: 22,
      diffFontSize: 11,
      diffMt: 3,
      bottomMt: 12,
      iconColorMid: 11,
      iconSize: 12,
      btnFontSize: 11,
      btnPad: "5px 10px",
      btnPadGreen: "5px 12px",
      btnGap: 5,
      btnIconSize: 11,
      payLabel: "Pagar",
      paidLabel: "Paga",
      paidIconSize: 12,
    }
    : {
      wrapStyle: { background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 14 },
      headerMb: 10,
      labelFontSize: 11,
      labelMb: 0,
      valueFontSize: 24,
      diffFontSize: 12,
      diffMt: 0,
      bottomMt: 12,
      iconColorMid: 12,
      iconSize: 13,
      btnFontSize: 12,
      btnPad: "6px 12px",
      btnPadGreen: "6px 14px",
      btnGap: 5,
      btnIconSize: 12,
      payLabel: "Marcar como paga",
      paidLabel: "Paga",
      paidIconSize: 13,
    };

  return (
    <div style={dims.wrapStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: dims.headerMb }}>
        <InvoiceNav compact={isMobile} invoice={invoice} previousInvoice={previousInvoice} nextInvoice={nextInvoice}
          onPrev={onPrevInvoice} onNext={onNextInvoice} />
        <div style={isMobile ? { textAlign: "right" } : { display: "flex", alignItems: "center", gap: 10 }}>
          {invoice?.atual && (
            <div style={{ ...G, fontSize: dims.labelFontSize, fontWeight: 700, color: T.blue, textTransform: "uppercase", letterSpacing: isMobile ? "0.09em" : "0.08em", marginBottom: dims.labelMb }}>
              Fatura aberta
            </div>
          )}
          <div style={{ ...G, ...NUM, fontSize: dims.valueFontSize, fontWeight: 800, color: T.ink, lineHeight: 1 }}>
            {formatBRL((invoice?.val || 0))}
          </div>
          {diffPercent !== 0 && (
            <div style={{ ...G, fontSize: dims.diffFontSize, fontWeight: 600, marginTop: dims.diffMt, color: diffPercent > 0 ? T.red : T.green }}>
              {diffPercent > 0 ? "↑" : "↓"} {Math.abs(diffPercent)}% vs {previousInvoice?.mes}
            </div>
          )}
        </div>
      </div>
      <LimitBar card={card} usagePercent={usagePercent} usageColor={usageColor} formatBRL={formatBRL} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: dims.bottomMt }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 8 }}>
          <Calendar size={dims.iconSize} color={T.inkLight} />
          <span style={{ ...G, fontSize: dims.iconColorMid, color: T.inkMid }}>Vence {invoice?.venc}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isCurrent && (
            <button onClick={onOpenExport}
              style={{ ...G, display: "flex", alignItems: "center", gap: dims.btnGap, fontSize: dims.btnFontSize, fontWeight: 600, color: T.inkMid, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: dims.btnPad, cursor: "pointer" }}>
              <Download size={dims.btnIconSize} /> CSV
            </button>
          )}
          {isCurrent && !isPaid && (
            <button onClick={onMarkPaid}
              style={{ ...G, display: "flex", alignItems: "center", gap: dims.btnGap, padding: dims.btnPadGreen, borderRadius: 8, border: `1.5px solid ${T.green}`, background: T.greenLight, color: T.green, fontSize: dims.btnFontSize, fontWeight: 700, cursor: "pointer" }}>
              {markingPaid
                ? <><RefreshCw size={dims.btnIconSize} /> …</>
                : <><Check size={dims.btnIconSize} /> {dims.payLabel}</>}
            </button>
          )}
          {isPaid && (
            <div style={{ ...G, display: "flex", alignItems: "center", gap: dims.btnGap, fontSize: dims.btnFontSize, fontWeight: 700, color: T.green }}>
              <Check size={dims.paidIconSize} /> {dims.paidLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
