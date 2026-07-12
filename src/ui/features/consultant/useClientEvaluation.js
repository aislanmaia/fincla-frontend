import { useCallback, useEffect, useRef, useState } from "react";

import { evaluateClientWithAi, newEvaluationRequestId } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

const IDLE = {
  loading: false,
  error: "",
  errorCode: "",
  result: null,
  correlationId: "",
  // `cached` só é `true` quando o backend reaproveitou uma run anterior; `computedAt`
  // é quando ela foi DE FATO calculada (ISO com offset). Ver §17 do guia da API.
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
 *
 * `422` é ambíguo por status: pode ser "o modelo falhou" ou "o cliente não tem
 * dado nenhum". Só o `detail.code` distingue — ver `ERROR_BY_CODE`.
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
 * o `code` é contrato. O texto exibido é NOSSO, não o do backend — a UI é PT-BR
 * e o backend não deve ditar a copy do produto.
 */
const ERROR_BY_CODE = {
  [ERROR_INSUFFICIENT_DATA]:
    "Este cliente ainda não registrou nenhuma transação. Assim que houver lançamentos, a IA poderá analisar o histórico dele.",
};

/**
 * Roda `POST /v1/consultant/clients/{org_id}/ai-evaluation` **sob demanda**
 * (no clique de "Avaliar com IA"), diferente dos demais hooks do consultor, que
 * carregam no mount.
 *
 * Este hook é o **único ponto de contato com o transporte**: a etapa 8 entrega
 * JSON 200 e o streaming SSE ficou para o "infra stage", então a migração
 * futura para `EventSource` fica contida aqui — o drawer e o `<AiChart>`
 * consomem `EvaluateClientOutput`, que não muda.
 *
 * Cada `run()` gera um `X-Request-Id` (UUID) novo, que é a chave de
 * idempotência da run. Reusá-lo devolveria `409`.
 */
export function useClientEvaluation(organizationId) {
  const [state, setState] = useState(IDLE);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  // Sequencial da run "válida". Uma resposta que chega com token vencido é de um
  // cliente que o consultor já trocou — descartada, nunca pintada na tela.
  const runToken = useRef(0);

  // Espelho do último estado commitado. Efeitos rodam antes do próximo event
  // handler, então quando `run()` é chamado isto já reflete o que está na tela.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Trocar de cliente invalida o resultado anterior — senão o drawer mostraria
  // a avaliação do cliente errado por um frame.
  //
  // O reset é guardado por um ref em vez de depender só da lista de deps: em
  // `<StrictMode>` os efeitos rodam duas vezes, e este está registrado ANTES do
  // efeito de auto-run do drawer. Sem o guard, a segunda passada rodaria depois
  // de `run()` já ter setado `loading` e apagaria esse estado — o drawer ficava
  // em branco durante toda a requisição (~55s) em dev.
  //
  // Trocar de cliente também LIBERA o `inFlight` e invalida a run anterior: o
  // hook agora sobrevive ao fechamento do drawer, então uma avaliação do cliente
  // A pode continuar em voo quando o consultor abre o cliente B. Sem isto, o
  // guard de `inFlight` bloquearia a avaliação de B, e pior — a resposta de A
  // chegaria depois e se pintaria na tela de B.
  const lastOrganizationId = useRef(organizationId);
  useEffect(() => {
    if (lastOrganizationId.current === organizationId) return;
    lastOrganizationId.current = organizationId;
    runToken.current += 1;
    inFlight.current = false;
    setState(IDLE);
  }, [organizationId]);

  const reset = useCallback(() => setState(IDLE), []);

  /**
   * `refresh: true` fura o cache do backend e paga uma execução nova do LLM.
   *
   * Um `X-Request-Id` novo (que geramos a cada `run`) evita o `409`, mas NÃO
   * fura o cache — sem `?refresh=true` o backend devolveria a run recente. Só o
   * consultor pedindo "Recalcular" justifica gastar de novo.
   */
  const run = useCallback(
    // `refresh: force` — a opção pública se chama `refresh`, mas ligá-la a esse
    // nome sombrearia o callback `refresh` definido abaixo.
    async ({ refresh: force = false } = {}) => {
      if (!organizationId || inFlight.current) return;
      inFlight.current = true;
      const token = (runToken.current += 1);
      const correlationId = newEvaluationRequestId();

      // Um "Recalcular" que falha NÃO pode custar ao consultor a avaliação que
      // ele já tinha na tela: a pipeline de IA erra com frequência (grounding,
      // schema, timeout do provider), e trocar uma análise boa por uma tela de
      // erro faz do botão uma aposta. Guardamos o resultado atual para devolvê-lo
      // se a nova run não vingar. Só vale no refresh — na primeira run não há o
      // que preservar.
      const fallback = force && latest.current.result ? latest.current : null;

      setState({ ...IDLE, loading: true, correlationId });

      try {
        const response = await evaluateClientWithAi(organizationId, correlationId, {}, force);
        if (!mounted.current || token !== runToken.current) return;
        setState({
          loading: false,
          error: "",
          errorCode: "",
          result: response.output,
          // O backend ecoa o correlation_id definitivo; guardamos o dele, não o nosso.
          correlationId: response.correlation_id || correlationId,
          // Backend anterior ao cache não manda os campos — ausência é "não é cache".
          cached: response.cached === true,
          // O backend só data as respostas que vieram do cache. Para uma run nova
          // datamos aqui: o drawer agora sobrevive ao fechamento, então esta
          // avaliação pode ficar horas na tela — e o consultor precisa enxergar a
          // idade dela e ter o "Recalcular" à mão, venha ela do cache ou não.
          computedAt: response.computed_at ?? new Date().toISOString(),
        });
      } catch (err) {
        if (!mounted.current || token !== runToken.current) return;
        const status = err?.response?.status;
        // `detail` é um objeto `{code, message}` desde o fix de `insufficient_data`.
        // Guardamos contra o formato antigo (string) — um deploy do FE pode preceder
        // o do backend, e `detail.code` viraria `undefined` sem quebrar nada.
        const code = err?.response?.data?.detail?.code ?? "";
        const message = ERROR_BY_CODE[code] || ERROR_BY_STATUS[status] || handleApiError(err);
        setState({
          // No refresh falho preservamos result/cached/computedAt — e o
          // `correlationId` ANTIGO junto, porque ele identifica a análise que
          // segue na tela. Trocá-lo pelo da run que falhou faria o "ID da
          // análise" apontar para uma run que não produziu nada.
          ...(fallback ?? IDLE),
          loading: false,
          error: message,
          errorCode: code,
          correlationId: fallback ? fallback.correlationId : correlationId,
        });
      } finally {
        // Só a run corrente pode destrancar a porta. Se o consultor trocou de
        // cliente, quem está em voo agora é OUTRA run — e a run velha, ao
        // terminar, liberaria o `inFlight` dela por engano, permitindo um
        // segundo disparo pago para o cliente novo.
        if (token === runToken.current) inFlight.current = false;
      }
    },
    [organizationId]
  );

  /** "Recalcular": descarta a avaliação em cache e paga uma run nova. */
  const refresh = useCallback(() => run({ refresh: true }), [run]);

  return { ...state, run, refresh, reset };
}
