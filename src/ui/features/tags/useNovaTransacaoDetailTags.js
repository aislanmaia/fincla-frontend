import { useCallback, useEffect, useMemo, useState } from "react";
import { createTag, listTags, listTagTypes } from "../../../api/tags";
import { detailLabelPtForTag } from "../../data/categoryLabels.js";

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

let cachedDetailTagTypeId = null;

async function resolveDetailTagTypeId() {
  if (cachedDetailTagTypeId) return cachedDetailTagTypeId;
  const res = await listTagTypes();
  const rows = res.tag_types ?? [];
  const found =
    rows.find((t) => normalizeLabel(t.name) === "detalhe") ??
    rows.find((t) => normalizeLabel(t.name) === "detail");
  cachedDetailTagTypeId = found?.id ?? null;
  return cachedDetailTagTypeId;
}

/**
 * Tags API tipo `detalhe` filtradas pela categoria (pai) selecionada no modal,
 * mais helper para criar tag de detalhe sob demanda (ex.: atalhos «família»).
 */
export function useNovaTransacaoDetailTags({
  organizationId,
  categoryTagId,
  enabled,
}) {
  const [allDetail, setAllDetail] = useState([]);
  const [detailTypeId, setDetailTypeId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !organizationId) {
      setAllDetail([]);
      setDetailTypeId(null);
      setLoading(false);
      setError("");
      return;
    }
    let cancelled = false;
    // Limpa ANTES de disparar o fetch: sem isso, trocar de organização deixa
    // uma janela em que `allDetail` ainda tem as tags da org ANTERIOR — um
    // `ensureDetailTag`/`findByLabel` chamado nessa janela resolveria (ou
    // criaria) contra a organização errada, silenciosamente (mesma classe de
    // bug do achado 4 na revisão da PR #96, aplicada aqui por simetria).
    setAllDetail([]);
    (async () => {
      setLoading(true);
      setError("");
      try {
        const typeId = await resolveDetailTagTypeId();
        if (cancelled) return;
        setDetailTypeId(typeId);
        // `status: "all"` (não só ativas): sem isso, `ensureDetailTag` nunca
        // encontra uma tag ARQUIVADA pelo nome — o quick-add tenta criar de
        // novo, e o backend (que checa duplicata incluindo linhas inativas)
        // devolve "Tag '...' already exists for this organization", uma
        // string em inglês direto no erro de envio, sem chip nenhum (achado
        // 2, rodada 4 de review #100). Linhas inativas ficam de fora da
        // lista de SUGESTÕES clicáveis (NovaTransacaoModal.jsx,
        // `detailTagRowsAvailable`) — só entram aqui pra resolução por nome.
        const { tags } = await listTags(organizationId, "detalhe", { status: "all" });
        if (cancelled) return;
        setAllDetail(tags ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(
            typeof e?.message === "string" ? e.message : "Falha ao carregar tags",
          );
          setAllDetail([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId]);

  const rowsForCategory = useMemo(() => {
    if (!categoryTagId) return [];
    const pid = String(categoryTagId);
    return allDetail.filter(
      (t) =>
        t.parent_category_tag_id != null &&
        String(t.parent_category_tag_id) === pid,
    );
  }, [allDetail, categoryTagId]);

  /**
   * Duas passadas, nunca uma condição "ou" única: nome cru exato em TODOS os
   * candidatos primeiro, só then rótulo PT traduzido. Com "grocery" (seed) e
   * "mercado" (do usuário) na mesma categoria, uma única passada com `||`
   * podia bater no rótulo traduzido de "grocery" antes de olhar o nome cru
   * de "mercado" — o clique no chip "mercado" salvava o id do seed, e como
   * os dois exibem o mesmo texto, o erro é invisível pro usuário.
   */
  function findByRawNameThenLabel(candidates, n) {
    const byRawName = candidates.find((t) => normalizeLabel(t.name) === n);
    if (byRawName) return byRawName;
    return candidates.find((t) => normalizeLabel(detailLabelPtForTag(t)) === n) ?? null;
  }

  const findByLabel = useCallback(
    (label) => findByRawNameThenLabel(rowsForCategory, normalizeLabel(label)),
    [rowsForCategory],
  );

  const findDetailForParentAndLabel = useCallback((parentId, label) => {
    if (!parentId) return null;
    const pid = String(parentId);
    const candidates = allDetail.filter(
      (t) => t.parent_category_tag_id != null && String(t.parent_category_tag_id) === pid,
    );
    return findByRawNameThenLabel(candidates, normalizeLabel(label));
  }, [allDetail]);

  const ensureDetailTag = useCallback(
    async (label, parentCategoryOverride = null) => {
      if (!organizationId) {
        throw new Error("Sem organização ou categoria");
      }
      const parent =
        parentCategoryOverride != null && String(parentCategoryOverride) !== ""
          ? String(parentCategoryOverride)
          : categoryTagId != null
            ? String(categoryTagId)
            : "";
      if (!parent) {
        throw new Error("Sem organização ou categoria");
      }
      const trimmed = String(label || "").trim();
      if (!trimmed) throw new Error("Tag vazia");
      const existing = findDetailForParentAndLabel(parent, trimmed);
      if (existing) return existing.id;
      let typeId = detailTypeId ?? (await resolveDetailTagTypeId());
      if (!typeId) {
        throw new Error('Tipo de tag "detalhe" não encontrado no servidor');
      }
      const created = await createTag(organizationId, {
        name: trimmed,
        tag_type_id: typeId,
        parent_category_tag_id: parent,
      });
      setDetailTypeId(typeId);
      setAllDetail((prev) => {
        if (prev.some((p) => p.id === created.id)) return prev;
        return [...prev, created];
      });
      return created.id;
    },
    [
      organizationId,
      categoryTagId,
      detailTypeId,
      findDetailForParentAndLabel,
    ],
  );

  const labelForDetailId = useCallback(
    (id) => {
      const row = allDetail.find((t) => String(t.id) === String(id));
      if (!row) return String(id);
      // `row.name` pode vir cru do seed (ex. "health_plan") — traduz pro chip.
      return detailLabelPtForTag(row) || row.name || String(id);
    },
    [allDetail],
  );

  return {
    allDetailTags: allDetail,
    detailTagRowsForCategory: rowsForCategory,
    loading,
    error,
    findByLabel,
    ensureDetailTag,
    labelForDetailId,
  };
}
