import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { T } from "../../tokens.js";
import { G } from "../../typography.js";
import { DisclosureChevron } from "../../components/DisclosureChevron.jsx";

const EXIT_MS = 420;

/**
 * Sheet de filtros do celular, no desenho da tela de Transações: abre em tela cheia, alça com chevron que
 * reduz a 72% ao arrastar para baixo e dispensa no arrasto seguinte, cabeçalho com "Limpar tudo" só quando há
 * filtro, rodapé com o CTA "Ver N …" e animação de entrada/saída.
 *
 * `onClose` roda depois da animação de saída; quem fecha por outro caminho (Escape) desmonta direto.
 */
export function MobileFilterSheet({ dialogRef, closeRef, ariaLabel, title, onClose, onClear, footer, footerLoading = false, children }) {
  const sheetRef = useRef(null);
  const fullRef = useRef(true);
  const closingRef = useRef(false);
  const timerRef = useRef(null);
  const [full, setFull] = useState(true);
  const [closing, setClosing] = useState(false);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timerRef.current = setTimeout(onClose, EXIT_MS);
  };
  const setSnap = (value) => { fullRef.current = value; setFull(value); };

  const onHandleTouchStart = (event) => {
    const el = sheetRef.current;
    if (!el) return;
    const startY = event.touches[0].clientY;
    const startedAt = Date.now();
    let lastDelta = 0;
    const cleanup = () => { document.removeEventListener("touchmove", onMove); document.removeEventListener("touchend", onEnd); };
    const onMove = (move) => {
      const delta = move.touches[0].clientY - startY;
      lastDelta = delta;
      if (delta < 0) {
        if (!fullRef.current && delta < -52) { setSnap(true); el.style.transform = ""; cleanup(); }
        else if (fullRef.current) el.style.transform = `translateY(${delta / 3}px)`;
      } else if (fullRef.current && delta > 64) { setSnap(false); el.style.transform = ""; cleanup(); }
      else el.style.transform = `translateY(${Math.max(0, delta * (fullRef.current ? 0.3 : 1))}px)`;
    };
    const onEnd = () => {
      const velocity = lastDelta / Math.max(Date.now() - startedAt, 1);
      if (!fullRef.current && (velocity > 0.45 || lastDelta > (el.offsetHeight || 400) * 0.3)) {
        el.style.transition = "transform 0.38s cubic-bezier(0.32,0.72,0,1)";
        el.style.transform = "translateY(105%)";
        timerRef.current = setTimeout(() => { el.style.transform = ""; el.style.transition = ""; onClose(); }, 380);
      } else {
        el.style.transition = "transform 0.4s cubic-bezier(0.32,0.72,0,1)";
        el.style.transform = "translateY(0)";
        setTimeout(() => { el.style.transition = ""; }, 400);
      }
      cleanup();
    };
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
  };

  return <div style={{ position: "fixed", inset: 0, zIndex: 49, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
    <div aria-hidden="true" onClick={requestClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", animation: closing ? "backdropOut 0.38s ease-in both" : "backdropIn 0.22s ease-out both" }} />
    <div ref={(node) => { sheetRef.current = node; if (dialogRef) dialogRef.current = node; }} role="dialog" aria-modal="true" aria-label={ariaLabel}
      style={{ position: "relative", background: T.surface, display: "flex", flexDirection: "column", willChange: "transform",
        borderRadius: full ? 0 : "24px 24px 0 0", maxHeight: full ? "100dvh" : "72dvh", height: full ? "100dvh" : undefined,
        paddingTop: full ? "env(safe-area-inset-top, 0px)" : 0,
        transition: "max-height 0.38s cubic-bezier(0.32,0.72,0,1), border-radius 0.2s ease",
        animation: closing ? "sheetDown 0.38s cubic-bezier(0.32,0.72,0,1) both" : "sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both",
        boxShadow: "0 -2px 0 rgba(0,0,0,0.05), 0 -8px 32px rgba(0,0,0,0.14), 0 -24px 80px rgba(0,0,0,0.08)" }}>
      <div onTouchStart={onHandleTouchStart} aria-hidden="true" style={{ padding: "12px 0 8px", flex: "none", cursor: "grab", userSelect: "none", touchAction: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minHeight: 44, boxSizing: "border-box" }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(0,0,0,0.18)" }} />
        <DisclosureChevron open={!full} size={12} style={{ color: "rgba(0,0,0,0.2)" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 20px 10px", borderBottom: `1px solid ${T.border}`, flex: "none" }}>
        <div style={{ ...G, fontSize: 16, fontWeight: 800, color: T.ink }}>{title}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {onClear && <button type="button" onClick={onClear} style={{ ...G, background: T.redLight, border: "none", cursor: "pointer", fontSize: 12, color: T.red, fontWeight: 700, padding: "6px 12px", borderRadius: 8 }}>Limpar tudo</button>}
          <button ref={closeRef} type="button" aria-label="Fechar filtros" onClick={requestClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex" }}><X size={18} color={T.inkMid} /></button>
        </div>
      </div>
      <div className="fincla-scroll" style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "16px 16px 20px", overscrollBehavior: "contain", display: "flex", flexDirection: "column" }}>{children}</div>
      {footer && <div style={{ padding: "12px 20px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${T.border}`, background: T.surface, flex: "none" }}>
        <button type="button" onClick={requestClose} style={{ ...G, width: "100%", background: T.ink, color: T.surface, border: "none", borderRadius: 12, padding: 15, fontSize: 15, fontWeight: 800, cursor: "pointer", opacity: footerLoading ? 0.7 : 1 }}>{footer}</button>
      </div>}
    </div>
  </div>;
}
