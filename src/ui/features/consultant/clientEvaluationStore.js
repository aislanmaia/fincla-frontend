import {
  evaluateClientWithAi,
  getAiEvaluationRun,
  newEvaluationRequestId,
} from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

/**
 * Store das avaliações de IA, **uma fatia por cliente**, viva fora do React.
 *
 * Por que fora do React: uma avaliação leva de 12 a 50 segundos e custa ~15 mil
 * tokens. Enquanto ela roda, o consultor fecha o painel, olha outro cliente,
 * navega para outra tela. Se o estado morasse no componente, cada uma dessas
 * ações o destruiria — e foi o que acontecia. Medido contra o backend real:
 *
 *   - fechar e reabrir o painel  → 2 runs pagas do mesmo cliente (45.853 tokens
 *     de entrada para UMA avaliação pedida);
 *   - avaliar A, espiar B, voltar para A antes de A terminar → 3 runs, e a
 *     segunda run de A ainda voltou `blocked`: o consultor viu "Não foi possível
 *     avaliar" enquanto a PRIMEIRA run de A, que deu `ok`, era descartada.
 *
 * A avaliação nunca é abortada (não há `AbortController`) — o backend a leva até
 * o fim e cobra do mesmo jeito. Então abandoná-la na UI é puro desperdício. Aqui
 * cada cliente tem a sua fatia, e a run em voo é reencontrada em vez de refeita.
 *
 * Chave: `organizationId`. Sem TTL nem descarte: a sessão do consultor é curta e
 * a carteira tem dezenas de clientes, não milhões.
 */

export const IDLE = {
  loading: false,
  error: "",
  errorCode: "",
  result: null,
  correlationId: "",
  // `cached` = o backend reaproveitou uma run anterior. `computedAt` = quando a
  // análise foi DE FATO calculada — e existe mesmo em run nova, porque o
  // resultado sobrevive ao fechamento do painel e precisa mostrar a idade.
  cached: false,
  computedAt: null,
};

/** `detail.code` que o backend devolve; o front ramifica por ele, nunca por mensagem. */
export const ERROR_INSUFFICIENT_DATA = "insufficient_data";

/**
 * `409` com este código = já existe uma avaliação DESTE cliente em execução, e o
 * `detail.run_id` diz qual. É um convite, não uma recusa: em vez de mostrar "tente
 * de novo", o front volta para a run que já está lá — e já está sendo paga.
 */
const ERROR_EVALUATION_IN_PROGRESS = "evaluation_in_progress";

/**
 * Mensagens por status HTTP do endpoint de avaliação (§17 do guia da API).
 *
 * O texto de erro do backend é deliberadamente genérico (anti-leak: nunca vaza
 * texto de provider nem motivo de grounding), então não repassamos o `detail`
 * cru ao consultor — traduzimos para uma ação possível.
 */
const ERROR_BY_STATUS = {
  402: "Você atingiu o limite de uso da IA. Tente novamente mais tarde.",
  403: "Seu plano não inclui a avaliação com IA.",
  404: "Cliente não encontrado na sua carteira.",
  409: "Já existe uma avaliação em andamento para este cliente. Aguarde e tente de novo.",
  422: "Não foi possível gerar a avaliação agora. Tente novamente em instantes.",
};

/**
 * Mensagens por `detail.code`, quando presente. Tem precedência sobre o status.
 *
 * Ramificar por `code` e não por substring da mensagem: a mensagem é copy, muda;
 * o `code` é contrato. O texto exibido é NOSSO — a UI é PT-BR e o backend não
 * deve ditar a copy do produto.
 */
const ERROR_BY_CODE = {
  [ERROR_INSUFFICIENT_DATA]:
    "Este cliente ainda não registrou nenhuma transação. Assim que houver lançamentos, a IA poderá analisar o histórico dele.",
};

/**
 * Uma run reencontrada não termina em código HTTP — termina num `RunStatus` do
 * domínio. Traduzimos os terminais para a mesma linguagem dos erros do POST, para
 * o consultor não ver duas histórias diferentes para a mesma falha.
 *
 * `ok` não está aqui de propósito: é sucesso, e o sucesso tem outro caminho.
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

/**
 * De quanto em quanto tempo se pergunta pela run reencontrada.
 *
 * A consulta é barata (lê a linha de audit; não toca no LLM), mas uma avaliação
 * leva de 12 a 50 segundos — pesquisar de meio em meio segundo só geraria ruído.
 */
const POLL_INTERVAL_MS = 3_000;

/**
 * Desistir de acompanhar. Casado com o `CONSULTANT_AI_RUN_STALE_AFTER_SECONDS`
 * do backend (5 min), que é quando ele mesmo dá a run por morta. Esperar mais que
 * isso seria esperar por algo que o backend já enterrou.
 */
const POLL_TIMEOUT_MS = 300_000;

const TOOK_TOO_LONG_MESSAGE =
  "A avaliação está demorando mais do que o normal. Tente novamente em instantes.";

/**
 * `404` no GET da run é OUTRA coisa que `404` no POST: aqui o cliente está na
 * carteira — quem sumiu foi a run (o backend a deu por morta e a enterrou).
 * Reusar o "Cliente não encontrado na sua carteira" mandaria o consultor caçar um
 * problema que não existe.
 */
const RUN_NOT_FOUND_MESSAGE =
  "Não foi possível recuperar a avaliação em andamento. Peça uma nova.";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `organizationId` → fatia de estado. */
const slices = new Map();
/** `organizationId` → Set de callbacks (um por componente montado). */
const listeners = new Map();
/** `organizationId` → `true` enquanto há requisição em voo para aquele cliente. */
const inFlight = new Map();

/**
 * Geração do store. `clearAllEvaluations()` a incrementa, e toda run em voo
 * carrega a geração em que nasceu: uma resposta que chega DEPOIS de a sessão ser
 * encerrada é descartada em vez de se escrever de volta no store — senão o
 * logout limparia a memória e a run de 40s a repovoaria logo em seguida.
 */
let epoch = 0;

export function getSlice(organizationId) {
  return slices.get(organizationId) ?? IDLE;
}

export function subscribe(organizationId, callback) {
  if (!listeners.has(organizationId)) listeners.set(organizationId, new Set());
  const set = listeners.get(organizationId);
  set.add(callback);
  return () => set.delete(callback);
}

function emit(organizationId, slice) {
  slices.set(organizationId, slice);
  for (const cb of listeners.get(organizationId) ?? []) cb();
}

export function resetSlice(organizationId) {
  emit(organizationId, IDLE);
}

/**
 * Esquece TUDO: chamada quando a sessão termina (logout ou token expirado).
 *
 * Sem isto o store seria um vazamento entre contas. O `signOut` do Fincla não
 * recarrega a página — ele apaga o token e reseta o estado do React —, então
 * este `Map` de nível de módulo sobreviveria ao logout. O próximo consultor a
 * entrar NA MESMA ABA abriria o painel de um cliente que também está na carteira
 * dele e veria, instantaneamente e sem nenhuma chamada à API, a análise que o
 * consultor anterior mandou gerar. O cache do backend é isolado por consultor;
 * este cache do front furaria essa isolação.
 *
 * Os `listeners` NÃO são descartados: eles pertencem aos componentes montados, e
 * jogá-los fora deixaria um drawer aberto surdo a qualquer emit futuro. Em vez
 * disso, são notificados — quem estiver na tela volta para `IDLE`.
 */
export function clearAllEvaluations() {
  epoch += 1;
  slices.clear();
  inFlight.clear();
  for (const set of listeners.values()) {
    for (const cb of set) cb();
  }
}

/**
 * Garante que existe uma avaliação para este cliente.
 *
 * É **idempotente por cliente**: se já há uma run em voo ou um resultado, não
 * dispara nada. É isso que faz reabrir o painel reencontrar a run em vez de
 * pagar outra. `refresh: true` é a única forma de forçar uma execução nova.
 *
 * O guard de run em voo vem antes de tudo e vale inclusive para o `refresh`:
 * enquanto uma avaliação deste cliente está rodando, nada dispara outra. Não há
 * o que perder aí — durante a run a UI mostra o skeleton, e "Recalcular" não
 * existe na tela.
 */
export async function runEvaluation(organizationId, { refresh = false } = {}) {
  if (!organizationId || inFlight.get(organizationId)) return;

  const current = getSlice(organizationId);
  if (!refresh && (current.result || current.error)) return;

  inFlight.set(organizationId, true);
  // A geração em que esta run nasceu. Se a sessão for encerrada no meio dela, a
  // resposta que chegar depois não pode se escrever no store de quem entrar em
  // seguida.
  const myEpoch = epoch;
  const correlationId = newEvaluationRequestId();

  // Um "Recalcular" que falha NÃO pode custar ao consultor a avaliação que ele
  // já tinha na tela: a pipeline de IA erra com frequência (grounding, schema,
  // timeout do provider). Guardamos o resultado atual para devolvê-lo se a run
  // nova não vingar. Na primeira run não há o que preservar.
  const fallback = refresh && current.result ? current : null;

  emit(organizationId, { ...IDLE, loading: true, correlationId });

  try {
    const response = await evaluateClientWithAi(organizationId, correlationId, {}, refresh);
    if (myEpoch !== epoch) return;
    emit(organizationId, {
      loading: false,
      error: "",
      errorCode: "",
      result: response.output,
      // O backend ecoa o correlation_id definitivo; guardamos o dele, não o nosso.
      correlationId: response.correlation_id || correlationId,
      // Backend anterior ao cache não manda os campos — ausência é "não é cache".
      cached: response.cached === true,
      // O backend só data as respostas vindas do cache. Uma run nova datamos aqui:
      // o resultado fica na tela por horas, e sem idade o consultor olharia um
      // diagnóstico velho achando que é de agora.
      computedAt: response.computed_at ?? new Date().toISOString(),
    });
  } catch (err) {
    if (myEpoch !== epoch) return;
    const status = err?.response?.status;
    // `detail` é `{code, message}` desde o fix de `insufficient_data`; guardamos
    // contra o formato antigo (string) — um deploy do FE pode preceder o do backend.
    const detail = err?.response?.data?.detail;
    const code = detail?.code ?? "";

    // O backend recusou porque JÁ EXISTE uma avaliação deste cliente rodando — e
    // mandou o id dela. Dizer "tente de novo" aqui seria mandar o consultor
    // esperar por uma resposta que já está a caminho, e que ele já está pagando.
    // Então voltamos para ela. É este o caminho de quem deu F5 no meio da run ou
    // abriu o cliente numa segunda aba.
    if (status === 409 && code === ERROR_EVALUATION_IN_PROGRESS && detail?.run_id) {
      await followRun(organizationId, detail.run_id, myEpoch, fallback);
      return;
    }

    const message = ERROR_BY_CODE[code] || ERROR_BY_STATUS[status] || handleApiError(err);
    emitFailure(organizationId, { message, code, fallback, correlationId });
  } finally {
    inFlight.set(organizationId, false);
  }
}

/**
 * Acompanha até o fim uma run que já estava rodando.
 *
 * Roda DENTRO do `try/finally` de `runEvaluation`, e isso é deliberado: o
 * `inFlight` daquele cliente continua marcado durante todo o acompanhamento, de
 * modo que reabrir o painel no meio dele não dispara uma terceira requisição.
 *
 * O `loading` já está na tela desde o `emit` inicial — enquanto a run não termina,
 * não emitimos nada, e o consultor segue vendo o skeleton. Do ponto de vista dele
 * não houve 409 nenhum: só uma avaliação que demorou.
 */
async function followRun(organizationId, runId, myEpoch, fallback) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);
    if (myEpoch !== epoch) return;

    let run;
    try {
      run = await getAiEvaluationRun(organizationId, runId);
    } catch (err) {
      if (myEpoch !== epoch) return;
      // Não há o que acompanhar, e insistir não traria a run de volta.
      const failedStatus = err?.response?.status;
      const message =
        failedStatus === 404
          ? RUN_NOT_FOUND_MESSAGE
          : ERROR_BY_STATUS[failedStatus] || handleApiError(err);
      emitFailure(organizationId, { message, code: "", fallback, correlationId: runId });
      return;
    }
    if (myEpoch !== epoch) return;

    if (run.status === "running") continue;

    if (run.status === "ok" && run.output) {
      emit(organizationId, {
        loading: false,
        error: "",
        errorCode: "",
        result: run.output,
        correlationId: run.correlation_id || runId,
        // Não veio do cache: é a run que nós mesmos pedimos, reencontrada.
        cached: false,
        computedAt: run.computed_at ?? new Date().toISOString(),
      });
      return;
    }

    // Terminou, mas não em `ok`. O motivo cru nunca vem (anti-leak); o `status` é
    // o que temos, e ele basta para escolher a história certa.
    const failure = ERROR_BY_RUN_STATUS[run.status] ?? {
      code: "",
      message: RUN_FAILED_MESSAGE,
    };
    emitFailure(organizationId, {
      ...failure,
      fallback,
      correlationId: run.correlation_id || runId,
    });
    return;
  }

  if (myEpoch !== epoch) return;
  emitFailure(organizationId, {
    message: TOOK_TOO_LONG_MESSAGE,
    code: "",
    fallback,
    correlationId: runId,
  });
}

/**
 * Uma falha nunca apaga uma avaliação boa da tela.
 *
 * Quando havia resultado (o caso do "Recalcular" que não vingou), ele volta
 * inteiro — com a idade e o id da análise EXIBIDA, não os da run que morreu.
 */
function emitFailure(organizationId, { message, code, fallback, correlationId }) {
  emit(organizationId, {
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
