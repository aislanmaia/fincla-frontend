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
  const lastOrganizationId = useRef(organizationId);
  useEffect(() => {
    if (lastOrganizationId.current === organizationId) return;
    lastOrganizationId.current = organizationId;
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
      const correlationId = newEvaluationRequestId();
      setState({ ...IDLE, loading: true, correlationId });

      try {
        const response = await evaluateClientWithAi(organizationId, correlationId, {}, force);
        if (!mounted.current) return;
        setState({
          loading: false,
          error: "",
          errorCode: "",
          result: response.output,
          // O backend ecoa o correlation_id definitivo; guardamos o dele, não o nosso.
          correlationId: response.correlation_id || correlationId,
          // Backend anterior ao cache não manda os campos — ausência é "não é cache".
          cached: response.cached === true,
          computedAt: response.computed_at ?? null,
        });
      } catch (err) {
        if (!mounted.current) return;
        const status = err?.response?.status;
        // `detail` é um objeto `{code, message}` desde o fix de `insufficient_data`.
        // Guardamos contra o formato antigo (string) — um deploy do FE pode preceder
        // o do backend, e `detail.code` viraria `undefined` sem quebrar nada.
        const code = err?.response?.data?.detail?.code ?? "";
        setState({
          ...IDLE,
          error: ERROR_BY_CODE[code] || ERROR_BY_STATUS[status] || handleApiError(err),
          errorCode: code,
          correlationId,
        });
      } finally {
        inFlight.current = false;
      }
    },
    [organizationId]
  );

  /** "Recalcular": descarta a avaliação em cache e paga uma run nova. */
  const refresh = useCallback(() => run({ refresh: true }), [run]);

  return { ...state, run, refresh, reset };
}
