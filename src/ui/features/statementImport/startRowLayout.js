// A linha da tela inicial da conta: a área de soltar e "Extratos importados" lado a lado, quebrando
// em duas linhas quando não cabem (computador estreito, ~768–1030px com a barra lateral).
import { useLayoutEffect, useState } from "react";

/** Base da área de soltar (px). */
export const UPLOAD_BASIS = 460;
/** Base da coluna "Extratos importados" (px). */
export const LIST_BASIS = 300;
/** Espaço entre as duas. */
export const ROW_GAP = 16;

/**
 * A linha quebra quando as duas bases não cabem lado a lado. Largura 0 = ainda não medida (ou sem
 * layout, como no jsdom): conta como "cabe".
 */
export function startRowWraps(width) {
  return width > 0 && width < UPLOAD_BASIS + ROW_GAP + LIST_BASIS;
}

/** Se a linha (o elemento em `ref`) quebrou; acompanha mudanças de largura. */
export function useStartRowWraps(ref) {
  const [wraps, setWraps] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWraps(startRowWraps(el.clientWidth));
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [ref]);
  return wraps;
}
