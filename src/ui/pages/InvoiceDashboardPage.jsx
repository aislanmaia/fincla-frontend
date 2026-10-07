import { useMemo } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { T } from "../tokens";
import { G } from "../typography";
import { FC } from "../routing/searchContract.js";
import { Btn, Card } from "../components/primitives";
import { shouldUseRealData } from "../dataMode.js";
import { mapInvoiceItemToUi } from "../data/creditCardsAdapter.js";
import { cardTransactionsPath, invoiceDashboardPath, isValidInvoiceParams } from "../routing/invoiceRoute.js";
import { StatusBadge } from "../features/cardHub/InvoiceCard.jsx";
import { InvoiceCarousel } from "../features/cardHub/InvoiceCarousel.jsx";
import { invoiceKey, parseInvoiceKey } from "../features/cardHub/hubInvoices.js";
import { buildInvoiceCsv, downloadCsv } from "../features/creditCards/invoiceCsv.js";
import { CategoryBreakdown } from "../features/invoiceDashboard/CategoryBreakdown.jsx";
import { Headline, InvoiceDetailBody } from "../features/invoiceDashboard/InvoiceDetailBody.jsx";
import { InvoiceNavigator } from "../features/invoiceDashboard/InvoiceNavigator.jsx";
import { MobileInvoiceItem } from "../features/invoiceDashboard/MobileInvoiceItem.jsx";
import { InvoiceMetrics } from "../features/invoiceDashboard/SpendingPace.jsx";
import { InvoiceChanges } from "../features/invoiceDashboard/InvoiceChanges.jsx";
import { ForecastInstallments, RecentItems } from "../features/invoiceDashboard/RecentItems.jsx";
import { useInvoiceDashboardData } from "../features/invoiceDashboard/useInvoiceDashboardData.js";

const CAROUSEL_ITEM_WIDTH = 330;

function Notice({ children, tone = "neutral", role = "status" }) {
  const palette = tone === "warn"
    ? { bg: T.amberLight, fg: T.inkMid, bd: T.amberBorder }
    : { bg: T.grayLight, fg: T.inkMid, bd: T.border };
  return (
    <div role={role} style={{ ...G, fontSize: 12, lineHeight: 1.5, color: palette.fg, background: palette.bg, border: `1px solid ${palette.bd}`, borderRadius: 10, padding: "10px 12px" }}>
      {children}
    </div>
  );
}

function BackLink({ onClick, children = "Cartões" }) {
  return (
    <button type="button" onClick={onClick} data-testid="back-to-cards"
      style={{ ...G, display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 600, color: T.blue, cursor: "pointer" }}>
      <ArrowLeft size={13} /> {children}
    </button>
  );
}

function cardLabel(card) {
  const name = card.description?.trim();
  return name ? `${card.brand} •${card.last4} · ${name}` : `${card.brand} •${card.last4}`;
}

export function InvoiceDashboardPage({ isMobile = false, organizationId = null, dataMode = "live", transactionsRefreshToken = 0 }) {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const valid = isValidInvoiceParams(params);
  const year = Number(params.year);
  const month = Number(params.month);
  const cardId = params.cardId;

  const data = useInvoiceDashboardData({
    organizationId,
    cardId,
    year,
    month,
    enabled: valid && shouldUseRealData(organizationId, dataMode),
    refreshToken: transactionsRefreshToken,
  });
  const { card, invoices, detail, detailState, now } = data;

  const goBack = () => navigate({ to: "/cards", search: { [FC.VIEW]: "new", [FC.HUB_CARD]: cardId } });
  const selectedKey = invoiceKey(year, month);
  const selectInvoice = (key) => {
    const ref = parseInvoiceKey(key);
    if (!ref || key === selectedKey) return;
    navigate({ to: invoiceDashboardPath(cardId, ref.year, ref.month), replace: true });
  };

  const currency = card?.currency || undefined;
  const invoice = invoices.find((i) => i.key === selectedKey) ?? null;
  const pad = isMobile ? 16 : 28;

  const exportCsv = () => {
    if (!detail || !card) return;
    downloadCsv(`fatura-${card.description?.trim() || `${card.brand}-${card.last4}`}-${selectedKey}.csv`, buildInvoiceCsv((detail.items ?? []).map(mapInvoiceItemToUi)));
  };

  const detailProps = useMemo(() => ({
    state: detailState,
    detail,
    futureRow: data.futureRow,
    card,
    now,
    mutation: data.mutation,
    refreshFailed: data.refreshFailed,
    onMarkPaid: data.markPaid,
    onUnmarkPaid: data.unmarkPaid,
    onExport: exportCsv,
    onRetry: data.retryDetail,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [detailState, detail, data.futureRow, card, now, data.mutation, data.refreshFailed, data.markPaid, data.unmarkPaid, data.retryDetail, selectedKey]);

  if (!valid) {
    return <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: 12 }}><BackLink onClick={goBack} /><Notice tone="warn" role="alert">Fatura inválida.</Notice></div>;
  }
  if (!shouldUseRealData(organizationId, dataMode)) {
    return <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: 12 }}><BackLink onClick={goBack} /><Notice>O dashboard da fatura precisa de uma organização com dados reais.</Notice></div>;
  }
  if (data.isLoading) {
    return <div style={{ padding: pad }}><Notice>Carregando fatura…</Notice></div>;
  }
  if (data.loadFailed || data.cardNotFound) {
    const message = data.forbidden || data.cardNotFound
      ? "Cartão não encontrado ou sem acesso."
      : "Não foi possível carregar este cartão.";
    return (
      <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: 12 }} data-testid="invoice-dashboard-error">
        <BackLink onClick={goBack}>Voltar para os cartões</BackLink>
        <Notice tone="warn" role="alert">{message}</Notice>
      </div>
    );
  }

  const degraded = data.auxReady && (data.historyFailed || data.futureFailed);
  const breadcrumb = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <BackLink onClick={goBack} />
      <span style={{ ...G, fontSize: 12, color: T.inkLight }}>·</span>
      <span data-testid="card-name-label" style={{ ...G, fontSize: 12, color: T.inkMid }}>{cardLabel(card)}</span>
    </div>
  );

  const showBreakdown = detailState === "ok" && detail;
  const lower = (
    <>
      {showBreakdown && <CategoryBreakdown breakdown={detail.category_breakdown} total={invoice?.total} currency={currency} isMobile={isMobile} />}
      {showBreakdown && <RecentItems items={detail.items} totalCount={detail.items_count} currency={currency} isMobile={isMobile} onViewAll={() => navigate({ to: cardTransactionsPath(cardId, year, month) })} />}
      {detailState === "forecast" && <ForecastInstallments installments={data.futureRow?.top_installments} currency={currency} isMobile={isMobile} />}
    </>
  );

  return (
    <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: isMobile ? 14 : 16, minWidth: 0 }}>
      {breadcrumb}
      {degraded && <Notice tone="warn">Algumas informações das faturas não puderam ser carregadas. Os dados do seletor podem estar incompletos.</Notice>}

      {isMobile ? (
        <>
          <InvoiceCarousel
            invoices={invoices}
            cardId={card.id}
            currency={currency}
            selectedKey={selectedKey}
            onSelect={selectInvoice}
            onNavigate={() => {}}
            isMobile
            now={now}
            itemWidth={CAROUSEL_ITEM_WIDTH}
            renderItem={({ invoice: item, selected, width }) => (
              <MobileInvoiceItem key={item.key} invoice={item} selected={selected} width={width}
                onSelect={selectInvoice} currency={currency} detailProps={detailProps} />
            )}
          />
          {showBreakdown && <InvoiceMetrics detail={detail} currency={currency} isMobile />}
          {showBreakdown && <InvoiceChanges changes={detail.changes} currency={currency} isMobile />}
          {lower}
        </>
      ) : invoice && (
        <>
           <Card data-testid={`invoice-card-${invoice.key}`} data-status={invoice.status} data-selected="true" aria-label="Fatura selecionada"
             style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <InvoiceNavigator invoices={invoices} selectedKey={selectedKey} onSelect={selectInvoice} currency={currency} />
                <StatusBadge status={invoice.status} />
              </div>
              <Headline invoice={invoice} detail={detail} state={detailState} futureRow={data.futureRow} currency={currency} />
            </div>
            <InvoiceDetailBody invoice={invoice} currency={currency} {...detailProps} />
           </Card>
          {showBreakdown && <InvoiceMetrics detail={detail} currency={currency} />}
          {showBreakdown && <InvoiceChanges changes={detail.changes} currency={currency} />}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }}>{lower}</div>
        </>
      )}
    </div>
  );
}
