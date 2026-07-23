import {
  askCopiloto,
  getAiCopilotoRun,
  newEvaluationRequestId,
} from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

/**
 * Store do "Copiloto IA" (Consultor IA — A4), vivo fora do React.
 *
 * Diferente dos stores de relatório (A2/A3), que guardam UM resultado singleton,
 * este é um CHAT: uma lista ordenada de mensagens que só cresce. Duas invariantes
 * moldam o desenho:
 *
 * 1. **Nada que a IA faça pode apagar o que já está na tela.** Uma falha vira uma
 *    bolha de erro anexada ao fim — as mensagens anteriores ficam. (A taxa real de
 *    falha das runs é alta; o chat não pode perder a conversa por causa dela.)
 * 2. **Multi-turno de verdade.** O `sessionId` (thread) é gerado UMA vez por
 *    conversa e reenviado em toda mensagem; o backend o namespaceia sob o
 *    consultor autenticado e carrega o histórico dessa sessão. "Nova conversa"
 *    gera um thread novo e zera a lista.
 *
 * O in-flight guard (`sending`) serializa: uma mensagem por vez, como um chat de
 * verdade. O backend também serializa (409 `copilot_in_progress` → rejoin-poll),
 * cobrindo o F5/segunda aba.
 */

let messages = [];
let sending = false;
let sessionId = newEvaluationRequestId();
let banner = null; // { message, code } — erro transitório do último envio (quota, etc.)

let msgSeq = 0;
const listeners = new Set();
let epoch = 0;

const ERROR_COPILOT_IN_PROGRESS = "copilot_in_progress";

const ERROR_BY_STATUS = {
  402: "Você atingiu o limite de uso da IA para esta mensagem. Tente novamente mais tarde.",
  403: "Seu plano não inclui o Copiloto IA.",
  409: "O Copiloto ainda está respondendo à mensagem anterior. Aguarde e tente de novo.",
  422: "Não foi possível responder agora. Tente novamente em instantes.",
  429: "Você usou todas as mensagens do Copiloto do seu plano neste mês. A cota é renovada no dia 1º.",
};

const RUN_FAILED_MESSAGE = ERROR_BY_STATUS[422];
const TOOK_TOO_LONG_MESSAGE =
  "A resposta está demorando mais do que o normal. Tente novamente em instantes.";
const RUN_NOT_FOUND_MESSAGE =
  "Não foi possível recuperar a mensagem em andamento. Envie de novo.";

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 300_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Snapshot IMUTÁVEL: `useSyncExternalStore` compara por referência. */
let snapshot = buildSnapshot();

function buildSnapshot() {
  return { messages, sending, sessionId, banner };
}

export function getSnapshot() {
  return snapshot;
}

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emit() {
  snapshot = buildSnapshot();
  for (const cb of listeners) cb();
}

function appendMessage(message) {
  messages = [...messages, { id: `m${(msgSeq += 1)}`, ...message }];
}

/**
 * Prefixo de escopo: quando o consultor foca um cliente pelo seletor, o NOME dele
 * entra na mensagem enviada. É a decisão de PII do A4 — o backend só deixa a IA
 * filtrar por um nome que o consultor DIGITOU, e ao escolher o cliente no seletor
 * ele o forneceu explicitamente. A bolha na tela mostra o texto cru; o nome só
 * viaja no payload.
 */
function composeMessage(text, scopeClientName) {
  const name = (scopeClientName || "").trim();
  if (!name) return text;
  return `Sobre o cliente ${name}: ${text}`;
}

/**
 * Envia um turno do chat. Idempotente contra duplo-clique pelo guard `sending`.
 * `scopeClientName` (opcional) ancora o filtro por nome na mensagem enviada.
 */
export async function sendMessage(rawText, { scopeClientName = "" } = {}) {
  const text = String(rawText ?? "").trim();
  if (!text || sending) return;

  appendMessage({ role: "user", text });
  sending = true;
  banner = null;
  emit();

  const myEpoch = epoch;
  const correlationId = newEvaluationRequestId();
  const payload = composeMessage(text, scopeClientName);

  try {
    const response = await askCopiloto(correlationId, payload, sessionId);
    if (myEpoch !== epoch) return;
    appendMessage({ role: "assistant", output: response.output });
  } catch (err) {
    if (myEpoch !== epoch) return;
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail;
    const code = detail?.code ?? "";

    if (status === 409 && code === ERROR_COPILOT_IN_PROGRESS && detail?.run_id) {
      await followRun(detail.run_id, myEpoch);
      return;
    }

    const message = ERROR_BY_STATUS[status] || handleApiError(err);
    // 429/403 viram banner (é sobre a CONTA, não sobre a pergunta); os demais
    // viram uma bolha de erro no fim da conversa.
    if (status === 429 || status === 403) {
      banner = { message, code: String(status) };
    } else {
      appendMessage({ role: "assistant", error: message });
    }
  } finally {
    if (myEpoch === epoch) {
      sending = false;
      emit();
    }
  }
}

async function followRun(runId, myEpoch) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    if (myEpoch !== epoch) return;

    let run;
    try {
      run = await getAiCopilotoRun(runId);
    } catch (err) {
      if (myEpoch !== epoch) return;
      const failedStatus = err?.response?.status;
      const message =
        failedStatus === 404
          ? RUN_NOT_FOUND_MESSAGE
          : ERROR_BY_STATUS[failedStatus] || handleApiError(err);
      appendMessage({ role: "assistant", error: message });
      return;
    }
    if (myEpoch !== epoch) return;

    if (run.status === "running") continue;

    if (run.status === "ok" && run.output) {
      appendMessage({ role: "assistant", output: run.output });
      return;
    }

    appendMessage({ role: "assistant", error: RUN_FAILED_MESSAGE });
    return;
  }

  if (myEpoch !== epoch) return;
  appendMessage({ role: "assistant", error: TOOK_TOO_LONG_MESSAGE });
}

/** Começa uma conversa nova: thread novo (contexto zerado no backend) + tela limpa. */
export function newConversation() {
  epoch += 1;
  messages = [];
  sending = false;
  banner = null;
  sessionId = newEvaluationRequestId();
  emit();
}

/**
 * Esquece tudo ao fim da sessão do consultor — mesma isolação por consultor dos
 * stores irmãos. Um logout→login na mesma aba não pode herdar a conversa anterior.
 */
export function clearCopiloto() {
  newConversation();
}

/** Só para os testes: zera o store entre casos, de forma determinística. */
export function __resetStore() {
  epoch += 1;
  messages = [];
  sending = false;
  banner = null;
  msgSeq = 0;
  sessionId = "test-thread";
  listeners.clear();
  snapshot = buildSnapshot();
}
