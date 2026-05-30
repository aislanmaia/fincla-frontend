import { useCallback, useEffect, useRef, useState } from "react";

export const DRAWER_CLOSE_MS = 320;
export const SIDE_PANEL_MS = 320;

/**
 * Animação de saída do drawer Nova Transação (sheet mobile + drawer desktop).
 *
 * `beginClose()` arma `drawerClosing=true`, dispara a animação CSS e chama
 * `onClose()` após `DRAWER_CLOSE_MS`. Um guard ref impede chamadas
 * concorrentes (clique duplo no backdrop / Cancelar) de empilhar timeouts.
 * Quando o pai reabre o drawer (`open` vira `true`), o estado é resetado.
 */
export function useDrawerCloseAnim({ open, onClose }) {
  const [drawerClosing, setDrawerClosing] = useState(false);
  const closeAnimGuardRef = useRef(false);

  const beginClose = useCallback(() => {
    if (closeAnimGuardRef.current) return;
    closeAnimGuardRef.current = true;
    setDrawerClosing(true);
    window.setTimeout(() => {
      closeAnimGuardRef.current = false;
      setDrawerClosing(false);
      onClose();
    }, DRAWER_CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    closeAnimGuardRef.current = false;
    setDrawerClosing(false);
  }, [open]);

  return { drawerClosing, beginClose };
}
