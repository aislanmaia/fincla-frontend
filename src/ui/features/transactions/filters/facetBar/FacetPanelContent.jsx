import React from "react";
import { CardPanel } from "./panels/CardPanel.jsx";
import { CategoryPanel } from "./panels/CategoryPanel.jsx";
import { PeriodPanel } from "./panels/PeriodPanel.jsx";
import { RecPanel } from "./panels/RecPanel.jsx";
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
  // category
  cats,
  setCats,
  categories,
  // tag
  tags,
  setTags,
  allTags,
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
  // chrome
  onClose,
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
          compact={compact}
        />
      );
    case "tipo":
      return <TypePanel type={type} setType={setType} onClose={onClose} compact={compact} />;
    case "categoria":
      return (
        <CategoryPanel
          cats={cats}
          setCats={setCats}
          categories={categories}
          onClose={onClose}
          compact={compact}
        />
      );
    case "tag":
      return <TagPanel tags={tags} setTags={setTags} allTags={allTags} onClose={onClose} />;
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
          onClose={onClose}
          compact={compact}
        />
      );
    case "recorrencia":
      return <RecPanel rec={rec} setRec={setRec} onClose={onClose} compact={compact} />;
    default:
      return null;
  }
}
