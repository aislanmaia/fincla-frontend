import { formatMoneyAbs } from "../../money/formatMoney.js";
import { G, NUM } from "../../typography.js";
import { T } from "../../tokens.js";

const STATUS_LABELS = { open: "Aberta", closed: "Fechada", paid: "Paga" };
const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const segmentStyle = (active) => ({
  ...G,
  flex: 1,
  minHeight: 36,
  border: `1.5px solid ${active ? T.blue : T.border}`,
  borderRadius: 9,
  background: active ? T.blueLight : T.surface,
  color: active ? T.blue : T.ink,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
});

/**
 * Cabeçalho da faceta Período do ledger do cartão: escolhe entre FATURAS (uma ou
 * mais) e PERÍODO livre. No modo Fatura ele é o conteúdo inteiro da faceta; no modo
 * Período fica acima do calendário e dos atalhos de sempre.
 */
export function CardTimeScopePanel({ mode, onMode, options, selectedKeys, onToggle, currency, invoiceDisabled = false }) {
  const selected = new Set(selectedKeys);
  return <div style={{ ...G, display: "flex", flexDirection: "column", gap: 12 }}>
    <div role="group" aria-label="Recorte de tempo" style={{ display: "flex", gap: 8 }}>
      <button type="button" aria-pressed={mode === "invoice"} disabled={invoiceDisabled} onClick={() => onMode("invoice")} style={{ ...segmentStyle(mode === "invoice"), opacity: invoiceDisabled ? 0.5 : 1, cursor: invoiceDisabled ? "not-allowed" : "pointer" }}>Fatura</button>
      <button type="button" aria-pressed={mode === "period"} onClick={() => onMode("period")} style={segmentStyle(mode === "period")}>Período livre</button>
    </div>
    {invoiceDisabled && <p style={{ ...G, margin: 0, color: T.inkMid, fontSize: 11 }}>Fatura vale para um cartão. Volte para “este cartão” para escolher faturas.</p>}
    {mode === "invoice" && <>
      <p style={{ ...G, margin: 0, color: T.inkMid, fontSize: 11 }}>Marque uma ou mais faturas deste cartão.</p>
      {options.length === 0 && <p role="status" style={{ ...G, margin: 0, color: T.inkMid, fontSize: 12 }}>Este cartão ainda não tem faturas.</p>}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map((option) => {
          const disabled = option.invoiceId == null;
          const checked = selected.has(option.key);
          const name = `${MONTH_NAMES[option.month - 1]} ${option.year}`;
          return <li key={option.key}>
            <label style={{ ...G, display: "flex", alignItems: "center", gap: 10, minHeight: 40, padding: "6px 10px", border: `1px solid ${checked ? T.blue : T.border}`, borderRadius: 9, background: checked ? T.blueLight : T.surface, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}>
              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onToggle(option.key)} aria-label={`Fatura de ${name}`} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>{name}</span>
              <span style={{ ...NUM, fontSize: 11, color: T.inkMid }}>{disabled ? "sem lançamentos" : option.total != null && currency ? formatMoneyAbs(option.total, currency) : ""}</span>
              {!disabled && option.status && <span style={{ fontSize: 11, fontWeight: 700, color: option.status === "paid" ? T.inkMid : T.blue }}>{STATUS_LABELS[option.status] ?? option.status}</span>}
            </label>
          </li>;
        })}
      </ul>
    </>}
  </div>;
}
