import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";

import { createTag, deleteTag, listTags, listTagTypes, updateTag as apiUpdateTag } from "../../../api/tags";
import { handleApiError } from "../../../api/client";
import {
  categoryLabelPtForTag,
  detailLabelPtForTag,
  resolveCategoryColorForTag,
} from "../../data/categoryLabels.js";
import { CardEmptyWithCta } from "../shellExtras.jsx";
import { Btn } from "../../components/primitives.jsx";
import { T } from "../../tokens";
import { G } from "../../typography";
import { CATEGORY_ICON_KEYS } from "../../data/categoryLucideIcons.js";
import { getCategoryLucideIcon } from "../../data/categoryLucideIcons.js";
import { CategoryLucideIcon } from "../../components/CategoryLucideIcon.jsx";

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatTagName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
}

function resolveTagTypeId(rows, names) {
  return (
    rows.find((row) => names.includes(normalizeLabel(row.name)))?.id ?? null
  );
}

function getTagName(tag) {
  return typeof tag === "string" ? tag : tag?.name ?? "";
}

/**
 * Rótulo PT-BR de exibição de uma tag "detalhe". O seed cria filhas em inglês
 * (`grocery`, `health_plan`...) pra toda organização nova — sem isso, a lista
 * de tags da categoria mostra o nome cru da API.
 */
function getTagLabelPt(tag) {
  if (typeof tag === "string") return tag;
  return tag?.label || detailLabelPtForTag(tag) || tag?.name || "";
}

function getTagId(tag, fallback) {
  return typeof tag === "string" ? `local-${fallback}` : tag?.id ?? `local-${fallback}`;
}

function appendTagToCategory(rows, catId, tag) {
  return rows.map((row) =>
    row.id === catId ? { ...row, tags: [...(row.tags || []), tag] } : row,
  );
}

function removeTagFromCategory(rows, catId, tagId, tagIndex) {
  return rows.map((row) =>
    row.id === catId
      ? {
          ...row,
          tags: (row.tags || []).filter((tag, index) => {
            if (tagId) return String(getTagId(tag, index)) !== String(tagId);
            return index !== tagIndex;
          }),
        }
      : row,
  );
}

const DEFAULT_CATEGORIES = [
  { id:"alim",  name:"Alimentação",           color:"#059669", tags:["mercado","restaurante","delivery"] },
  { id:"trans", name:"Transporte",             color:"#2563EB", tags:["combustível","uber","ônibus"] },
  { id:"saude", name:"Saúde",                  color:"#DC2626", tags:["farmácia","médico","plano"] },
  { id:"edu",   name:"Educação",               color:"#7C3AED", tags:["curso","livro"] },
  { id:"lazer", name:"Lazer & Entretenimento", color:"#D97706", tags:["streaming","viagem","bar"] },
  { id:"comp",  name:"Compras Pessoais",        color:"#DC2626", tags:["roupa","eletrônico"] },
  { id:"serv",  name:"Serviços",               color:"#6B7280", tags:[] },
  { id:"assin", name:"Assinaturas & Software",  color:"#0891B2", tags:["saas","app"] },
  { id:"imp",   name:"Impostos & Taxas",        color:"#D97706", tags:["imposto","taxa"] },
  { id:"mor",   name:"Moradia",                color:"#6B7280", tags:["aluguel","energia","água"] },
];

export function CategoriesTagsSettingsPanel({
  isMobile = false,
  dataMode = "mock",
  organizationId = null,
  SectionCard,
}) {
  const liveEnabled = Boolean(organizationId) && dataMode === "live";
  const [cats, setCats] = useState(DEFAULT_CATEGORIES);
  const [catSearch, setCatSearch] = useState("");
  const [expandedCat, setExpandedCat] = useState(null);
  const [newTagInputs, setNewTagInputs] = useState({});
  const [editCat, setEditCat] = useState(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#2563EB");
  const [newCatIconKey, setNewCatIconKey] = useState("tag");
  const [newCatScopes, setNewCatScopes] = useState(["income", "expense", "refund"]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsError, setCatsError] = useState("");
  /** Id da tag existente destacada por ~1.5s quando `addTag` acha duplicata. */
  const [highlightedTagId, setHighlightedTagId] = useState(null);
  const [editingDetail, setEditingDetail] = useState(null);
  const editingCategory = editCat === "new"
    ? { id: "new", name: "", labelPt: "" }
    : cats.find((category) => category.id === editCat) ?? null;

  const filteredCats = cats.filter((c) => {
    const q = catSearch.toLowerCase();
    // Busca tanto pelo nome cru (API) quanto pelo rótulo PT exibido, senão o
    // usuário não acha "Alimentação" digitando o que vê na tela.
    return c.name.toLowerCase().includes(q) || (c.labelPt || "").toLowerCase().includes(q);
  });

  const refreshCats = useCallback(async () => {
    if (!liveEnabled) return;
    setCatsLoading(true);
    setCatsError("");
    try {
      const [categoriesResp, detailResp] = await Promise.all([
        listTags(organizationId, "categoria"),
        listTags(organizationId, "detalhe"),
      ]);
      const rawCategories = categoriesResp.tags ?? [];
      const detailTags = detailResp.tags ?? [];
      setCats(
        rawCategories.map((tag) => ({
          id: tag.id,
          // `name` fica cru (usado pra editar/salvar); `labelPt` é só exibição —
          // o seed cria categorias em inglês (`Food & Groceries`...) pra toda
          // organização nova, e o backend não muda (fora do escopo do frontend).
          name: tag.name,
          labelPt: tag.label || categoryLabelPtForTag(tag),
          systemKey: tag.system_key ?? null,
          customName: tag.custom_name ?? null,
          iconKey: tag.custom_icon_key || tag.icon_key || null,
          allowedTransactionTypes: tag.allowed_transaction_types ?? ["income", "expense", "refund"],
          color: resolveCategoryColorForTag(tag),
          tags: detailTags.filter(
            (detailTag) => String(detailTag.parent_category_tag_id ?? "") === String(tag.id),
          ),
          _tagTypeId: tag.tag_type?.id ?? null,
        })),
      );
    } catch (e) {
      setCatsError(handleApiError(e));
    } finally {
      setCatsLoading(false);
    }
  }, [liveEnabled, organizationId]);

  useEffect(() => { if (liveEnabled) void refreshCats(); }, [liveEnabled, refreshCats]);

  const handleCreateCat = useCallback(async () => {
    if (!newCatName.trim()) return;
    if (liveEnabled) {
      try {
        const typesResp = await listTagTypes();
        const catType = (typesResp.tag_types ?? []).find(t => t.name === "categoria");
        if (!catType) return;
        await createTag(organizationId, { name: newCatName.trim(), tag_type_id: catType.id, color: newCatColor, icon_key: newCatIconKey, allowed_transaction_types: newCatScopes });
        await refreshCats();
      } catch (e) { setCatsError(handleApiError(e)); }
    } else {
      setCats(prev => [...prev, { id: Date.now().toString(), name: newCatName.trim(), color: newCatColor, tags: [] }]);
    }
    setEditCat(null);
  }, [liveEnabled, organizationId, newCatName, newCatColor, refreshCats]);

  const handleUpdateCat = useCallback(async (catId) => {
    const cat = cats.find(c => c.id === catId);
    const trimmed = newCatName.trim();
    const displayedBefore = (cat?.labelPt || cat?.name || "").trim();
    // Input pré-preenche com o rótulo PT (ex. "Alimentação"), não o nome cru
    // ("Food & Groceries"). Só manda `name` novo quando o usuário de fato
    // mudou o que via na tela — senão salvar só a cor (sem tocar o nome)
    // reenviaria o rótulo traduzido como se fosse o nome real e destruiria o
    // nome canônico do seed (ou um nome custom do usuário, ex. "Renda").
    const isSystemCategory = Boolean(cat?.systemKey);
    const nameForPayload = isSystemCategory || !trimmed || trimmed === displayedBefore ? cat?.name : trimmed;
    const customName = isSystemCategory
      ? (trimmed && trimmed !== displayedBefore ? trimmed : null)
      : undefined;
    if (liveEnabled) {
      try {
        await apiUpdateTag(catId, {
          name: nameForPayload,
          color: newCatColor,
          tag_type_id: cat?._tagTypeId,
          ...(isSystemCategory ? { custom_icon_key: newCatIconKey } : { icon_key: newCatIconKey }),
          allowed_transaction_types: newCatScopes,
          ...(isSystemCategory ? { custom_name: customName } : {}),
        });
        await refreshCats();
        setExpandedCat(catId);
      } catch (e) { setCatsError(handleApiError(e)); }
    } else {
      setCats(prev => prev.map(c => c.id === catId ? {...c, name: nameForPayload, color: newCatColor} : c));
    }
    setEditCat(null);
  }, [liveEnabled, cats, newCatName, newCatColor, newCatIconKey, newCatScopes, refreshCats]);

  const handleDeleteCat = useCallback(async (catId) => {
    if (liveEnabled) {
      try {
        await deleteTag(catId);
        await refreshCats();
      } catch (e) { setCatsError(handleApiError(e)); }
    } else {
      setCats(prev => prev.filter(c => c.id !== catId));
    }
  }, [liveEnabled, refreshCats]);

  const addTag = useCallback((cat) => {
    const tagName = formatTagName(newTagInputs[cat.id] || "");
    if (!tagName) return;
    // Compara com o nome cru E com o rótulo PT exibido: o usuário só vê
    // "#mercado" na tela (tradução da tag seed "grocery") — comparar só com
    // o nome cru deixa passar e cria uma tag "mercado" duplicada.
    const existingTag = (cat.tags || []).find(
      (tag) =>
        formatTagName(getTagName(tag)) === tagName ||
        formatTagName(getTagLabelPt(tag)) === tagName,
    );
    if (existingTag) {
      // Já existe (seed ou não) — não duplica, mas também não pode virar um
      // beco sem saída: limpa o campo e pisca o chip existente pra deixar
      // claro que a tag que o usuário procurava já está ali.
      const existingId = String(getTagId(existingTag, 0));
      setNewTagInputs((prev) => ({ ...prev, [cat.id]: "" }));
      setHighlightedTagId(existingId);
      setTimeout(() => {
        setHighlightedTagId((cur) => (cur === existingId ? null : cur));
      }, 1500);
      return;
    }
    void createDetailTag(cat, tagName);
  }, [newTagInputs]);

  const createDetailTag = useCallback(async (cat, tagName) => {
    if (liveEnabled) {
      try {
        const typesResp = await listTagTypes();
        const detailTypeId = resolveTagTypeId(typesResp.tag_types ?? [], ["detalhe", "detail"]);
        if (!detailTypeId) {
          setCatsError('Tipo de tag "detalhe" não encontrado.');
          return;
        }
        const created = await createTag(organizationId, {
          name: tagName,
          tag_type_id: detailTypeId,
          parent_category_tag_id: cat.id,
        });
        setCats((prev) => appendTagToCategory(prev, cat.id, created));
        setNewTagInputs((prev) => ({ ...prev, [cat.id]: "" }));
        setCatsError("");
      } catch (e) {
        setCatsError(handleApiError(e));
      }
      return;
    }
    setCats((prev) => prev.map((c) => (c.id === cat.id ? { ...c, tags: [...(c.tags || []), tagName] } : c)));
    setNewTagInputs((prev) => ({ ...prev, [cat.id]: "" }));
  }, [liveEnabled, organizationId]);

  const removeTag = useCallback(async (cat, tagIndex) => {
    const tag = (cat.tags || [])[tagIndex];
    if (!tag) return;
    if (liveEnabled) {
      const tagId = typeof tag === "string" ? null : tag.id;
      if (!tagId) return;
      try {
        await deleteTag(tagId);
        setCats((prev) => removeTagFromCategory(prev, cat.id, tagId, tagIndex));
        setCatsError("");
      } catch (e) {
        setCatsError(handleApiError(e));
      }
      return;
    }
    setCats((prev) =>
      prev.map((row) =>
        row.id === cat.id
          ? { ...row, tags: (row.tags || []).filter((_, index) => index !== tagIndex) }
          : row,
      ),
    );
  }, [liveEnabled, refreshCats]);

  const updateDetailIcon = useCallback(async (cat, tag, iconKey) => {
    if (!liveEnabled || typeof tag === "string") return;
    try {
      await apiUpdateTag(tag.id, {
        name: tag.name,
        tag_type_id: tag.tag_type.id,
        ...(tag.system_key ? { custom_icon_key: iconKey } : { icon_key: iconKey }),
      });
      await refreshCats();
      setExpandedCat(cat.id);
    } catch (error) {
      setCatsError(handleApiError(error));
    }
  }, [liveEnabled, refreshCats]);

  const saveDetail = useCallback(async () => {
    if (!editingDetail) return;
    const { cat, tag, name, iconKey } = editingDetail;
    try {
      await apiUpdateTag(tag.id, {
        name: tag.system_key ? tag.name : (name.trim() || tag.name),
        tag_type_id: tag.tag_type.id,
        ...(tag.system_key ? { custom_name: name.trim() || null, custom_icon_key: iconKey } : { icon_key: iconKey }),
      });
      await refreshCats();
      setExpandedCat(cat.id);
      setEditingDetail(null);
    } catch (error) { setCatsError(handleApiError(error)); }
  }, [editingDetail, refreshCats]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <SectionCard>
        <div style={{ padding: isMobile ? "14px 16px" : "16px 24px 14px",
          borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center",
          justifyContent:"space-between", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:T.blueLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Tag size={14} color={T.blue}/>
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ ...G, fontSize:15, fontWeight:800, color:T.ink }}>Categorias e Tags</div>
              {!isMobile && <div style={{ ...G, fontSize:12, color:T.inkMid }}>Personalize como suas transações são organizadas</div>}
            </div>
          </div>
          <Btn variant="dark" small={isMobile} onClick={() => { setNewCatName(""); setNewCatColor("#2563EB"); setNewCatIconKey("tag"); setNewCatScopes(["income", "expense", "refund"]); setEditCat("new"); }} style={{ flexShrink: 0 }}>
            <Plus size={12}/>{isMobile ? "Nova" : "Nova categoria"}
          </Btn>
        </div>

        {catsLoading && <div style={{ padding:"12px 24px", ...G, fontSize:13, color:T.inkLight }}>Carregando categorias…</div>}
        {catsError && <div style={{ padding:"12px 24px", ...G, fontSize:12, color:T.red }}>{catsError}</div>}

        <div style={{ padding: isMobile ? "10px 16px" : "12px 24px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:T.bg,
            border:`1px solid ${T.border}`, borderRadius:9, padding:"8px 12px" }}>
            <Search size={13} color={T.inkLight}/>
            <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Buscar categoria…"
              aria-label="Buscar categoria"
              style={{ ...G, flex:1, minWidth:0, border:"none", outline:"none",
                background:"transparent", fontSize:13, color:T.ink }}/>
          </div>
        </div>


        {filteredCats.map((cat, i) => (
          <div key={cat.id} style={{ borderBottom: i < filteredCats.length-1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10,
              padding: isMobile ? "11px 16px" : "11px 24px" }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:cat.color, flexShrink:0 }}/>

              <>
                  <CategoryLucideIcon iconKey={cat.iconKey} labelPt={cat.labelPt || cat.name} size={17} color={cat.color} />
                  <span style={{ ...G, fontSize:13, color:T.ink, flex:1, minWidth:0 }}>{cat.labelPt || cat.name}</span>
                  <Btn variant="ghost" small onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)} aria-label={`Expandir tags de ${cat.labelPt || cat.name}`}
                    style={{ ...G, display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:99,
                      background: expandedCat===cat.id ? `${cat.color}18` : T.grayLight,
                      border:`1px solid ${expandedCat===cat.id ? cat.color+"44" : T.border}`,
                      color: expandedCat===cat.id ? cat.color : T.inkMid,
                      fontSize:11, fontWeight:600, cursor:"pointer", flexShrink:0,
                      transition:"all 0.15s" }}>
                    <Hash size={10}/>
                    {(cat.tags||[]).length}
                  </Btn>
                  <Btn variant="ghost" small onClick={() => { setEditCat(cat.id); setNewCatName(cat.labelPt || cat.name); setNewCatColor(cat.color); setNewCatIconKey(cat.iconKey || "tag"); setNewCatScopes(cat.allowedTransactionTypes || ["income", "expense", "refund"]); }} aria-label={editCat === cat.id ? "Edição aberta" : `Editar categoria ${cat.labelPt || cat.name}`} style={{ padding:5, flexShrink:0 }}>
                    <Pencil size={13} color={T.inkLight}/>
                  </Btn>
                  <Btn variant="ghost" small onClick={() => handleDeleteCat(cat.id)} aria-label={`Excluir categoria ${cat.labelPt || cat.name}`} style={{ padding:5, flexShrink:0 }}>
                    <Trash2 size={13} color={T.red+"66"}/>
                  </Btn>
                </>
            </div>

            {expandedCat === cat.id && (
              <div style={{ padding: isMobile ? "10px 16px 14px 36px" : "10px 24px 14px 44px",
                background:`${cat.color}08`, borderTop:`1px solid ${cat.color}22` }}>
                <div style={{ ...G, fontSize: 11, fontWeight:700, color:cat.color,
                  textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
                  Tags de {cat.labelPt || cat.name}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                  {(cat.tags||[]).map((tag, ti) => {
                    // Tenta criar uma tag que já existe (seed ou não): não duplica, mas
                    // pisca o chip existente por ~1.5s pra dar feedback visual de "já está aqui".
                    const isHighlighted = highlightedTagId === String(getTagId(tag, ti));
                    return (
                      <span key={getTagId(tag, ti)} style={{ ...G, display:"flex", alignItems:"center", gap:5, fontSize:12,
                        background: isHighlighted ? `${cat.color}18` : T.surface,
                        border:`1px solid ${isHighlighted ? cat.color : T.border}`, borderRadius:99,
                        padding:"4px 10px", color:T.inkMid, transition:"all 0.15s" }}>
                        <Btn variant="ghost" small onClick={() => typeof tag !== "string" && setEditingDetail({ cat, tag, name:getTagLabelPt(tag), iconKey:tag.custom_icon_key || tag.icon_key || "tag" })} style={{ padding:0, color:T.inkMid }} aria-label={`Editar tag ${getTagLabelPt(tag)}`}><CategoryLucideIcon iconKey={tag.custom_icon_key || tag.icon_key} labelPt={getTagLabelPt(tag)} size={13} color={cat.color} />#{getTagLabelPt(tag)}</Btn>
                        <Btn variant="ghost" small onClick={() => void removeTag(cat, ti)}
                          aria-label={`Remover tag ${getTagLabelPt(tag)}`}
                          style={{ padding:0, minWidth:14, lineHeight:1, color:T.inkGhost, fontSize:14 }}>×</Btn>
                      </span>
                    );
                  })}
                  {(cat.tags||[]).length === 0 && (
                    <span style={{ ...G, fontSize:12, color:T.inkLight, fontStyle:"italic" }}>
                      Nenhuma tag ainda
                    </span>
                  )}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <div style={{ flex:1, display:"flex", alignItems:"center", gap:6, background:T.surface,
                    border:`1.5px solid ${T.border}`, borderRadius:9, padding:"7px 12px", minWidth:0 }}>
                    <span style={{ ...G, fontSize:12, color:T.inkLight, flexShrink:0 }}>#</span>
                    <input
                       value={newTagInputs[cat.id] || ""}
                       onChange={e => setNewTagInputs(p => ({...p, [cat.id]: e.target.value}))}
                       onKeyDown={e => {
                         if (e.key !== "Enter") return;
                         e.preventDefault();
                         void addTag(cat);
                       }}
                      placeholder="nova tag (Enter)"
                      aria-label={`Nova tag de ${cat.labelPt || cat.name}`}
                      style={{ ...G, flex:1, minWidth:0, border:"none", outline:"none",
                        background:"transparent", fontSize:12, color:T.ink }}/>
                  </div>
                   <Btn variant="dark" small
                     onClick={() => void addTag(cat)}
                     style={{ flexShrink:0 }}>
                     + Tag
                  </Btn>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredCats.length === 0 && (
          <CardEmptyWithCta
            icon="🔍"
            iconSize={26}
            title="Nenhuma categoria encontrada"
            sub={catSearch.trim() ? `Nenhum resultado para «${catSearch.trim()}».` : "Ajuste a busca ou limpe o filtro para ver a lista completa."}
            primaryLabel={catSearch.trim() ? "Limpar busca" : undefined}
            onPrimary={catSearch.trim() ? () => setCatSearch("") : undefined}
          />
        )}
      </SectionCard>
      {editingCategory && (
        <CategoryEditModal
          category={editingCategory}
          isNew={editCat === "new"}
          name={newCatName}
          color={newCatColor}
          iconKey={newCatIconKey}
          scopes={newCatScopes}
          onNameChange={setNewCatName}
          onColorChange={setNewCatColor}
          onIconChange={setNewCatIconKey}
          onScopesChange={setNewCatScopes}
          onCancel={() => setEditCat(null)}
          onSave={() => void (editCat === "new" ? handleCreateCat() : handleUpdateCat(editingCategory.id))}
        />
      )}
      {editingDetail && <DetailEditModal value={editingDetail} onChange={setEditingDetail} onCancel={() => setEditingDetail(null)} onSave={() => void saveDetail()} />}
    </div>
  );
}

function EditorModal({ eyebrow, title, children, onCancel, onSave, saveLabel = "Salvar" }) {
  return (
    <div onClick={onCancel} style={{ position:"fixed", inset:0, zIndex:60, background:"rgba(15,15,13,.28)", display:"grid", placeItems:"center", padding:16 }}>
      <div onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title} style={{ width:"min(680px, 100%)", maxHeight:"90dvh", display:"flex", flexDirection:"column", background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, boxShadow:T.lg }}>
        <header style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ ...G, fontSize:11, fontWeight:700, color:T.blue, letterSpacing:".08em", textTransform:"uppercase" }}>{eyebrow}</div><h2 style={{ ...G, margin:"3px 0 0", fontSize:18, fontWeight:800, color:T.ink }}>{title}</h2></div>
          <Btn variant="ghost" small onClick={onCancel} aria-label="Fechar" style={{ width:32, height:32, padding:0 }}><X size={18}/></Btn>
        </header>
        <div style={{ padding:"18px 20px", overflowY:"auto" }}>{children}</div>
        <footer style={{ display:"flex", justifyContent:"flex-end", gap:9, padding:"14px 20px", borderTop:`1px solid ${T.border}` }}><Btn variant="outGray" onClick={onCancel}>Cancelar</Btn><Btn variant="dark" onClick={onSave}>{saveLabel}</Btn></footer>
      </div>
    </div>
  );
}

function DetailEditModal({ value, onChange, onCancel, onSave }) {
  return <EditorModal eyebrow="Etiqueta" title="Editar etiqueta" onCancel={onCancel} onSave={onSave}>
    <div style={{ display:"grid", gap:18 }}>
      <label style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid }}>Nome<input value={value.name} onChange={e=>onChange({...value,name:e.target.value})} style={{ ...G, display:"block", width:"100%", boxSizing:"border-box", marginTop:7, padding:"11px 12px", border:`1.5px solid ${T.border}`, borderRadius:10, fontSize:14, color:T.ink }}/></label>
      <IconPicker value={value.iconKey} onChange={iconKey=>onChange({...value,iconKey})}/>
    </div>
  </EditorModal>;
}

function CategoryEditModal({ category, isNew, name, color, iconKey, scopes, onNameChange, onColorChange, onIconChange, onScopesChange, onCancel, onSave }) {
  return <EditorModal eyebrow="Categoria" title={isNew ? "Nova categoria" : "Editar categoria"} onCancel={onCancel} onSave={onSave} saveLabel={isNew ? "Criar categoria" : "Salvar alterações"}>
    <div style={{ display:"grid", gap:20 }}>
      <label style={{ ...G, display:"grid", gap:7, fontSize:12, fontWeight:600, color:T.inkMid }}>Nome
        <input aria-label={isNew ? "Nome da categoria" : `Editar categoria ${category.labelPt || category.name}`} autoFocus value={name} onChange={(event)=>onNameChange(event.target.value)} style={{ ...G, padding:"11px 12px", border:`1.5px solid ${T.border}`, borderRadius:10, fontSize:14, color:T.ink }} />
      </label>
      <div style={{ display:"flex", gap:12, alignItems:"center" }}><div style={{ width:42, height:42, borderRadius:10, background:`${color}18`, display:"grid", placeItems:"center" }}><CategoryLucideIcon iconKey={iconKey} size={22} color={color} /></div><label style={{ ...G, fontSize:12, fontWeight:600, color:T.inkMid }}>Cor <input type="color" value={color} onChange={(event)=>onColorChange(event.target.value)} aria-label="Cor da categoria" style={{ verticalAlign:"middle", marginLeft:8, width:34, height:30 }} /></label></div>
      <IconPicker value={iconKey} onChange={onIconChange} />
      <ScopePicker scopes={scopes} onChange={onScopesChange} />
    </div>
  </EditorModal>;
}

function IconPicker({ value, onChange }) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState(0); const pageSize = 24;
  const icons = useMemo(() => CATEGORY_ICON_KEYS.filter((key) => key.includes(query.toLowerCase())), [query]);
  const visible = icons.slice(page * pageSize, (page + 1) * pageSize);
  return <section><div style={{ ...G, display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}><strong style={{ fontSize:12, color:T.inkMid }}>Ícone</strong><input value={query} onChange={(event)=>{setQuery(event.target.value);setPage(0);}} placeholder="Buscar ícone" aria-label="Buscar ícone" style={{ ...G, padding:"7px 9px", border:`1px solid ${T.border}`, borderRadius:7, width:170 }} /></div><div style={{ display:"grid", gridTemplateColumns:"repeat(8, 1fr)", gap:6 }}>{visible.map((key)=>{const Icon=getCategoryLucideIcon(key);const selected=key===value;return <Btn key={key} variant={selected ? "dark" : "outGray"} small onClick={()=>onChange(key)} aria-label={`Selecionar ícone ${key.replaceAll("-", " ")}`} style={{ height:38, padding:0 }}><Icon size={17} color={selected?"#fff":T.inkMid}/></Btn>;})}</div><div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}><span style={{ ...G, fontSize:11, color:T.inkGhost }}>{icons.length} ícones</span><div style={{ display:"flex", gap:6 }}><Btn variant="outGray" small disabled={!page} onClick={()=>setPage(page-1)}>Anterior</Btn><Btn variant="outGray" small disabled={(page+1)*pageSize>=icons.length} onClick={()=>setPage(page+1)}>Próxima</Btn></div></div></section>;
}

function ScopePicker({ scopes, onChange }) { const rows=[["income","Receita","Entradas como salário, vendas e reembolsos recebidos."],["expense","Despesa","Saídas e gastos pagos pela conta."],["refund","Estorno","Entrada vinculada a uma devolução ou correção."]]; return <section><strong style={{ ...G, fontSize:12, color:T.inkMid }}>Está disponível para</strong><div style={{ display:"grid", gap:7, marginTop:8 }}>{rows.map(([key,label,description])=>{const active=scopes.includes(key);return <Btn key={key} variant={active ? "dark" : "outGray"} onClick={()=>onChange(active?scopes.filter((item)=>item!==key):[...scopes,key])} style={{ minHeight:60, whiteSpace:"normal", textAlign:"left", alignItems:"flex-start", flexDirection:"column", padding:"10px 12px" }}><b>{active?"✓ ":""}{label}</b><span style={{ display:"block", fontSize:12, fontWeight:500, color:active?"rgba(255,255,255,.72)":T.inkGhost, marginTop:2 }}>{description}</span></Btn>;})}</div></section>; }
