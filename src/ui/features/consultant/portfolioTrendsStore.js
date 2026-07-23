import {
  detectPortfolioTrendsWithAi,
  getAiPortfolioTrendsRun,
  newEvaluationRequestId,
} from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

/**
 * Store das "Tendências detectadas pela IA" (Consultor IA — A3), vivo fora do React.
 *
 * Irmão de `portfolioSummaryStore`: mesmo alvo (a carteira, uma só por consultor,
 * chave constante) e a mesma mecânica (in-flight guard, epoch, rejoin-poll,
 * fallback no refresh). A diferença NÃO está aqui — está no gatilho: a seção de
 * Insights AUTO-DISPARA a geração ao montar, enquanto o card do A2 é on-demand.
 * Isso mora no componente; o store é o mesmo. É por isso que o cache do backend é
 * de 1 dia: sem ele, cada abertura da tela pagaria uma run.
 */

const KEY = "trends";

export const IDLE = {
  loading: false,
  error: "",
  errorCode: "",
  result: null,
  correlationId: "",
  cached: false,
  computedAt: null,
};

/** `detail.code` de "carteira sem clientes" — a seção mostra um estado próprio. */
export const ERROR_INSUFFICIENT_DATA = "insufficient_data";

/**
 * `409` com este código = já existe uma detecção rodando, e `detail.run_id` diz
 * qual. **Não é `portfolio_summary_in_progress`** (aquele é o relatório): dois
 * `code` diferentes, duas telas diferentes.
 */
const ERROR_TRENDS_IN_PROGRESS = "trends_detection_in_progress";

const ERROR_BY_STATUS = {
  402: "Você atingiu o limite de uso da IA. Tente novamente mais tarde.",
  403: "Seu plano não inclui a detecção de tendências com IA.",
  409: "Já existe uma detecção de tendências em andamento. Aguarde e tente de novo.",
  422: "Não foi possível detectar tendências agora. Tente novamente em instantes.",
  429: "Você usou todas as detecções de tendências do seu plano neste mês. A cota é renovada no dia 1º.",
};

const ERROR_BY_CODE = {
  [ERROR_INSUFFICIENT_DATA]:
    "Você ainda não tem clientes na carteira para detectar tendências. Adicione clientes para liberar a análise.",
};

const ERROR_BY_RUN_STATUS = {
  [ERROR_INSUFFICIENT_DATA]: {
    code: ERROR_INSUFFICIENT_DATA,
    message: ERROR_BY_CODE[ERROR_INSUFFICIENT_DATA],
  },
  budget_exceeded: { code: "", message: ERROR_BY_STATUS[402] },
};

const RUN_FAILED_MESSAGE = ERROR_BY_STATUS[422];

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 300_000;

const TOOK_TOO_LONG_MESSAGE =
  "A detecção está demorando mais do que o normal. Tente novamente em instantes.";

const RUN_NOT_FOUND_MESSAGE =
  "Não foi possível recuperar a detecção em andamento. Peça uma nova.";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const slices = new Map();
const listeners = new Map();
const inFlight = new Map();
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

/** Esquece tudo ao fim da sessão — mesma isolação por consultor das irmãs. */
export function clearAllPortfolioTrends() {
  epoch += 1;
  slices.clear();
  inFlight.clear();
  for (const set of listeners.values()) {
    for (const cb of set) cb();
  }
}

/**
 * Garante que existem tendências. Idempotente: se já há run em voo ou resultado,
 * não dispara nada — é o que faz a seção auto-disparar UMA vez ao montar (o
 * StrictMode dobra o efeito) e reabrir a tela reencontrar em vez de pagar outra.
 * `refresh: true` (botão "Atualizar") é a única forma de forçar execução nova.
 *
 * Depois de um ERRO, o auto-run NÃO retenta (o guard abaixo barra `current.error`):
 * a seção mostra o erro com um "Atualizar" manual, em vez de re-pagar sozinha.
 */
export async function runPortfolioTrends({ refresh = false } = {}) {
  if (inFlight.get(KEY)) return;

  const current = getSlice();
  if (!refresh && (current.result || current.error)) return;

  inFlight.set(KEY, true);
  const myEpoch = epoch;
  const correlationId = newEvaluationRequestId();
  const fallback = refresh && current.result ? current : null;

  emit({ ...IDLE, loading: true, correlationId });

  try {
    const response = await detectPortfolioTrendsWithAi(correlationId, refresh);
    if (myEpoch !== epoch) return;
    emit({
      loading: false,
      error: "",
      errorCode: "",
      result: response.output,
      correlationId: response.correlation_id || correlationId,
      cached: response.cached === true,
      computedAt: response.computed_at ?? new Date().toISOString(),
    });
  } catch (err) {
    if (myEpoch !== epoch) return;
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail;
    const code = detail?.code ?? "";

    if (status === 409 && code === ERROR_TRENDS_IN_PROGRESS && detail?.run_id) {
      await followRun(detail.run_id, myEpoch, fallback);
      return;
    }

    const message = ERROR_BY_CODE[code] || ERROR_BY_STATUS[status] || handleApiError(err);
    emitFailure({ message, code, fallback, correlationId });
  } finally {
    // Só libera o guard se a run ainda é da geração ATUAL. Sem isto, uma run de
    // sessão anterior que resolve tarde (logout→login na mesma aba) liberaria o
    // slot da run nova em voo, e a auto-fire da tela dispararia uma segunda run
    // paga. Mesmo fix dos stores irmãos.
    if (myEpoch === epoch) inFlight.set(KEY, false);
  }
}

async function followRun(runId, myEpoch, fallback) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    if (myEpoch !== epoch) return;

    let run;
    try {
      run = await getAiPortfolioTrendsRun(runId);
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

    const failure = ERROR_BY_RUN_STATUS[run.status] ?? { code: "", message: RUN_FAILED_MESSAGE };
    emitFailure({ ...failure, fallback, correlationId: run.correlation_id || runId });
    return;
  }

  if (myEpoch !== epoch) return;
  emitFailure({ message: TOOK_TOO_LONG_MESSAGE, code: "", fallback, correlationId: runId });
}

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
