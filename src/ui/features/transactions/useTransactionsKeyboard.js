import { useCallback, useEffect, useRef } from "react";

/**
 * Os atalhos da tela de Transações, e o `roving tabindex` da lista.
 *
 * Duas regras que decidem tudo aqui:
 *
 * **Letra solta só vale com o foco fora de campo de texto.** É o erro clássico
 * que faz a pessoa "não conseguir digitar F" na busca. A guarda é por tipo de
 * elemento (input, textarea, select, contenteditable), não por id — qualquer
 * campo novo na tela já nasce protegido.
 *
 * **A lista é UM ponto de parada no Tab.** Com `tabIndex=0` em toda linha, 20
 * linhas × 4 ações rápidas viram 100 paradas entre a busca e o rodapé; ↑↓ é o
 * que anda entre elas, como em qualquer grade.
 */

const CAMPOS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function focoEmCampoDeTexto(alvo) {
  if (!alvo) return false;
  if (CAMPOS.has(alvo.tagName)) return true;
  return Boolean(alvo.isContentEditable);
}

/** As linhas visíveis, na ordem em que estão na tela. */
function linhas(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll("[data-tx-row]"));
}

export function useTransactionsKeyboard({
  containerRef,
  enabled = true,
  onFocusSearch,
  onToggleFilters,
  onHelp,
  onSettle,
  onEdit,
  onDuplicate,
  onDelete,
  getTransaction,
  /* Sem isto o `roving tabindex` não rove: as setas moviam o FOCO mas a parada
     de Tab continuava na primeira linha, então sair e voltar com Tab jogava a
     pessoa de volta ao topo da lista. */
  onRovingChange,
}) {
  const focoRef = useRef(null);

  /** Move o foco N linhas, rolando o suficiente para a linha ficar à vista. */
  const mover = useCallback(
    (delta) => {
      const lista = linhas(containerRef.current);
      if (lista.length === 0) return;
      const atual = lista.findIndex((el) => el === document.activeElement);
      const proximo = atual < 0 ? 0 : Math.min(lista.length - 1, Math.max(0, atual + delta));
      const el = lista[proximo];
      if (!el) return;
      focoRef.current = el.dataset.txRow;
      onRovingChange?.(el.dataset.txRow);
      el.focus();
      /* `block: "nearest"` e não `center`: centralizar salta a lista inteira a
         cada seta, e quem está andando de uma linha para a vizinha perde a
         referência do que acabou de ver. */
      el.scrollIntoView({ block: "nearest" });
    },
    [containerRef, onRovingChange],
  );

  useEffect(() => {
    if (!enabled) return undefined;

    const onKey = (e) => {
      if (e.defaultPrevented) return;
      const emCampo = focoEmCampoDeTexto(e.target);

      /* A guarda de modificadores vem ANTES de tudo: `Ctrl+/`, `Cmd+/` e
         `Cmd+?` são acordes do navegador e do sistema, e interceptá-los
         roubaria atalhos que não são nossos. */
      if (emCampo || e.metaKey || e.ctrlKey || e.altKey) return;

      // "?" (Shift+/) abre a ajuda. É a convenção de GitHub, Linear, Gmail e
      // Slack — quem já tem o hábito acha sem procurar.
      if (e.key === "?") {
        e.preventDefault();
        onHelp?.();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }

      if (e.key === "ArrowDown") { e.preventDefault(); mover(1); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); return; }

      const k = e.key.toLowerCase();
      if (k === "f") { e.preventDefault(); onToggleFilters?.(); return; }

      /* As ações precisam de uma LINHA em foco. Sem ela, "excluir" não teria
         alvo — e adivinhar o alvo numa tecla destrutiva é o pior chute
         possível. */
      const linha = document.activeElement?.closest?.("[data-tx-row]");
      const id = linha?.dataset?.txRow;
      if (!id) return;
      const tx = getTransaction?.(id);
      if (!tx) return;

      if (k === "p") { e.preventDefault(); onSettle?.(tx); return; }
      if (k === "e") { e.preventDefault(); onEdit?.(tx); return; }
      if (k === "d") { e.preventDefault(); onDuplicate?.(tx); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onDelete?.(tx); }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, mover, onFocusSearch, onToggleFilters, onHelp, onSettle, onEdit, onDuplicate, onDelete, getTransaction]);

  return { focoRef };
}
