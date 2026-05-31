import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { formatOrganizationsApiError } from "../data/organizationsAdapter.js";
import { useOrganizationMembersData } from "../features/organization/useOrganizationMembersData.js";
import { changePassword as apiChangePassword } from "../../api/auth";
import { getOrganization } from "../../api/organizations";
import { listWhatsAppConnections, linkWhatsAppPhone, unlinkWhatsAppPhone } from "../../api/whatsappConnections";
import { createTag, updateTag as apiUpdateTag, deleteTag, listTagTypes, listTags } from "../../api/tags";
import { handleApiError } from "../../api/client";
import {
  Settings,
  Lock,
  Building2,
  Users,
  Tag,
  MessageCircle,
  CreditCard,
  LogOut,
  Key,
  CheckCircle2,
  Smartphone,
  AlertTriangle,
  UserPlus,
  Plus,
  Search,
  Hash,
  Pencil,
  Trash2,
} from "lucide-react";
import { T } from "../tokens";
import { G } from "../typography";
import { BillingPanel } from "../features/subscription/BillingPanel.jsx";
import { FeatureGate, UpgradePrompt } from "../features/entitlements/index.js";
import { DragScrollTabs } from "../layouts/DragScrollTabs.jsx";
import { CardEmptyWithCta } from "../features/shellExtras.jsx";
import {
  PROFILE_TAB_INTERNAL_TO_SLUG,
  PROFILE_TAB_SLUG_TO_INTERNAL,
  profileSettingsTabSlugFromPathname,
} from "../routing/profileSettingsTabs.js";

function formatOrgTipoLabelForSettings(t) {
  if (t == null || t === "") return "Pessoal";
  const v = String(t).toLowerCase();
  if (v === "business" || v === "negocio") return "Negócio";
  if (v === "couple" || v === "casal") return "Casal";
  if (v === "family" || v === "familia") return "Família";
  if (v === "personal" || v === "outro" || v === "other" || v === "pessoal") {
    return "Pessoal";
  }
  return String(t);
}

function SectionCard({ children, style = {} }) {
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, overflow:"hidden", width:"100%", ...style }}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, sub }) {
  return (
    <div style={{ padding:"20px 24px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ width:36, height:36, borderRadius:10, background:T.blueLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        {icon}
      </div>
      <div>
        <h2 style={{ ...G, fontSize:16, fontWeight:800, color:T.ink, margin:0 }}>{title}</h2>
        {sub && <div style={{ ...G, fontSize:12, color:T.inkMid, marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function FieldRow({ label, value, action }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 24px", borderBottom:`1px solid ${T.border}` }}>
      <div>
        <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{label}</div>
        <div style={{ ...G, fontSize:14, color:T.ink }}>{value}</div>
      </div>
      {action}
    </div>
  );
}

function BtnPrimary({ onClick, children, small }) {
  return (
    <button onClick={onClick} style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:9, padding:small?"7px 14px":"9px 18px", fontSize:small?11:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
      {children}
    </button>
  );
}

function BtnGhost({ onClick, children, danger }) {
  return (
    <button onClick={onClick} style={{ ...G, background:"none", color:danger?T.red:T.inkMid, border:`1px solid ${danger?T.red+"44":T.border}`, borderRadius:9, padding:"7px 14px", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
      {children}
    </button>
  );
}

export function ConfiguracoesPage({
  onNav,
  isMobile = false,
  onboardingData = null,
  dataMode = "mock",
  organizationId = null,
  currentUser = null,
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const settingsTabSlug = profileSettingsTabSlugFromPathname(pathname);
  const subPage = useMemo(() => {
    if (!settingsTabSlug) return "perfil";
    return PROFILE_TAB_SLUG_TO_INTERNAL[settingsTabSlug] ?? "perfil";
  }, [settingsTabSlug]);

  const goToSettingsTab = useCallback(
    (internalId) => {
      const slug = PROFILE_TAB_INTERNAL_TO_SLUG[internalId];
      if (!slug) return;
      navigate({ to: `/profile/${slug}` });
    },
    [navigate],
  );

  const liveMembersEnabled = Boolean(organizationId) && dataMode === "live";
  const liveMembers = useOrganizationMembersData({
    organizationId: organizationId || "",
    enabled: liveMembersEnabled,
  });
  const [inviteInput, setInviteInput] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteErr, setInviteErr] = useState("");
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConf, setSenhaConf] = useState("");
  const [senhaOk, setSenhaOk] = useState(false);
  const [whatsNums, setWhatsNums] = useState([
    { id: 1, num: "+55 11 99999-0001", nome: "Aislan (pessoal)", status: "ativo",    ultimo: "há 2h" },
    { id: 2, num: "+55 11 98888-0002", nome: "Ana (família)",     status: "ativo",    ultimo: "há 1d" },
  ]);
  const [whatsConns, setWhatsConns] = useState([]);
  const [whatsLoading, setWhatsLoading] = useState(false);
  const [whatsError, setWhatsError] = useState("");
  const [novoNum, setNovoNum] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [addNumOpen, setAddNumOpen] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#2563EB");

  const orgNome  = onboardingData?.orgNome  || "Família Alves";
  const orgTipo  = onboardingData?.orgTipo  || "personal";
  const membros  = onboardingData?.membros?.filter(m => m.trim()) || [];

  const CAT_LIST = [
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
  const [cats, setCats] = useState(CAT_LIST);
  const [catSearch, setCatSearch] = useState("");
  const [expandedCat, setExpandedCat] = useState(null);
  const [newTagInputs, setNewTagInputs] = useState({});
  const filteredCats = cats.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));

  const liveEnabled = Boolean(organizationId) && dataMode === "live";
  const [orgData, setOrgData] = useState(null);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsError, setCatsError] = useState("");
  const [senhaErr, setSenhaErr] = useState("");
  const [senhaLoading, setSenhaLoading] = useState(false);

  // ── Load organization details ──────────────────────────────────────────────
  useEffect(() => {
    if (!liveEnabled) return;
    let cancelled = false;
    getOrganization(organizationId).then(d => { if (!cancelled) setOrgData(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [liveEnabled, organizationId]);

  // ── Load WhatsApp connections ──────────────────────────────────────────────
  const refreshWhats = useCallback(async () => {
    if (!liveEnabled) return;
    setWhatsLoading(true);
    setWhatsError("");
    try {
      const resp = await listWhatsAppConnections(organizationId);
      setWhatsConns(resp.connections ?? []);
    } catch (e) {
      setWhatsError(handleApiError(e));
    } finally {
      setWhatsLoading(false);
    }
  }, [liveEnabled, organizationId]);

  useEffect(() => { if (liveEnabled) void refreshWhats(); }, [liveEnabled, refreshWhats]);

  // ── Load categories from API ───────────────────────────────────────────────
  const refreshCats = useCallback(async () => {
    if (!liveEnabled) return;
    setCatsLoading(true);
    setCatsError("");
    try {
      const resp = await listTags(organizationId, "categoria");
      const raw = resp.tags ?? [];
      setCats(raw.map(t => ({ id: t.id, name: t.name, color: t.color ?? "#6B7280", tags: [], _tagTypeId: t.tag_type?.id ?? null })));
    } catch (e) {
      setCatsError(handleApiError(e));
    } finally {
      setCatsLoading(false);
    }
  }, [liveEnabled, organizationId]);

  useEffect(() => { if (liveEnabled) void refreshCats(); }, [liveEnabled, refreshCats]);

  // ── Category CRUD handlers ─────────────────────────────────────────────────
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

  // ── WhatsApp CRUD handlers ─────────────────────────────────────────────────
  const handleLinkWhats = useCallback(async () => {
    if (!novoNum.trim()) return;
    if (liveEnabled) {
      try {
        await linkWhatsAppPhone({ organization_id: organizationId, phone_number: novoNum.trim() });
        setNovoNum(""); setNovoNome(""); setAddNumOpen(false);
        await refreshWhats();
      } catch (e) { setWhatsError(handleApiError(e)); }
    } else {
      setWhatsNums(prev => [...prev, { id: Date.now(), num: novoNum.trim(), nome: novoNome.trim() || novoNum.trim(), status: "pendente", ultimo: "nunca" }]);
      setNovoNum(""); setNovoNome(""); setAddNumOpen(false);
    }
  }, [liveEnabled, organizationId, novoNum, novoNome, refreshWhats]);

  const handleUnlinkWhats = useCallback(async (connId) => {
    if (liveEnabled) {
      try {
        await unlinkWhatsAppPhone(connId);
        await refreshWhats();
      } catch (e) { setWhatsError(handleApiError(e)); }
    } else {
      setWhatsNums(prev => prev.filter(x => x.id !== connId));
    }
  }, [liveEnabled, refreshWhats]);

  // ── Password change handler ────────────────────────────────────────────────
  const handleSenha = useCallback(async () => {
    if (!senhaAtual || !senhaNova || !senhaConf) return;
    if (senhaNova !== senhaConf) { setSenhaErr("As senhas não coincidem."); return; }
    setSenhaLoading(true);
    setSenhaErr("");
    try {
      await apiChangePassword(senhaAtual, senhaNova);
      setSenhaOk(true);
      setSenhaOpen(false);
      setSenhaAtual(""); setSenhaNova(""); setSenhaConf("");
      setTimeout(() => setSenhaOk(false), 3000);
    } catch (e) {
      setSenhaErr(handleApiError(e));
    } finally {
      setSenhaLoading(false);
    }
  }, [senhaAtual, senhaNova, senhaConf]);

  // ── Sub-nav structure ──────────────────────────────────────────────────────
  const SUB_NAV = [
    { group: "Conta", items: [
      { id:"perfil",     label:"Meu Perfil",        Icon: Settings },
      { id:"seguranca",  label:"Segurança",          Icon: Lock },
    ]},
    { group: "Workspace", items: [
      { id:"organizacao",label:"Organização",        Icon: Building2 },
      { id:"membros",    label:"Membros",            Icon: Users },
      { id:"categorias", label:"Categorias e Tags",  Icon: Tag },
    ]},
    { group: "Integrações", items: [
      { id:"whatsapp",   label:"Assistente WhatsApp",Icon: MessageCircle },
    ]},
    { group: "Plano", items: [
      { id:"assinatura", label:"Assinatura",         Icon: CreditCard },
    ]},
  ];

  const fmtS = (id) => {
    const titles = {
      perfil:"Meu Perfil", seguranca:"Segurança", organizacao:"Organização",
      membros:"Membros", categorias:"Categorias e Tags",
      whatsapp:"Assistente WhatsApp", assinatura:"Assinatura",
    };
    return titles[id] || id;
  };

  // ── Content renderers ──────────────────────────────────────────────────────
  const renderPerfil = () => {
    const fullName = currentUser
      ? [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") || currentUser.email
      : "—";
    const email = currentUser?.email ?? "—";
    const initials = (() => {
      const parts = fullName.trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return "??";
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    })();
    const plan = currentUser?.subscription?.plan ?? "free";
    // Catalog now ships multiple slugs (essential/pro/beta/…); render the slug
    // uppercased so the badge reflects whatever the backend returns instead of
    // collapsing everything not-premium-not-beta to FREE.
    const planLabel = plan ? String(plan).toUpperCase() : "—";
    const rolePt = currentUser?.role === "owner" ? "Administrador" : currentUser?.role === "member" ? "Membro" : currentUser?.role ?? "—";
    const memberSince = currentUser?.created_at
      ? new Date(currentUser.created_at).toLocaleDateString("pt-BR")
      : "—";
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <SectionCard>
          <div style={{ height:72, background:`linear-gradient(135deg, #1A1A2E 0%, #2563EB 60%, #7C3AED 100%)`, position:"relative" }}/>
          <div style={{ padding:"0 24px 20px", position:"relative" }}>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ width:64, height:64, borderRadius:9999, background:`linear-gradient(135deg, ${T.blue}, ${T.purple})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, color:"#fff", border:"3px solid #fff", marginTop:-32, flexShrink:0 }}>{initials}</div>
              <BtnGhost onClick={() => onNav("__logout__")} danger><LogOut size={13}/> Sair da conta</BtnGhost>
            </div>
            <div style={{ ...G, fontSize:18, fontWeight:800, color:T.ink, marginBottom:3 }}>{fullName}</div>
            <div style={{ ...G, fontSize:13, color:T.inkMid, marginBottom:10 }}>{email}</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <span style={{ ...G, fontSize:11, fontWeight:700, background:T.purpleLight, color:T.purple, padding:"3px 10px", borderRadius:99 }}>{planLabel}</span>
              <span style={{ ...G, fontSize:11, fontWeight:600, background:T.grayLight, color:T.inkMid, padding:"3px 10px", borderRadius:99 }}>{rolePt}</span>
              <span style={{ ...G, fontSize:11, color:T.inkLight, padding:"3px 10px" }}>Membro desde {memberSince}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeader icon={<Settings size={16} color={T.blue}/>} title="Informações da conta" sub="Dados pessoais e de acesso"/>
          <FieldRow label="Nome completo" value={fullName} action={<BtnGhost onClick={()=>{}}>Editar</BtnGhost>}/>
          <FieldRow label="E-mail" value={email} action={<BtnGhost onClick={()=>{}}>Alterar</BtnGhost>}/>
          <FieldRow label="Fuso horário" value="(UTC-3) Brasília" action={<BtnGhost onClick={()=>{}}>Editar</BtnGhost>}/>
          <div style={{ padding:"13px 24px" }}>
            <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Idioma</div>
            <div style={{ ...G, fontSize:14, color:T.ink }}>Português (Brasil)</div>
          </div>
        </SectionCard>
      </div>
    );
  };

  const renderSeguranca = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <SectionCard>
        <SectionHeader icon={<Lock size={16} color={T.blue}/>} title="Segurança" sub="Gerencie o acesso à sua conta"/>
        <div style={{ padding:"16px 24px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: senhaOpen ? 16 : 0 }}>
            <div>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, marginBottom:2 }}>Senha</div>
              <div style={{ ...G, fontSize:12, color:T.inkMid }}>Última alteração: nunca</div>
            </div>
            <BtnGhost onClick={() => setSenhaOpen(o => !o)}><Key size={12}/> Alterar Senha</BtnGhost>
          </div>
          {senhaOpen && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:16, paddingTop:16, borderTop:`1px solid ${T.border}` }}>
              {[["Senha atual", senhaAtual, setSenhaAtual],["Nova senha", senhaNova, setSenhaNova],["Confirmar nova senha", senhaConf, setSenhaConf]].map(([label, val, set]) => (
                <div key={label}>
                  <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>{label}</div>
                  <input type="password" value={val} onChange={e => set(e.target.value)} placeholder="••••••••"
                    style={{ ...G, width:"100%", padding:"10px 13px", border:`1.5px solid ${T.border}`, borderRadius:9, fontSize:13, color:T.ink, background:T.bg, outline:"none" }}/>
                </div>
              ))}
              {senhaErr && (
                <div style={{ ...G, fontSize:12, color:T.red, marginTop:4 }}>{senhaErr}</div>
              )}
              <div style={{ display:"flex", gap:10, marginTop:4 }}>
                <BtnGhost onClick={() => { setSenhaOpen(false); setSenhaAtual(""); setSenhaNova(""); setSenhaConf(""); setSenhaErr(""); }}>Cancelar</BtnGhost>
                <BtnPrimary onClick={handleSenha}>
                  {senhaOk ? <><CheckCircle2 size={13}/> Salvo!</> : senhaLoading ? "Salvando…" : "Salvar senha"}
                </BtnPrimary>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:"14px 24px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, marginBottom:2 }}>Autenticação em dois fatores</div>
              <div style={{ ...G, fontSize:12, color:T.inkMid }}>Adicione uma camada extra de proteção</div>
            </div>
            <span style={{ ...G, fontSize:11, fontWeight:700, background:T.amberLight, color:T.amber, padding:"3px 10px", borderRadius:99 }}>Desativado</span>
          </div>
        </div>
        <div style={{ padding:"14px 24px" }}>
          <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, marginBottom:10 }}>Sessões ativas</div>
          {[
            { device:"Chrome — macOS", ip:"189.6.xxx.xxx", last:"Agora", current:true },
            { device:"Safari — iPhone 15", ip:"189.6.xxx.xxx", last:"há 3h", current:false },
          ].map((s, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom: i===0 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ width:36, height:36, borderRadius:9, background:T.grayLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Smartphone size={16} color={T.inkMid}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ ...G, fontSize:12, fontWeight:600, color:T.ink }}>{s.device} {s.current && <span style={{ ...G, fontSize:10, fontWeight:700, background:T.greenLight, color:T.green, padding:"1px 7px", borderRadius:99, marginLeft:6 }}>atual</span>}</div>
                <div style={{ ...G, fontSize:11, color:T.inkLight }}>{s.ip} · {s.last}</div>
              </div>
              {!s.current && <BtnGhost danger onClick={()=>{}}>Revogar</BtnGhost>}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );

  const renderOrganizacao = () => {
    const nome = orgData?.name ?? onboardingData?.orgNome ?? "—";
    const tipo = orgData?.org_type ?? onboardingData?.orgTipo ?? null;
    const orgId = orgData?.id ?? organizationId ?? null;
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <SectionCard>
          <SectionHeader icon={<Building2 size={16} color={T.blue}/>} title="Organização" sub="Gerencie seu espaço de trabalho"/>
          <FieldRow label="Nome" value={nome} action={<BtnGhost onClick={()=>{}}>Editar</BtnGhost>}/>
          <FieldRow label="Tipo" value={formatOrgTipoLabelForSettings(tipo)} action={null}/>
          <FieldRow label="ID da organização" value={<span style={{ ...G, fontFamily:"'Geist Mono', monospace", fontSize:12, color:T.inkLight }}>{orgId ?? "—"}</span>} action={null}/>
          <div style={{ padding:"13px 24px" }}>
            <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkLight, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>Status</div>
            <span style={{ ...G, fontSize:12, fontWeight:700, background:T.greenLight, color:T.green, padding:"3px 10px", borderRadius:99 }}>Ativa</span>
          </div>
        </SectionCard>
        <SectionCard>
          <div style={{ padding:"16px 24px", display:"flex", alignItems:"center", gap:10 }}>
            <AlertTriangle size={16} color={T.red}/>
            <div style={{ flex:1 }}>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.red, marginBottom:2 }}>Zona de perigo</div>
              <div style={{ ...G, fontSize:12, color:T.inkMid }}>Ações irreversíveis que afetam toda a organização.</div>
            </div>
            <BtnGhost danger onClick={()=>{}}>Excluir organização</BtnGhost>
          </div>
        </SectionCard>
      </div>
    );
  };

  const renderMembros = () => {
    if (liveMembersEnabled) {
      const displayName = (u) =>
        [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim() || u?.email || "Conta";
      const rowInitials = (label) => {
        const parts = String(label).trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return "??";
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      };
      const pendingInvites = liveMembers.invitations.filter((inv) => inv.status === "pending");
      const memberColors = [T.purple, T.blue, T.green, "#D97706"];

      return (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <SectionCard>
            <div style={{ padding:"16px 24px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:T.blueLight, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Users size={16} color={T.blue}/>
                </div>
                <div>
                  <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>Membros</div>
                  <div style={{ ...G, fontSize:12, color:T.inkMid }}>
                    {liveMembers.totalMembers ? `${liveMembers.totalMembers} na organização` : "Gerencie quem tem acesso à organização"}
                  </div>
                </div>
              </div>
            </div>

            {liveMembers.loading && (
              <div style={{ padding:"16px 24px", ...G, fontSize:13, color:T.inkLight }}>Carregando membros…</div>
            )}
            {liveMembers.error && (
              <div style={{ padding:"16px 24px", display:"flex", gap:8, alignItems:"flex-start" }}>
                <AlertTriangle size={16} color={T.red} style={{ flexShrink:0, marginTop:2 }} />
                <div style={{ ...G, fontSize:13, color:T.red }}>{liveMembers.error}</div>
              </div>
            )}

            <div style={{ padding:"12px 24px", borderBottom:`1px solid ${T.border}`, display:"flex", flexDirection: isMobile ? "column" : "row", gap:10, alignItems: isMobile ? "stretch" : "center" }}>
              <input
                value={inviteInput}
                onChange={(e) => { setInviteInput(e.target.value); setInviteErr(""); }}
                placeholder="email@convidado.com (vários separados por vírgula)"
                style={{ ...G, flex:1, minWidth:0, padding:"9px 12px", border:`1.5px solid ${T.border}`, borderRadius:9, fontSize:13, color:T.ink, background:T.surface, outline:"none" }}
              />
              <BtnPrimary
                small
                onClick={async () => {
                  const parts = inviteInput.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
                  if (!parts.length) {
                    setInviteErr("Informe pelo menos um e-mail.");
                    return;
                  }
                  setInviteBusy(true);
                  setInviteErr("");
                  try {
                    await liveMembers.inviteByEmails(parts);
                    setInviteInput("");
                  } catch (e) {
                    setInviteErr(formatOrganizationsApiError(e));
                  } finally {
                    setInviteBusy(false);
                  }
                }}
              >
                {inviteBusy ? "Enviando…" : <><UserPlus size={12}/> Convidar</>}
              </BtnPrimary>
            </div>
            {inviteErr && (
              <div style={{ padding:"0 24px 12px", ...G, fontSize:12, color:T.red }}>{inviteErr}</div>
            )}

            {!liveMembers.loading && liveMembers.members.map((m, i, arr) => {
              const self = currentUser && m.user_id === currentUser.id;
              const label = self ? displayName(currentUser) : `Participante (${m.user_id.slice(0, 8)}…)`;
              const sub = self && currentUser?.email ? currentUser.email : `ID ${m.user_id}`;
              const rolePt = m.role === "owner" ? "Administrador" : "Membro";
              const color = memberColors[i % memberColors.length];
              return (
                <div key={m.membership_id || m.user_id} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 24px", borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ width:38, height:38, borderRadius:9999, background:`linear-gradient(135deg,${color},${color}99)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff", flexShrink:0 }}>{rowInitials(label)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                      {label}
                      {self && <span style={{ ...G, fontSize:10, fontWeight:700, background:T.grayLight, color:T.inkLight, padding:"1px 7px", borderRadius:99 }}>você</span>}
                    </div>
                    <div style={{ ...G, fontSize:11, color:T.inkLight, wordBreak:"break-all" }}>{sub}</div>
                  </div>
                  <span style={{ ...G, fontSize:11, fontWeight:600, background: m.role === "owner" ? T.purpleLight : T.grayLight, color: m.role === "owner" ? T.purple : T.inkMid, padding:"3px 10px", borderRadius:99, flexShrink:0 }}>{rolePt}</span>
                  {!self && m.role !== "owner" && (
                    <BtnGhost danger onClick={() => { void liveMembers.removeOrgMember(m.user_id); }}>Remover</BtnGhost>
                  )}
                </div>
              );
            })}

            {pendingInvites.length > 0 && (
              <>
                <div style={{ padding:"14px 24px 6px", ...G, fontSize:11, fontWeight:700, color:T.inkLight, letterSpacing:"0.06em" }}>CONVITES PENDENTES</div>
                {pendingInvites.map((inv, j) => (
                  <div key={inv.id} style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", padding:"10px 24px", borderBottom: j < pendingInvites.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ flex:1, minWidth:160, ...G, fontSize:13, color:T.ink }}>{inv.email}</div>
                    <BtnGhost onClick={() => { void liveMembers.resendInvite(inv.id); }}>Reenviar</BtnGhost>
                    <BtnGhost danger onClick={() => { void liveMembers.cancelInvite(inv.id); }}>Cancelar</BtnGhost>
                  </div>
                ))}
              </>
            )}
          </SectionCard>
        </div>
      );
    }

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <SectionCard>
          <div style={{ padding:"16px 24px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:T.blueLight, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Users size={16} color={T.blue}/>
              </div>
              <div>
                <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>Membros</div>
                <div style={{ ...G, fontSize:12, color:T.inkMid }}>Gerencie quem tem acesso à organização</div>
              </div>
            </div>
            <BtnPrimary small onClick={()=>{}}><UserPlus size={12}/> Convidar</BtnPrimary>
          </div>
          {/* Owner */}
          {[
            { initials:"AS", name:"Aislan Santos", email:"aislan@email.com", role:"Administrador", since:"04/03/2026", color:T.purple, self:true },
            ...(membros.length > 0 ? membros.map((m) => ({
              initials: m.substring(0,2).toUpperCase(), name:m, email:`${m.toLowerCase().replace(/\s+/g,".")}@email.com`,
              role:"Membro", since:"04/03/2026", color:T.blue, self:false,
            })) : [
              { initials:"AS", name:"Ana Souza", email:"ana.souza@email.com", role:"Membro", since:"04/03/2026", color:T.green, self:false },
            ]),
          ].map((m, i, arr) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 24px", borderBottom: i < arr.length-1 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ width:38, height:38, borderRadius:9999, background:`linear-gradient(135deg,${m.color},${m.color}99)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff", flexShrink:0 }}>{m.initials}</div>
              <div style={{ flex:1 }}>
                <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, display:"flex", alignItems:"center", gap:7 }}>
                  {m.name} {m.self && <span style={{ ...G, fontSize:10, fontWeight:700, background:T.grayLight, color:T.inkLight, padding:"1px 7px", borderRadius:99 }}>você</span>}
                </div>
                <div style={{ ...G, fontSize:11, color:T.inkLight }}>{m.email}</div>
              </div>
              <span style={{ ...G, fontSize:11, fontWeight:600, background: m.role==="Administrador" ? T.purpleLight : T.grayLight, color: m.role==="Administrador" ? T.purple : T.inkMid, padding:"3px 10px", borderRadius:99 }}>{m.role}</span>
              {!m.self && <BtnGhost danger onClick={()=>{}}>Remover</BtnGhost>}
            </div>
          ))}
        </SectionCard>
      </div>
    );
  };

  const renderCategorias = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <SectionCard>
        {/* Header */}
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

        {/* Search */}
        <div style={{ padding: isMobile ? "10px 16px" : "12px 24px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:T.bg,
            border:`1px solid ${T.border}`, borderRadius:9, padding:"8px 12px" }}>
            <Search size={13} color={T.inkLight}/>
            <input value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder="Buscar categoria…"
              style={{ ...G, flex:1, minWidth:0, border:"none", outline:"none",
                background:"transparent", fontSize:13, color:T.ink }}/>
          </div>
        </div>

        {/* New category form */}
        {editCat === "new" && (
          <div style={{ padding: isMobile ? "12px 16px" : "14px 24px",
            borderBottom:`1px solid ${T.border}`, background:T.blueLight }}>
            <div style={{ ...G, fontSize:10, fontWeight:700, color:T.blue,
              textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>Nova categoria</div>
            <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap:8, alignItems: isMobile ? "stretch" : "center" }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nome da categoria" autoFocus
                style={{ ...G, flex:1, minWidth:0, padding:"9px 12px", border:`1.5px solid ${T.border}`,
                  borderRadius:9, fontSize:13, color:T.ink, background:T.surface, outline:"none" }}/>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
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

        {/* Category + tags list */}
        {filteredCats.map((cat, i) => (
          <div key={cat.id} style={{ borderBottom: i < filteredCats.length-1 ? `1px solid ${T.border}` : "none" }}>

            {/* Category row */}
            <div style={{ display:"flex", alignItems:"center", gap:10,
              padding: isMobile ? "11px 16px" : "11px 24px" }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:cat.color, flexShrink:0 }}/>

              {editCat === cat.id ? (
                <div style={{ flex:1, display:"flex", flexDirection: isMobile ? "column" : "row",
                  gap:8, alignItems: isMobile ? "stretch" : "center", minWidth:0 }}>
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)} autoFocus
                    style={{ ...G, flex:1, minWidth:0, padding:"6px 10px", border:`1.5px solid ${T.blue}`,
                      borderRadius:8, fontSize:13, color:T.ink, background:T.surface, outline:"none" }}/>
                  <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                    <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)}
                      style={{ width:30, height:30, borderRadius:7, border:`1px solid ${T.border}`, cursor:"pointer", padding:2 }}/>
                    <button onClick={() => handleUpdateCat(cat.id)}
                      style={{ ...G, background:T.ink, color:"#fff", border:"none", borderRadius:8,
                        padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer" }}>OK</button>
                    <button onClick={() => setEditCat(null)}
                      style={{ ...G, background:"none", color:T.inkMid, border:`1px solid ${T.border}`,
                        borderRadius:8, padding:"6px 10px", fontSize:12, cursor:"pointer" }}>×</button>
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ ...G, fontSize:13, color:T.ink, flex:1, minWidth:0 }}>{cat.name}</span>
                  <button onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                    style={{ ...G, display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:99,
                      background: expandedCat===cat.id ? `${cat.color}18` : T.grayLight,
                      border:`1px solid ${expandedCat===cat.id ? cat.color+"44" : T.border}`,
                      color: expandedCat===cat.id ? cat.color : T.inkMid,
                      fontSize:11, fontWeight:600, cursor:"pointer", flexShrink:0,
                      transition:"all 0.15s" }}>
                    <Hash size={10}/>
                    {(cat.tags||[]).length}
                  </button>
                  <button onClick={() => { setEditCat(cat.id); setNewCatName(cat.name); setNewCatColor(cat.color); }}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:5, borderRadius:7, display:"flex", flexShrink:0 }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.grayLight}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <Pencil size={13} color={T.inkLight}/>
                  </button>
                  <button onClick={() => handleDeleteCat(cat.id)}
                    style={{ background:"none", border:"none", cursor:"pointer", padding:5, borderRadius:7, display:"flex", flexShrink:0 }}
                    onMouseEnter={e=>e.currentTarget.style.color=T.red}
                    onMouseLeave={e=>e.currentTarget.style.color=T.red+"66"}>
                    <Trash2 size={13} color={T.red+"66"}/>
                  </button>
                </>
              )}
            </div>

            {/* Tags panel */}
            {expandedCat === cat.id && (
              <div style={{ padding: isMobile ? "10px 16px 14px 36px" : "10px 24px 14px 44px",
                background:`${cat.color}08`, borderTop:`1px solid ${cat.color}22` }}>
                <div style={{ ...G, fontSize:10, fontWeight:700, color:cat.color,
                  textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
                  Tags de {cat.name}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                  {(cat.tags||[]).map((tag, ti) => (
                    <span key={ti} style={{ ...G, display:"flex", alignItems:"center", gap:5, fontSize:12,
                      background:T.surface, border:`1px solid ${T.border}`, borderRadius:99,
                      padding:"4px 10px", color:T.inkMid }}>
                      #{tag}
                      <button onClick={() => setCats(prev => prev.map(c =>
                          c.id===cat.id ? {...c, tags:(c.tags||[]).filter((_,j)=>j!==ti)} : c))}
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
                        const tag = (newTagInputs[cat.id]||"").trim().toLowerCase().replace(/\s+/g, "-");
                        if (!tag || (cat.tags||[]).includes(tag)) return;
                        setCats(prev => prev.map(c => c.id===cat.id ? {...c, tags:[...(c.tags||[]), tag]} : c));
                        setNewTagInputs(p => ({...p, [cat.id]: ""}));
                      }}
                      placeholder="nova tag (Enter)"
                      style={{ ...G, flex:1, minWidth:0, border:"none", outline:"none",
                        background:"transparent", fontSize:12, color:T.ink }}/>
                  </div>
                  <button
                    onClick={() => {
                      const tag = (newTagInputs[cat.id]||"").trim().toLowerCase().replace(/\s+/g, "-");
                      if (!tag || (cat.tags||[]).includes(tag)) return;
                      setCats(prev => prev.map(c => c.id===cat.id ? {...c, tags:[...(c.tags||[]), tag]} : c));
                      setNewTagInputs(p => ({...p, [cat.id]: ""}));
                    }}
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

  const renderWhatsAppBody = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Hero informativo */}
      <div style={{ background:"#1A1A2E", borderRadius:16, padding:"20px 24px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:130, height:130, borderRadius:"50%", background:"rgba(37,99,235,0.12)" }}/>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <div style={{ width:40, height:40, borderRadius:11, background:"rgba(37,99,235,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <MessageCircle size={20} color="#60A5FA"/>
          </div>
          <div>
            <div style={{ ...G, fontSize:15, fontWeight:800, color:"#fff" }}>Assistente WhatsApp</div>
            <div style={{ ...G, fontSize:12, color:"rgba(255,255,255,0.45)" }}>Registre transações por voz ou texto</div>
          </div>
        </div>
        <div style={{ ...G, fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.7 }}>
          Envie uma mensagem para o número do assistente e ele registrará automaticamente a transação na sua conta Fincla. Os números autorizados abaixo têm acesso.
        </div>
        <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,0.06)", borderRadius:10, padding:"10px 14px" }}>
          <div style={{ ...G, fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase", letterSpacing:"0.07em" }}>Número do assistente</div>
          <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:14, fontWeight:700, color:"#60A5FA", flex:1 }}>+55 11 9xxxx-xxxx</div>
          <button style={{ ...G, fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", background:"rgba(255,255,255,0.08)", border:"none", borderRadius:7, padding:"5px 10px", cursor:"pointer" }}>Copiar</button>
        </div>
      </div>

      <SectionCard>
        <div style={{ padding:"16px 24px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ ...G, fontSize:15, fontWeight:800, color:T.ink }}>Números autorizados</div>
            <div style={{ ...G, fontSize:12, color:T.inkMid }}>
              {liveEnabled ? whatsConns.length : whatsNums.length} número{(liveEnabled ? whatsConns.length : whatsNums.length) !== 1 ? "s" : ""} com acesso
            </div>
          </div>
          <BtnPrimary small onClick={() => setAddNumOpen(o => !o)}><Plus size={12}/> Vincular número</BtnPrimary>
        </div>
        {whatsLoading && <div style={{ padding:"12px 24px", ...G, fontSize:13, color:T.inkLight }}>Carregando conexões…</div>}
        {whatsError && <div style={{ padding:"12px 24px", ...G, fontSize:12, color:T.red }}>{whatsError}</div>}
        {/* Add form */}
        {addNumOpen && (
          <div style={{ padding:"14px 24px", borderBottom:`1px solid ${T.border}`, background:T.greenLight }}>
            <div style={{ ...G, fontSize:11, fontWeight:700, color:T.green, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Novo número</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              <input value={novoNum} onChange={e => setNovoNum(e.target.value)} placeholder="+55 11 99999-0000"
                style={{ ...G, flex:"1 1 160px", padding:"9px 12px", border:`1.5px solid ${T.border}`, borderRadius:9, fontSize:13, color:T.ink, background:T.surface, outline:"none" }}/>
              <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome (ex: Ana — pessoal)"
                style={{ ...G, flex:"1 1 180px", padding:"9px 12px", border:`1.5px solid ${T.border}`, borderRadius:9, fontSize:13, color:T.ink, background:T.surface, outline:"none" }}/>
              <BtnPrimary small onClick={handleLinkWhats}>Vincular</BtnPrimary>
              <BtnGhost onClick={() => { setAddNumOpen(false); setNovoNum(""); setNovoNome(""); }}>Cancelar</BtnGhost>
            </div>
            <div style={{ ...G, fontSize:11, color:T.green, marginTop:8 }}>💡 O número receberá um código de verificação via WhatsApp.</div>
          </div>
        )}
        {/* Numbers list — live */}
        {liveEnabled && whatsConns.map((c, i) => (
          <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 24px", borderBottom: i < whatsConns.length-1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ width:38, height:38, borderRadius:9, background: c.is_active ? T.greenLight : T.amberLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Smartphone size={16} color={c.is_active ? T.green : T.amber}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:13, fontWeight:700, color:T.ink }}>{c.phone_number}</div>
              <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:2 }}>Conectado em {new Date(c.connected_at).toLocaleDateString("pt-BR")}</div>
            </div>
            <span style={{ ...G, fontSize:11, fontWeight:700, background: c.is_active ? T.greenLight : T.amberLight, color: c.is_active ? T.green : T.amber, padding:"3px 10px", borderRadius:99 }}>
              {c.is_active ? "Ativo" : "Inativo"}
            </span>
            <BtnGhost danger onClick={() => handleUnlinkWhats(c.id)}>Revogar</BtnGhost>
          </div>
        ))}
        {/* Numbers list — mock */}
        {!liveEnabled && whatsNums.map((n, i) => (
          <div key={n.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 24px", borderBottom: i < whatsNums.length-1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ width:38, height:38, borderRadius:9, background: n.status==="ativo" ? T.greenLight : T.amberLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Smartphone size={16} color={n.status==="ativo" ? T.green : T.amber}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ ...G, fontSize:13, fontWeight:700, color:T.ink, marginBottom:2 }}>{n.nome}</div>
              <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:12, color:T.inkMid }}>{n.num}</div>
              <div style={{ ...G, fontSize:11, color:T.inkLight, marginTop:2 }}>Último uso: {n.ultimo}</div>
            </div>
            <span style={{ ...G, fontSize:11, fontWeight:700, background: n.status==="ativo" ? T.greenLight : T.amberLight, color: n.status==="ativo" ? T.green : T.amber, padding:"3px 10px", borderRadius:99 }}>
              {n.status === "ativo" ? "Ativo" : "Pendente"}
            </span>
            <BtnGhost danger onClick={() => handleUnlinkWhats(n.id)}>Revogar</BtnGhost>
          </div>
        ))}
        {liveEnabled && !whatsLoading && whatsConns.length === 0 && (
          <CardEmptyWithCta
            icon="📱"
            iconSize={28}
            title="Nenhum número vinculado"
            sub="Vincule um número autorizado para registrar transações pelo assistente no WhatsApp."
            primaryLabel="Vincular número"
            onPrimary={() => setAddNumOpen(true)}
          />
        )}
        {!liveEnabled && whatsNums.length === 0 && (
          <CardEmptyWithCta
            icon="📱"
            iconSize={28}
            title="Nenhum número vinculado"
            sub="Vincule um número autorizado para registrar transações pelo assistente no WhatsApp."
            primaryLabel="Vincular número"
            onPrimary={() => setAddNumOpen(true)}
          />
        )}
      </SectionCard>
    </div>
  );

  const renderAssinatura = () => (
    <BillingPanel
      SectionCard={SectionCard}
      SectionHeader={SectionHeader}
      dataMode={dataMode}
    />
  );

  // Gate the WhatsApp tab on the `whatsapp_assistant` feature. Essential and
  // higher plans have the key, so this is a no-op for paying users; the
  // fallback only kicks in for legacy ``free`` accounts and future plans
  // that drop the assistant.
  const renderWhatsApp = () => (
    <FeatureGate
      feature="whatsapp_assistant"
      user={currentUser}
      fallback={
        <UpgradePrompt
          feature="whatsapp_assistant"
          message="O assistente WhatsApp está disponível a partir do plano Essential."
          ctaLabel="Ver planos"
          onUpgradeClick={() => onNav("assinatura")}
        />
      }
    >
      {renderWhatsAppBody()}
    </FeatureGate>
  );

  const RENDERERS = { perfil:renderPerfil, seguranca:renderSeguranca, organizacao:renderOrganizacao, membros:renderMembros, categorias:renderCategorias, whatsapp:renderWhatsApp, assinatura:renderAssinatura };

  return (
    <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap:20, alignItems:"flex-start", width:"100%" }}>
      {/* Sub-nav */}
      {!isMobile && (
        <div style={{ width:200, flexShrink:0, display:"flex", flexDirection:"column", gap:4, position:"sticky", top:0 }}>
          {SUB_NAV.map(({ group, items }) => (
            <div key={group}>
              <div style={{ ...G, fontSize:10, fontWeight:700, color:T.inkMid, textTransform:"uppercase", letterSpacing:"0.1em", padding:"10px 10px 4px" }}>{group}</div>
              {items.map(({ id, label, Icon }) => {
                const active = subPage === id;
                return (
                  <button key={id} onClick={() => goToSettingsTab(id)} style={{ ...G, width:"100%", display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:9, border:"none", cursor:"pointer", marginBottom:1, transition:"all 0.12s", background: active ? T.ink : "transparent", color: active ? "#fff" : T.inkMid, fontWeight: active ? 600 : 400, fontSize:13, textAlign:"left" }}>
                    <Icon size={13} strokeWidth={active ? 2.5 : 2}/>
                    {label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      {/* Mobile sub-nav strip */}
      {isMobile && (
        <DragScrollTabs bg={T.bg}>
          {SUB_NAV.flatMap(g => g.items).map(({ id, label, Icon }) => {
            const active = subPage === id;
            return (
              <button key={id} onClick={() => goToSettingsTab(id)}
                style={{ ...G, display:"flex", alignItems:"center", gap:6,
                  padding:"7px 14px", borderRadius:99,
                  border:`1px solid ${active ? T.ink : T.border}`,
                  background: active ? T.ink : T.surface,
                  color: active ? "#fff" : T.inkMid,
                  fontSize:12, fontWeight: active ? 700 : 400,
                  cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                <Icon size={12}/>{label}
              </button>
            );
          })}
        </DragScrollTabs>
      )}
      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ ...G, fontSize:22, fontWeight:800, color:T.ink, marginBottom:4 }}>
          {fmtS(subPage)}
        </div>
        <div style={{ ...G, fontSize:13, color:T.inkMid, marginBottom:18 }}>Gerencie suas informações e configurações da conta</div>
        {(RENDERERS[subPage] || (() => null))()}
      </div>
    </div>
  );
}
