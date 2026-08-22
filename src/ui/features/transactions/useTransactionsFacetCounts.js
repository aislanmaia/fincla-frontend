import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildTransactionsFacetsQuery,
  getTransactionsFacetsForUi,
} from "../../data/transactionsAdapter.js";

/**
 * Contagens por opção do painel de filtro (`GET /v1/transactions/facets`).
 *
 * Semântica que a UI precisa respeitar — é a mesma do backend: cada número
 * responde «quantas linhas eu teria se marcasse ESTA opção», com todos os
 * OUTROS filtros aplicados. Consequência: as opções de uma facet só somam
 * `total` quando o filtro DELA está inativo. Com um filtro próprio ativo elas
 * são hipóteses, não uma partição — por isso nada nesta tela soma as
 * contagens para inferir um total.
 *
 * Preguiçoso de propósito: só busca depois que o painel abre pela primeira
 * vez. Contagem é enfeite informativo, e cobrar uma requisição extra de todo
 * mundo que só quer ver a lista seria pagar caro por um número que ninguém
 * pediu. Depois de aberto uma vez, acompanha as mudanças de filtro — aí o
 * usuário está navegando pelo painel e os números precisam seguir junto.
 *
 * Falha é silenciosa (`counts` volta a `null`): um painel sem números continua
 * inteiramente utilizável, e derrubar o filtro por causa do enfeite seria uma
 * troca ruim.
 */
export function useTransactionsFacetCounts({
  organizationId,
  filters,
  enabled = false,
  refreshToken = 0,
  debounceMs = 220,
}) {
  const [counts, setCounts] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  // Uma vez aberto, segue acompanhando: fechar o painel não deve descartar o
  // que já foi pago, senão reabrir pisca o número de novo a cada visita.
  //
  // O trinco vive num efeito, não no corpo do render: mutar ref durante a
  // renderização é inseguro sob renderização concorrente (um render pode ser
  // descartado e o trinco ficaria ligado sem nunca ter sido comitado). Efeitos
  // do mesmo commit rodam na ordem de declaração, então este roda ANTES do
  // efeito de busca abaixo e a primeira abertura não perde o quadro.
  const everEnabled = useRef(false);
  useEffect(() => {
    if (enabled) everEnabled.current = true;
  }, [enabled]);

  const query = useMemo(() => {
    if (!organizationId) return null;
    return buildTransactionsFacetsQuery({ organizationId, ...filters });
  }, [organizationId, filters]);

  // Assinatura por CONTEÚDO. `filters` é um objeto novo a cada quadro da
  // página (ela recalcula com `visible` maior no scroll infinito), então
  // comparar por referência refaria a busca a cada página carregada — uma
  // requisição por rolagem, para um número que não mudou.
  const signature = query ? JSON.stringify(query) : null;

  useEffect(() => {
    if (!everEnabled.current || !signature) {
      if (!signature) setCounts(null);
      return undefined;
    }
    let cancelled = false;
    setIsLoading(true);
    const timer = setTimeout(() => {
      getTransactionsFacetsForUi(JSON.parse(signature)).then((data) => {
        if (cancelled) return;
        setCounts(data);
        setIsLoading(false);
      });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsLoading(false);
    };
    // `enabled` entra na lista para disparar a PRIMEIRA busca no quadro em que
    // o painel abre — sem ele, `everEnabled` já viraria `true` mas nenhuma
    // dependência teria mudado, e o painel abriria sem número nenhum até o
    // filtro seguinte.
  }, [signature, enabled, refreshToken, debounceMs]);

  /** Contagem de uma opção de facet de lista, ou `null` se não há dado. */
  const optionCount = useCallback(
    (facet, value) => {
      const list = counts?.[facet];
      if (!Array.isArray(list)) return null;
      const hit = list.find((o) => o.value === String(value));
      return hit ? hit.count : 0;
    },
    [counts],
  );

  /** Contagem por RÓTULO — o painel de Tags trabalha com nomes, não com ids. */
  const optionCountByLabel = useCallback(
    (facet, label) => {
      const list = counts?.[facet];
      if (!Array.isArray(list)) return null;
      const hit = list.find((o) => o.label === label);
      return hit ? hit.count : 0;
    },
    [counts],
  );

  /** Contagem de um dos dois desfechos de uma facet binária. */
  const binaryCount = useCallback(
    (facet, key) => {
      const bucket = counts?.[facet];
      if (!bucket || typeof bucket !== "object") return null;
      const n = bucket[key];
      return typeof n === "number" ? n : 0;
    },
    [counts],
  );

  return {
    counts,
    isLoading,
    total: counts?.total ?? null,
    buckets: counts?.value_bucket ?? null,
    optionCount,
    optionCountByLabel,
    binaryCount,
  };
}
