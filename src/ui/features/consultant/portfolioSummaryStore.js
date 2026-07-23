import {
  getAiPortfolioSummaryRun,
  newEvaluationRequestId,
  summarizePortfolioWithAi,
} from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

/**
 * Store do "Resumo da base por IA" (Consultor IA — A2), vivo fora do React.
 *
 * Irmão de `clientEvaluationStore`, e pela mesma razão: um relatório da base leva
 * de 12 a 50 segundos e custa tokens de verdade. Enquanto ele roda, o consultor
 * fecha o drawer, navega, abre outra aba — e se o estado morasse no componente,
 * cada uma dessas ações o destruiria e faria pagar uma segunda run.
 *
 * A diferença para o A1 é o ALVO: lá cada cliente tem a sua fatia (chave =
 * `organizationId`); aqui o alvo é a carteira inteira, e há uma só por consultor.
 * Então há uma fatia única, sob uma chave constante — o resto da mecânica
 * (in-flight guard, epoch, rejoin-poll, fallback no refresh) é idêntico, porque
 * os problemas são os mesmos.
 */

/** Chave da fatia única. A carteira é uma só por consultor logado. */
const KEY = "portfolio";

export const IDLE = {
  loading: false,
  error: "",
  errorCode: "",
  result: null,
  correlationId: "",
  cached: false,
  computedAt: null,
};

/**
 * `detail.code` de "carteira sem clientes". O drawer ramifica por ele para
 * mostrar um estado próprio (adicione clientes), não um erro de geração.
 */
export const ERROR_INSUFFICIENT_DATA = "insufficient_data";

/**
 * `409` com este código = já existe um relatório da base rodando, e `detail.run_id`
 * diz qual. **Não é `evaluation_in_progress`** (aquele aponta para um cliente):
 * a ação de volta é reencontrar o relatório da carteira, não o de um cliente.
 */
const ERROR_PORTFOLIO_IN_PROGRESS = "portfolio_summary_in_progress";

/**
 * Mensagens por status HTTP do endpoint de relatório da base. O texto do backend
 * é genérico (anti-leak), então traduzimos para uma ação possível — em PT-BR, a
 * copy é NOSSA.
 */
const ERROR_BY_STATUS = {
  402: "Você atingiu o limite de uso da IA. Tente novamente mais tarde.",
  403: "Seu plano não inclui o relatório da base com IA.",
  409: "Já existe um relatório da base em andamento. Aguarde e tente de novo.",
  422: "Não foi possível gerar o relatório da base agora. Tente novamente em instantes.",
  429: "Você usou todos os relatórios da base do seu plano neste mês. A cota é renovada no dia 1º.",
};

/**
 * Mensagens por `detail.code`, com precedência sobre o status. Ramificar por
 * `code` (contrato) e não por mensagem (copy).
 */
const ERROR_BY_CODE = {
  [ERROR_INSUFFICIENT_DATA]:
    "Você ainda não tem clientes na carteira para gerar o relatório da base. Adicione clientes para liberar a análise.",
};

/**
 * Terminais de uma run reencontrada, traduzidos para a mesma linguagem dos erros
 * do POST. `ok` não está aqui: é sucesso, com outro caminho.
 */
const ERROR_BY_RUN_STATUS = {
  [ERROR_INSUFFICIENT_DATA]: {
    code: ERROR_INSUFFICIENT_DATA,
    message: ERROR_BY_CODE[ERROR_INSUFFICIENT_DATA],
  },
  budget_exceeded: { code: "", message: ERROR_BY_STATUS[402] },
};

/** Qualquer outro terminal (`error`, `blocked`, `schema_fail`, `tool_error`). */
const RUN_FAILED_MESSAGE = ERROR_BY_STATUS[422];

/** A consulta é barata (audit, não LLM), mas o relatório leva dezenas de segundos. */
const POLL_INTERVAL_MS = 3_000;

/**
 * Desistir de acompanhar. Espelha o stale-window do backend (5 min), pelo mesmo
 * raciocínio do A1: conta de quando ESTA aba recebeu o 409, e o "Tentar de novo"
 * do consultor dispara o POST que enterra a run velha.
 */
const POLL_TIMEOUT_MS = 300_000;

const TOOK_TOO_LONG_MESSAGE =
  "O relatório está demorando mais do que o normal. Tente novamente em instantes.";

/** `404` no GET da run = o relatório sumiu (backend o enterrou), não a carteira. */
const RUN_NOT_FOUND_MESSAGE =
  "Não foi possível recuperar o relatório em andamento. Peça um novo.";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fatia única (chaveada por `KEY`) — mesma forma do A1, um alvo só. */
const slices = new Map();
const listeners = new Map();
const inFlight = new Map();

/**
 * Geração do store. `clearAllPortfolioSummaries()` a incrementa; uma resposta que
 * chega depois do logout é descartada em vez de repovoar o store do próximo
 * consultor na mesma aba. Mesma isolação por sessão que o A1 tem.
 */
let epoch = 0;

export function getSlice() {
  return slices.get(KEY) ?? IDLE;
}

export function subscribe(callback) {
  if (!listeners.has(KEY)) listeners.set(KEY, new Set());
  const set = listeners.get(KEY);
  set.add(callback);
  return () => set.delete(callback);
}

function emit(slice) {
  slices.set(KEY, slice);
  for (const cb of listeners.get(KEY) ?? []) cb();
}

export function resetSlice() {
  emit(IDLE);
}

/**
 * Esquece tudo ao fim da sessão. Sem isto, o próximo consultor na MESMA aba veria
 * o relatório da base do anterior — o cache do backend é isolado por consultor, e
 * este cache do front furaria a isolação. Os `listeners` são notificados, não
 * descartados: um drawer aberto volta para `IDLE` em vez de ficar surdo.
 */
export function clearAllPortfolioSummaries() {
  epoch += 1;
  slices.clear();
  inFlight.clear();
  for (const set of listeners.values()) {
    for (const cb of set) cb();
  }
}

/**
 * Garante que existe um relatório da base. Idempotente: se já há run em voo ou
 * resultado, não dispara nada — é o que faz reabrir o drawer reencontrar a run em
 * vez de pagar outra. `refresh: true` é a única forma de forçar execução nova, e
 * o guard de run em voo vale inclusive para ele.
 */
export async function runPortfolioSummary({ refresh = false } = {}) {
  if (inFlight.get(KEY)) return;

  const current = getSlice();
  if (!refresh && (current.result || current.error)) return;

  inFlight.set(KEY, true);
  const myEpoch = epoch;
  const correlationId = newEvaluationRequestId();

  // Um "Recalcular" que falha não pode apagar o relatório que já estava na tela:
  // a pipeline de IA erra com frequência. Guardamos o atual para devolvê-lo.
  const fallback = refresh && current.result ? current : null;

  emit({ ...IDLE, loading: true, correlationId });

  try {
    const response = await summarizePortfolioWithAi(correlationId, refresh);
    if (myEpoch !== epoch) return;
    emit({
      loading: false,
      error: "",
      errorCode: "",
      result: response.output,
      correlationId: response.correlation_id || correlationId,
      cached: response.cached === true,
      // Run nova datamos aqui: o resultado fica na tela por horas, e sem idade o
      // consultor olharia um relatório velho achando que é de agora.
      computedAt: response.computed_at ?? new Date().toISOString(),
    });
  } catch (err) {
    if (myEpoch !== epoch) return;
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail;
    const code = detail?.code ?? "";

    // Já existe um relatório da base rodando, e o backend mandou o id. Voltamos
    // para ele em vez de mandar o consultor esperar por algo que já paga.
    if (status === 409 && code === ERROR_PORTFOLIO_IN_PROGRESS && detail?.run_id) {
      await followRun(detail.run_id, myEpoch, fallback);
      return;
    }

    const message = ERROR_BY_CODE[code] || ERROR_BY_STATUS[status] || handleApiError(err);
    emitFailure({ message, code, fallback, correlationId });
  } finally {
    inFlight.set(KEY, false);
  }
}

/**
 * Acompanha até o fim um relatório que já estava rodando. Roda DENTRO do
 * `try/finally`, então `inFlight` segue marcado durante todo o poll — reabrir o
 * drawer no meio dele não dispara uma terceira requisição.
 */
async function followRun(runId, myEpoch, fallback) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    if (myEpoch !== epoch) return;

    let run;
    try {
      run = await getAiPortfolioSummaryRun(runId);
    } catch (err) {
      if (myEpoch !== epoch) return;
      const failedStatus = err?.response?.status;
      const message =
        failedStatus === 404
          ? RUN_NOT_FOUND_MESSAGE
          : ERROR_BY_STATUS[failedStatus] || handleApiError(err);
      emitFailure({ message, code: "", fallback, correlationId: runId });
      return;
    }
    if (myEpoch !== epoch) return;

    if (run.status === "running") continue;

    if (run.status === "ok" && run.output) {
      emit({
        loading: false,
        error: "",
        errorCode: "",
        result: run.output,
        correlationId: run.correlation_id || runId,
        cached: false,
        computedAt: run.computed_at ?? new Date().toISOString(),
      });
      return;
    }

    const failure = ERROR_BY_RUN_STATUS[run.status] ?? {
      code: "",
      message: RUN_FAILED_MESSAGE,
    };
    emitFailure({
      ...failure,
      fallback,
      correlationId: run.correlation_id || runId,
    });
    return;
  }

  if (myEpoch !== epoch) return;
  emitFailure({
    message: TOOK_TOO_LONG_MESSAGE,
    code: "",
    fallback,
    correlationId: runId,
  });
}

/**
 * Uma falha nunca apaga um relatório bom da tela. Quando havia resultado (o caso
 * do "Recalcular" que não vingou), ele volta inteiro — com a idade e o id do
 * relatório EXIBIDO, não os da run que morreu.
 */
function emitFailure({ message, code, fallback, correlationId }) {
  emit({
    ...(fallback ?? IDLE),
    loading: false,
    error: message,
    errorCode: code,
    correlationId: fallback ? fallback.correlationId : correlationId,
  });
}

/** Só para os testes: zera o store entre casos. */
export function __resetStore() {
  slices.clear();
  listeners.clear();
  inFlight.clear();
}
