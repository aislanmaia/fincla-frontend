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
    (async () => {
      setLoading(true);
      setError("");
      try {
        const typeId = await resolveDetailTagTypeId();
        if (cancelled) return;
        setDetailTypeId(typeId);
        const { tags } = await listTags(organizationId, "detalhe");
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

  // Casa pelo nome cru OU pelo rótulo PT exibido: a tag seed "grocery" aparece
  // na tela como "mercado", e é isso que o usuário digita de volta (PR #96
  // resolve a tag por este mesmo caminho). Comparar só com o nome cru nunca
  // acha a tag seed e cria duplicata a cada vez.
  const matchesLabel = useCallback(
    (t, n) => normalizeLabel(t.name) === n || normalizeLabel(detailLabelPtForTag(t)) === n,
    [],
  );

  const findByLabel = useCallback(
    (label) => {
      const n = normalizeLabel(label);
      return rowsForCategory.find((t) => matchesLabel(t, n)) ?? null;
    },
    [rowsForCategory, matchesLabel],
  );

  const findDetailForParentAndLabel = useCallback((parentId, label) => {
    if (!parentId) return null;
    const n = normalizeLabel(label);
    const pid = String(parentId);
    return (
      allDetail.find(
        (t) =>
          t.parent_category_tag_id != null &&
          String(t.parent_category_tag_id) === pid &&
          matchesLabel(t, n),
      ) ?? null
    );
  }, [allDetail, matchesLabel]);

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
