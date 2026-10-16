import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { T } from "../../tokens.js";
import { G } from "../../typography.js";
import { DisclosureChevron } from "../../components/DisclosureChevron.jsx";

// Durações das animações de saída: o desmonte (EXIT_MS) espera a animação (SLIDE_MS) terminar.
const SLIDE_MS = 380;
const EXIT_MS = 420;
const SHEET_TRANSITION = `height ${SLIDE_MS}ms cubic-bezier(0.32,0.72,0,1), border-radius 0.2s ease`;

/**
 * Sheet de filtros do celular, no desenho da tela de Transações: abre em tela cheia, alça com chevron que
 * reduz a 72% ao arrastar para baixo e dispensa no arrasto seguinte, cabeçalho com "Limpar tudo" só quando há
 * filtro, rodapé com o CTA "Ver N …" e animação de entrada/saída.
 *
 * `onClose` roda depois da animação de saída. `requestCloseRef` recebe a função que fecha COM a animação, para quem
 * fecha por outro caminho (Escape): chamar `onClose` direto desmontaria o sheet sem saída.
 */
export function MobileFilterSheet({ dialogRef, closeRef, requestCloseRef, ariaLabel, title, onClose, onClear, footer, footerLoading = false, children }) {
  const sheetRef = useRef(null);
  const fullRef = useRef(true);
  const closingRef = useRef(false);
  const timerRef = useRef(null);
  const [full, setFull] = useState(true);
  const [closing, setClosing] = useState(null); // null | "animated" | "dragged"
  const cleanupRef = useRef(null);
  useEffect(() => () => { clearTimeout(timerRef.current); cleanupRef.current?.(); }, []);

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing("animated");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onClose, EXIT_MS);
  };
  // Publicada em efeito (não no render) e solta ao desmontar: o Escape da página nunca chama um sheet que já saiu.
  useEffect(() => {
    if (!requestCloseRef) return undefined;
    requestCloseRef.current = requestClose;
    return () => { requestCloseRef.current = null; };
  });
  const setSnap = (value) => { fullRef.current = value; setFull(value); };

  const onHandleTouchStart = (event) => {
    const el = sheetRef.current;
    if (!el || closingRef.current) return;
    cleanupRef.current?.();
    const startY = event.touches[0].clientY;
    const startedAt = Date.now();
    let lastDelta = 0;
    const settle = (transform, transition) => {
      el.style.transition = transition;
      el.style.transform = transform;
      setTimeout(() => { el.style.transition = SHEET_TRANSITION; }, SLIDE_MS);
    };
    const cleanup = () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
      cleanupRef.current = null;
    };
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
      cleanup();
      if (!fullRef.current && (velocity > 0.45 || lastDelta > (el.offsetHeight || 400) * 0.3)) {
        // Dispensar pelo arrasto: o sheet desce pelo transform e só o fundo usa a animação de saída.
        closingRef.current = true;
        setClosing("dragged");
        settle("translateY(105%)", `transform ${SLIDE_MS}ms cubic-bezier(0.32,0.72,0,1)`);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(onClose, SLIDE_MS);
      } else settle("translateY(0)", `transform 0.4s cubic-bezier(0.32,0.72,0,1), ${SHEET_TRANSITION}`);
    };
    // Gesto cancelado pelo sistema (ligação, borda): volta ao lugar, nunca dispensa.
    const onCancel = () => { cleanup(); settle("translateY(0)", `transform 0.4s cubic-bezier(0.32,0.72,0,1), ${SHEET_TRANSITION}`); };
    cleanupRef.current = cleanup;
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onCancel);
  };

  return <div style={{ position: "fixed", inset: 0, zIndex: 49, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
    <div aria-hidden="true" onClick={requestClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", animation: closing ? `backdropOut ${SLIDE_MS}ms ease-in both` : "backdropIn 0.22s ease-out both" }} />
    <div ref={(node) => { sheetRef.current = node; if (dialogRef) dialogRef.current = node; }} role="dialog" aria-modal="true" aria-label={ariaLabel}
      style={{ position: "relative", background: T.surface, display: "flex", flexDirection: "column", willChange: "transform",
        borderRadius: full ? 0 : "24px 24px 0 0", height: full ? "100dvh" : "72dvh", maxHeight: "100dvh",
        paddingTop: full ? "env(safe-area-inset-top, 0px)" : 0, transition: SHEET_TRANSITION,
        // A entrada preenche só para trás: um `forwards` seguraria o transform e o arrasto não moveria o sheet.
        animation: closing === "animated" ? `sheetDown ${SLIDE_MS}ms cubic-bezier(0.32,0.72,0,1) both` : closing ? "none" : "sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) backwards",
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
