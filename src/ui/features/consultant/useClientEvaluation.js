import { useCallback, useEffect, useRef, useState } from "react";

import { evaluateClientWithAi, newEvaluationRequestId } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

const IDLE = { loading: false, error: "", result: null, correlationId: "" };

/**
 * Mensagens por status HTTP do endpoint de avaliação (§17 do guia da API).
 *
 * O `422` do backend é deliberadamente genérico (anti-leak: nunca vaza texto de
 * provider nem motivo de grounding), então não adianta repassar o `detail` cru
 * ao consultor — traduzimos para uma ação possível. Os demais status têm causa
 * distinta e merecem mensagem própria, senão tudo vira "erro ao carregar".
 */
const ERROR_BY_STATUS = {
  402: "Você atingiu o limite de uso da IA. Tente novamente mais tarde.",
  403: "Seu plano não inclui a avaliação com IA.",
  404: "Cliente não encontrado na sua carteira.",
  409: "Já existe uma avaliação em andamento para este cliente. Aguarde e tente de novo.",
  422: "Não foi possível gerar a avaliação agora. Tente novamente em instantes.",
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
  useEffect(() => {
    setState(IDLE);
  }, [organizationId]);

  const reset = useCallback(() => setState(IDLE), []);

  const run = useCallback(async () => {
    if (!organizationId || inFlight.current) return;
    inFlight.current = true;
    const correlationId = newEvaluationRequestId();
    setState({ loading: true, error: "", result: null, correlationId });

    try {
      const response = await evaluateClientWithAi(organizationId, correlationId);
      if (!mounted.current) return;
      setState({
        loading: false,
        error: "",
        result: response.output,
        // O backend ecoa o correlation_id definitivo; guardamos o dele, não o nosso.
        correlationId: response.correlation_id || correlationId,
      });
    } catch (err) {
      if (!mounted.current) return;
      const status = err?.response?.status;
      setState({
        loading: false,
        error: ERROR_BY_STATUS[status] || handleApiError(err),
        result: null,
        correlationId,
      });
    } finally {
      inFlight.current = false;
    }
  }, [organizationId]);

  return { ...state, run, reset };
}
