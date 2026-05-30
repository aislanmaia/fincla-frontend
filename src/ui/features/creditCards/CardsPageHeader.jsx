import { CreditCard, Pencil, Plus } from "lucide-react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { PageTitle } from "../../components/primitives";

/**
 * Header da `CartoesPage`: título "Meus Cartões" + ações (Novo item,
 * Editar cartão selecionado, +Cartão). Variantes mobile/desktop
 * compartilham markup; só estilo (gap, padding, fontSize, ícones) muda.
 */
export function CardsPageHeader({
  variant,
  cardId,
  canEditSelectedCard,
  onNewItem,
  onEditCard,
  onAddCard,
}) {
  const isMobile = variant === "mobile";

  const dims = isMobile
    ? {
      wrapStyle: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 8 },
      actionsStyle: { display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" },
      pad: "8px 12px",
      gap: 5,
      fontSize: 12,
      iconSize: 13,
      borderRadius: 9,
      newItemLabel: "Item",
      editLabel: "Editar",
      addLabel: "+ Cartão",
    }
    : {
      wrapStyle: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 },
      actionsStyle: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
      pad: "9px 16px",
      gap: 6,
      fontSize: 13,
      iconSize: 14,
      borderRadius: 10,
      newItemLabel: "Novo item",
      editLabel: "Editar",
      addLabel: "+ Cartão",
    };

  return (
    <div style={dims.wrapStyle}>
      <PageTitle sans="Meus" serif="Cartões" />
      <div style={dims.actionsStyle}>
        <button type="button" onClick={() => onNewItem?.(cardId)} title="Novo item"
          style={{ ...G, display: "flex", alignItems: "center", gap: dims.gap, background: T.green, border: "none", borderRadius: dims.borderRadius, padding: dims.pad, fontSize: dims.fontSize, fontWeight: 700, color: "#fff", cursor: "pointer", flexShrink: 0 }}>
          <Plus size={dims.iconSize} /> {isMobile ? <span>{dims.newItemLabel}</span> : dims.newItemLabel}
        </button>
        {canEditSelectedCard && (
          <button type="button" onClick={onEditCard} title="Editar cartão selecionado"
            style={{ ...G, display: "flex", alignItems: "center", gap: dims.gap, background: T.surface, border: `1px solid ${T.border}`, borderRadius: dims.borderRadius, padding: dims.pad, fontSize: dims.fontSize, fontWeight: 700, color: T.ink, cursor: "pointer", flexShrink: 0 }}>
            <Pencil size={dims.iconSize} /> {isMobile ? <span>{dims.editLabel}</span> : dims.editLabel}
          </button>
        )}
        <button type="button" onClick={onAddCard} title="Novo cartão"
          style={{ ...G, display: "flex", alignItems: "center", gap: dims.gap, background: T.ink, border: "none", borderRadius: dims.borderRadius, padding: dims.pad, fontSize: dims.fontSize, fontWeight: 700, color: "#fff", cursor: "pointer", flexShrink: 0 }}>
          <CreditCard size={dims.iconSize} />
          {isMobile ? <span style={{ whiteSpace: "nowrap" }}>{dims.addLabel}</span> : dims.addLabel}
        </button>
      </div>
    </div>
  );
}
