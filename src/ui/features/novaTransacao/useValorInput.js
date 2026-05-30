import { useCallback, useEffect, useRef, useState } from "react";

const MAX_CENTS = 9999999;

function formatBrlFromCents(cents) {
  return cents === 0
    ? ""
    : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

function valorFieldHasSelection(el) {
  return (
    el &&
    typeof el.selectionStart === "number" &&
    typeof el.selectionEnd === "number" &&
    el.selectionStart !== el.selectionEnd
  );
}

/**
 * Input "banking-style" do campo Valor do drawer Nova Transação.
 * Mantém duas formas do mesmo número (inteiro em centavos + string formatada
 * em pt-BR) e dois caminhos de digitação:
 *
 *  1. `handleValorKey` — onKeyDown direto no <input>; faz digit-shift e
 *     trata Backspace/Delete com seleção.
 *  2. Listener global no document — quando o usuário digita dígitos com
 *     foco fora de qualquer input, foca o Valor e processa a tecla.
 *
 * `onClearParcelaMode` é chamado sempre que o usuário digita dígitos — o
 * caller é responsável por no-op-ar quando o modo não estiver ativo
 * (setParcelaMode(false) é idempotente).
 */
export function useValorInput({
  open,
  descFocused,
  onClearParcelaMode,
}) {
  const [centavos, setCentavos] = useState(0);
  const [valor, setValor] = useState("");
  const valorInputRef = useRef(null);

  const setAmountCents = useCallback((next) => {
    const clamped = Math.max(0, Math.min(Number(next) || 0, MAX_CENTS));
    setCentavos(clamped);
    setValor(formatBrlFromCents(clamped));
  }, []);

  const resetAmount = useCallback(() => {
    setAmountCents(0);
  }, [setAmountCents]);

  const setAmountFromDecimal = useCallback(
    (decimal) => {
      if (decimal == null || decimal === "") {
        setAmountCents(0);
        return;
      }
      const cents = Math.round(Number(decimal) * 100);
      if (Number.isFinite(cents)) setAmountCents(cents);
      else setAmountCents(0);
    },
    [setAmountCents],
  );

  const handleValorKey = useCallback(
    (e) => {
      const el = e.currentTarget;
      const replacing = valorFieldHasSelection(el);

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        e.stopPropagation();
        const base = replacing ? 0 : centavos;
        const next = Math.min(base * 10 + parseInt(e.key, 10), MAX_CENTS);
        setAmountCents(next);
        onClearParcelaMode?.();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Delete" || replacing) {
          setAmountCents(0);
        } else {
          setAmountCents(Math.floor(centavos / 10));
        }
      }
    },
    [centavos, onClearParcelaMode, setAmountCents],
  );

  // Captura global: qualquer dígito digitado fora de input/textarea/select foca o campo.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (document.activeElement === valorInputRef.current) return;
      const tag = document.activeElement?.tagName;
      const isOtherInput =
        (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") &&
        document.activeElement !== valorInputRef.current;
      if (isOtherInput || descFocused) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") {
        valorInputRef.current?.focus();
        e.preventDefault();
        const next = Math.min(centavos * 10 + parseInt(e.key, 10), MAX_CENTS);
        setAmountCents(next);
        onClearParcelaMode?.();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (document.activeElement === valorInputRef.current) return;
        valorInputRef.current?.focus();
        e.preventDefault();
        if (e.key === "Delete") setAmountCents(0);
        else setAmountCents(Math.floor(centavos / 10));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, centavos, descFocused, onClearParcelaMode, setAmountCents]);

  const valorNum = centavos / 100;

  return {
    valor,
    centavos,
    valorNum,
    valorInputRef,
    handleValorKey,
    setAmountCents,
    setAmountFromDecimal,
    resetAmount,
  };
}
