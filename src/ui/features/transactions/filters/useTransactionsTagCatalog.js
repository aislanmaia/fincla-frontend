import { useEffect, useState } from "react";
import { listTags } from "../../../../api/tags";

function normalizeTypeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Catálogo de tags "filtráveis" na tela de Transações: TODAS as tags da
 * organização, exceto as do tipo "categoria" (essas já têm a facet própria
 * "Categoria"). fincla-frontend#96 achado 6 — a primeira versão desta busca
 * reaproveitava `useNovaTransacaoDetailTags`, que só traz `tag_type=detalhe`
 * porque é isso que o modal Nova transação precisa. Mas o backend tem mais
 * tipos não-categoria (`detalhe`, `contexto`, `local`, `pessoa` — ver
 * fincla-api seed_tag_types.py) e a LINHA da transação mostra qualquer um
 * deles (`pickTagNames` em transactionsAdapter.js só exclui categoria). Uma
 * tag "contexto" aparecia na linha mas nunca no painel de filtro — visível,
 * mas impossível de selecionar. `listTags(organizationId)` sem `tag_type`
 * devolve o catálogo inteiro (FRONTEND_API_GUIDE.md ~L2151); filtramos
 * categoria no cliente.
 */
export function useTransactionsTagCatalog({ organizationId, enabled }) {
  const [rows, setRows] = useState([]);
  // Começa `true` quando já dá pra saber que uma busca vai disparar (mesmo
  // padrão do `useCalendarData`/`useCreditCardsData`) — do contrário o
  // PRIMEIRO quadro do componente lê `loading:false` antes do `useEffect`
  // rodar, `resolveTagFilterStatus` não vê "carregando" e uma tag ainda não
  // resolvida nesse instante acusa "tag não encontrada" (fincla-frontend#101).
  const [loading, setLoading] = useState(() => Boolean(enabled && organizationId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !organizationId) {
      setRows([]);
      setLoading(false);
      setError("");
      return undefined;
    }
    let cancelled = false;
    // Limpa ANTES de disparar o fetch: sem isso, trocar de organização deixa
    // uma janela em que `rows` ainda tem as tags da org ANTERIOR — um nome
    // resolvido nessa janela filtraria pelo id de outra organização, e a
    // troca ficaria com resultado errado sem nenhum aviso (achado 4).
    setRows([]);
    setLoading(true);
    setError("");
    (async () => {
      try {
        const { tags } = await listTags(organizationId);
        if (cancelled) return;
        // O adapter aceita as duas grafias do tipo categoria ("categoria" e
        // "category" — ver isApiTagTypeCategory em transactionsAdapter.js);
        // esta checagem só cobria "categoria" e deixava tag de categoria
        // vazar pro catálogo de filtro quando o backend mandava "category"
        // (fincla-frontend#101).
        const filtered = (tags ?? []).filter((t) => {
          const typeName = normalizeTypeName(t?.tag_type?.name);
          return typeName !== "categoria" && typeName !== "category";
        });
        setRows(filtered);
      } catch (e) {
        if (!cancelled) {
          setError(
            typeof e?.message === "string" ? e.message : "Falha ao carregar tags",
          );
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId]);

  return { rows, loading, error };
}
