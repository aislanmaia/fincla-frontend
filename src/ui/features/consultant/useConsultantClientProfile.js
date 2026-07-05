import { useEffect, useState } from "react";

import { getConsultantClientProfile } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

const EMPTY = { loading: false, error: "", profile: null, hasLoaded: false };

/**
 * Carrega `GET /v1/consultant/clients/{org_id}/profile` — o perfil privado
 * (notas/tags/…) que o consultor gravou no "Adicionar cliente" — para o card
 * "Notas do consultor" do relatório. Degrada em silêncio se o endpoint ainda não
 * estiver no ar (o front cai no estado vazio). Mesmo padrão dos hooks do consultor.
 */
export function useConsultantClientProfile({ organizationId, enabled = true } = {}) {
  const [state, setState] = useState(EMPTY);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setState(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setState({ ...EMPTY, loading: true });
    getConsultantClientProfile(organizationId)
      .then((profile) => {
        if (cancelled) return;
        setState({ loading: false, error: "", profile, hasLoaded: true });
      })
      .catch((err) => {
        if (!cancelled) setState({ ...EMPTY, error: handleApiError(err), hasLoaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, enabled]);

  return state;
}
