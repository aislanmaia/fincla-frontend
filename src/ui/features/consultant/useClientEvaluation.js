import { useCallback, useSyncExternalStore } from "react";

import {
  ERROR_INSUFFICIENT_DATA,
  getSlice,
  resetSlice,
  runEvaluation,
  subscribe,
} from "./clientEvaluationStore.js";

export { ERROR_INSUFFICIENT_DATA };

/**
 * Liga o drawer à fatia de avaliação **deste cliente** no store.
 *
 * Todo o estado vive em `clientEvaluationStore` (fora do React) porque uma
 * avaliação dura de 12 a 50 segundos e custa ~15 mil tokens, e o consultor fecha
 * o painel, troca de cliente e navega enquanto ela roda. Guardar isso no
 * componente fazia cada uma dessas ações abandonar uma run já paga — e disparar
 * outra ao voltar.
 *
 * Consequência boa e deliberada: avaliações de clientes diferentes **correm em
 * paralelo**, cada uma na sua fatia. Voltar para o cliente A reencontra a run de
 * A, esteja ela em voo ou pronta.
 *
 * Cada `run()` gera um `X-Request-Id` (UUID) novo, que é a chave de idempotência
 * da run no backend. Reusá-lo devolveria `409`.
 */
export function useClientEvaluation(organizationId) {
  const state = useSyncExternalStore(
    useCallback((cb) => subscribe(organizationId, cb), [organizationId]),
    useCallback(() => getSlice(organizationId), [organizationId])
  );

  /**
   * "Garanta que existe uma avaliação para este cliente." Idempotente: se já há
   * uma run em voo ou um resultado, não dispara nada — é o que faz reabrir o
   * painel reencontrar a run em vez de pagar por outra.
   */
  const run = useCallback(() => runEvaluation(organizationId), [organizationId]);

  /**
   * "Recalcular": a única forma de forçar uma execução nova.
   *
   * Um `X-Request-Id` novo evita o `409` mas NÃO fura o cache — sem
   * `?refresh=true` o backend devolveria a run recente, e o botão estaria
   * mentindo para o consultor.
   */
  const refresh = useCallback(
    () => runEvaluation(organizationId, { refresh: true }),
    [organizationId]
  );

  const reset = useCallback(() => resetSlice(organizationId), [organizationId]);

  return { ...state, run, refresh, reset };
}
