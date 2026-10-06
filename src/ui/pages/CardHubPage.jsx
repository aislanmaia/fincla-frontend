import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Lightbulb, Pencil, Pin, Plus } from "lucide-react";

import { T } from "../tokens";
import { G } from "../typography";
import { PageTitle } from "../components/primitives";
import { DragScrollTabs } from "../layouts/DragScrollTabs.jsx";
import { shouldUseRealData } from "../dataMode.js";
import { FC } from "../routing/searchContract.js";
import { formatMoneyAbs } from "../money/formatMoney.js";
import { CARD_VISUAL_WIDTH, CardVisual } from "../features/creditCards/cartoesPanels.jsx";
import { CardHeuristicTiles } from "../features/creditCards/CardHeuristicTiles.jsx";
import {
  computeCardKpis,
  computeInstallmentsExposure,
  computeSpendProjection,
  computeUsagePercent,
} from "../features/creditCards/cardKpis.js";
import { HubInvoices } from "../features/cardHub/HubInvoices.jsx";
import { InvoiceCarousel } from "../features/cardHub/InvoiceCarousel.jsx";
import { AllInvoicesDialog } from "../features/cardHub/AllInvoicesDialog.jsx";
import { CategoryTrendChart, InvoiceHistoryChart } from "../features/cardHub/HubCharts.jsx";
import { HubDialog } from "../features/cardHub/HubDialog.jsx";
import { CreateCardDialog } from "../features/cardHub/CreateCardDialog.jsx";
import { EditCardDialog } from "../features/cardHub/EditCardDialog.jsx";
import { CompactKpiStrip, LimitTiles } from "../features/cardHub/HubKpis.jsx";
import { InsightsList } from "../features/cardHub/InsightsList.jsx";

import { NotesDialog } from "../features/cardHub/NotesDialog.jsx";
import { RecentCardTransactions } from "../features/cardHub/RecentCardTransactions.jsx";
import { INVOICE_STATUS, summarizeInvoiceCounts } from "../features/cardHub/hubInvoices.js";
import { useCardHubData } from "../features/cardHub/useCardHubData.js";
import { useRecentCardTransactions } from "../features/cardHub/useRecentCardTransactions.js";
import { useToday } from "../features/cardHub/useToday.js";
import "../features/cardHub/cardHub.css";

const OUTLINE_BTN = {
  ...G, display: "flex", alignItems: "center", gap: 6, background: T.surface, border: `1px solid ${T.border}`,
  borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 700, color: T.ink, cursor: "pointer", flexShrink: 0,
};
const CAROUSEL_ARROW = {
  position: "absolute", top: "50%", transform: "translateY(-50%)", zIndex: 1,
  width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
  border: `1px solid ${T.border}`, borderRadius: 9999, background: T.surface, color: T.ink,
  boxShadow: T.md, transition: "opacity 0.18s, background-color 0.18s",
};

function Notice({ children, tone = "neutral" }) {
  const palette = tone === "warn"
    ? { bg: T.amberLight, fg: T.inkMid, bd: T.amberBorder }
    : { bg: T.grayLight, fg: T.inkMid, bd: T.border };
  return (
    <div role="status" style={{ ...G, fontSize: 12, lineHeight: 1.5, color: palette.fg, background: palette.bg, border: `1px solid ${palette.bd}`, borderRadius: 10, padding: "10px 12px" }}>
      {children}
    </div>
  );
}

function HubCardOption({ card, selected, mobile = false, onSelect }) {
  return (
    <button type="button" aria-pressed={selected} aria-label={`${card.nome || card.banco}, final ${card.dig}${selected ? ", selecionado" : ""}`}
      onClick={() => onSelect(card.cardId)}
      data-card-id={card.cardId}
      style={{ all: "unset", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, cursor: "pointer", padding: 3 }}>
      <div style={{ border: `3px solid ${selected ? T.blue : "transparent"}`, borderRadius: mobile ? 15 : 19, padding: 3,
        background: selected ? T.blueLight : "transparent", transition: "border-color 0.2s, background 0.2s" }}>
        <CardVisual c={card} selected={selected} size={mobile ? "sm" : "md"} />
      </div>
      <span style={{ ...G, minHeight: 19, marginTop: 3, padding: "2px 8px", borderRadius: 9999,
        background: selected ? T.blue : "transparent", color: selected ? "#fff" : "transparent", fontSize: 11, fontWeight: 800 }}>
        ✓ Selecionado
      </span>
    </button>
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
  const search = useSearch({ strict: false });
  const hub = useCardHubData({
    organizationId,
    enabled: shouldUseRealData(organizationId, dataMode),
    refreshToken: transactionsRefreshToken,
    selectedPublicIdFromUrl: search?.[FC.HUB_CARD] ?? null,
  });
  const { selectedCard, selectedCardId, invoiceCards, detail } = hub;
  const recent = useRecentCardTransactions({
    organizationId,
    cardId: selectedCardId,
    enabled: shouldUseRealData(organizationId, dataMode),
    refreshToken: transactionsRefreshToken,
  });

  const [dialog, setDialog] = useState(null);
  const [mobileInvoiceKey, setMobileInvoiceKey] = useState(null);
  const desktopCardsRef = useRef(null);
  const [cardScroll, setCardScroll] = useState({ left: false, right: false });
  const canCreateCard = shouldUseRealData(organizationId, dataMode);
  const now = useToday();

  useEffect(() => {
    if (isMobile) return undefined;
    const scroller = desktopCardsRef.current;
    if (!scroller) return undefined;
    const measure = () => {
      const left = scroller.scrollLeft > 2;
      const right = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2;
      setCardScroll((prev) => prev.left === left && prev.right === right ? prev : { left, right });
    };
    measure();
    scroller.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      scroller.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [isMobile, hub.uiCards.length]);

  useEffect(() => {
    if (isMobile || !selectedCardId) return;
    const scroller = desktopCardsRef.current;
    const selected = [...(scroller?.children ?? [])].find((child) => child.dataset.cardId === String(selectedCardId));
    if (!scroller || !selected) return;
    const left = selected.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
    scroller.scrollTo?.({ left: Math.max(0, left - (scroller.clientWidth - selected.clientWidth) / 2), behavior: "smooth" });
  }, [isMobile, selectedCardId, hub.uiCards.length]);

  const currency = selectedCard?.currency || undefined;
  const uiCard = hub.uiCards.find((c) => c.cardId === selectedCardId) ?? null;
  const openInvoice = invoiceCards.find((i) => i.status === INVOICE_STATUS.OPEN) ?? null;
  const mobileOtherInvoices = invoiceCards.filter((invoice) => invoice.key !== hub.initialInvoiceKey);
  const nearestOtherInvoice = mobileOtherInvoices.find((invoice) => invoice.key > hub.initialInvoiceKey)
    ?? mobileOtherInvoices[mobileOtherInvoices.length - 1];
  const insights = detail.future?.insights ?? [];

  const kpis = useMemo(() => {
    if (!uiCard || detail.loading) return null;
    const invoice = { val: openInvoice?.total ?? (detail.currentState === "empty" ? 0 : null) };
    // As parcelas ativas vêm da fatura aberta: se ela não pôde ser lida, a exposição é
    // desconhecida (null) e o score não é afirmado. 404 (sem lançamentos) é dado: zero parcelas.
    const exposureKnown = detail.currentState !== "unavailable";
    return computeCardKpis({
      card: uiCard,
      invoice,
      usagePercent: computeUsagePercent(uiCard),
      totalInstallments: exposureKnown ? computeInstallmentsExposure(uiCard.parcelas_ativas).net : null,
      projection: computeSpendProjection({ card: uiCard, invoice, isCurrent: true, today: now }),
      today: now,
    });
  }, [uiCard, openInvoice, detail.currentState, detail.loading, now]);

  const goClassic = () => navigate({ to: "/cards", search: (prev) => {
    const next = { ...prev };
    delete next[FC.VIEW];
    delete next[FC.HUB_CARD];
    return next;
  } });
  const goTo = (href) => navigate({ to: href });
  const selectCard = (cardId) => {
    const publicId = hub.cards.find((card) => card.id === cardId)?.public_id;
    if (!publicId) return;
    if (cardId === selectedCardId && search?.[FC.HUB_CARD] === publicId) return;
    navigate({ to: "/cards", search: (prev) => ({ ...prev, [FC.VIEW]: "new", [FC.HUB_CARD]: publicId }) });
  };
  const formatMoneyForCard = (v) => formatMoneyAbs(v, currency) ?? "—";
  const closeDialog = () => setDialog(null);
  const scrollCards = (direction) => {
    const scroller = desktopCardsRef.current;
    const step = (scroller?.firstElementChild?.getBoundingClientRect().width ?? 218) + 14;
    scroller?.scrollBy?.({ left: direction * step, behavior: "smooth" });
  };

  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: isMobile ? 12 : 16 }}>
      <PageTitle sans="Meus" serif="Cartões" />
      <div style={{ display: "flex", gap: isMobile ? 6 : 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {canCreateCard && !hub.isLoading && !hub.error && (
          <button type="button" onClick={() => setDialog("create-card")} style={OUTLINE_BTN}>
            <Plus size={14} /> Cartão
          </button>
        )}
        {selectedCard && insights.length > 0 && isMobile && (
          <button type="button" onClick={() => setDialog("insights")} aria-label="Insights" style={OUTLINE_BTN}>
            <Lightbulb size={14} />
          </button>
        )}
        {selectedCard && (
          <button type="button" onClick={() => setDialog("edit-card")} style={OUTLINE_BTN}>
            <Pencil size={14} /> {isMobile ? "Editar" : "Editar cartão"}
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
        <button type="button" onClick={() => setDialog("create-card")} disabled={!canCreateCard} style={{ ...OUTLINE_BTN, background: T.ink, color: "#fff", border: "none" }}>
          Cadastrar cartão
        </button>
        {dialog === "create-card" && <CreateCardDialog organizationId={organizationId} isMobile={isMobile} onCreate={async (payload) => {
          const created = await hub.createCard(payload);
          navigate({ to: "/cards", search: (prev) => ({ ...prev, [FC.VIEW]: "new", [FC.HUB_CARD]: created.public_id }) });
          return created;
        }} onClose={closeDialog} />}
      </div>
    );
  }

  const cardRow = (
    <div style={{ marginBottom: isMobile ? 2 : 6 }}>
      {isMobile ? (
        <DragScrollTabs bg={T.bg}>
          {hub.uiCards.map((c) => (
            <HubCardOption key={c.id} card={c} selected={c.cardId === selectedCardId} mobile onSelect={selectCard} />
          ))}
          {canCreateCard && <NewCardTile isMobile onClick={() => setDialog("create-card")} />}
        </DragScrollTabs>
      ) : (
        <div style={{ position: "relative", minWidth: 0 }}>
          <div ref={desktopCardsRef} data-testid="hub-card-carousel" style={{ display: "flex", gap: 14, overflowX: "auto", padding: "6px 44px 8px", scrollbarWidth: "none", scrollBehavior: "smooth" }}>
            {hub.uiCards.map((c) => (
              <HubCardOption key={c.id} card={c} selected={c.cardId === selectedCardId} onSelect={selectCard} />
            ))}
            {canCreateCard && <NewCardTile onClick={() => setDialog("create-card")} />}
          </div>
          <button type="button" aria-label="Ver cartões anteriores" disabled={!cardScroll.left} onClick={() => scrollCards(-1)}
            style={{ ...CAROUSEL_ARROW, left: 4, opacity: cardScroll.left ? 1 : 0.4, cursor: cardScroll.left ? "pointer" : "default" }}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Ver próximos cartões" disabled={!cardScroll.right} onClick={() => scrollCards(1)}
            style={{ ...CAROUSEL_ARROW, right: 4, opacity: cardScroll.right ? 1 : 0.4, cursor: cardScroll.right ? "pointer" : "default" }}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );

  const degraded = !detail.loading && (detail.historyFailed || detail.futureFailed || detail.currentState === "unavailable");
  const cardName = selectedCard.description?.trim() || `${selectedCard.brand} •• ${selectedCard.last4}`;

  return (
    <div style={{ padding: isMobile ? 16 : 28, display: "flex", flexDirection: "column", gap: isMobile ? 14 : 18, minWidth: 0 }}>
      <div>{header}{classicLink}</div>

      {cardRow}

      <div style={{ ...G, fontSize: 12, color: T.inkMid }}>
        Cartão selecionado: <strong style={{ color: T.ink }}>{cardName} •{selectedCard.last4}</strong>
      </div>

      <LimitTiles card={selectedCard} currency={currency} isMobile={isMobile} onEdit={() => setDialog("edit-card")} />

      {!isMobile && insights.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.amber}`, borderRadius: 14, padding: "14px 18px" }}>
          <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 10 }}>💡 Insights</div>
          <InsightsList insights={insights} />
        </div>
      )}

      {kpis && (isMobile
        ? <CompactKpiStrip kpis={kpis} />
        : <CardHeuristicTiles kpis={kpis} formatBRL={formatMoneyForCard} isMobile={false} emphasizeProgress />)}

      <div style={{ height: 1, background: T.border }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ ...G, margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 800, color: T.ink }}>Faturas</h2>
        {invoiceCards.length > 0 && (
          <span data-testid="invoice-counts" style={{ ...G, fontSize: 11, color: T.inkMid, background: T.grayLight, borderRadius: 9999, padding: "3px 10px" }}>
            {summarizeInvoiceCounts(invoiceCards)}
          </span>
        )}
      </div>

      {hub.refreshFailed && <Notice tone="warn">Não foi possível atualizar agora. Mostrando os dados anteriores.</Notice>}

      {degraded && <Notice tone="warn">Algumas informações das faturas não puderam ser carregadas. Os dados abaixo podem estar incompletos.</Notice>}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 2fr) minmax(0, 1fr)", gap: 14, alignItems: "stretch", minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      {detail.loading ? (
        <Notice>Carregando faturas…</Notice>
      ) : invoiceCards.length === 0 ? (
        <Notice>Este cartão ainda não tem faturas.</Notice>
      ) : (
        <>
          <HubInvoices
            key={`${organizationId}:${selectedCard.id}:${hub.initialInvoiceKey}`}
            invoices={invoiceCards}
            currentKey={hub.initialInvoiceKey}
            cardId={selectedCard.public_id}
            currency={currency}
            isMobile={isMobile}
            now={now}
            onNavigate={goTo}
            onMarkPaid={hub.payInvoice}
          />
          {isMobile && <>
            {mobileOtherInvoices.length > 0 && <InvoiceCarousel invoices={mobileOtherInvoices} cardId={selectedCard.public_id} currency={currency}
              selectedKey={mobileOtherInvoices.some((invoice) => invoice.key === mobileInvoiceKey) ? mobileInvoiceKey : nearestOtherInvoice?.key}
              onSelect={setMobileInvoiceKey} onNavigate={goTo} isMobile now={now} openOnCard />}
            <button type="button" onClick={() => setDialog("invoices")} data-testid="all-invoices-open-button"
              style={{ ...OUTLINE_BTN, width: "100%", justifyContent: "space-between" }}>
              <span>📋 Ver todas as faturas</span><span>{invoiceCards.length} faturas →</span>
            </button>
          </>}
        </>
      )}
      </div>

      <RecentCardTransactions
        transactions={recent.rows}
        cardCurrency={currency}
        loading={recent.loading}
        error={recent.error}
        onViewAll={() => goTo("/transactions")}
      />
      </div>

      {!detail.loading && invoiceCards.length > 0 && (
        <>
          <div style={{ height: 1, background: T.border }} />
          <InvoiceHistoryChart
            invoices={invoiceCards}
            anchorKey={openInvoice?.key ?? hub.initialInvoiceKey}
            currency={currency}
            isMobile={isMobile}
          />
          <CategoryTrendChart
            history={detail.history}
            anchorKey={detail.history?.period_end?.slice(0, 7) ?? openInvoice?.key ?? hub.initialInvoiceKey}
            currency={currency}
            isMobile={isMobile}
          />
        </>
      )}

      {dialog === "notes" && (
        <NotesDialog
          key={`${organizationId}:${selectedCard.id}`}
          initialNotes={selectedCard.notes ?? ""}
          isMobile={isMobile}
          onSave={hub.saveNotes}
          onClose={closeDialog}
        />
      )}
      {dialog === "edit-card" && (
        <EditCardDialog key={`${organizationId}:${selectedCard.id}`} card={selectedCard} organizationId={organizationId}
          isMobile={isMobile} onSave={hub.updateCard} onClose={closeDialog} />
      )}
      {dialog === "create-card" && (
        <CreateCardDialog organizationId={organizationId} isMobile={isMobile} onCreate={async (payload) => {
          const created = await hub.createCard(payload);
          navigate({ to: "/cards", search: (prev) => ({ ...prev, [FC.VIEW]: "new", [FC.HUB_CARD]: created.public_id }) });
          return created;
        }} onClose={closeDialog} />
      )}
      {dialog === "invoices" && <AllInvoicesDialog invoices={invoiceCards} cardId={selectedCard.public_id} currency={currency}
        isMobile
        onNavigate={(href) => { closeDialog(); goTo(href); }} onClose={closeDialog} />}
      {dialog === "insights" && (
        <HubDialog title="Insights" isMobile={isMobile} onClose={closeDialog}>
          <div style={{ padding: "16px 20px" }}><InsightsList insights={insights} /></div>
        </HubDialog>
      )}
    </div>
  );
}

function NewCardTile({ isMobile = false, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Novo cartão" style={{
      ...G, width: isMobile ? CARD_VISUAL_WIDTH.sm - 10 : CARD_VISUAL_WIDTH.md - 50,
      height: isMobile ? 94 : Math.round(CARD_VISUAL_WIDTH.md / 1.586),
      marginTop: isMobile ? 8 : 0, borderRadius: isMobile ? 12 : 16,
      border: `2px dashed ${T.border}`, background: T.surface, color: T.inkMid,
      flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 6, cursor: "pointer", fontSize: 11,
    }}>
      <Plus size={isMobile ? 18 : 22} /> Novo cartão
    </button>
  );
}
