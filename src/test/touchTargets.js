// Alvos de toque no celular (QA F2, BUG-01): todo controle dos fluxos de conciliação tem ≥44 px de
// altura. O jsdom não mede layout, então a altura conferida é a declarada no estilo do elemento
// (`min-height` ou `height`), que é como os componentes aplicam o `TOUCH_TARGET`.
import { TOUCH_TARGET } from "../ui/tokens";

const CONTROLS = "button, a[href], [role='button'], select, input:not([type='hidden']):not([type='file'])";

function declaredHeight(target) {
  // A caixa de marcar fica do tamanho dela: o alvo de toque é o rótulo em volta (`CheckTarget`).
  const el = target.matches("input[type='checkbox'], input[type='radio']") ? target.closest("label") : target;
  if (!el) return 0;
  const values = [el.style.minHeight, el.style.height].map((v) => Number.parseFloat(v)).filter((v) => !Number.isNaN(v));
  return values.length ? Math.max(...values) : 0;
}

function nameOf(el) {
  return (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.tagName).replace(/\s+/g, " ").trim();
}

/** Os controles visíveis em `root` com altura declarada abaixo do alvo de toque ("nome (altura)"). */
export function smallTouchTargets(root) {
  return [...root.querySelectorAll(CONTROLS)]
    .filter((el) => !el.closest("[hidden], [aria-hidden='true']"))
    .filter((el) => declaredHeight(el) < TOUCH_TARGET)
    .map((el) => `${nameOf(el)} (${declaredHeight(el)})`);
}
