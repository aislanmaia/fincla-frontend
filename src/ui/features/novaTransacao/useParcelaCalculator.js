import { useCallback, useState } from "react";

/**
 * Estado e ações da calculadora "÷ por parcela" do drawer Nova Transação,
 * além do input "outro" (N customizado) ao lado dos presets.
 *
 * O `applyInstallmentCalc` chama `onApply({ totalCents, installmentCount })`
 * no parent para integrar com `cents`/`amount`/`method`/`modality`/
 * `installments`/painel de cartão; o reset interno (`calcOpen = false`,
 * `calcCents = 0`) acontece em seguida.
 */
export function useInstallmentCalculator({ onApply }) {
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcCents, setCalcCents] = useState(0);
  const [calcCount, setCalcCount] = useState(2);
  // Custom N inside the calculator panel
  const [calcCustom, setCalcCustom] = useState(false);
  const [calcCustomInput, setCalcCustomInput] = useState("");
  // Custom N next to the installment presets (panel)
  const [installmentsCustom, setInstallmentsCustom] = useState(false);
  const [installmentsInput, setInstallmentsInput] = useState("");

  const handleCalcKey = useCallback((e) => {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      setCalcCents((prev) => Math.min(prev * 10 + parseInt(e.key, 10), 9999999));
    } else if (e.key === "Backspace") {
      e.preventDefault();
      setCalcCents((prev) => Math.floor(prev / 10));
    } else if (e.key === "Delete") {
      e.preventDefault();
      setCalcCents(0);
    }
  }, []);

  const applyInstallmentCalc = useCallback(() => {
    const totalCents = calcCents * calcCount;
    onApply?.({ totalCents, installmentCount: calcCount });
    setCalcOpen(false);
    setCalcCents(0);
  }, [calcCents, calcCount, onApply]);

  const resetAll = useCallback(() => {
    setCalcOpen(false);
    setCalcCents(0);
    setCalcCount(2);
    setCalcCustom(false);
    setCalcCustomInput("");
    setInstallmentsCustom(false);
    setInstallmentsInput("");
  }, []);

  return {
    calcOpen,
    setCalcOpen,
    calcCents,
    setCalcCents,
    calcCount,
    setCalcCount,
    calcCustom,
    setCalcCustom,
    calcCustomInput,
    setCalcCustomInput,
    installmentsCustom,
    setInstallmentsCustom,
    installmentsInput,
    setInstallmentsInput,
    handleCalcKey,
    applyInstallmentCalc,
    resetAll,
  };
}
