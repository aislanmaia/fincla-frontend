import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Stepper do bottom-sheet mobile do drawer Nova Transação.
 *
 * O fluxo é dinâmico: sempre começa em Valor → Detalhes, ganha
 * "card" quando despesa + crédito, ganha "recurrence" quando o toggle de
 * recorrência está ligado, e termina em "review".
 *
 * Encapsula:
 *   - `mStep` / `setMStep` e `mStepAnimating` (anima slide entre passos)
 *   - timer da animação (cleanup ao fechar o drawer)
 *   - derivados (`mStepsFlow`, `mCurrentIdx`, `mTotalSteps`, `mNextStep`,
 *     `mPrevStep`, `mNextLabel`)
 *   - navegação (`goNext`, `goPrev`) e `resetToFirstStep()` consumido pelo
 *     init effect de `preConfig` e por `handleNewTransaction`.
 */
export function useMobileStepFlow({ open, isMobile, tipo, method, isRecurring }) {
  const [mStep, setMStep] = useState(1);
  const [mStepAnimating, setMStepAnimating] = useState(false);
  const mStepAnimTimerRef = useRef(null);

  useEffect(() => {
    if (open) return;
    if (mStepAnimTimerRef.current) {
      clearTimeout(mStepAnimTimerRef.current);
      mStepAnimTimerRef.current = null;
    }
    setMStepAnimating(false);
  }, [open]);

  const mStepsFlow = useMemo(() => {
    const f = [1, 2];
    if (tipo === "despesa" && method === "credito") f.push("card");
    if (isRecurring) f.push("recurrence");
    f.push("review");
    return f;
  }, [tipo, method, isRecurring]);

  const mCurrentIdx = mStepsFlow.indexOf(mStep);
  const mTotalSteps = mStepsFlow.length;
  const mNextStep = mStepsFlow[mCurrentIdx + 1];
  const mPrevStep = mCurrentIdx > 0 ? mStepsFlow[mCurrentIdx - 1] : null;

  const mNextLabel = useCallback(() => {
    if (mNextStep === "review") return "Revisar →";
    if (mNextStep === "card") return "Cartão →";
    if (mNextStep === "recurrence") return "Recorrência →";
    return "Continuar →";
  }, [mNextStep]);

  const animateMobileStepChange = useCallback(() => {
    if (!isMobile) return;
    setMStepAnimating(true);
    if (mStepAnimTimerRef.current) clearTimeout(mStepAnimTimerRef.current);
    mStepAnimTimerRef.current = window.setTimeout(() => {
      mStepAnimTimerRef.current = null;
      setMStepAnimating(false);
    }, 260);
  }, [isMobile]);

  const goNext = useCallback(() => {
    if (!mNextStep) return;
    animateMobileStepChange();
    setMStep(mNextStep);
  }, [mNextStep, animateMobileStepChange]);

  const goPrev = useCallback(() => {
    if (mPrevStep === null) return;
    animateMobileStepChange();
    setMStep(mPrevStep);
  }, [mPrevStep, animateMobileStepChange]);

  const resetToFirstStep = useCallback(() => {
    setMStep(1);
  }, []);

  return {
    mStep,
    mStepAnimating,
    mStepsFlow,
    mCurrentIdx,
    mTotalSteps,
    mNextStep,
    mPrevStep,
    mNextLabel,
    goNext,
    goPrev,
    resetToFirstStep,
  };
}
