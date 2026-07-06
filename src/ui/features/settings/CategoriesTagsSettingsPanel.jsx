import React, { useCallback, useEffect, useState } from "react";
import { Hash, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";

import { createTag, deleteTag, listTags, listTagTypes, updateTag as apiUpdateTag } from "../../../api/tags";
import { handleApiError } from "../../../api/client";
import { resolveCategoryColorForTag } from "../../data/categoryLabels.js";
import { CardEmptyWithCta } from "../shellExtras.jsx";
import { T } from "../../tokens";
import { G } from "../../typography";

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
  { id:"rec",   name:"Receita",                color:"#059669", tags:["salário","freelance"] },
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
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsError, setCatsError] = useState("");

  const filteredCats = cats.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));

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
          name: tag.name,
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
        await createTag(organizationId, { name: newCatName.trim(), tag_type_id: catType.id, color: newCatColor });
        await refreshCats();
      } catch (e) { setCatsError(handleApiError(e)); }
    } else {
      setCats(prev => [...prev, { id: Date.now().toString(), name: newCatName.trim(), color: newCatColor, tags: [] }]);
    }
    setEditCat(null);
  }, [liveEnabled, organizationId, newCatName, newCatColor, refreshCats]);

  const handleUpdateCat = useCallback(async (catId) => {
    if (liveEnabled) {
      try {
        const cat = cats.find(c => c.id === catId);
        await apiUpdateTag(catId, { name: newCatName, color: newCatColor, tag_type_id: cat?._tagTypeId });
        await refreshCats();
      } catch (e) { setCatsError(handleApiError(e)); }
    } else {
      setCats(prev => prev.map(c => c.id === catId ? {...c, name: newCatName, color: newCatColor} : c));
    }
    setEditCat(null);
  }, [liveEnabled, cats, newCatName, newCatColor, refreshCats]);

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

  const addTag = useCallback(async (cat) => {
    const tagName = formatTagName(newTagInputs[cat.id] || "");
    const hasTag = (cat.tags || []).some((tag) => formatTagName(getTagName(tag)) === tagName);
    if (!tagName || hasTag) return;
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
  }, [liveEnabled, newTagInputs, organizationId, refreshCats]);

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
          <button onClick={() => { setNewCatName(""); setNewCatColor("#2563EB"); setEditCat("new"); }}
            style={{ ...G, flexShrink:0, background:T.ink, color:"#fff", border:"none", borderRadius:9,
              padding: isMobile ? "7px 12px" : "7px 14px", fontSize: isMobile ? 11 : 12,
              fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
            <Plus size={12}/>{isMobile ? "Nova" : "Nova categoria"}
          </button>
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

        {editCat === "new" && (
          <div style={{ padding: isMobile ? "12px 16px" : "14px 24px",
            borderBottom:`1px solid ${T.border}`, background:T.blueLight }}>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.blue,
              textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Nova categoria</div>
            <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap:8, alignItems: isMobile ? "stretch" : "center" }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nome da categoria" aria-label="Nome da categoria" autoFocus
                style={{ ...G, flex:1, minWidth:0, padding:"9px 12px", border:`1.5px solid ${T.border}`,
                  borderRadius:9, fontSize:13, color:T.ink, background:T.surface, outline:"none" }}/>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} aria-label="Cor da categoria"
                  style={{ width:36, height:36, borderRadius:9, border:`1px solid ${T.border}`,
                    cursor:"pointer", padding:2, flexShrink:0 }}/>
                <button onClick={handleCreateCat} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:9,
                  padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0 }}>Salvar</button>
                <button onClick={() => setEditCat(null)}
                  style={{ ...G, background:"none", color:T.inkMid, border:`1px solid ${T.border}`,
                    borderRadius:9, padding:"8px 12px", fontSize:12, fontWeight:600, cursor:"pointer", flexShrink:0 }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {filteredCats.map((cat, i) => (
          <div key={cat.id} style={{ borderBottom: i < filteredCats.length-1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10,
              padding: isMobile ? "11px 16px" : "11px 24px" }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:cat.color, flexShrink:0 }}/>

              {editCat === cat.id ? (
                <div style={{ flex:1, display:"flex", flexDirection: isMobile ? "column" : "row",
                  gap:8, alignItems: isMobile ? "stretch" : "center", minWidth:0 }}>
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)} aria-label={`Editar categoria ${cat.name}`} autoFocus
                    style={{ ...G, flex:1, minWidth:0, padding:"6px 10px", border:`1.5px solid ${T.blue}`,
                      borderRadius:8, fontSize:13, color:T.ink, background:T.surface, outline:"none" }}/>
                  <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                    <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} aria-label={`Cor da categoria ${cat.name}`}
                      style={{ width:30, height:30, borderRadius:7, border:`1px solid ${T.border}`, cursor:"pointer", padding:2 }}/>
                    <button onClick={() => handleUpdateCat(cat.id)}
                      style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:8,
                        padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>OK</button>
                    <button onClick={() => setEditCat(null)} aria-label={`Cancelar edição de ${cat.name}`}
                      style={{ ...G, background:"none", color:T.inkMid, border:`1px solid ${T.border}`,
                        borderRadius:8, padding:"6px 10px", fontSize:12, cursor:"pointer" }}>×</button>
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ ...G, fontSize:13, color:T.ink, flex:1, minWidth:0 }}>{cat.name}</span>
                  <button onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)} aria-label={`Expandir tags de ${cat.name}`}
                    style={{ ...G, display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:99,
                      background: expandedCat===cat.id ? `${cat.color}18` : T.grayLight,
                      border:`1px solid ${expandedCat===cat.id ? cat.color+"44" : T.border}`,
                      color: expandedCat===cat.id ? cat.color : T.inkMid,
                      fontSize:11, fontWeight:600, cursor:"pointer", flexShrink:0,
                      transition:"all 0.15s" }}>
                    <Hash size={10}/>
                    {(cat.tags||[]).length}
                  </button>
                  <button onClick={() => { setEditCat(cat.id); setNewCatName(cat.name); setNewCatColor(cat.color); }} aria-label={`Editar categoria ${cat.name}`}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:5, borderRadius:7, display:"flex", flexShrink:0 }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.grayLight}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <Pencil size={13} color={T.inkLight}/>
                  </button>
                  <button onClick={() => handleDeleteCat(cat.id)} aria-label={`Excluir categoria ${cat.name}`}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:5, borderRadius:7, display:"flex", flexShrink:0 }}
                    onMouseEnter={e=>e.currentTarget.style.color=T.red}
                    onMouseLeave={e=>e.currentTarget.style.color=T.red+"66"}>
                    <Trash2 size={13} color={T.red+"66"}/>
                  </button>
                </>
              )}
            </div>

            {expandedCat === cat.id && (
              <div style={{ padding: isMobile ? "10px 16px 14px 36px" : "10px 24px 14px 44px",
                background:`${cat.color}08`, borderTop:`1px solid ${cat.color}22` }}>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:cat.color,
                  textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
                  Tags de {cat.name}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                  {(cat.tags||[]).map((tag, ti) => (
                    <span key={getTagId(tag, ti)} style={{ ...G, display:"flex", alignItems:"center", gap:5, fontSize:12,
                      background:T.surface, border:`1px solid ${T.border}`, borderRadius:99,
                      padding:"4px 10px", color:T.inkMid }}>
                      #{getTagName(tag)}
                      <button onClick={() => void removeTag(cat, ti)}
                        aria-label={`Remover tag ${getTagName(tag)}`}
                        style={{ background:"none", border:"none", cursor:"pointer", padding:0, lineHeight:1,
                          color:T.inkGhost, fontSize:14, display:"flex", alignItems:"center" }}>×</button>
                    </span>
                  ))}
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
                      aria-label={`Nova tag de ${cat.name}`}
                      style={{ ...G, flex:1, minWidth:0, border:"none", outline:"none",
                        background:"transparent", fontSize:12, color:T.ink }}/>
                  </div>
                   <button
                     onClick={() => void addTag(cat)}
                     style={{ ...G, flexShrink:0, background:cat.color, color:"#fff", border:"none",
                       borderRadius:9, padding:"8px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                     + Tag
                  </button>
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
    </div>
  );
}
