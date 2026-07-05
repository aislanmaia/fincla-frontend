import React from "react";

import { Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import { Icon } from "./consultantUi";

/**
 * Uma opção de formato de exportação (espelha a seção "Formato de exportação" do
 * `ExportInvoiceModal` dos cartões): card selecionável com check quando ativo.
 */
function FormatOption({ selected, onSelect, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ ...G, textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${selected ? T.ink : T.border}`, background: selected ? T.bg : T.surface, cursor: "pointer", transition: "all 0.15s" }}
    >
      <div style={{ width: 22, height: 22, borderRadius: 6, background: selected ? T.ink : "transparent", border: selected ? "none" : `2px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {selected && <Icon name="check" size={12} color="#fff" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink }}>{title}</div>
        <div style={{ ...G, fontSize: 10, color: T.inkLight }}>{subtitle}</div>
      </div>
    </button>
  );
}

/**
 * Modal "Exportar consolidado" do Insights. Formato **PDF** (default — relatório
 * apresentável ao cliente) ou **CSV** (dados p/ planilha). O botão dispara
 * `onExport(format)` — ambos baixam o consolidado da base
 * (`/consultant/reports/consolidated`); o PDF ainda cruza os agregados do Insights.
 */
export function ConsultantExportModal({ open, exporting, onExport, onClose }) {
  const [format, setFormat] = React.useState("pdf");
  if (!open) return null;
  const label = format === "pdf" ? "Exportar PDF" : "Exportar CSV";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div role="presentation" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15,15,13,0.5)" }} />
      <Card style={{ position: "relative", width: 440, maxWidth: "100%", padding: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>Exportar consolidado</div>
            <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 2 }}>Números agregados de toda a carteira</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ background: T.grayLight, border: "none", cursor: "pointer", padding: 7, borderRadius: 8, display: "flex" }}>
            <Icon name="x" size={14} color={T.inkMid} />
          </button>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em" }}>Formato de exportação</div>
          <FormatOption selected={format === "pdf"} onSelect={() => setFormat("pdf")} title="PDF" subtitle="Relatório para apresentar ao cliente" />
          <FormatOption selected={format === "csv"} onSelect={() => setFormat("csv")} title="CSV" subtitle="Compatível com Excel, Sheets, etc." />
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}` }}>
          <button type="button" onClick={() => onExport(format)} disabled={exporting}
            style={{ ...G, width: "100%", padding: "13px", borderRadius: 10, border: "none", background: T.ink, color: "#fff", fontSize: 13, fontWeight: 700, cursor: exporting ? "default" : "pointer", opacity: exporting ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Icon name="download" size={14} color="#fff" /> {exporting ? "Exportando…" : label}
          </button>
        </div>
      </Card>
    </div>
  );
}
