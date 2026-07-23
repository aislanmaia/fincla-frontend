import { useCallback, useSyncExternalStore } from "react";

import {
  getSnapshot,
  newConversation,
  sendMessage,
  subscribe,
} from "./copilotoStore.js";

/**
 * Liga o React ao `copilotoStore` (Consultor IA — A4). Fininho: toda a lógica
 * (thread, in-flight, rejoin-poll, bolhas de erro) vive no store, fora do React.
 * Igual aos hooks das irmãs, mas com uma AÇÃO de enviar em vez de um "run" sem
 * argumento — o chat recebe texto.
 */
export function useCopiloto() {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  const send = useCallback(
    (text, options) => sendMessage(text, options),
    []
  );
  const startNew = useCallback(() => newConversation(), []);
  return { ...state, send, startNew };
}
