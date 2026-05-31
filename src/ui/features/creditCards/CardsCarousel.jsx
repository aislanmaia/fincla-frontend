import { Plus } from "lucide-react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { DragScrollTabs } from "../../layouts/DragScrollTabs.jsx";
import { CardVisual } from "./cartoesPanels.jsx";

/**
 * Carrossel de cartões da `CartoesPage`: lista os cartões do usuário e
 * uma "tile" pontilhada para adicionar um novo. No mobile usa
 * `<DragScrollTabs>` para scroll horizontal nativo; no desktop é
 * `overflow-x:auto` direto.
 */
export function CardsCarousel({
  variant,
  cards,
  selectedCardId,
  onSwitchCard,
  onAddCard,
}) {
  const isMobile = variant === "mobile";

  const dims = isMobile
    ? {
      wrapStyle: { marginBottom: 2 },
      cardSize: "sm",
      cardItemStyle: { paddingTop: 8, paddingBottom: 0 },
      addWidth: 130,
      addBorderRadius: 12,
      addPlusSize: 18,
      addGap: 5,
      addLabelFontSize: 10,
      addExtraStyle: { marginTop: 8 },
    }
    : {
      wrapStyle: { marginBottom: 16 },
      cardSize: "md",
      addWidth: 200,
      addBorderRadius: 16,
      addPlusSize: 22,
      addGap: 6,
      addLabelFontSize: 11,
      addExtraStyle: {},
    };

  const addTile = (
    <div onClick={onAddCard}
      style={{
        width: dims.addWidth,
        height: Math.round(dims.addWidth / 1.586),
        borderRadius: dims.addBorderRadius,
        flexShrink: 0,
        border: `2px dashed ${T.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: dims.addGap,
        cursor: "pointer",
        background: T.surface,
        ...dims.addExtraStyle,
      }}>
      <Plus size={dims.addPlusSize} color={T.inkLight} />
      <span style={{ ...G, fontSize: dims.addLabelFontSize, color: T.inkMid }}>Novo cartão</span>
    </div>
  );

  if (isMobile) {
    return (
      <div style={dims.wrapStyle}>
        <DragScrollTabs bg={T.bg}>
          {cards.map((c) => (
            <div key={c.id} style={dims.cardItemStyle}>
              <CardVisual c={c} selected={c.id === selectedCardId} size={dims.cardSize} onClick={onSwitchCard} />
            </div>
          ))}
          {addTile}
        </DragScrollTabs>
      </div>
    );
  }

  return (
    <div style={dims.wrapStyle}>
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8, paddingTop: 6, scrollbarWidth: "none" }}>
        {cards.map((c) => (
          <CardVisual key={c.id} c={c} selected={c.id === selectedCardId} size={dims.cardSize} onClick={onSwitchCard} />
        ))}
        {addTile}
      </div>
    </div>
  );
}
