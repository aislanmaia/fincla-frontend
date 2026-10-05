import { useEffect, useRef } from "react";

import { T } from "../../tokens";
import { InvoiceCard } from "./InvoiceCard.jsx";

const CARD_WIDTH_DESKTOP = 320;
const CARD_WIDTH_MOBILE = 300;
const GAP = 12;
const MAX_DOTS = 7;
/** Teto de segurança para a rolagem programática terminar mesmo sem `scrollend` (Safari antigo). */
const PROGRAMMATIC_SCROLL_MAX_MS = 900;

/** Janela de pontos ao redor da fatura selecionada (29 faturas não cabem em 390px). */
export function dotWindow(total, activeIndex, max = MAX_DOTS) {
  if (total <= max) return { start: 0, end: total };
  const half = Math.floor(max / 2);
  const start = Math.min(Math.max(0, activeIndex - half), total - max);
  return { start, end: start + max };
}

/**
 * Carrossel cronológico de faturas (passadas à esquerda, futuras à direita), com a
 * selecionada centralizada. Rolagem nativa com scroll-snap e barra oculta; no
 * mobile a fatura mais próxima do centro passa a ser a selecionada ao soltar o dedo.
 * `renderItem({ invoice, selected, width })` troca o card padrão (o dashboard da fatura
 * usa o card de detalhe completo); o item devolvido precisa de `key` e ocupar `width`.
 */
export function InvoiceCarousel({ invoices, cardId, currency, selectedKey, onSelect, onNavigate, isMobile, now, renderItem = null, itemWidth = null }) {
  const scrollerRef = useRef(null);
  const settleTimer = useRef(null);
  const programmatic = useRef(false);
  const programmaticTimer = useRef(null);
  const width = itemWidth ?? (isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH_DESKTOP);
  const selectedIndex = Math.max(0, invoices.findIndex((i) => i.key === selectedKey));

  useEffect(() => {
    const scroller = scrollerRef.current;
    const target = scroller?.children?.[selectedIndex];
    if (!scroller || !target || typeof scroller.scrollTo !== "function") return;
    const left = target.offsetLeft - (scroller.clientWidth - target.clientWidth) / 2;
    programmatic.current = true;
    clearTimeout(programmaticTimer.current);
    clearTimeout(settleTimer.current);
    programmaticTimer.current = setTimeout(() => { programmatic.current = false; }, PROGRAMMATIC_SCROLL_MAX_MS);
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [selectedKey, selectedIndex, invoices.length, width]);

  useEffect(() => () => {
    clearTimeout(settleTimer.current);
    clearTimeout(programmaticTimer.current);
  }, []);

  /* Rolagem que a gente mesmo pediu não é intenção do usuário: enquanto dura, o
     "mais próximo do centro" não pode reescolher o card antigo no meio da animação. */
  const endProgrammatic = () => {
    programmatic.current = false;
    clearTimeout(programmaticTimer.current);
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    scroller?.addEventListener("scrollend", endProgrammatic);
    return () => scroller?.removeEventListener("scrollend", endProgrammatic);
  }, []);

  const handleScroll = () => {
    if (!isMobile || programmatic.current) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const center = scroller.scrollLeft + scroller.clientWidth / 2;
      let best = -1;
      let bestDist = Infinity;
      Array.from(scroller.children).forEach((child, i) => {
        const dist = Math.abs(child.offsetLeft + child.clientWidth / 2 - center);
        if (dist < bestDist) { best = i; bestDist = dist; }
      });
      if (best >= 0 && invoices[best] && invoices[best].key !== selectedKey) onSelect(invoices[best].key);
    }, 140);
  };

  const dots = dotWindow(invoices.length, selectedIndex);

  return (
    <div style={{ position: "relative", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
      <div
        ref={scrollerRef}
        className="hub-carousel"
        data-testid="invoice-carousel"
        onScroll={handleScroll}
        onTouchStart={endProgrammatic}
        onWheel={endProgrammatic}
        style={{
          display: "flex", gap: GAP, overflowX: "auto", scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          padding: `6px calc(50% - ${width / 2}px) 8px`,
        }}>
        {invoices.map((invoice) => (renderItem
          ? renderItem({ invoice, selected: invoice.key === selectedKey, width })
          : (
            <InvoiceCard key={invoice.key} invoice={invoice} cardId={cardId} currency={currency}
              selected={invoice.key === selectedKey} width={width}
              onSelect={onSelect} onNavigate={onNavigate} now={now} />
          )))}
      </div>
      {isMobile && invoices.length > 1 && (
        <div data-testid="invoice-dots" style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 6 }}>
          {invoices.slice(dots.start, dots.end).map((invoice, i) => {
            const active = dots.start + i === selectedIndex;
            return (
              <span key={invoice.key} data-active={active ? "true" : "false"}
                style={{ width: active ? 16 : 6, height: 6, borderRadius: 3, background: active ? T.ink : T.border, transition: "width 0.2s" }} />
            );
          })}
        </div>
      )}
    </div>
  );
}
