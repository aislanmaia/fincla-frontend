import { useEffect, useState } from "react";

import { getTransactionsSummary } from "../../../api/transactions";
import { exportFailureMessage } from "./exportFailure.js";
import { withSliceCurrency } from "./sliceCurrency.js";

/**
 * O resumo do recorte que o painel de exportação mostra, para as telas que não têm um resumo do MESMO recorte
 * (fatura, Lançamentos da fatura; fincla-api#525). Pedido só enquanto o painel está aberto (`query` não nulo), com
 * os mesmos filtros que vão ao exportador e com `slice_currency`, como o arquivo calcula.
 *
 * Devolve `{ data, error }`: `data` nulo enquanto carrega; `error` é a mensagem que o painel mostra (nunca engolida).
 */
export function useExportSummary(query) {
  const key = query ? JSON.stringify(query) : null;
  const [state, setState] = useState({ key: null, data: null, error: null });
  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    setState({ key, data: null, error: null });
    getTransactionsSummary(withSliceCurrency({ ...JSON.parse(key), locale: "pt-BR" })).then((data) => {
      if (active) setState({ key, data, error: null });
    }).catch((error) => {
      if (active) setState({ key, data: null, error: exportFailureMessage(error) });
    });
    return () => { active = false; };
  }, [key]);
  return state.key === key ? { data: state.data, error: state.error } : { data: null, error: null };
}
