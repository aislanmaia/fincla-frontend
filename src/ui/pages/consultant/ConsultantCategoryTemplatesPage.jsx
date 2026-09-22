import React from "react";

import { ConsultantCategoryTemplatesPanel } from "../../features/consultant/ConsultantCategoryTemplatesPanel.jsx";
import { PageTitle } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";

/** Portfolio catalog defaults belong to the consultant's operating area, not profile. */
export function ConsultantCategoryTemplatesPage() {
  return <div style={{ ...G, width: "100%", boxSizing: "border-box", padding: "clamp(18px, 3.5vw, 32px) clamp(16px, 3.5vw, 40px) 48px", display: "flex", flexDirection: "column", gap: 18, minWidth: 0, maxWidth: 1040 }}>
    <div>
      <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Sua carteira</div>
      <PageTitle sans="Modelos de" serif="categorias" />
      <p style={{ ...G, maxWidth: 630, margin: "9px 0 0", color: T.inkMid, fontSize: 13, lineHeight: 1.55 }}>Monte catálogos que serão copiados para cada novo cliente. Você pode adaptar as categorias padrão, criar categorias próprias e organizar etiquetas.</p>
    </div>
    <ConsultantCategoryTemplatesPanel />
  </div>;
}
