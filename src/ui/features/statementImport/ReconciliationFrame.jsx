// A moldura comum das conciliações (extrato da conta, fincla-api#507; fatura do cartão, #554): o topo
// fixo, o trilho dos passos e o aviso de passo vazio. Cada fluxo traz os seus passos e estados.
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Card } from "../../components/primitives";

/** As cores do estado de um passo no trilho. */
export const STEP_TONE = {
  warn: { dot: T.amber, text: T.amber },
  ready: { dot: T.blue, text: T.blue },
  done: { dot: T.green, text: T.green },
  neutral: { dot: T.inkFaint, text: T.inkLight },
};

/** A largura da coluna dos passos no computador (o aviso do rodapé alinha à lista ao lado dela). */
export const RAIL_WIDTH = 240;

/**
 * O trilho dos passos. `statusOf(key)` → `{tone, text}`. `currentText`: o texto do passo aberto
 * quando ele não pede nada nem está conferido (a fatura diz "Você está aqui"). `separatorBefore`:
 * os passos que abrem um grupo novo (o traço antes de "Conferir o total" na fatura).
 */
export function StepRail({ steps, statusOf, current, onOpen, label = "Passos da conciliação", currentText = null, separatorBefore = null }) {
  return (
    <nav aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {steps.map((step, index) => {
        const status = statusOf(step.key);
        const tone = STEP_TONE[status.tone];
        const active = step.key === current;
        const text = active && currentText && status.tone !== "warn" && status.tone !== "done" ? currentText : status.text;
        return (
          <div key={step.key} style={{ display: "contents" }}>
            {separatorBefore?.has(step.key) ? <div aria-hidden="true" style={{ height: 1, background: T.border, margin: "4px 10px" }} /> : null}
            <button
              type="button"
              aria-current={active ? "step" : undefined}
              onClick={() => onOpen(step.key)}
              style={{
                ...G, textAlign: "left", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start",
                background: active ? T.surface : "transparent", border: `1px solid ${active ? T.border : "transparent"}`,
                boxShadow: active ? T.sm : "none", borderRadius: 10, padding: "8px 10px",
              }}
            >
              <span aria-hidden="true" style={{ ...NUM, flexShrink: 0, width: 20, height: 20, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", background: tone.dot, marginTop: 1 }}>
                {status.tone === "done" ? <Check size={11} /> : index + 1}
              </span>
              <span style={{ minWidth: 0 }}>
                <span data-testid="step-title" style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.ink }}>{step.title}</span>
                <span style={{ display: "block", fontSize: 11, color: tone.text, marginTop: 2 }}>{text}</span>
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

/** Folga entre o topo fixo e o que ganha foco ao rolar (o cartão atual, "Alterar"…). */
const STICKY_FOCUS_GAP = 12;

/**
 * O que o topo fixo cobre no alto da área que rola: a altura dele em `data-sticky-cover` (onde a
 * área visível começa de fato, lida pela âncora da lista) e, com a folga, no `scroll-padding-top`
 * (onde o foco que a página move para).
 */
function reserveStickyTop(scroller, height) {
  scroller.dataset.stickyCover = String(height);
  scroller.style.scrollPaddingTop = `${height + STICKY_FOCUS_GAP}px`;
}

/**
 * O topo fixo da conciliação: gruda no alto da área que rola, com fundo próprio para o que passa
 * por baixo não aparecer. `top: 0` grudaria ABAIXO do padding do alto da área que rola (20px no
 * computador, 14px no celular) e deixaria ali uma faixa onde o conteúdo aparece cortado (BUG-01 da
 * QA da etapa 3): o `top` negativo desse padding faz o topo encostar no alto da área que rola. Fica como filho direto da página, então vale para todos os
 * passos. Enquanto existe, reserva a altura dele no `scroll-padding-top` da área que rola: o foco
 * que a página move (cartão atual, "Alterar") nunca fica escondido atrás dele. Ao sair, devolve.
 */
export function StickyTop({ children, style = null }) {
  const ref = useRef(null);
  const scrollerRef = useRef(null);
  const [top, setTop] = useState(0);
  useEffect(() => {
    const scroller = ref.current?.closest("[data-fincla-main-scroll]");
    if (!scroller) return undefined;
    scrollerRef.current = scroller;
    const paddingTop = Number.parseFloat(window.getComputedStyle(scroller).paddingTop) || 0;
    setTop(paddingTop ? -paddingTop : 0);
    const previous = scroller.style.scrollPaddingTop;
    const reserve = () => reserveStickyTop(scroller, ref.current?.offsetHeight ?? 0);
    reserve();
    window.addEventListener("resize", reserve);
    return () => {
      window.removeEventListener("resize", reserve);
      scroller.style.scrollPaddingTop = previous;
      delete scroller.dataset.stickyCover;
      scrollerRef.current = null;
    };
  }, []);
  // A altura muda com o conteúdo (o valor, a quebra de linha): a reserva acompanha a cada render.
  useEffect(() => {
    if (scrollerRef.current && ref.current) reserveStickyTop(scrollerRef.current, ref.current.offsetHeight);
  });
  return (
    <div
      ref={ref}
      data-sticky="balance-now"
      style={{ position: "sticky", top, zIndex: 5, background: T.bg, padding: "8px 0", margin: "-8px 0", ...style }}
    >
      {children}
    </div>
  );
}

/** Um passo sem nada a fazer. */
export function EmptyStep({ children }) {
  return (
    <Card style={{ padding: 16 }}>
      <p style={{ ...G, fontSize: 13, color: T.inkMid, margin: 0 }}>{children}</p>
    </Card>
  );
}
