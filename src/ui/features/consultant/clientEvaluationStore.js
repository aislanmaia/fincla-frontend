import { evaluateClientWithAi, newEvaluationRequestId } from "../../../api/consultant";
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
    const code = err?.response?.data?.detail?.code ?? "";
    const message = ERROR_BY_CODE[code] || ERROR_BY_STATUS[status] || handleApiError(err);
    emit(organizationId, {
      // No refresh falho preservamos result/cached/computedAt — e o `correlationId`
      // ANTIGO junto, porque ele identifica a análise que segue na tela.
      ...(fallback ?? IDLE),
      loading: false,
      error: message,
      errorCode: code,
      correlationId: fallback ? fallback.correlationId : correlationId,
    });
  } finally {
    inFlight.set(organizationId, false);
  }
}

/** Só para os testes: zera o store entre casos. */
export function __resetStore() {
  slices.clear();
  listeners.clear();
  inFlight.clear();
}
