import { Download } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { INVOICE_STATUS, monthNameLower } from "../cardHub/hubInvoices.js";
import { PayControls } from "./PayControls.jsx";
import { topCategoryLabel, timelineProgress } from "./invoiceDashboardModel.js";
import { dayMonth, dueText, plural, previousMonthName } from "./invoiceFormat.js";

const mutedText = { ...G, fontSize: 12, color: T.inkMid };

export function Headline({ invoice, detail, state, futureRow, currency, centered = false }) {
  const money = (v) => formatMoney(v, currency) ?? "—";
  const total = state === "forecast" ? (futureRow ? futureRow.total_amount : null) : invoice.total;
  const change = detail?.month_over_month_change;
  const prevName = previousMonthName(invoice.key);
  const hasComparison = Number.isFinite(Number(change)) && change !== null && prevName;
  const up = Number(change) > 0;
  return (
    <div style={{ textAlign: centered ? "center" : "right" }}>
      <div data-testid="invoice-total" style={{ ...G, ...NUM, fontSize: centered ? 26 : 28, fontWeight: 800, color: T.ink }}>
        {invoice.isEmpty ? "Sem lançamentos" : money(total)}
      </div>
      {hasComparison && (
        <div data-testid="invoice-comparison"
          style={{ ...G, fontSize: 11, fontWeight: 600, marginTop: 2, color: Number(change) === 0 ? T.inkMid : up ? T.red : T.green }}>
          {Number(change) === 0 ? `igual a ${prevName}` : `${up ? "↑" : "↓"} ${Math.abs(Math.round(Number(change)))}% vs ${prevName}`}
          {detail.previous_month_total != null ? ` (${money(detail.previous_month_total)})` : ""}
        </div>
      )}
    </div>
  );
}

function Timeline({ detail, status, now }) {
  const closing = dayMonth(detail.closing_date);
  const progress = timelineProgress({ closingDate: detail.closing_date, dueDate: detail.due_date }, now);
  if (!progress && !closing) return null;
  const paid = status === INVOICE_STATUS.PAID;
  const pct = paid ? 100 : progress?.pct;
  const due = paid
    ? `🗓 vencia ${dayMonth(detail.due_date) ?? ""}`.trim()
    : `🗓 ${dueText({ days: detail.days_until_due, dueDate: detail.due_date }) ?? ""}`.trim();
  const closingLabel = closing ? `${progress?.beforeClosing ? "Fecha" : "Fechou"} ${closing}` : "";
  return (
    <div data-testid="invoice-timeline">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={mutedText}>{closingLabel}</span>
        <span style={{ ...mutedText, color: detail.is_overdue && !paid ? T.red : T.inkMid, fontWeight: detail.is_overdue && !paid ? 700 : 400 }}>
          {due}{detail.is_overdue && !paid ? " · em atraso" : ""}
        </span>
      </div>
      {pct !== null && pct !== undefined && (
        <div style={{ position: "relative", height: 6, background: T.grayLight, borderRadius: 99 }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: paid ? T.green : `linear-gradient(90deg, ${T.green}, ${T.amber})`, borderRadius: 99 }} />
          {!paid && (
            <div style={{ position: "absolute", left: `${pct}%`, top: -4, width: 14, height: 14, borderRadius: "50%", background: T.ink, border: "2.5px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.3)", transform: "translateX(-50%)" }} />
          )}
        </div>
      )}
      {!paid && pct !== null && pct !== undefined && (
        <div style={{ ...mutedText, fontSize: 11, fontWeight: 700, textAlign: "center", marginTop: 4 }}>hoje</div>
      )}
    </div>
  );
}

export function LimitUsage({ percent, card, currency }) {
  if (percent === null || percent === undefined || !Number.isFinite(Number(percent))) return null;
  const pct = Math.min(100, Math.max(0, Number(percent)));
  const color = pct >= 90 ? T.red : pct >= 70 ? T.amber : T.green;
  const limit = card?.credit_limit != null ? formatMoney(card.credit_limit, currency) : null;
  return (
    <div data-testid="invoice-limit">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={mutedText}>Limite utilizado</span>
        <span style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color }}>{Math.round(Number(percent))}%{limit ? ` de ${limit}` : ""}</span>
      </div>
      <div style={{ height: 6, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function ForecastBody({ invoice, futureRow, card, currency }) {
  const count = Number(futureRow?.installments_count);
  const parts = futureRow && Number.isFinite(count) && count > 0 ? [plural(count, "parcela já garantida", "parcelas já garantidas")] : [];
  return (
    <>
      <div style={{ ...mutedText, textAlign: "center" }}>
        {futureRow
          ? "Fatura ainda não aberta: o valor é a soma do que já está assumido em parcelas."
          : "Fatura ainda não aberta e sem compromissos assumidos até agora."}
      </div>
      {parts.length > 0 && <div style={{ ...mutedText, textAlign: "center" }}>{parts.join(" · ")}</div>}
      <LimitUsage percent={futureRow?.limit_usage_percent} card={card} currency={currency} />
    </>
  );
}

/**
 * Corpo do card da fatura SELECIONADA (cabeçalho com mês/seletor fica no pai, que
 * muda entre desktop e mobile). Cobre todos os estados do detalhe.
 */
export function InvoiceDetailBody({
  invoice, state, detail, futureRow, card, currency, now, mutation,
  onMarkPaid, onUnmarkPaid, onExport, onRetry, centered = false, refreshFailed = false,
}) {
  const status = invoice.status;
  const topCategory = detail ? topCategoryLabel(detail.category_breakdown) : null;

  if (state === "loading") {
    return <div role="status" style={{ ...mutedText, textAlign: "center" }}>Carregando fatura…</div>;
  }
  if (state === "error" || state === "forbidden") {
    return (
      <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: centered ? "center" : "flex-start" }}>
        <div style={{ ...mutedText, color: T.red }}>
          {state === "forbidden" ? "Você não tem acesso a esta fatura." : "Não foi possível carregar esta fatura."}
        </div>
        {state === "error" && <Btn variant="outGray" small onClick={onRetry} data-testid="invoice-retry">Tentar novamente</Btn>}
      </div>
    );
  }

  return (
    <>
      {state === "empty" && (
        <div data-testid="invoice-empty" style={{ ...mutedText, textAlign: "center", padding: "4px 0" }}>
          {status === INVOICE_STATUS.OPEN
            ? "A fatura aberta ainda não recebeu compras."
            : `Nenhum lançamento na fatura de ${monthNameLower(invoice.month)}.`}
        </div>
      )}
      {state === "forecast" && <ForecastBody invoice={invoice} futureRow={futureRow} card={card} currency={currency} />}
      {state === "ok" && detail && (
        <>
          <div style={{ ...mutedText, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: centered ? "center" : "flex-start" }}>
            <span data-testid="invoice-count">{plural(detail.items_count ?? 0, "lançamento", "lançamentos")}</span>
            {topCategory && <><span style={{ color: T.border }}>·</span><span>maior categoria: <strong style={{ color: T.ink }}>{topCategory}</strong></span></>}
          </div>
          <Timeline detail={detail} status={status} now={now} />
          <LimitUsage percent={detail.limit_usage_percent} card={card} currency={currency} />
          {refreshFailed && (
            <div role="status" style={{ ...G, fontSize: 11, color: "#92400E" }}>Não foi possível atualizar agora. Mostrando os dados anteriores.</div>
          )}
          <div style={{ height: 1, background: T.border }} />
          <div style={{ display: "flex", flexDirection: centered ? "column" : "row", gap: 10, alignItems: centered ? "stretch" : "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
            <Btn variant="outGray" small onClick={onExport} data-testid="export-csv" style={centered ? { justifyContent: "center" } : undefined}>
              <Download size={12} /> Exportar CSV
            </Btn>
            {(status === INVOICE_STATUS.OPEN || status === INVOICE_STATUS.CLOSED || status === INVOICE_STATUS.PAID) && (
              <PayControls
                key={invoice.key}
                status={status}
                paidDate={detail.paid_date}
                mutation={mutation}
                onMarkPaid={onMarkPaid}
                onUnmarkPaid={onUnmarkPaid}
                now={now}
                stacked={centered}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}
