import React from "react";
import { useNavigate } from "@tanstack/react-router";

import { Btn } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { createConsultantClient } from "../../../api/consultant";
import { handleApiError } from "../../../api/client";
import { Icon } from "./consultantUi";

/**
 * Wizard "Adicionar cliente" (S5) — modal de 7 passos fiel à referência
 * (`consultor/cons-adicionar.jsx`): cliente → organização → início → cartão →
 * receita → perfil privado → revisão. Coleta e valida tudo e chega à revisão.
 *
 * ⚠️ **Provisionamento (criação real) = pendente:** não existe endpoint de backend
 * "consultor cria cliente" (envolve criação de user/org + convite por e-mail +
 * migration do perfil privado — decisões do Owner, ainda em aberto). Por isso o
 * "Criar cliente" leva a um estado **honesto "em breve"** — o wizard NÃO forja
 * sucesso. Quando o endpoint existir, é só trocar `submit()` pela chamada real.
 */

const STEPS = [
  { id: "cliente", num: "01", bg: "#1E3A5F", acc: "#93C5FD", h: "Quem é o cliente?", s: "Vamos criar a conta de acesso. O cliente recebe um convite por e-mail para definir a senha." },
  { id: "org", num: "02", bg: "#14532D", acc: "#86EFAC", h: "A organização financeira", s: "Toda conta no Fincla vive dentro de uma organização. Isso personaliza linguagem e relatórios." },
  { id: "inicio", num: "03", bg: "#4C1D95", acc: "#C4B5FD", h: "Ponto de partida", s: "Saldo inicial e categorias em destaque deixam a conta pronta para o primeiro lançamento." },
  { id: "cartao", num: "04", bg: "#3F1D38", acc: "#F0ABFC", h: "Cartão de crédito", s: "Opcional. Se o cliente usa cartão, o Fincla acompanha faturas, parcelas e assinaturas." },
  { id: "receita", num: "05", bg: "#064E3B", acc: "#6EE7B7", h: "Receita recorrente", s: "Opcional. Registrar a renda mensal já calibra os relatórios para a realidade do cliente." },
  { id: "perfil", num: "06", bg: "#1E1B4B", acc: "#A5B4FC", h: "Seu perfil do cliente", s: "Anotações e tags — visíveis apenas para você, o consultor. Não aparecem para o cliente." },
  { id: "revisar", num: "07", bg: "#0F0F0D", acc: "#F8F7F5", h: "Tudo pronto", s: "Revise os dados antes de criar a conta e enviar o convite." },
];

const ORG_TYPES = [
  { id: "personal", label: "Pessoal", sub: "Finanças de uma pessoa", icon: "user" },
  { id: "family", label: "Família", sub: "Finanças compartilhadas", icon: "users" },
  { id: "business", label: "Negócio / PJ", sub: "Empresa ou autônomo", icon: "wallet" },
];
const CATEGORIES = [
  { id: "moradia", label: "Moradia", color: T.blue, icon: "card" },
  { id: "alimentacao", label: "Alimentação", color: T.green, icon: "wallet" },
  { id: "transporte", label: "Transporte", color: T.amber, icon: "target" },
  { id: "saude", label: "Saúde", color: T.red, icon: "check-circle" },
  { id: "lazer", label: "Lazer", color: T.purple, icon: "sparkles" },
  { id: "educacao", label: "Educação", color: "#0891B2", icon: "file" },
];
const EXPERIENCE_LEVELS = [
  { id: "iniciante", l: "Iniciante", s: "Primeira vez organizando finanças" },
  { id: "intermediario", l: "Intermediário", s: "Já controla, quer evoluir" },
  { id: "avancado", l: "Avançado", s: "Investe e planeja longo prazo" },
];
const GOALS = ["Sair das dívidas", "Montar reserva", "Começar a investir", "Comprar imóvel", "Aposentadoria", "Organizar o negócio"];
const PROFILE_TAGS = ["renda variável", "endividado", "poupador", "autônomo", "família", "empresário", "primeira renda", "alto patrimônio"];

const INITIAL = {
  nome: "", email: "", telefone: "", ocupacao: "",
  orgNome: "", orgTipo: "personal", renda: "",
  saldo: "", categorias: ["moradia", "alimentacao", "transporte"],
  temCartao: false, cardBanco: "", cardLimite: "", cardVenc: "10",
  temReceita: true, recDesc: "Salário", recValor: "", recDia: "5",
  notas: "", tags: [], nivel: "iniciante", objetivo: "Montar reserva", prioridade: false,
};

const inputBase = { ...G, width: "100%", border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 13px", fontSize: 14, color: T.ink, background: "#fff", outline: "none", boxSizing: "border-box" };

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label style={{ ...G, fontSize: 12, fontWeight: 700, color: T.inkMid, marginBottom: 7, display: "flex", gap: 4 }}>
        {label}{required && <span style={{ color: T.red }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ ...G, fontSize: 10.5, color: T.inkGhost, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, pre, type = "text" }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {pre && <span style={{ position: "absolute", left: 13, ...G, fontSize: 14, fontWeight: 700, color: T.inkLight }}>{pre}</span>}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inputBase, paddingLeft: pre ? 38 : 13 }} />
    </div>
  );
}

const toggleBtn = (active) => ({ ...G, flex: 1, padding: "13px", borderRadius: 11, border: `1.5px solid ${active ? T.ink : T.border}`, background: active ? "rgba(15,15,13,0.03)" : "#fff", color: T.ink, fontSize: 13.5, fontWeight: 700, cursor: "pointer" });

/** Mapeia o estado do form (labels PT-BR internos) → payload da API (inglês). */
function toPayload(f) {
  const parts = f.nome.trim().split(/\s+/);
  return {
    first_name: parts[0] || "",
    last_name: parts.slice(1).join(" "),
    email: f.email.trim().toLowerCase(),
    phone: f.telefone || undefined,
    occupation: f.ocupacao || undefined,
    org_name: f.orgNome.trim(),
    org_type: f.orgTipo,
    estimated_income: f.renda || undefined,
    initial_balance: f.saldo || undefined,
    card: f.temCartao ? { bank: f.cardBanco, limit: f.cardLimite, due_day: f.cardVenc } : null,
    income: f.temReceita ? { description: f.recDesc, value: f.recValor, day: f.recDia } : null,
    notes: f.notas || undefined,
    tags: f.tags,
    experience_level: f.nivel,
    main_goal: f.objetivo,
    priority: f.prioridade,
  };
}

export function ConsultantAddClientWizard({ open, onClose, onCreated, quota = null }) {
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = React.useState(0);
  const [f, setF] = React.useState(INITIAL);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null); // { organization_id, client_name, set_password_link }
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (open) { setStepIdx(0); setF(INITIAL); setSubmitting(false); setError(""); setResult(null); setCopied(false); }
  }, [open]);

  if (!open) return null;

  // Sem créditos no plano → o modal vira um paywall (não o wizard).
  const isFull = quota != null && quota.remaining <= 0;

  const step = STEPS[stepIdx];
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleArr = (k, v) => setF((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));

  const canNext = () => {
    if (step.id === "cliente") return f.nome.trim() && /\S+@\S+\.\S+/.test(f.email);
    if (step.id === "org") return f.orgNome.trim();
    return true;
  };
  const next = () => stepIdx < STEPS.length - 1 && setStepIdx(stepIdx + 1);
  const back = () => stepIdx > 0 && setStepIdx(stepIdx - 1);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await createConsultantClient(toPayload(f));
      setResult(res);
      onCreated?.(); // sinaliza a carteira p/ atualizar a lista
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = () => {
    if (!result?.set_password_link) return;
    try {
      navigator.clipboard?.writeText(result.set_password_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponível */ }
  };

  const openReport = () => {
    const orgId = result?.organization_id;
    onClose();
    if (orgId) navigate({ to: "/consultant/clients/$id", params: { id: orgId } });
  };

  const orgTypeMeta = ORG_TYPES.find((o) => o.id === f.orgTipo);
  const initials = f.nome.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  let body = null;
  if (step.id === "cliente") body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Field label="Nome completo" required><TextInput value={f.nome} onChange={(v) => set("nome", v)} placeholder="Ex.: Mariana Torres" /></Field>
      <Field label="E-mail" required hint="O convite de acesso é enviado para este e-mail."><TextInput value={f.email} onChange={(v) => set("email", v)} placeholder="mariana@email.com" type="email" /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Telefone"><TextInput value={f.telefone} onChange={(v) => set("telefone", v)} placeholder="(11) 90000-0000" /></Field>
        <Field label="Ocupação"><TextInput value={f.ocupacao} onChange={(v) => set("ocupacao", v)} placeholder="Ex.: Autônomo · TI" /></Field>
      </div>
    </div>
  );
  else if (step.id === "org") body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Field label="Nome da organização" required hint="Aparece no topo da conta do cliente."><TextInput value={f.orgNome} onChange={(v) => set("orgNome", v)} placeholder="Ex.: Finanças de Mariana" /></Field>
      <Field label="Tipo de organização">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          {ORG_TYPES.map((o) => {
            const active = f.orgTipo === o.id;
            return (
              <button key={o.id} type="button" onClick={() => set("orgTipo", o.id)}
                style={{ ...G, display: "flex", alignItems: "center", gap: 11, padding: "12px 13px", borderRadius: 11, border: `1.5px solid ${active ? T.ink : T.border}`, background: active ? "rgba(15,15,13,0.03)" : "#fff", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: active ? T.ink : T.grayLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={o.icon} size={16} color={active ? "#fff" : T.inkMid} /></div>
                <div><div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>{o.label}</div><div style={{ ...G, fontSize: 10.5, color: T.inkLight }}>{o.sub}</div></div>
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Renda mensal estimada" hint="Base para metas e índice de comprometimento."><TextInput value={f.renda} onChange={(v) => set("renda", v.replace(/[^0-9.,]/g, ""))} placeholder="0,00" pre="R$" /></Field>
    </div>
  );
  else if (step.id === "inicio") body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Field label="Saldo inicial em conta" hint="Quanto o cliente tem hoje somando contas e dinheiro."><TextInput value={f.saldo} onChange={(v) => set("saldo", v.replace(/[^0-9.,]/g, ""))} placeholder="0,00" pre="R$" /></Field>
      <Field label="Categorias em destaque" hint="As selecionadas aparecem primeiro ao lançar transações.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CATEGORIES.map((cat) => {
            const active = f.categorias.includes(cat.id);
            return (
              <button key={cat.id} type="button" onClick={() => toggleArr("categorias", cat.id)}
                style={{ ...G, display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 13px", borderRadius: 10, border: `1.5px solid ${active ? cat.color : T.border}`, background: active ? cat.color + "12" : "#fff", color: active ? cat.color : T.inkMid, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                <Icon name={cat.icon} size={14} color={active ? cat.color : T.inkLight} />{cat.label}
                {active && <Icon name="check" size={12} color={cat.color} />}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
  else if (step.id === "cartao") body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={() => set("temCartao", true)} style={toggleBtn(f.temCartao === true)}>Sim, usa cartão</button>
        <button type="button" onClick={() => set("temCartao", false)} style={toggleBtn(f.temCartao === false)}>Não, pular</button>
      </div>
      {f.temCartao && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Banco / apelido do cartão"><TextInput value={f.cardBanco} onChange={(v) => set("cardBanco", v)} placeholder="Ex.: Nubank Roxinho" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
            <Field label="Limite"><TextInput value={f.cardLimite} onChange={(v) => set("cardLimite", v.replace(/[^0-9.,]/g, ""))} placeholder="0,00" pre="R$" /></Field>
            <Field label="Dia de vencimento"><TextInput value={f.cardVenc} onChange={(v) => set("cardVenc", v.replace(/[^0-9]/g, "").slice(0, 2))} placeholder="10" /></Field>
          </div>
        </div>
      )}
    </div>
  );
  else if (step.id === "receita") body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={() => set("temReceita", true)} style={toggleBtn(f.temReceita === true)}>Registrar receita</button>
        <button type="button" onClick={() => set("temReceita", false)} style={toggleBtn(f.temReceita === false)}>Não, pular</button>
      </div>
      {f.temReceita && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Descrição"><TextInput value={f.recDesc} onChange={(v) => set("recDesc", v)} placeholder="Ex.: Salário, Pró-labore…" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
            <Field label="Valor mensal"><TextInput value={f.recValor} onChange={(v) => set("recValor", v.replace(/[^0-9.,]/g, ""))} placeholder="0,00" pre="R$" /></Field>
            <Field label="Dia de recebimento"><TextInput value={f.recDia} onChange={(v) => set("recDia", v.replace(/[^0-9]/g, "").slice(0, 2))} placeholder="5" /></Field>
          </div>
        </div>
      )}
    </div>
  );
  else if (step.id === "perfil") body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EEF2FF", borderRadius: 10, padding: "10px 13px" }}>
        <Icon name="user" size={14} color="#4338CA" />
        <span style={{ ...G, fontSize: 11.5, color: T.inkMid, lineHeight: 1.4 }}>Tudo nesta etapa é <strong>privado do consultor</strong> — o cliente nunca vê.</span>
      </div>
      <Field label="Notas sobre o cliente">
        <textarea value={f.notas} onChange={(e) => set("notas", e.target.value)} rows={3} placeholder="Contexto, histórico, pontos de atenção, combinados…" style={{ ...inputBase, resize: "vertical", lineHeight: 1.5 }} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Nível de experiência">
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {EXPERIENCE_LEVELS.map((lv) => {
              const active = f.nivel === lv.id;
              return (
                <button key={lv.id} type="button" onClick={() => set("nivel", lv.id)}
                  style={{ ...G, display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${active ? T.ink : T.border}`, background: active ? "rgba(15,15,13,0.03)" : "#fff", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 14, height: 14, borderRadius: 99, border: `2px solid ${active ? T.ink : T.borderHov}`, background: active ? T.ink : "transparent", flexShrink: 0 }} />
                  <span><span style={{ ...G, fontSize: 12.5, fontWeight: 700, color: T.ink, display: "block" }}>{lv.l}</span><span style={{ ...G, fontSize: 10, color: T.inkLight }}>{lv.s}</span></span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Objetivo principal">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignContent: "flex-start" }}>
            {GOALS.map((g) => {
              const active = f.objetivo === g;
              return <button key={g} type="button" onClick={() => set("objetivo", g)} style={{ ...G, padding: "7px 11px", borderRadius: 9, border: `1.5px solid ${active ? T.ink : T.border}`, background: active ? T.ink : "#fff", color: active ? "#fff" : T.inkMid, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{g}</button>;
            })}
          </div>
        </Field>
      </div>
      <Field label="Tags de perfil">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {PROFILE_TAGS.map((t) => {
            const active = f.tags.includes(t);
            return <button key={t} type="button" onClick={() => toggleArr("tags", t)} style={{ ...G, padding: "6px 11px", borderRadius: 99, border: `1.5px solid ${active ? T.ink : T.border}`, background: active ? "rgba(15,15,13,0.04)" : "#fff", color: active ? T.ink : T.inkMid, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>#{t}</button>;
          })}
        </div>
      </Field>
    </div>
  );
  else if (step.id === "revisar") body = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[
        { ic: "user", t: "Cliente", rows: [["Nome", f.nome || "—"], ["E-mail", f.email || "—"], ["Telefone", f.telefone || "—"], ["Ocupação", f.ocupacao || "—"]] },
        { ic: "users", t: "Organização", rows: [["Nome", f.orgNome || "—"], ["Tipo", orgTypeMeta?.label], ["Renda mensal", f.renda ? "R$ " + f.renda : "—"]] },
        { ic: "wallet", t: "Início", rows: [["Saldo inicial", f.saldo ? "R$ " + f.saldo : "R$ 0,00"], ["Categorias", f.categorias.length + " selecionadas"]] },
        ...(f.temCartao ? [{ ic: "card", t: "Cartão", rows: [["Banco", f.cardBanco || "—"], ["Limite", f.cardLimite ? "R$ " + f.cardLimite : "—"], ["Vencimento", "dia " + f.cardVenc]] }] : []),
        ...(f.temReceita ? [{ ic: "repeat", t: "Receita recorrente", rows: [["Descrição", f.recDesc], ["Valor", f.recValor ? "R$ " + f.recValor : "—"], ["Dia", "dia " + f.recDia]] }] : []),
        { ic: "user", t: "Perfil (privado)", rows: [["Nível", EXPERIENCE_LEVELS.find((l) => l.id === f.nivel)?.l], ["Objetivo", f.objetivo], ["Tags", f.tags.length ? f.tags.map((t) => "#" + t).join(" ") : "—"]] },
      ].map((sec) => (
        <div key={sec.t} style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: T.bg, borderBottom: `1px solid ${T.border}` }}>
            <Icon name={sec.ic} size={14} color={T.inkMid} /><span style={{ ...G, fontSize: 12.5, fontWeight: 800, color: T.ink }}>{sec.t}</span>
          </div>
          <div style={{ padding: "6px 14px" }}>
            {sec.rows.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", gap: 12 }}>
                <span style={{ ...G, fontSize: 12, color: T.inkLight }}>{k}</span>
                <span style={{ ...G, fontSize: 12.5, fontWeight: 600, color: T.ink, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={onClose} role="presentation" style={{ position: "absolute", inset: 0, background: "rgba(15,15,13,0.5)" }} />
      <div style={{ position: "relative", width: 920, maxWidth: "100%", height: "min(640px, 92vh)", background: T.surface, borderRadius: 18, overflow: "hidden", boxShadow: T.lg, display: "grid", gridTemplateColumns: (result || isFull) ? "1fr" : "minmax(0,300px) 1fr" }}>
        {result ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40, gap: 8 }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: `linear-gradient(135deg, ${T.green}, #0891B2)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, boxShadow: T.md }}><Icon name="check" size={36} color="#fff" /></div>
            <div style={{ ...G, fontSize: 22, fontWeight: 800, color: T.ink }}>Cliente adicionado!</div>
            <div style={{ ...G, fontSize: 13.5, color: T.inkLight, maxWidth: 470, lineHeight: 1.6 }}>
              A conta de <strong style={{ color: T.ink }}>{result.client_name}</strong> foi criada. Envie o link abaixo para {result.client_name.split(" ")[0]} <strong style={{ color: T.ink }}>definir a senha</strong> e acessar. O link expira e é de uso único; você pode gerar um novo depois na carteira.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", maxWidth: 560, marginTop: 6, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px" }}>
              <input readOnly value={result.set_password_link} aria-label="Link de definição de senha" style={{ ...G, flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 12, color: T.inkMid }} />
              <Btn variant="outGray" small onClick={copyLink}><Icon name="check" size={12} color={T.inkMid} /> {copied ? "Copiado" : "Copiar"}</Btn>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn variant="outline" onClick={onClose}>Voltar à carteira</Btn>
              <Btn variant="dark" onClick={openReport}><Icon name="arrow-right" size={14} color="#fff" /> Abrir relatório</Btn>
            </div>
          </div>
        ) : isFull ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40, gap: 10 }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: "linear-gradient(135deg, #7C3AED, #2563EB)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4, boxShadow: T.md }}><Icon name="sparkles" size={32} color="#fff" /></div>
            <div style={{ ...G, fontSize: 22, fontWeight: 800, color: T.ink }}>Limite de clientes atingido</div>
            <div style={{ ...G, fontSize: 13.5, color: T.inkLight, maxWidth: 480, lineHeight: 1.6 }}>
              Seu plano permite gerenciar até <strong style={{ color: T.ink }}>{quota.limit} {quota.limit === 1 ? "cliente" : "clientes"}</strong>, e todos já estão em uso. Para ampliar sua carteira, faça upgrade do seu plano de consultor — fale com o nosso time comercial.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn variant="outline" onClick={onClose}>Fechar</Btn>
              <a href="mailto:comercial@fincla.com.br?subject=Upgrade%20do%20plano%20de%20consultor%20Fincla" style={{ textDecoration: "none" }}>
                <Btn variant="dark"><Icon name="message" size={14} color="#fff" /> Falar com o time comercial</Btn>
              </a>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background: step.bg, color: "#fff", padding: "26px 24px", display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ ...G, fontSize: 13, fontWeight: 800, marginBottom: 28 }}>Novo cliente</div>
              <div style={{ ...G, fontSize: 13, color: step.acc, marginBottom: 4 }}>Etapa {step.num}</div>
              <div style={{ ...G, fontSize: 22, fontWeight: 800, lineHeight: 1.15, marginBottom: 12 }}>{step.h}</div>
              <div style={{ ...G, fontSize: 12.5, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{step.s}</div>
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 9, paddingTop: 20 }}>
                {STEPS.map((s, i) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 9, opacity: i === stepIdx ? 1 : 0.5 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 99, background: i < stepIdx ? step.acc : i === stepIdx ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {i < stepIdx ? <Icon name="check" size={11} color={step.bg} /> : <span style={{ ...G, ...NUM, fontSize: 9, fontWeight: 800, color: "#fff" }}>{i + 1}</span>}
                    </span>
                    <span style={{ ...G, fontSize: 11.5, fontWeight: i === stepIdx ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.h}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  {f.nome && <div style={{ width: 30, height: 30, borderRadius: 9999, background: `linear-gradient(135deg, ${T.blue}, ${T.ink})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 11, ...G, flexShrink: 0 }}>{initials}</div>}
                  <span style={{ ...G, fontSize: 13.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nome || "Adicionar cliente"}</span>
                </div>
                <button type="button" onClick={onClose} aria-label="Fechar" style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: 7, cursor: "pointer", display: "flex" }}><Icon name="x" size={15} color={T.inkMid} /></button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>{body}</div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderTop: `1px solid ${T.border}` }}>
                <button type="button" onClick={stepIdx === 0 ? onClose : back} style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: T.inkMid, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 4px" }}>
                  {stepIdx === 0 ? "Cancelar" : <><Icon name="chevron-left" size={15} color={T.inkMid} /> Voltar</>}
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {error && <span style={{ ...G, fontSize: 11.5, color: T.red, maxWidth: 260, textAlign: "right" }}>{error}</span>}
                  <span style={{ ...G, ...NUM, fontSize: 11.5, color: T.inkGhost }}>{stepIdx + 1} / {STEPS.length}</span>
                  {step.id === "revisar" ? (
                    <button type="button" onClick={submit} disabled={submitting}
                      style={{ ...G, display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 9, border: `1.5px solid ${T.ink}`, background: T.ink, color: "#fff", fontSize: 12, fontWeight: 600, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1 }}>
                      <Icon name="check" size={14} color="#fff" /> {submitting ? "Criando…" : "Criar cliente"}
                    </button>
                  ) : (
                    <button type="button" onClick={canNext() ? next : undefined} disabled={!canNext()}
                      style={{ ...G, display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 9, border: `1.5px solid ${T.ink}`, background: T.ink, color: "#fff", fontSize: 12, fontWeight: 600, cursor: canNext() ? "pointer" : "not-allowed", opacity: canNext() ? 1 : 0.45 }}>
                      Continuar <Icon name="arrow-right" size={14} color="#fff" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
