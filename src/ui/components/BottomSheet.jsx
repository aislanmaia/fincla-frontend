import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { T } from "../tokens";
import { G } from "../typography";

const SHEET_SLIDE_MS = 380;
const SHEET_EASE = "cubic-bezier(0.32,0.72,0,1)";

/**
 * Sheet de baixo do celular, PORTALIZADO no `body`: dentro do card ele herdaria o
 * `transform` da animação de entrada da grade (que vira o bloco de contenção de
 * `position: fixed`) e ficaria preso ao card, por baixo dos KPIs.
 *
 * Fecha por arrasto, fundo, Esc ou ✕. A saída anima e o desmontar vem por TIMER —
 * nunca por `onAnimationEnd`, que não é garantido e deixaria a camada presa.
 */
export function BottomSheet({
  title, ariaLabel = title, closeLabel = "Fechar", testIdPrefix = "bottom-sheet", footer = null, onClose, children,
  /** `false` = nada fecha (Esc, ✕, fundo, arrasto) — ex.: enquanto um lote está em voo. */
  dismissible = true,
  /** `false` = o toque no FUNDO não fecha (ex.: há valores editados); ✕/Esc seguem fechando. */
  backdropDismissible = true,
}) {
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;
  const [closing, setClosing] = useState(null); // null | "animated" | "dragged"
  const closingRef = useRef(false);
  const timerRef = useRef(null);
  const sheetRef = useRef(null);
  const listenersCleanupRef = useRef(null);
  const finishAfter = useCallback((ms) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(onClose, ms);
  }, [onClose]);
  const requestClose = useCallback(() => {
    if (closingRef.current || !dismissibleRef.current) return;
    closingRef.current = true;
    setClosing("animated");
    finishAfter(SHEET_SLIDE_MS);
  }, [finishAfter]);
  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    listenersCleanupRef.current?.();
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  const onHandleTouchStart = (event) => {
    const el = sheetRef.current;
    if (!el || closingRef.current) return;
    listenersCleanupRef.current?.();
    const startY = event.touches[0].clientY;
    let delta = 0;
    el.style.transition = "none";
    const cleanup = () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
      listenersCleanupRef.current = null;
    };
    const snapBack = () => {
      el.style.transition = `transform 0.3s ${SHEET_EASE}`;
      el.style.transform = "translateY(0)";
    };
    function onMove(move) {
      delta = Math.max(0, move.touches[0].clientY - startY);
      el.style.transform = `translateY(${delta}px)`;
    }
    function onEnd() {
      cleanup();
      if (delta > 80 && dismissibleRef.current) {
        // Fecha A PARTIR de onde o dedo soltou: transição no próprio elemento, sem a
        // animação CSS `sheetDown` (que recomeçaria em 0 e daria um salto para cima).
        closingRef.current = true;
        setClosing("dragged");
        el.style.transition = `transform ${SHEET_SLIDE_MS}ms ${SHEET_EASE}`;
        el.style.transform = "translateY(105%)";
        finishAfter(SHEET_SLIDE_MS);
      } else snapBack();
    }
    // O sistema tomou o gesto (chamada, rolagem nativa): volta ao lugar, não fecha.
    function onCancel() {
      cleanup();
      snapBack();
    }
    listenersCleanupRef.current = cleanup;
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onCancel);
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div data-testid={`${testIdPrefix}-backdrop`} aria-hidden="true" onClick={() => { if (backdropDismissible) requestClose(); }}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", animation: closing ? `backdropOut ${SHEET_SLIDE_MS}ms ease-in both` : "backdropIn 0.22s ease-out both" }} />
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={ariaLabel} data-closing={closing ?? ""}
        style={{ position: "relative", background: T.surface, borderRadius: "24px 24px 0 0", maxHeight: "85dvh", display: "flex", flexDirection: "column",
          animation: closing === "animated" ? `sheetDown ${SHEET_SLIDE_MS}ms ${SHEET_EASE} both` : closing ? "none" : `sheetUp 0.5s ${SHEET_EASE} backwards`,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.14)" }}>
        <div data-testid={`${testIdPrefix}-handle`} onTouchStart={onHandleTouchStart} aria-hidden="true"
          style={{ padding: "12px 0 6px", display: "flex", justifyContent: "center", touchAction: "none", cursor: "grab" }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(0,0,0,0.18)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 18px 10px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink }}>{title}</div>
          <button type="button" aria-label={closeLabel} onClick={requestClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex" }}>
            <X size={18} color={T.inkMid} />
          </button>
        </div>
        <div className="fincla-scroll" style={{ overflowY: "auto", minHeight: 0, flex: 1, padding: "8px 18px", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))", overscrollBehavior: "contain" }}>
          {children}
        </div>
        {footer ? (
          <div style={{ padding: "12px 18px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${T.border}`, background: T.surface, flex: "none" }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
