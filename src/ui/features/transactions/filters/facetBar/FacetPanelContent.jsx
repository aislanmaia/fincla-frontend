import React from "react";
import { CardPanel } from "./panels/CardPanel.jsx";
import { CategoryPanel } from "./panels/CategoryPanel.jsx";
import { PaymentMethodPanel } from "./panels/PaymentMethodPanel.jsx";
import { PeriodPanel } from "./panels/PeriodPanel.jsx";
import { RecPanel } from "./panels/RecPanel.jsx";
import { SettlementPanel } from "./panels/SettlementPanel.jsx";
import { TagPanel } from "./panels/TagPanel.jsx";
import { TypePanel } from "./panels/TypePanel.jsx";
import { ValuePanel } from "./panels/ValuePanel.jsx";

/**
 * Mux que escolhe qual painel renderizar com base na key da facet ativa.
 * Todas as props relevantes são repassadas; cada painel ignora o que não usa.
 */
export function FacetPanelContent({
  facetKey,
  // period
  period,
  setPeriod,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  // type
  type,
  setType,
  method,
  setMethod,
  // category
  cats,
  setCats,
  categories,
  // tag
  tags,
  setTags,
  allTags,
  allTagsLoading,
  allTagsError,
  // card
  cardSel,
  setCardSel,
  cards,
  // value
  valueMin,
  valueMax,
  setValueMin,
  setValueMax,
  // recurrence
  rec,
  setRec,
  settlement,
  setSettlement,
  // contagens por opção (GET /v1/transactions/facets) — opcional
  counts,
  // chrome
  onClose,
  onApply,
  compact,
}) {
  switch (facetKey) {
    case "periodo":
      return (
        <PeriodPanel
          period={period}
          setPeriod={setPeriod}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
          onClose={onClose}
          onApply={onApply}
          compact={compact}
        />
      );
    case "tipo":
      return (
        <TypePanel
          type={type}
          setType={setType}
          counts={counts}
          onClose={onClose}
          onApply={onApply}
          compact={compact}
        />
      );
    case "forma":
      return (
        <PaymentMethodPanel
          type={type}
          method={method}
          setMethod={setMethod}
          counts={counts}
          onClose={onClose}
          onApply={onApply}
          compact={compact}
        />
      );
    case "categoria":
      return (
        <CategoryPanel
          cats={cats}
          setCats={setCats}
          categories={categories}
          counts={counts}
          onClose={onClose}
          compact={compact}
        />
      );
    case "tag":
      return (
        <TagPanel
          tags={tags}
          setTags={setTags}
          allTags={allTags}
          loading={allTagsLoading}
          error={allTagsError}
          counts={counts}
          onClose={onClose}
        />
      );
    case "cartao":
      return (
        <CardPanel
          cardSel={cardSel}
          setCardSel={setCardSel}
          cards={cards}
          onClose={onClose}
          compact={compact}
        />
      );
    case "valor":
      return (
        <ValuePanel
          valueMin={valueMin}
          valueMax={valueMax}
          setValueMin={setValueMin}
          setValueMax={setValueMax}
          counts={counts}
          onClose={onClose}
          compact={compact}
        />
      );
    case "recorrencia":
      return (
        <RecPanel
          rec={rec}
          setRec={setRec}
          counts={counts}
          onClose={onClose}
          onApply={onApply}
          compact={compact}
        />
      );
    case "situacao":
      return (
        <SettlementPanel
          settlement={settlement}
          setSettlement={setSettlement}
          counts={counts}
          onClose={onClose}
          onApply={onApply}
          compact={compact}
        />
      );
    default:
      return null;
  }
}
