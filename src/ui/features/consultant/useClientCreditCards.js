import { useEffect, useState } from "react";

import { listCreditCardsForUi } from "../../data/creditCardsAdapter.js";
import { handleApiError } from "../../../api/client";

const EMPTY = { loading: false, error: "", cards: [], hasLoaded: false };

/**
 * Carrega os cartões + fatura corrente da org do cliente para a aba "Cartões" do
 * relatório (RF.3). Reusa o `listCreditCardsForUi` (mesmo caminho da página de
 * cartões do cliente — resolve a fatura em aberto pelo ciclo de fechamento e
 * garante números idênticos). Gated por aba aberta (`enabled`), guard `cancelled`,
 * `hasLoaded` para distinguir "carregando" de "carregado-vazio".
 */
export function useClientCreditCards({ organizationId, enabled = true }) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    listCreditCardsForUi(organizationId)
      .then((res) => {
        if (cancelled) return;
        setState({ loading: false, error: "", cards: res.cards ?? [], hasLoaded: true });
      })
      .catch((err) => {
        if (!cancelled) setState({ ...EMPTY, error: handleApiError(err), hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId]);

  return state;
}
