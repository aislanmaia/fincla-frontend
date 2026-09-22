import React from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";

import { Btn, Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G } from "../../typography";
import {
  deleteConsultantCategoryTemplate,
  listConsultantCategoryTemplates,
  saveConsultantCategoryTemplate,
} from "../../../api/consultant";
import { handleApiError } from "../../../api/client";

const CATEGORIES = [
  ["housing", "Moradia"],
  ["food_groceries", "Alimentação"],
  ["transport", "Transporte"],
  ["health", "Saúde"],
  ["education", "Educação"],
  ["leisure_entertainment", "Lazer e entretenimento"],
  ["work_salary", "Trabalho e salário"],
  ["services_provided", "Serviços prestados"],
  ["sales", "Vendas"],
  ["received_transfers", "Transferências recebidas"],
  ["received_reimbursements", "Reembolsos recebidos"],
];

function definitionFrom(selected) {
  return { categories: CATEGORIES.map(([system_key]) => ({ system_key, is_onboarding_highlight: selected.includes(system_key) })) };
}

function selectedFrom(template) {
  return (template?.definition?.categories ?? [])
    .filter((item) => item?.is_onboarding_highlight && typeof item.system_key === "string")
    .map((item) => item.system_key);
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

/** Portfolio-level defaults that are copied when a consultant provisions a client. */
export function ConsultantCategoryTemplatesPanel() {
  const [templates, setTemplates] = React.useState([]);
  const [editing, setEditing] = React.useState(null);
  const [name, setName] = React.useState("");
  const [selected, setSelected] = React.useState(["housing", "food_groceries", "transport"]);
  const [isDefault, setIsDefault] = React.useState(false);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const reload = React.useCallback(async () => {
    try { setTemplates(await listConsultantCategoryTemplates()); setError(""); }
    catch (cause) { setError(handleApiError(cause)); }
  }, []);
  React.useEffect(() => { void reload(); }, [reload]);

  const begin = (template = null) => {
    setEditing(template?.id ?? "new");
    setName(template?.name ?? "");
    setSelected(template ? selectedFrom(template) : ["housing", "food_groceries", "transport"]);
    setIsDefault(template?.is_default ?? templates.length === 0);
    setError("");
  };
  const toggle = (key) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await saveConsultantCategoryTemplate(editing === "new" ? newId() : editing, {
        name: name.trim(), definition: definitionFrom(selected), is_default: isDefault,
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

  return <Card style={{ padding: 0 }}>
    <div style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.border}` }}>
      <div><div style={{ ...G, fontSize: 14, fontWeight: 800, color: T.ink }}>Modelos de categorias</div><div style={{ ...G, fontSize: 12, color: T.inkLight, marginTop: 3 }}>Defina os destaques que serão copiados para novos clientes.</div></div>
      {!editing && <Btn variant="dark" small onClick={() => begin()}><Plus size={13} />Novo modelo</Btn>}
    </div>
    {error && <div style={{ ...G, margin: "12px 20px 0", padding: "9px 10px", borderRadius: 9, fontSize: 12, color: T.red, background: T.redLight }}>{error}</div>}
    {editing ? <div style={{ padding: 20, display: "grid", gap: 16 }}>
      <label style={{ ...G, fontSize: 12, fontWeight: 600, color: T.inkMid }}>Nome do modelo<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Família com filhos" style={{ ...G, width: "100%", boxSizing: "border-box", marginTop: 7, padding: "10px 12px", border: `1.5px solid ${T.border}`, borderRadius: 10, fontSize: 14, color: T.ink }} /></label>
      <div><div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.inkMid, marginBottom: 8 }}>Categorias em destaque no onboarding</div><div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{CATEGORIES.map(([key, label]) => { const active = selected.includes(key); return <button key={key} type="button" onClick={() => toggle(key)} style={{ ...G, display: "inline-flex", alignItems: "center", gap: 5, border: `1.5px solid ${active ? T.ink : T.border}`, background: active ? T.grayLight : T.surface, color: active ? T.ink : T.inkMid, borderRadius: 99, padding: "7px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{active && <Check size={13} />}{label}</button>; })}</div></div>
      <label style={{ ...G, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: T.inkMid }}><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />Usar como modelo padrão</label>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Btn variant="outGray" onClick={() => setEditing(null)}>Cancelar</Btn><Btn variant="dark" disabled={!name.trim() || busy} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar modelo"}</Btn></div>
    </div> : <div>{templates.length === 0 ? <div style={{ ...G, padding: "18px 20px", fontSize: 12, color: T.inkLight }}>Nenhum modelo salvo. Crie um para repetir sua configuração ao adicionar clientes.</div> : templates.map((template, index) => <div key={template.id} style={{ padding: "13px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: index === templates.length - 1 ? "none" : `1px solid ${T.border}` }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>{template.name}{template.is_default && <span style={{ marginLeft: 7, color: T.purple, fontSize: 11 }}>Padrão</span>}</div><div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 3 }}>{selectedFrom(template).length} categorias em destaque</div></div><Btn variant="ghost" small aria-label={`Editar ${template.name}`} onClick={() => begin(template)}><Pencil size={14} /></Btn><Btn variant="ghost" small aria-label={`Excluir ${template.name}`} onClick={() => void remove(template.id)}><Trash2 size={14} color={T.red} /></Btn></div>)}</div>}
  </Card>;
}
