import { useEffect, useState } from "react";
import { getFinancialHealth } from "../../../api/financialHealth";

const EMPTY = { loading: false, error: "", data: null, hasLoaded: false, insufficientData: false };

/** `detail.code` do backend. Ramificamos por ele, nunca por substring da mensagem. */
export const HEALTH_INSUFFICIENT_DATA = "insufficient_data";

const INSUFFICIENT_DATA_MESSAGE =
  "Ainda não há transações registradas. O painel de saúde aparece assim que houver lançamentos.";

/**
 * `detail` já foi uma string; desde a recusa de clientes sem dado é `{code, message}`.
 * Aceitamos as duas formas: um deploy do front pode preceder o do backend.
 */
function readDetail(e) {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return { code: "", message: d };
  if (d && typeof d === "object") return { code: d.code || "", message: d.message || "" };
  return { code: "", message: "" };
}

/**
 * Saúde financeira de uma org.
 *
 * `422 insufficient_data` **não é falha**: é a org sem nenhuma transação. O backend
 * se recusa a pontuar o vazio (antes devolvia 200 com um score de "sinais neutros",
 * e a UI mostrava "Frágil 31" para quem nunca lançou nada). Sinalizamos com
 * `insufficientData` para a tela mostrar um estado vazio, não um erro vermelho.
 */
export function useFinancialHealthData({ organizationId, enabled = true }) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    getFinancialHealth(organizationId)
      .then((data) => {
        if (!cancelled) setState({ ...EMPTY, data, hasLoaded: true });
      })
      .catch((e) => {
        if (cancelled) return;
        const { code, message } = readDetail(e);
        const insufficientData = code === HEALTH_INSUFFICIENT_DATA;
        setState({
          ...EMPTY,
          hasLoaded: true,
          insufficientData,
          error: insufficientData
            ? INSUFFICIENT_DATA_MESSAGE
            : message || e?.message || "Erro ao carregar a saúde financeira.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId]);

  return state;
}
