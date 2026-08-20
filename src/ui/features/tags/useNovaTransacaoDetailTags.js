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
        // Só ativas (sem `status: "all"`) — de propósito (achado 1, rodada
        // 5 de review #100, revertendo a rodada 4): o backend `create_tag.py`
        // REATIVA uma tag arquivada quando `POST /tags` bate no mesmo nome
        // (devolve 201, `is_active: true`), só devolve o erro de duplicata
        // pra uma linha JÁ ATIVA. Se este fetch trouxesse arquivadas,
        // `ensureDetailTag` acharia a linha inativa e devolveria o id SEM
        // fazer o POST — a tag nunca seria reativada, o chip ficava preso
        // em "(indisponível)" pra sempre e a trava de submit bloqueava o
        // save. Sem `status`, digitar o nome arquivado cai em `createTag`,
        // que reativa e devolve a tag ativa de verdade — comportamento
        // correto original, preservado.
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
      // `allDetail` é limpo ANTES do fetch disparar (ver comentário acima, no
      // efeito) para não resolver contra a organização ANTERIOR — mas isso
      // alarga a janela em que `allDetail` está vazio de propósito enquanto o
      // catálogo real ainda está a caminho. Sem esta guarda, `findDetailForParentAndLabel`
      // nunca encontra a tag que JÁ EXISTE nesse intervalo (lista vazia) e
      // `ensureDetailTag` cria uma tag duplicada (fincla-frontend#101) — em
      // vez de aceitar o clique e mentir, falha fechado com aviso visível
      // (mesmo padrão de fail-closed do achado 4 na revisão da PR #96).
      if (loading) {
        throw new Error("Ainda carregando as tags — tente novamente em instantes.");
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
      loading,
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
