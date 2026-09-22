import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";

import { getSystemCategoryCatalog } from "../../../api/tags";
import {
  deleteConsultantCategoryTemplate,
  listConsultantCategoryTemplates,
  saveConsultantCategoryTemplate,
} from "../../../api/consultant";
import { handleApiError } from "../../../api/client";
import { Btn, Card } from "../../components/primitives";
import { CategoryLucideIcon } from "../../components/CategoryLucideIcon";
import { CATEGORY_ICON_KEYS, getCategoryLucideIcon } from "../../data/categoryLucideIcons";
import { T } from "../../tokens";
import { G } from "../../typography";

const FALLBACK_CATEGORIES = [
  ["housing", "Moradia", "house", "#6B7280", ["expense"]],
  ["food_groceries", "Alimentação", "shopping-cart", "#059669", ["expense"]],
  ["transport", "Transporte", "car", "#2563EB", ["expense"]],
  ["health", "Saúde", "heart-pulse", "#DC2626", ["expense"]],
  ["education", "Educação", "graduation-cap", "#7C3AED", ["expense"]],
  ["leisure_entertainment", "Lazer e entretenimento", "party-popper", "#D97706", ["expense"]],
  ["work_salary", "Trabalho e salário", "briefcase-business", "#0891B2", ["income"]],
  ["services_provided", "Serviços prestados", "handshake", "#2563EB", ["income"]],
  ["sales", "Vendas", "store", "#059669", ["income"]],
  ["received_transfers", "Transferências recebidas", "arrow-down-left", "#7C3AED", ["income"]],
  ["received_reimbursements", "Reembolsos recebidos", "rotate-ccw", "#D97706", ["income", "refund"]],
].map(([system_key, label, icon_key, color, allowed_transaction_types]) => ({ system_key, label, icon_key, color, allowed_transaction_types, details: [] }));

const SCOPE_OPTIONS = [
  ["income", "Receita", "Entradas como salário, vendas e reembolsos recebidos."],
  ["expense", "Despesa", "Saídas e gastos pagos pela conta."],
  ["refund", "Estorno", "Entrada vinculada a uma devolução ou correção."],
];

function newId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
function detailsFrom(category) { return category?.details ?? []; }
function standardOverrides(template) { return template?.definition?.categories ?? []; }
function customFrom(template) { return template?.definition?.custom_categories ?? []; }
function isConfigured(item) {
  return ["custom_name", "custom_icon_key", "color", "allowed_transaction_types", "is_onboarding_highlight"].some((key) => key in item) || (item.details?.length ?? 0) > 0;
}
function toDefinition(overrides, customCategories) {
  return {
    categories: overrides.filter(isConfigured),
    custom_categories: customCategories
      .filter((category) => category.name?.trim())
      .map((category) => ({
        ...category,
        name: category.name.trim(),
        details: detailsFrom(category)
          .filter((detail) => detail.name?.trim())
          .map((detail) => ({ ...detail, name: detail.name.trim() })),
      })),
  };
}
function templateHighlightCount(template) {
  return [...standardOverrides(template), ...customFrom(template)].filter((item) => item.is_onboarding_highlight).length;
}

export function ConsultantCategoryTemplatesPanel() {
  const [templates, setTemplates] = useState([]);
  const [catalog, setCatalog] = useState(FALLBACK_CATEGORIES);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [overrides, setOverrides] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [isDefault, setIsDefault] = useState(false);
  const [categoryEditor, setCategoryEditor] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try { setTemplates(await listConsultantCategoryTemplates()); setError(""); }
    catch (cause) {
      if (cause?.response?.status === 404) { setTemplates([]); return; }
      setError("Não foi possível carregar os modelos agora. Tente novamente.");
    }
  };
  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    void getSystemCategoryCatalog().then((response) => {
      const categories = response.categories.filter((category) => !category.is_fallback);
      if (categories.length) setCatalog(categories);
    }).catch(() => {});
  }, []);

  const begin = (template = null) => {
    setEditing(template?.id ?? "new");
    setName(template?.name ?? "");
    setOverrides(standardOverrides(template));
    setCustomCategories(customFrom(template));
    setIsDefault(template?.is_default ?? templates.length === 0);
    setCategoryEditor(null);
    setError("");
  };
  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await saveConsultantCategoryTemplate(editing === "new" ? newId() : editing, {
        name: name.trim(), definition: toDefinition(overrides, customCategories), is_default: isDefault,
      });
      setEditing(null);
      await reload();
    } catch (cause) { setError(handleApiError(cause)); }
    finally { setBusy(false); }
  };
  const remove = async (id) => {
    if (busy) return;
    setBusy(true);
    try { await deleteConsultantCategoryTemplate(id); await reload(); }
    catch (cause) { setError(handleApiError(cause)); }
    finally { setBusy(false); }
  };
  const standardOverride = (key) => overrides.find((item) => item.system_key === key) ?? { system_key: key };
  const updateStandard = (key, changes) => setOverrides((items) => {
    const current = items.find((item) => item.system_key === key) ?? { system_key: key };
    return [...items.filter((item) => item.system_key !== key), { ...current, ...changes }];
  });
  const addCustom = () => {
    const category = { id: newId(), name: "", color: "#2563EB", icon_key: "tag", allowed_transaction_types: ["income", "expense"], is_onboarding_highlight: true, details: [] };
    setCustomCategories((items) => [...items, category]);
    setCategoryEditor({ kind: "custom", id: category.id });
  };
  const updateCustom = (id, changes) => setCustomCategories((items) => items.map((item) => item.id === id ? { ...item, ...changes } : item));
  const editorCategory = useMemo(() => {
    if (!categoryEditor) return null;
    if (categoryEditor.kind === "standard") {
      const base = catalog.find((item) => item.system_key === categoryEditor.systemKey);
      if (!base) return null;
      return { ...base, ...standardOverride(base.system_key), base, kind: "standard" };
    }
    const customCategory = customCategories.find((category) => category.id === categoryEditor.id);
    return customCategory ? { ...customCategory, base: null, kind: "custom" } : null;
  }, [categoryEditor, catalog, overrides, customCategories]);
  const saveCategory = (value) => {
    if (value.kind === "standard") {
      const { base, kind, ...override } = value;
      updateStandard(value.system_key, override);
    } else {
      const { base, kind, ...custom } = value;
      updateCustom(value.id, custom);
    }
    setCategoryEditor(null);
  };

  return <Card style={{ padding: 0 }}>
    <div style={headerStyle}>
      <div><div style={titleStyle}>Modelos de categorias</div><div style={subtitleStyle}>Defina um catálogo inicial que será copiado para cada novo cliente.</div></div>
      {!editing && <Btn variant="dark" small onClick={() => begin()}><Plus size={14} />Novo modelo</Btn>}
    </div>
    {error && <div role="alert" style={errorStyle}>{error}</div>}
    {editing ? <div style={{ padding: 20, display: "grid", gap: 20 }}>
      <label style={labelStyle}>Nome do modelo<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Família com filhos" style={inputStyle} /></label>
      <div style={{ display: "grid", gap: 9 }}>
        <div><div style={sectionTitle}>Categorias padrão</div><div style={sectionHint}>Configure nome, ícone, disponibilidade, destaque e etiquetas de cada categoria.</div></div>
        <div style={stackStyle}>{catalog.map((category) => <CategoryRow key={category.system_key} category={{ ...category, ...standardOverride(category.system_key) }} onEdit={() => setCategoryEditor({ kind: "standard", systemKey: category.system_key })} />)}</div>
      </div>
      <div style={{ display: "grid", gap: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><div><div style={sectionTitle}>Categorias próprias</div><div style={sectionHint}>Crie agrupadores exclusivos para a carteira deste consultor.</div></div><Btn variant="outGray" small onClick={addCustom}><Plus size={14} />Adicionar categoria</Btn></div>
        {customCategories.length === 0 ? <div style={emptyStyle}>Nenhuma categoria própria neste modelo.</div> : <div style={stackStyle}>{customCategories.map((category) => <CategoryRow key={category.id} category={category} onEdit={() => setCategoryEditor({ kind: "custom", id: category.id })} onRemove={() => setCustomCategories((items) => items.filter((item) => item.id !== category.id))} />)}</div>}
      </div>
      <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} style={{ accentColor: T.ink }} />Usar como modelo padrão</label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn variant="outGray" onClick={() => setEditing(null)}>Cancelar</Btn><Btn variant="dark" disabled={!name.trim() || busy} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar modelo"}</Btn></div>
    </div> : <div>{templates.length === 0 ? <div style={emptyStyle}>Nenhum modelo salvo. Crie um para repetir sua configuração ao adicionar clientes.</div> : templates.map((template, index) => <div key={template.id} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: index === templates.length - 1 ? "none" : `1px solid ${T.border}` }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>{template.name}{template.is_default && <span style={{ marginLeft: 8, color: T.purple, fontSize: 11 }}>Padrão</span>}</div><div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 3 }}>{templateHighlightCount(template)} categorias em destaque</div></div><Btn variant="ghost" small aria-label={`Editar ${template.name}`} onClick={() => begin(template)}><Pencil size={14} /></Btn><Btn variant="ghost" small aria-label={`Excluir ${template.name}`} onClick={() => void remove(template.id)}><Trash2 size={14} color={T.red} /></Btn></div>)}</div>}
    {editorCategory && <CategoryTemplateModal category={editorCategory} onCancel={() => setCategoryEditor(null)} onSave={saveCategory} />}
  </Card>;
}

function CategoryRow({ category, onEdit, onRemove }) {
  const iconKey = category.custom_icon_key || category.icon_key;
  const label = category.custom_name || category.label || category.name || "Nova categoria";
  return <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", border: `1px solid ${T.border}`, borderRadius: 10 }}>
    <div style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 9, background: `${category.color || T.blue}16`, flexShrink: 0 }}><CategoryLucideIcon iconKey={iconKey} labelPt={label} color={category.color || T.blue} size={17} /></div>
    <div style={{ minWidth: 0, flex: 1 }}><div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink }}>{label}</div><div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>{detailsFrom(category).length} etiquetas{category.is_onboarding_highlight && <span style={{ color: T.blue, marginLeft: 7 }}>• em destaque</span>}</div></div>
    <Btn variant="outGray" small onClick={onEdit}>Configurar<ChevronRight size={13} /></Btn>
    {onRemove && <Btn variant="ghost" small aria-label={`Remover ${label}`} onClick={onRemove}><Trash2 size={14} color={T.red} /></Btn>}
  </div>;
}

function CategoryTemplateModal({ category, onCancel, onSave }) {
  const [value, setValue] = useState(category);
  const [picking, setPicking] = useState("category");
  const isStandard = value.kind === "standard";
  const baseDetails = detailsFrom(value.base);
  const overrides = detailsFrom(value);
  const details = isStandard ? baseDetails.map((detail) => ({ ...detail, ...(overrides.find((item) => item.system_key === detail.system_key) ?? {}) })).concat(overrides.filter((detail) => !detail.system_key)) : overrides;
  const update = (changes) => setValue((current) => ({ ...current, ...changes }));
  const updateDetail = (index, changes) => update({ details: details.map((detail, itemIndex) => itemIndex === index ? { ...detail, ...changes } : detail) });
  const addDetail = () => update({ details: [...details, { id: newId(), name: "", icon_key: "tag" }] });
  const removeDetail = (index) => update({ details: details.filter((_, itemIndex) => itemIndex !== index) });
  const chooseIcon = (iconKey) => {
    if (picking === "category") {
      update(isStandard ? { custom_icon_key: iconKey } : { icon_key: iconKey });
      return;
    }
    const selectedDetail = details[picking];
    updateDetail(picking, isStandard && selectedDetail?.system_key ? { custom_icon_key: iconKey } : { icon_key: iconKey });
  };
  const displayedIcon = (detail) => detail.custom_icon_key || detail.icon_key || "tag";
  return <div onClick={onCancel} style={overlayStyle}><div role="dialog" aria-modal="true" aria-label={isStandard ? `Configurar ${value.label}` : "Configurar categoria própria"} onClick={(event) => event.stopPropagation()} style={modalStyle}>
    <header style={modalHeaderStyle}><div><div style={eyebrowStyle}>{isStandard ? "Categoria padrão" : "Categoria própria"}</div><h2 style={modalTitleStyle}>{isStandard ? `Configurar ${value.label}` : "Configurar categoria"}</h2></div><Btn variant="ghost" small aria-label="Fechar" onClick={onCancel} style={{ width: 32, height: 32, padding: 0 }}><X size={18} /></Btn></header>
    <div style={{ padding: "20px", overflowY: "auto", display: "grid", gap: 20 }}>
      <label style={labelStyle}>Nome para o cliente<input autoFocus={!isStandard} value={isStandard ? (value.custom_name ?? value.label) : value.name} onChange={(event) => update(isStandard ? { custom_name: event.target.value } : { name: event.target.value })} style={inputStyle} /></label>
      <div style={{ display: "grid", gap: 8 }}><div style={sectionTitle}>Disponibilidade</div><div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 7 }}>{SCOPE_OPTIONS.map(([scope, label, description]) => { const selected = (value.allowed_transaction_types ?? []).includes(scope); return <Btn key={scope} variant={selected ? "dark" : "outGray"} onClick={() => { const scopes = value.allowed_transaction_types ?? []; if (selected && scopes.length === 1) return; update({ allowed_transaction_types: selected ? scopes.filter((item) => item !== scope) : [...scopes, scope] }); }} style={{ height: 62, whiteSpace: "normal", textAlign: "left", alignItems: "flex-start", flexDirection: "column", padding: "9px 10px" }}><span>{selected && <Check size={12} />} {label}</span><span style={{ fontSize: 10, fontWeight: 500, color: selected ? "rgba(255,255,255,.72)" : T.inkLight, lineHeight: 1.25 }}>{description}</span></Btn>; })}</div></div>
      <Btn variant={value.is_onboarding_highlight ? "dark" : "outGray"} onClick={() => update({ is_onboarding_highlight: !value.is_onboarding_highlight })} style={{ justifyContent: "flex-start" }}><Sparkles size={15} />{value.is_onboarding_highlight ? "Em destaque no onboarding" : "Destacar esta categoria no onboarding"}</Btn>
      <IconPicker value={value.custom_icon_key || value.icon_key || "tag"} color={value.color || T.blue} onChange={chooseIcon} />
      <label style={labelStyle}>Cor<input type="color" value={value.color || T.blue} onChange={(event) => update({ color: event.target.value })} aria-label="Cor da categoria" style={{ display: "block", marginTop: 7, width: 42, height: 32, padding: 2, border: `1px solid ${T.border}`, borderRadius: 7 }} /></label>
      <div style={{ display: "grid", gap: 9 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={sectionTitle}>Etiquetas</div><div style={sectionHint}>São opcionais e ajudam a detalhar as transações.</div></div><Btn variant="outGray" small onClick={addDetail}><Plus size={13} />Etiqueta</Btn></div>
        <div style={stackStyle}>{details.map((detail, index) => <div key={detail.system_key || detail.id || index} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 32px", gap: 8, alignItems: "center", padding: 8, border: `1px solid ${T.border}`, borderRadius: 9 }}><Btn variant={picking === index ? "dark" : "outGray"} small aria-label={`Escolher ícone de ${detail.label || detail.name || "etiqueta"}`} onClick={() => setPicking(index)} style={{ width: 34, height: 32, padding: 0 }}><CategoryLucideIcon iconKey={displayedIcon(detail)} labelPt={detail.label || detail.name} size={15} color={picking === index ? "#fff" : value.color || T.blue} /></Btn><input value={isStandard && detail.system_key ? (detail.custom_name ?? detail.label ?? "") : (detail.name ?? "")} onChange={(event) => updateDetail(index, isStandard && detail.system_key ? { custom_name: event.target.value } : { name: event.target.value })} style={{ ...inputStyle, marginTop: 0, padding: "8px 9px" }} aria-label="Nome da etiqueta" />{!detail.system_key ? <Btn variant="ghost" small aria-label="Remover etiqueta" onClick={() => removeDetail(index)} style={{ width: 32, height: 32, padding: 0 }}><Trash2 size={14} color={T.red} /></Btn> : <span />}</div>)}</div>
      </div>
    </div>
    <footer style={modalFooterStyle}><Btn variant="outGray" onClick={onCancel}>Cancelar</Btn><Btn variant="dark" disabled={!(isStandard ? (value.custom_name ?? value.label).trim() : value.name.trim())} onClick={() => onSave(value)}>Salvar categoria</Btn></footer>
  </div></div>;
}

function IconPicker({ value, color, onChange }) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState(0); const pageSize = 24;
  const icons = useMemo(() => CATEGORY_ICON_KEYS.filter((key) => key.includes(query.toLowerCase())), [query]);
  const visible = icons.slice(page * pageSize, (page + 1) * pageSize);
  return <section><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}><div style={sectionTitle}>Ícone</div><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Buscar ícone" aria-label="Buscar ícone" style={{ ...inputStyle, marginTop: 0, width: 170, padding: "8px 10px" }} /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0,1fr))", gap: 6 }}>{visible.map((key) => { const Icon = getCategoryLucideIcon(key); const selected = key === value; return <Btn key={key} variant={selected ? "dark" : "outGray"} small aria-label={`Selecionar ícone ${key.replaceAll("-", " ")}`} onClick={() => onChange(key)} style={{ width: "100%", height: 36, padding: 0 }}><Icon size={16} color={selected ? "#fff" : T.inkMid} /></Btn>; })}</div><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}><span style={{ ...G, fontSize: 11, color: T.inkLight }}>{icons.length} ícones</span><div style={{ display: "flex", gap: 7 }}><Btn variant="outGray" small disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Anterior</Btn><Btn variant="outGray" small disabled={(page + 1) * pageSize >= icons.length} onClick={() => setPage((current) => current + 1)}>Próxima</Btn></div></div></section>;
}

const headerStyle = { padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.border}` };
const titleStyle = { ...G, fontSize: 14, fontWeight: 800, color: T.ink };
const subtitleStyle = { ...G, fontSize: 12, color: T.inkLight, marginTop: 3 };
const sectionTitle = { ...G, fontSize: 12, fontWeight: 700, color: T.inkMid };
const sectionHint = { ...G, fontSize: 11, color: T.inkLight, marginTop: 3 };
const labelStyle = { ...G, display: "grid", gap: 7, fontSize: 12, fontWeight: 600, color: T.inkMid };
const inputStyle = { ...G, width: "100%", boxSizing: "border-box", marginTop: 0, padding: "10px 11px", border: `1.5px solid ${T.border}`, borderRadius: 9, fontSize: 13, color: T.ink, background: T.surface };
const stackStyle = { display: "grid", gap: 7 };
const emptyStyle = { ...G, padding: "16px 20px", fontSize: 12, color: T.inkLight };
const errorStyle = { ...G, margin: "12px 20px 0", padding: "9px 10px", borderRadius: 9, fontSize: 12, color: T.red, background: T.redLight };
const overlayStyle = { position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,15,13,.28)", display: "grid", placeItems: "center", padding: 16 };
const modalStyle = { width: "min(720px, 100%)", maxHeight: "90dvh", display: "flex", flexDirection: "column", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: T.lg };
const modalHeaderStyle = { padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" };
const eyebrowStyle = { ...G, fontSize: 11, fontWeight: 700, color: T.blue, letterSpacing: ".08em", textTransform: "uppercase" };
const modalTitleStyle = { ...G, margin: "3px 0 0", fontSize: 18, fontWeight: 800, color: T.ink };
const modalFooterStyle = { display: "flex", justifyContent: "flex-end", gap: 9, padding: "14px 20px", borderTop: `1px solid ${T.border}` };
