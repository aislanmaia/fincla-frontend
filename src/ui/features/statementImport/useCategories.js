// As categorias e as etiquetas da organização, para o formulário do item novo das conciliações (o
// extrato, fincla-api#513, e a fatura, #557): só as ativas, em ordem alfabética. Cada etiqueta
// pertence a uma categoria (`parent_category_tag_id`). O erro é a frase a mostrar na tela.
import { useEffect, useState } from "react";

import { listTags } from "../../../api/tags";

const byLabel = (a, b) => (a.label || a.name).localeCompare(b.label || b.name, "pt-BR");

export function useCategories(organizationId) {
  const [categories, setCategories] = useState([]);
  const [details, setDetails] = useState([]);
  const [error, setError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  useEffect(() => {
    if (!organizationId) return undefined;
    let alive = true;
    listTags(organizationId, "categoria")
      .then((res) => {
        if (!alive) return;
        const active = (res.tags ?? []).filter((t) => t.is_active !== false);
        setCategories(active.sort(byLabel));
      })
      .catch(() => { if (alive) setError("Não foi possível carregar as suas categorias. Recarregue a página para escolher uma."); });
    // Etiquetas (fincla-api#513): cada uma pertence a uma categoria (`parent_category_tag_id`).
    listTags(organizationId, "detalhe")
      .then((res) => {
        if (alive) setDetails((res.tags ?? []).filter((t) => t.is_active !== false && t.parent_category_tag_id).sort(byLabel));
      })
      .catch(() => { if (alive) setDetailsError("Não foi possível carregar as suas etiquetas. Recarregue a página para escolher uma."); });
    return () => { alive = false; };
  }, [organizationId]);
  // Sem categorias não há etiqueta a escolher: o aviso das categorias vem primeiro.
  return { categories, details, error: error || detailsError };
}
