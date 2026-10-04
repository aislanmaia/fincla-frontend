import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Lightbulb, Pin, Plus } from "lucide-react";

import { T } from "../tokens";
import { G } from "../typography";
import { PageTitle } from "../components/primitives";
import { DragScrollTabs } from "../layouts/DragScrollTabs.jsx";
import { shouldUseRealData } from "../dataMode.js";
import { FC } from "../routing/searchContract.js";
import { formatMoneyAbs } from "../money/formatMoney.js";
import { CardVisual } from "../features/creditCards/cartoesPanels.jsx";
import { CardHeuristicTiles } from "../features/creditCards/CardHeuristicTiles.jsx";
import {
  computeCardKpis,
  computeInstallmentsExposure,
  computeSpendProjection,
  computeUsagePercent,
} from "../features/creditCards/cardKpis.js";
import { AllInvoicesDialog } from "../features/cardHub/AllInvoicesDialog.jsx";
import { HubDialog } from "../features/cardHub/HubDialog.jsx";
import { CompactKpiStrip, LimitTiles } from "../features/cardHub/HubKpis.jsx";
import { InsightsList } from "../features/cardHub/InsightsList.jsx";
import { InvoiceCarousel } from "../features/cardHub/InvoiceCarousel.jsx";
import { NotesDialog } from "../features/cardHub/NotesDialog.jsx";
import { INVOICE_STATUS, summarizeInvoiceCounts } from "../features/cardHub/hubInvoices.js";
import { useCardHubData } from "../features/cardHub/useCardHubData.js";

const OUTLINE_BTN = {
  ...G, display: "flex", alignItems: "center", gap: 6, background: T.surface, border: `1px solid ${T.border}`,
  borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 700, color: T.ink, cursor: "pointer", flexShrink: 0,
};

function Notice({ children, tone = "neutral" }) {
  const palette = tone === "warn"
    ? { bg: T.amberLight, fg: "#92400E", bd: T.amberBorder }
    : { bg: T.grayLight, fg: T.inkMid, bd: T.border };
  return (
    <div role="status" style={{ ...G, fontSize: 12, lineHeight: 1.5, color: palette.fg, background: palette.bg, border: `1px solid ${palette.bd}`, borderRadius: 10, padding: "10px 12px" }}>
      {children}
    </div>
  );
}

export function CardHubPage({
  isMobile = false,
  onNewItem,
  organizationId = null,
  dataMode = "live",
  transactionsRefreshToken = 0,
}) {
  const navigate = useNavigate();
  const hub = useCardHubData({
    organizationId,
    enabled: shouldUseRealData(organizationId, dataMode),
    refreshToken: transactionsRefreshToken,
  });
  const { selectedCard, selectedCardId, invoiceCards, detail } = hub;

  const [pickedKey, setPickedKey] = useState(null);
  const [dialog, setDialog] = useState(null);
  const now = useMemo(() => new Date(), []);

  useEffect(() => { setPickedKey(null); }, [selectedCardId]);

  const selectedKey = invoiceCards.some((i) => i.key === pickedKey) ? pickedKey : hub.initialInvoiceKey;
  const currency = selectedCard?.currency || undefined;
  const uiCard = hub.uiCards.find((c) => c.cardId === selectedCardId) ?? null;
  const openInvoice = invoiceCards.find((i) => i.status === INVOICE_STATUS.OPEN) ?? null;
  const insights = detail.future?.insights ?? [];

  const kpis = useMemo(() => {
    if (!uiCard) return null;
    const invoice = { val: openInvoice?.total ?? 0 };
    return computeCardKpis({
      card: uiCard,
      invoice,
      usagePercent: computeUsagePercent(uiCard),
      totalInstallments: computeInstallmentsExposure(uiCard.parcelas_ativas).net,
      projection: computeSpendProjection({ card: uiCard, invoice, isCurrent: true }),
    });
  }, [uiCard, openInvoice]);

  const goClassic = () => navigate({ to: "/cards", search: (prev) => ({ ...prev, [FC.VIEW]: "classic" }) });
  const goTo = (href) => navigate({ to: href });
  const formatMoneyForCard = (v) => formatMoneyAbs(v, currency) ?? "—";
  const closeDialog = () => setDialog(null);

  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: isMobile ? 12 : 16 }}>
      <PageTitle sans="Meus" serif="Cartões" />
      <div style={{ display: "flex", gap: isMobile ? 6 : 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {selectedCard && insights.length > 0 && isMobile && (
          <button type="button" onClick={() => setDialog("insights")} aria-label="Insights" style={OUTLINE_BTN}>
            <Lightbulb size={14} />
          </button>
        )}
        {selectedCard && (
          <button type="button" onClick={() => setDialog("notes")} data-testid="card-notes-open" style={OUTLINE_BTN}>
            <Pin size={14} /> Anotações
          </button>
        )}
        {selectedCard && onNewItem && (
          <button type="button" onClick={() => onNewItem(selectedCard.id)}
            style={{ ...OUTLINE_BTN, background: T.green, border: "none", color: "#fff" }}>
            <Plus size={14} /> {isMobile ? "Item" : "Novo item"}
          </button>
        )}
      </div>
    </div>
  );

  const classicLink = (
    <div style={{ marginTop: 4 }}>
      <button type="button" onClick={goClassic} data-testid="classic-view-link"
        style={{ ...G, background: "none", border: "none", padding: 0, fontSize: 11, color: T.inkLight, textDecoration: "underline", cursor: "pointer" }}>
        Ver tela anterior
      </button>
    </div>
  );

  if (hub.isLoading) {
    return <div style={{ padding: isMobile ? 16 : 28 }}>{header}<Notice>Carregando seus cartões…</Notice></div>;
  }

  if (hub.error) {
    return <div style={{ padding: isMobile ? 16 : 28 }}>{header}<Notice tone="warn">{hub.error}</Notice>{classicLink}</div>;
  }

  if (!selectedCard) {
    return (
      <div style={{ padding: isMobile ? 16 : 28 }}>
        {header}
        <div style={{ ...G, fontSize: 14, color: T.inkMid, marginBottom: 12 }}>Você ainda não cadastrou nenhum cartão.</div>
        <button type="button" onClick={goClassic} style={{ ...OUTLINE_BTN, background: T.ink, color: "#fff", border: "none" }}>
          Cadastrar cartão
        </button>
      </div>
    );
  }

  const cardRow = (
    <div style={{ marginBottom: isMobile ? 2 : 6 }}>
      {isMobile ? (
        <DragScrollTabs bg={T.bg}>
          {hub.uiCards.map((c) => (
            <div key={c.id} style={{ paddingTop: 8 }}>
              <CardVisual c={c} selected={c.cardId === selectedCardId} size="sm" onClick={() => hub.selectCard(c.cardId)} />
            </div>
          ))}
        </DragScrollTabs>
      ) : (
        <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "6px 4px 8px", scrollbarWidth: "none" }}>
          {hub.uiCards.map((c) => (
            <CardVisual key={c.id} c={c} selected={c.cardId === selectedCardId} size="md" onClick={() => hub.selectCard(c.cardId)} />
          ))}
        </div>
      )}
    </div>
  );

  const degraded = detail.historyFailed || detail.futureFailed || detail.currentState === "unavailable";
  const cardName = selectedCard.description?.trim() || `${selectedCard.brand} •• ${selectedCard.last4}`;

  return (
    <div style={{ padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap: isMobile ? 14 : 18, minWidth: 0 }}>
      <div>{header}{classicLink}</div>

      {cardRow}

      <div style={{ ...G, fontSize: 12, color: T.inkMid }}>
        Cartão selecionado: <strong style={{ color: T.ink }}>{cardName} •{selectedCard.last4}</strong>
      </div>

      <LimitTiles card={selectedCard} currency={currency} isMobile={isMobile} />

      {!isMobile && insights.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.amber}`, borderRadius: 14, padding: "14px 18px" }}>
          <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 10 }}>💡 Insights</div>
          <InsightsList insights={insights} />
        </div>
      )}

      {kpis && (isMobile
        ? <CompactKpiStrip kpis={kpis} />
        : <CardHeuristicTiles kpis={kpis} formatBRL={formatMoneyForCard} isMobile={false} />)}

      <div style={{ height: 1, background: T.border }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ ...G, margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 800, color: T.ink }}>Faturas</h2>
        {invoiceCards.length > 0 && (
          <span data-testid="invoice-counts" style={{ ...G, fontSize: 11, color: T.inkMid, background: T.grayLight, borderRadius: 9999, padding: "3px 10px" }}>
            {summarizeInvoiceCounts(invoiceCards)}
          </span>
        )}
      </div>

      {degraded && <Notice tone="warn">Algumas informações das faturas não puderam ser carregadas. Os dados abaixo podem estar incompletos.</Notice>}

      {detail.loading ? (
        <Notice>Carregando faturas…</Notice>
      ) : invoiceCards.length === 0 ? (
        <Notice>Este cartão ainda não tem faturas.</Notice>
      ) : (
        <>
          <InvoiceCarousel
            invoices={invoiceCards}
            cardId={selectedCard.id}
            currency={currency}
            selectedKey={selectedKey}
            onSelect={setPickedKey}
            onNavigate={goTo}
            isMobile={isMobile}
            now={now}
          />
          <button type="button" onClick={() => setDialog("invoices")} data-testid="all-invoices-open-button"
            style={{ ...OUTLINE_BTN, justifyContent: "space-between", width: isMobile ? "100%" : "auto", alignSelf: isMobile ? "stretch" : "flex-start" }}>
            <span>📋 Ver todas as faturas</span>
            <span style={{ fontSize: 11, color: T.blue }}>{invoiceCards.length} faturas →</span>
          </button>
        </>
      )}

      {dialog === "notes" && (
        <NotesDialog
          key={selectedCard.id}
          initialNotes={selectedCard.notes ?? ""}
          isMobile={isMobile}
          onSave={hub.saveNotes}
          onClose={closeDialog}
        />
      )}
      {dialog === "invoices" && (
        <AllInvoicesDialog
          invoices={invoiceCards}
          cardId={selectedCard.id}
          currency={currency}
          isMobile={isMobile}
          onPick={(key) => { setPickedKey(key); closeDialog(); }}
          onNavigate={(href) => { closeDialog(); goTo(href); }}
          onClose={closeDialog}
        />
      )}
      {dialog === "insights" && (
        <HubDialog title="Insights" isMobile={isMobile} onClose={closeDialog}>
          <div style={{ padding: "16px 20px" }}><InsightsList insights={insights} /></div>
        </HubDialog>
      )}
    </div>
  );
}
