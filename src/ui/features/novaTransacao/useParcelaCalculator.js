import { useCallback, useState } from "react";

/**
 * Estado e ações da calculadora "÷ por parcela" do drawer Nova Transação,
 * além do input "outro" (N customizado) ao lado dos presets.
 *
 * O `applyParcelaCalc` chama `onApply({ totalCents, parcelasN })` no parent
 * para integrar com `centavos`/`valor`/`method`/`modalidade`/`parcelas`/painel
 * de cartão; o reset interno (`parcelaMode = false`, `pCalcCents = 0`)
 * acontece em seguida.
 */
export function useParcelaCalculator({ onApply }) {
  const [parcelaMode, setParcelaMode] = useState(false);
  const [pCalcCents, setPCalcCents] = useState(0);
  const [pCalcN, setPCalcN] = useState(2);
  // Custom N inside the calculator panel
  const [pCalcCustom, setPCalcCustom] = useState(false);
  const [pCalcCustomInput, setPCalcCustomInput] = useState("");
  // Custom N next to the parcela presets (panel)
  const [parcelasCustom, setParcelasCustom] = useState(false);
  const [parcelasInput, setParcelasInput] = useState("");

  const handlePCalcKey = useCallback((e) => {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      setPCalcCents((prev) => Math.min(prev * 10 + parseInt(e.key, 10), 9999999));
    } else if (e.key === "Backspace") {
      e.preventDefault();
      setPCalcCents((prev) => Math.floor(prev / 10));
    } else if (e.key === "Delete") {
      e.preventDefault();
      setPCalcCents(0);
    }
  }, []);

  const applyParcelaCalc = useCallback(() => {
    const totalCents = pCalcCents * pCalcN;
    onApply?.({ totalCents, parcelasN: pCalcN });
    setParcelaMode(false);
    setPCalcCents(0);
  }, [pCalcCents, pCalcN, onApply]);

  const resetAll = useCallback(() => {
    setParcelaMode(false);
    setPCalcCents(0);
    setPCalcN(2);
    setPCalcCustom(false);
    setPCalcCustomInput("");
    setParcelasCustom(false);
    setParcelasInput("");
  }, []);

  return {
    parcelaMode,
    setParcelaMode,
    pCalcCents,
    setPCalcCents,
    pCalcN,
    setPCalcN,
    pCalcCustom,
    setPCalcCustom,
    pCalcCustomInput,
    setPCalcCustomInput,
    parcelasCustom,
    setParcelasCustom,
    parcelasInput,
    setParcelasInput,
    handlePCalcKey,
    applyParcelaCalc,
    resetAll,
  };
}
