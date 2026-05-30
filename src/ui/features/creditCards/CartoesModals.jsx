import { Check, Download, X } from "lucide-react";

import { T } from "../../tokens";
import { G } from "../../typography";
import { CAT_COLORS_CARD } from "../../data/creditCardsMockData.js";

function ModalWrap({ isMobile, onBackdrop, width = 400, maxVh = "80vh", children }) {
  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 400, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div onClick={onBackdrop} style={{ position: "absolute", inset: 0, background: "rgba(15,23,35,0.5)" }} />
        <div style={{ position: "relative", background: T.surface, borderRadius: "24px 24px 0 0", maxHeight: `calc(${maxVh} + 6vh)`, display: "flex", flexDirection: "column", animation: "sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 99, background: T.inkGhost }} />
          </div>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onBackdrop} style={{ position: "absolute", inset: 0, background: "rgba(15,23,35,0.38)" }} />
      <div style={{ position: "relative", width, maxHeight: maxVh, background: T.surface, borderRadius: 18, boxShadow: T.dark, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Modal "Realocar parcela" — escolhe qual fatura futura recebe a próxima
 * cobrança da parcela selecionada.
 */
export function ParcelaModal({
  parcelaModal,
  parcelaTarget,
  setParcelaTarget,
  parcelaOk,
  card,
  fmtBRL,
  isMobile,
  onClose,
  onConfirm,
}) {
  if (!parcelaModal) return null;
  const futuros = card?.planejamento?.length
    ? card.planejamento.map((item) => item.mes).slice(0, 4)
    : ["Abr'26", "Mai'26", "Jun'26", "Jul'26"];
  return (
    <ModalWrap isMobile={isMobile} onBackdrop={onClose}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>Realocar parcela</div>
          <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 2 }}>
            {parcelaModal.desc} · {fmtBRL(parcelaModal.vParcela)}/mês
          </div>
        </div>
        <button onClick={onClose}
          style={{ background: T.grayLight, border: "none", cursor: "pointer", padding: 7, borderRadius: 8, display: "flex" }}>
          <X size={14} color={T.inkMid} />
        </button>
      </div>
      <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
        <p style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.7, marginBottom: 12 }}>
          Mova a <strong>próxima cobrança</strong> para uma fatura futura:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {futuros.map((f) => (
            <button key={f} onClick={() => setParcelaTarget(f)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${parcelaTarget === f ? T.blue : T.border}`, background: parcelaTarget === f ? T.blueLight : T.surface, cursor: "pointer", transition: "all 0.15s" }}>
              <span style={{ ...G, fontSize: 13, fontWeight: 600, color: parcelaTarget === f ? T.blue : T.ink }}>{f}</span>
              {parcelaTarget === f && <Check size={14} color={T.blue} />}
            </button>
          ))}
        </div>
        {parcelaTarget && (
          <div style={{ background: T.blueLight, border: `1px solid ${T.blue}22`, borderRadius: 10, padding: "10px 14px", marginTop: 12 }}>
            <span style={{ ...G, fontSize: 11, color: T.blue, lineHeight: 1.65 }}>
              A parcela de <strong>{fmtBRL(parcelaModal.vParcela)}</strong> será movida para <strong>{parcelaTarget}</strong>.
            </span>
          </div>
        )}
      </div>
      <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <button onClick={onConfirm} disabled={!parcelaTarget}
          style={{ ...G, width: "100%", padding: "12px", borderRadius: 10, border: "none", background: parcelaOk ? T.green : !parcelaTarget ? T.inkGhost : T.blue, color: "#fff", fontSize: 13, fontWeight: 700, cursor: parcelaTarget ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.2s" }}>
          {parcelaOk ? <><Check size={14} /> Realocado!</> : "Confirmar"}
        </button>
      </div>
    </ModalWrap>
  );
}

/**
 * Modal "Exportar fatura" — escolha de tipos/categorias e download CSV.
 */
export function ExportModal({
  open,
  card,
  fatura,
  displayItens,
  expCats,
  setExpCats,
  expParcelas,
  setExpParcelas,
  expRec,
  setExpRec,
  expNormal,
  setExpNormal,
  isMobile,
  onClose,
  onExport,
}) {
  if (!open) return null;
  const allCats = [...new Set(displayItens.map((i) => i.cat))];
  const typeRows = [
    ["expRec", expRec, setExpRec, "Recorrentes", "Assinaturas e cobranças automáticas"],
    ["expParcelas", expParcelas, setExpParcelas, "Parcelados", "Compras divididas"],
    ["expNormal", expNormal, setExpNormal, "Avulsos", "Compras únicas"],
  ];
  return (
    <ModalWrap isMobile={isMobile} onBackdrop={onClose} width={440} maxVh="85vh">
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>Exportar fatura</div>
          <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 2 }}>{card.nome} · {fatura?.mes}</div>
        </div>
        <button onClick={onClose}
          style={{ background: T.grayLight, border: "none", cursor: "pointer", padding: 7, borderRadius: 8, display: "flex" }}>
          <X size={14} color={T.inkMid} />
        </button>
      </div>
      <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
            Tipos de transação
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {typeRows.map(([key, val, setter, label, sub]) => (
              <div key={key} onClick={() => setter((v) => !v)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${val ? T.ink : T.border}`, background: val ? T.bg : T.surface, cursor: "pointer", transition: "all 0.15s" }}>
                <div>
                  <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink }}>{label}</div>
                  <div style={{ ...G, fontSize: 10, color: T.inkLight }}>{sub}</div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${val ? T.ink : T.border}`, background: val ? T.ink : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {val && <Check size={11} color="#fff" />}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em" }}>Categorias</div>
            <button onClick={() => setExpCats({})}
              style={{ ...G, fontSize: 10, color: T.blue, background: "none", border: "none", cursor: "pointer" }}>
              Todas
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {allCats.map((cat) => {
              const active = !!expCats[cat];
              const color = CAT_COLORS_CARD[cat] || T.inkMid;
              return (
                <button key={cat} onClick={() => setExpCats((m) => ({ ...m, [cat]: !m[cat] }))}
                  style={{ ...G, fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${active ? color : T.border}`, background: active ? color + "18" : T.surface, color: active ? color : T.inkMid, cursor: "pointer", transition: "all 0.15s" }}>
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
            Formato de exportação
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${T.ink}`, background: T.bg }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Check size={12} color="#fff" />
            </div>
            <div>
              <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink }}>CSV</div>
              <div style={{ ...G, fontSize: 10, color: T.inkLight }}>Compatível com Excel, Sheets, etc.</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <button onClick={onExport}
          style={{ ...G, width: "100%", padding: "13px", borderRadius: 10, border: "none", background: T.ink, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Download size={14} /> Exportar CSV
        </button>
      </div>
    </ModalWrap>
  );
}
