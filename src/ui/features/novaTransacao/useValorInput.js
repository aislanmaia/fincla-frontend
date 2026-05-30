import { useCallback, useEffect, useRef, useState } from "react";

const MAX_CENTS = 9999999;

function formatBrlFromCents(cents) {
  return cents === 0
    ? ""
    : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

function inputHasSelection(el) {
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
 *  1. `handleAmountKey` — onKeyDown direto no <input>; faz digit-shift e
 *     trata Backspace/Delete com seleção.
 *  2. Listener global no document — quando o usuário digita dígitos com
 *     foco fora de qualquer input, foca o Valor e processa a tecla.
 *
 * `onCancelInstallmentCalc` é chamado sempre que o usuário digita dígitos — o
 * caller é responsável por no-op-ar quando o modo não estiver ativo
 * (setInstallmentCalcOpen(false) é idempotente).
 */
export function useAmountInput({
  open,
  descFocused,
  onCancelInstallmentCalc,
}) {
  const [cents, setCents] = useState(0);
  const [amount, setAmount] = useState("");
  const amountInputRef = useRef(null);

  const setAmountCents = useCallback((next) => {
    const clamped = Math.max(0, Math.min(Number(next) || 0, MAX_CENTS));
    setCents(clamped);
    setAmount(formatBrlFromCents(clamped));
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
      const nextCents = Math.round(Number(decimal) * 100);
      if (Number.isFinite(nextCents)) setAmountCents(nextCents);
      else setAmountCents(0);
    },
    [setAmountCents],
  );

  const handleAmountKey = useCallback(
    (e) => {
      const el = e.currentTarget;
      const replacing = inputHasSelection(el);

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        e.stopPropagation();
        const base = replacing ? 0 : cents;
        const next = Math.min(base * 10 + parseInt(e.key, 10), MAX_CENTS);
        setAmountCents(next);
        onCancelInstallmentCalc?.();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Delete" || replacing) {
          setAmountCents(0);
        } else {
          setAmountCents(Math.floor(cents / 10));
        }
      }
    },
    [cents, onCancelInstallmentCalc, setAmountCents],
  );

  // Captura global: qualquer dígito digitado fora de input/textarea/select foca o campo.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (document.activeElement === amountInputRef.current) return;
      const tag = document.activeElement?.tagName;
      const isOtherInput =
        (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") &&
        document.activeElement !== amountInputRef.current;
      if (isOtherInput || descFocused) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") {
        amountInputRef.current?.focus();
        e.preventDefault();
        const next = Math.min(cents * 10 + parseInt(e.key, 10), MAX_CENTS);
        setAmountCents(next);
        onCancelInstallmentCalc?.();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (document.activeElement === amountInputRef.current) return;
        amountInputRef.current?.focus();
        e.preventDefault();
        if (e.key === "Delete") setAmountCents(0);
        else setAmountCents(Math.floor(cents / 10));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, cents, descFocused, onCancelInstallmentCalc, setAmountCents]);

  const amountNum = cents / 100;

  return {
    amount,
    cents,
    amountNum,
    amountInputRef,
    handleAmountKey,
    setAmountCents,
    setAmountFromDecimal,
    resetAmount,
  };
}
