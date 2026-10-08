import { Download } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn, ProgBar } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { INVOICE_STATUS, monthNameLower } from "../cardHub/hubInvoices.js";
import { PayControls } from "./PayControls.jsx";
import { topCategoryLabel, timelineProgress } from "./invoiceDashboardModel.js";
import { dayMonth, dueText, plural, previousMonthName } from "./invoiceFormat.js";

/** Linha de future-commitments que de fato traz compromisso (valor ou parcelas). */
export function hasCommitments(row) {
  return Boolean(row) && (Number(row.installments_count) > 0 || Number(row.total_amount) > 0);
}

const mutedText = { ...G, fontSize: 12, color: T.inkMid };

export function Headline({ invoice, detail, state, futureRow, currency, centered = false }) {
  const money = (v) => formatMoney(v, currency) ?? "—";
  const total = state === "forecast" ? (futureRow ? futureRow.total_amount : null) : invoice.total;
  const emptyForecast = state === "forecast" && !hasCommitments(futureRow);
  const change = detail?.month_over_month_change;
  const averageChange = detail?.six_month_average_change;
  const prevName = previousMonthName(invoice.key);
  const hasComparison = Number.isFinite(Number(change)) && change !== null && prevName;
  const up = Number(change) > 0;
  return (
    <div style={{ textAlign: centered ? "center" : "right" }}>
      <div data-testid="invoice-total" style={{ ...G, ...NUM, fontSize: centered ? 26 : 28, fontWeight: 800, color: T.ink }}>
        {invoice.isEmpty || emptyForecast ? "Sem lançamentos" : money(total)}
      </div>
      {hasComparison && (
        <div data-testid="invoice-comparison" style={{ display: "flex", justifyContent: centered ? "center" : "flex-end", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
        <span
          style={{ ...G, fontSize: 11, fontWeight: 600, marginTop: 2, color: Number(change) === 0 ? T.inkMid : up ? T.red : T.green }}>
          {Number(change) === 0 ? `igual a ${prevName}` : `${up ? "↑" : "↓"} ${Math.abs(Math.round(Number(change)))}% vs ${prevName}`}
          {detail.previous_month_total != null ? ` (${money(detail.previous_month_total)})` : ""}
        </span>
        {averageChange != null && <span style={{ ...G, fontSize: 10, fontWeight: 700, color: Number(averageChange) > 0 ? T.amber : T.green, background: Number(averageChange) > 0 ? T.amberLight : T.greenLight, borderRadius: 99, padding: "3px 7px" }}>{Math.abs(Number(averageChange)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% {Number(averageChange) > 0 ? "acima" : "abaixo"} da média</span>}
        </div>
      )}
    </div>
  );
}

function Timeline({ detail, status, now }) {
  if (status === INVOICE_STATUS.PAID || status === INVOICE_STATUS.FORECAST) return null;
  const closing = dayMonth(detail.closing_date);
  const progress = timelineProgress({ closingDate: detail.closing_date, dueDate: detail.due_date }, now);
  if (!progress && !closing) return null;
  const pct = progress?.pct;
  const due = `🗓 ${dueText({ days: detail.days_until_due, dueDate: detail.due_date }) ?? ""}`.trim();
  const closingLabel = closing ? `${progress?.beforeClosing ? "Fecha" : "Fechou"} ${closing}` : "";
  return (
    <div data-testid="invoice-timeline">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={mutedText}>{closingLabel}</span>
        <span style={{ ...mutedText, color: detail.is_overdue ? T.red : T.inkMid, fontWeight: detail.is_overdue ? 700 : 400 }}>
          {due}{detail.is_overdue ? " · em atraso" : ""}
        </span>
      </div>
      {pct !== null && pct !== undefined && (
        <div style={{ position: "relative" }}>
          <ProgBar pct={pct} color={`linear-gradient(90deg, ${T.green}, ${T.amber})`} h={6} />
          <div style={{ position: "absolute", left: `${pct}%`, top: -4, width: 14, height: 14, borderRadius: "50%", background: T.ink, border: "2.5px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.3)", transform: "translateX(-50%)" }} />
        </div>
      )}
      {pct !== null && pct !== undefined && (
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
  // Card used_limit can cover other invoices; show it beside this invoice's percentage only when they agree.
  const matchingUsed = card?.used_limit != null && card?.credit_limit > 0
    && Math.abs(Number(card.used_limit) / Number(card.credit_limit) * 100 - Number(percent)) < 0.5;
  const used = matchingUsed ? formatMoney(card.used_limit, currency) : null;
  return (
    <div data-testid="invoice-limit">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={mutedText}>Limite utilizado</span>
        <span style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color }}>{Math.round(Number(percent))}%{used && limit ? ` · ${used} de ${limit}` : limit ? ` de ${limit}` : ""}</span>
      </div>
      <ProgBar pct={pct} color={color} h={6} />
    </div>
  );
}

function ForecastBody({ invoice, futureRow, card, currency }) {
  const count = Number(futureRow?.installments_count);
  const parts = futureRow && Number.isFinite(count) && count > 0 ? [plural(count, "parcela já garantida", "parcelas já garantidas")] : [];
  return (
    <>
      <div style={{ ...mutedText, textAlign: "center" }}>
        {hasCommitments(futureRow)
          ? "Fatura ainda não aberta: o valor é a soma do que já está assumido em parcelas."
          : "Fatura ainda não aberta e sem lançamentos até agora."}
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
