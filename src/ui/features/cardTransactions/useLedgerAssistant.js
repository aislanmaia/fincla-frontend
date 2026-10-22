import { useCallback, useEffect, useState } from "react";

import { getLedgerAssistant } from "../../../api/transactions";

const DEBOUNCE_MS = 500;
const EMPTY = { key: null, data: null, error: null };
const SLICE_CHANGED_RETRIES = 2;

/**
 * Lê o Assistente do recorte inteiro. A chamada examina todos os lançamentos, então espera o filtro assentar
 * (debounce), cancela a anterior ao mudar e, se o extrato mudou durante a leitura (409), pergunta de novo (até
 * duas vezes). Sem `enabled` não pergunta nada.
 *
 * `current` diz se o resultado guardado é do pedido de agora (`requestKey`): enquanto não é, não há resposta —
 * nem a do recorte anterior, nem "nada encontrado". `retry` refaz a leitura depois de uma falha.
 */
export function useLedgerAssistant({ enabled, params, requestKey }) {
  const [state, setState] = useState(EMPTY);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) { setState(EMPTY); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState(EMPTY);
      try {
        let data;
        for (let tries = 0; ; tries += 1) {
          try {
            data = await getLedgerAssistant(params, controller.signal);
            break;
          } catch (error) {
            if (error?.response?.data?.detail?.code !== "slice_changed" || tries >= SLICE_CHANGED_RETRIES) throw error;
          }
        }
        if (!controller.signal.aborted) setState({ key: requestKey, data, error: null });
      } catch (error) {
        if (!controller.signal.aborted) setState({ key: requestKey, data: null, error });
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  // requestKey describes the request; params is rebuilt every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, requestKey, attempt]);
  return { ...state, current: enabled && state.key === requestKey, retry };
}
