import { Check, ChevronDown, X } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { M_MONO } from "../moodV4";
import { CARD_BRAND_OPTIONS } from "../../data/creditCardsAdapter.js";

/**
 * Sheet "Adicionar / Editar cartão" usado pela `CartoesPage`.
 *
 * Permanece "stateless": todo o estado de rascunho (`draft*`), os handlers
 * de salvar/atualizar/cancelar, e flags de loading/erro/sucesso são
 * controlados pelo pai. Apresentação reage só via props.
 */
export function CardFormSheet({
  open,
  isMobile,
  isEdit,
  draftIssuer,
  setDraftIssuer,
  draftName,
  setDraftName,
  draftLast4,
  setDraftLast4,
  draftBrand,
  setDraftBrand,
  draftLimit,
  setDraftLimit,
  draftDueDay,
  setDraftDueDay,
  draftClosingDay,
  setDraftClosingDay,
  draftSuccess,
  saving,
  error,
  onSave,
  onUpdate,
  onCancel,
}) {
  if (!open) return null;
  const canSave =
    draftIssuer && draftName && draftLast4 && draftLimit && draftDueDay;

  const FI = ({ val, set, ph, type = "text" }) => (
    <div
      style={{ display: "flex", alignItems: "center", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 9, background: T.surface, transition: "border-color 0.15s" }}
      onFocusCapture={(e) => (e.currentTarget.style.borderColor = T.blue)}
      onBlurCapture={(e) => (e.currentTarget.style.borderColor = T.border)}
    >
      <input
        value={val}
        onChange={(e) => set(e.target.value)}
        placeholder={ph}
        type={type}
        style={{ ...G, flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 13, color: T.ink }}
      />
    </div>
  );

  const inner = (
    <>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>
            {isEdit ? "Editar cartão" : "Adicionar cartão"}
          </div>
          {isEdit && (
            <div style={{ ...G, fontSize: 12, fontWeight: 500, color: T.inkMid, marginTop: 5, lineHeight: 1.45 }}>
              Atualize nome, limite e datas. Alterar os 4 dígitos afeta como o cartão é identificado nas transações.
            </div>
          )}
        </div>
        <button type="button" onClick={onCancel}
          style={{ background: T.grayLight, border: "none", cursor: "pointer", padding: 7, borderRadius: 8, display: "flex", flexShrink: 0 }}>
          <X size={14} color={T.inkMid} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Preview card stub */}
        <div style={{ height: 96, borderRadius: 14, background: "linear-gradient(135deg,#374151,#6B7280)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "14px 18px", position: "relative", overflow: "hidden", marginBottom: 4 }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
          <div style={{ ...G, fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
            {draftIssuer || "BANCO"}
          </div>
          <div style={{ ...M_MONO, ...NUM, fontSize: 13, color: "rgba(255,255,255,0.6)", letterSpacing: "0.18em" }}>
            ···· ···· ···· {draftLast4 || "····"}
          </div>
          <div style={{ ...G, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>
            {draftName || "Nome do cartão"}
          </div>
        </div>
        <div>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 7 }}>Banco / Emissor</div>
          <FI val={draftIssuer} set={setDraftIssuer} ph="ex: Nubank, Itaú, Bradesco…" />
        </div>
        <div>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 7 }}>Nome do cartão</div>
          <FI val={draftName} set={setDraftName} ph="ex: Nubank Roxinho, Personnalité…" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 7 }}>4 últimos dígitos</div>
            <FI val={draftLast4} set={setDraftLast4} ph="1234" type="number" />
          </div>
          <div>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 7 }}>Bandeira</div>
            <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
              <select value={draftBrand} onChange={(e) => setDraftBrand(e.target.value)}
                style={{ ...G, padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 9, background: T.surface, fontSize: 13, color: T.ink, cursor: "pointer", appearance: "none" }}>
                {CARD_BRAND_OPTIONS.map((b) => <option key={b}>{b}</option>)}
              </select>
              <ChevronDown size={13} color={T.inkLight}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
          </div>
        </div>
        <div>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 7 }}>Limite total</div>
          <div style={{ display: "flex", alignItems: "center", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 9, background: T.surface }}
            onFocusCapture={(e) => (e.currentTarget.style.borderColor = T.blue)}
            onBlurCapture={(e) => (e.currentTarget.style.borderColor = T.border)}>
            <span style={{ ...G, fontSize: 13, fontWeight: 700, color: T.inkLight, marginRight: 4 }}>R$</span>
            <input value={draftLimit} onChange={(e) => setDraftLimit(e.target.value)} placeholder="0,00" type="text"
              style={{ ...G, ...NUM, flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: T.ink }} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 7 }}>Dia do vencimento</div>
            <FI val={draftDueDay} set={setDraftDueDay} ph="ex: 10" type="number" />
          </div>
          <div>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 7 }}>Dia do fechamento</div>
            <FI val={draftClosingDay} set={setDraftClosingDay} ph="ex: 3" type="number" />
          </div>
        </div>
        <div style={{ background: T.blueLight, border: `1px solid ${T.blue}22`, borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ ...G, fontSize: 11, color: T.blue, lineHeight: 1.65 }}>
            💡 <strong>Dica financeira:</strong> O dia do fechamento define o início do período de compras. Compras feitas logo após o fechamento têm mais prazo para pagamento.
          </div>
        </div>
      </div>
      <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        {error && (
          <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, border: `1px solid ${T.red}22`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        <button type="button" onClick={isEdit ? onUpdate : onSave} disabled={!canSave || saving}
          style={{ ...G, width: "100%", padding: "13px", borderRadius: 10, border: "none", background: draftSuccess ? T.green : (!canSave || saving) ? T.inkGhost : T.ink, color: "#fff", fontSize: 13, fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.2s" }}>
          {draftSuccess
            ? <><Check size={14} /> {isEdit ? "Alterações salvas!" : "Cartão adicionado!"}</>
            : (isEdit ? "Salvar alterações" : "Adicionar cartão")}
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 400, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(15,23,35,0.5)" }} />
        <div style={{ position: "relative", background: T.surface, borderRadius: "24px 24px 0 0", maxHeight: "95dvh", display: "flex", flexDirection: "column", animation: "sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: T.inkGhost }} />
          </div>
          {inner}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(15,23,35,0.38)" }} />
      <div style={{ position: "relative", width: 460, maxHeight: "88dvh", background: T.surface, borderRadius: 18, boxShadow: T.dark, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {inner}
      </div>
    </div>
  );
}
