import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FlaskConical,
  Plus,
  ChevronRight,
  X,
  Trash2,
  ChevronDown,
  AlertTriangle,
  Target,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { T } from "../tokens";
import { G, S, NUM } from "../typography";
import { M_MONO } from "../features/moodV4";
import { fmtAbs, fmtK } from "../formatters";
import {
  Badge,
  Breadcrumb,
  Btn,
  Card,
  PageTitle,
} from "../components/primitives";
import {
  simulateForUi,
  formatSimulationApiError,
  deriveRisksFromResponse,
  deriveImpactsFromResponse,
  deriveRecsFromResponse,
  deriveChartDataFromResponse,
  deriveKpisFromResponse,
} from "../data/simulationAdapter";


const T_RED   = "#DC2626"; const T_AMBER = "#D97706";
const T_GREEN = "#059669"; const T_BLUE  = "#2563EB";

const TIPOS_ITEM = [
  { id: "despesa_parcelada",  label: "Despesa parcelada",  emoji: "🛍️", cor: T_RED   },
  { id: "despesa_recorrente", label: "Despesa recorrente", emoji: "🔁", cor: T_AMBER  },
  { id: "receita_pontual",    label: "Receita pontual",    emoji: "💰", cor: T_GREEN  },
  { id: "receita_recorrente", label: "Receita recorrente", emoji: "📈", cor: T_GREEN  },
  { id: "ajuste_categoria",   label: "Ajuste de categoria",emoji: "✂️", cor: T_BLUE   },
];

const BANCOS_SIM     = ["Nubank", "Itaú Personnalité", "Bradesco", "Inter", "Pix", "Dinheiro"];
const CATEGORIAS_SIM = ["Tecnologia","Alimentação","Transporte","Moradia","Lazer","Saúde","Assinaturas","Outros"];
const BUDGET_FALLBACK = 4200;

/* ── Shimmer loading skeleton ─────────────────────────── */
const shimmerKeyframes = `@keyframes fincla-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`;
const shimmerBg = { background: `linear-gradient(90deg, ${T.grayLight} 25%, ${T.border} 50%, ${T.grayLight} 75%)`, backgroundSize: "200% 100%", animation: "fincla-shimmer 1.4s ease-in-out infinite" };
const SkeletonBlock = ({ h = 16, w = "100%", r = 6, style }) => (
  <div style={{ height: h, width: w, borderRadius: r, ...shimmerBg, ...style }} />
);
const SimLoadingSkeleton = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <style>{shimmerKeyframes}</style>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Card style={{ padding: 18 }}>
        <SkeletonBlock h={20} w="50%" style={{ marginBottom: 14 }} />
        <SkeletonBlock h={14} w="70%" style={{ marginBottom: 10 }} />
        {[1, 2, 3].map(i => <SkeletonBlock key={i} h={44} style={{ marginBottom: 8 }} />)}
      </Card>
      <Card style={{ padding: 18 }}>
        <SkeletonBlock h={20} w="40%" style={{ marginBottom: 14 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
          {[1, 2, 3].map(i => <SkeletonBlock key={i} h={80} r={0} />)}
        </div>
        <SkeletonBlock h={52} style={{ marginBottom: 10 }} />
        <SkeletonBlock h={90} />
      </Card>
    </div>
    <Card style={{ padding: 20 }}><SkeletonBlock h={220} /></Card>
    <div className="fincla-sim-insights-grid">
      {[1, 2, 3].map(i => <Card key={i} style={{ padding: 18 }}><SkeletonBlock h={20} w="50%" style={{ marginBottom: 14 }} />{[1, 2].map(j => <SkeletonBlock key={j} h={40} style={{ marginBottom: 10 }} />)}</Card>)}
    </div>
  </div>
);

/* ── Responsive CSS for insights grid ─────────────────── */
const INSIGHTS_RESPONSIVE_CSS = `
.fincla-sim-insights-grid{display:grid;gap:14px;grid-template-columns:1fr 1fr 1fr}
@media(max-width:1199px){.fincla-sim-insights-grid{grid-template-columns:1fr 1fr}}
@media(max-width:899px){.fincla-sim-insights-grid{grid-template-columns:1fr}}
`;
/* ── Modal Novo Cenário ────────────────────────────────── */
const ModalNovoCenario = ({ open, onClose, onCriar, initialTipo = null }) => {
  const [nome,       setNome]       = useState("");
  const [budgetEdit, setBudgetEdit] = useState(false);
  const [budgetVal,  setBudgetVal]  = useState(String(BUDGET_FALLBACK));
  const [items,      setItems]      = useState([]);
  const [showForm,   setShowForm]   = useState(false);
  // form novo item
  const [tipo,    setTipo]    = useState(initialTipo || "despesa_parcelada");
  const [iNome,   setINome]   = useState("");
  const [iValor,  setIValor]  = useState("");
  const [iCat,    setICat]    = useState("Tecnologia");
  const [iBanco,  setIBanco]  = useState("Nubank");
  const [iParcelas,setIParcelas] = useState("12");
  const [iMeses,  setIMeses]  = useState("6");

  // quando o modal abre com um tipo pré-definido, já expande o formulário
  useEffect(() => {
    if (open && initialTipo) {
      setTipo(initialTipo);
      setShowForm(true);
    }
    if (!open) {
      // reset ao fechar
      setNome(""); setBudgetEdit(false); setBudgetVal(String(BUDGET_FALLBACK));
      setItems([]); setShowForm(false);
      setTipo(initialTipo || "despesa_parcelada");
      setINome(""); setIValor("");
    }
  }, [open]);

  const budgetNum  = parseFloat(budgetVal.replace(/[^\d.,]/g,"").replace(",",".")) || BUDGET_FALLBACK;
  const overridden = budgetNum !== BUDGET_FALLBACK;
  const totalItems = items.reduce((s,i) => s + i.total, 0);
  const totalMes   = items.reduce((s,i) => s + i.valParcela, 0);

  const resetForm = () => { setINome(""); setIValor(""); setICat("Tecnologia"); setIBanco("Nubank"); setIParcelas("12"); setIMeses("6"); setShowForm(false); };

  const addItem = () => {
    const val = parseFloat(iValor.replace(/[^\d.,]/g,"").replace(",",".")) || 0;
    if (!iNome || !val) return;
    const parc = tipo === "despesa_parcelada" ? parseInt(iParcelas) || 1 : 1;
    const mes  = tipo === "despesa_recorrente" || tipo === "receita_recorrente" ? parseInt(iMeses) || 1 : null;
    const isReceita = tipo === "receita_pontual" || tipo === "receita_recorrente";
    const isAjuste  = tipo === "ajuste_categoria";
    const valParcela = parc > 1 ? +(val / parc).toFixed(2) : val;
    const badge = parc > 1 ? `${parc}× meses` : mes ? `${mes} meses` : null;
    setItems(l => [...l, { id: Date.now(), tipo, nome: iNome, cat: iCat, banco: tipo === "ajuste_categoria" ? "-" : iBanco, parcelas: parc, meses: mes, valParcela, total: isReceita ? -val : val, badge, isReceita, isAjuste }]);
    resetForm();
  };

  const criar = () => {
    onCriar({ nome: nome || "Novo cenário", budgetOverride: overridden ? budgetNum : null, items });
    setNome(""); setBudgetEdit(false); setBudgetVal(String(BUDGET_FALLBACK)); setItems([]); resetForm();
  };

  if (!open) return null;

  const inputStyle = { ...G, height: 36, border: `1.5px solid ${T.border}`, borderRadius: 9, padding: "0 11px", fontSize: 12, color: T.ink, background: T.surface, outline: "none", width: "100%", fontFamily: "'Geist', sans-serif" };
  const selectStyle = { ...inputStyle, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%239CA3AF'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 11px center", paddingRight: 28 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,15,13,0.5)", zIndex: 500, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 48 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: T.surface, borderRadius: 18, width: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden" }}>

        {/* Header roxo */}
        <div style={{ background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 100%)", padding: "20px 24px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div>
            <div style={{ ...G, display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.15)", borderRadius: 99, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.06em", marginBottom: 8 }}>✦ SIMULAÇÃO</div>
            <div style={{ ...G, fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Novo cenário</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.8)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Body scrollável */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flex: 1 }}>

          {/* Nome */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkMid }}>Nome do cenário</label>
            <input style={{ ...inputStyle, ...(nome ? {} : { borderColor: T.purple, boxShadow: `0 0 0 3px ${T.purple}11` }) }}
              placeholder="Ex: Compra do notebook novo"
              value={nome} onChange={e => setNome(e.target.value)} autoFocus />
          </div>

          {/* Orçamento */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <label style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkMid }}>Orçamento do período</label>
              <span style={{ ...G, fontSize: 10, color: T.inkLight }}>opcional</span>
            </div>
            {!budgetEdit ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: T.grayLight, border: `1.5px solid ${T.border}`, borderRadius: 10, cursor: "pointer" }}
                onClick={() => setBudgetEdit(true)}>
                <span style={{ fontSize: 13 }}>💰</span>
                <span style={{ ...M_MONO, ...NUM, fontSize: 14, fontWeight: 800, color: T.ink, flex: 1 }}>R$ 4.200,00</span>
                <span style={{ ...G, fontSize: 10, color: T.inkLight, display: "flex", alignItems: "center", gap: 4 }}>✏️ Ajustar para este cenário</span>
              </div>
            ) : (
              <div style={{ border: `1.5px solid ${overridden && budgetNum > BUDGET_FALLBACK ? T.purple : T.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", background: overridden ? T.purpleLight : T.grayLight }}>
                  <span style={{ fontSize: 13 }}>💰</span>
                  {overridden && <span style={{ ...M_MONO, ...NUM, fontSize: 12, color: T.inkLight, textDecoration: "line-through" }}>R$ 4.200</span>}
                  {overridden && <span style={{ fontSize: 11, color: T.inkLight }}>→</span>}
                  <input style={{ ...G, fontFamily: "'Geist Mono', monospace", fontSize: 14, fontWeight: 800, color: overridden ? T.purple : T.ink, background: "none", border: "none", outline: "none", flex: 1, fontVariantNumeric: "tabular-nums" }}
                    value={budgetVal}
                    onChange={e => setBudgetVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") setBudgetEdit(false); if (e.key === "Escape") { setBudgetVal(String(BUDGET_FALLBACK)); setBudgetEdit(false); } }}
                    autoFocus />
                  {overridden && <button onClick={() => { setBudgetVal(String(BUDGET_FALLBACK)); setBudgetEdit(false); }} style={{ ...G, background: "none", border: "none", fontSize: 10, color: T.inkLight, cursor: "pointer", textDecoration: "underline" }}>Restaurar</button>}
                </div>
                <div style={{ display: "flex", borderTop: `1px solid ${T.border}` }}>
                  <button onClick={() => setBudgetEdit(false)} style={{ ...G, flex: 1, height: 32, background: T.purple, color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✓ Confirmar</button>
                  <button onClick={() => { setBudgetVal(String(BUDGET_FALLBACK)); setBudgetEdit(false); }} style={{ ...G, flex: 1, height: 32, background: "none", border: "none", borderLeft: `1px solid ${T.border}`, cursor: "pointer", fontSize: 11, color: T.inkMid }}>✕ Cancelar</button>
                </div>
              </div>
            )}
            <div style={{ ...G, fontSize: 10, color: T.inkLight }}>Deixe como está para usar o orçamento real da conta.</div>
          </div>

          {/* Divider itens */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.09em", whiteSpace: "nowrap" }}>Itens do cenário</div>
            <div style={{ flex: 1, height: 1, background: T.border }} />
            <span style={{ ...G, fontSize: 10, color: T.inkLight }}>opcional</span>
          </div>

          {/* Lista de itens já adicionados */}
          {items.map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: T.grayLight, border: `1px solid ${T.border}`, borderRadius: 9 }}>
              <span style={{ fontSize: 16 }}>{TIPOS_ITEM.find(t => t.id === item.tipo)?.emoji || "📦"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink }}>{item.nome}</div>
                <div style={{ ...G, fontSize: 10, color: T.inkMid }}>{item.cat} · {item.parcelas > 1 ? `${item.parcelas}×` : item.meses ? `${item.meses} meses` : "à vista"}</div>
              </div>
              {item.badge && <Badge color={T.amber} bg={T.amberLight}>{item.badge}</Badge>}
              <span style={{ ...M_MONO, ...NUM, fontSize: 12, fontWeight: 700, color: item.isReceita ? T.green : T.ink }}>{item.isReceita ? "+" : ""}{fmtAbs(Math.abs(item.total))}</span>
              <button onClick={() => setItems(l => l.filter(x => x.id !== item.id))} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkLight, padding: 2 }}><X size={13} /></button>
            </div>
          ))}

          {/* Formulário inline de novo item */}
          {showForm ? (
            <div style={{ border: `1.5px dashed ${T.purple}55`, borderRadius: 12, padding: 14, background: T.purpleLight, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.purple }}>Novo item</div>

              {/* Pills de tipo */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                {TIPOS_ITEM.map(t => (
                  <button key={t.id} onClick={() => setTipo(t.id)}
                    style={{ ...G, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "8px 4px", border: `1.5px solid ${tipo === t.id ? T.purple : T.border}`, borderRadius: 9, cursor: "pointer", background: tipo === t.id ? T.surface : "rgba(255,255,255,0.5)", transition: "all 0.15s" }}>
                    <span style={{ fontSize: 16 }}>{t.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: tipo === t.id ? T.purple : T.inkMid, textAlign: "center", lineHeight: 1.3 }}>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Campos comuns: nome + valor */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Nome</label>
                  <input style={inputStyle} placeholder="Ex: MacBook Air M3" value={iNome} onChange={e => setINome(e.target.value)} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>{tipo.startsWith("ajuste") ? "Valor do ajuste" : "Valor total"}</label>
                  <input style={{ ...inputStyle, fontFamily: "'Geist Mono', monospace" }} placeholder="R$ 0,00" value={iValor} onChange={e => setIValor(e.target.value)} />
                </div>
              </div>

              {/* Campos específicos por tipo */}
              {tipo === "despesa_parcelada" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Categoria</label>
                    <select style={selectStyle} value={iCat} onChange={e => setICat(e.target.value)}>{CATEGORIAS_SIM.map(c => <option key={c}>{c}</option>)}</select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Cartão / banco</label>
                    <select style={selectStyle} value={iBanco} onChange={e => setIBanco(e.target.value)}>{BANCOS_SIM.map(b => <option key={b}>{b}</option>)}</select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Parcelas</label>
                    <select style={selectStyle} value={iParcelas} onChange={e => setIParcelas(e.target.value)}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(n => <option key={n} value={n}>{n === 1 ? "à vista" : `${n}× (R$ ${iValor ? (parseFloat(iValor.replace(/[^\d.,]/g,"").replace(",","."))/n).toFixed(2) : "—"})`}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {(tipo === "despesa_recorrente" || tipo === "receita_recorrente") && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Categoria</label>
                    <select style={selectStyle} value={iCat} onChange={e => setICat(e.target.value)}>{CATEGORIAS_SIM.map(c => <option key={c}>{c}</option>)}</select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Duração</label>
                    <select style={selectStyle} value={iMeses} onChange={e => setIMeses(e.target.value)}>
                      {[1,2,3,4,5,6,9,12,24].map(n => <option key={n} value={n}>{n} {n === 1 ? "mês" : "meses"}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Periodicidade</label>
                    <select style={selectStyle}><option>Mensal</option><option>Semanal</option></select>
                  </div>
                </div>
              )}
              {tipo === "receita_pontual" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Categoria</label>
                    <select style={selectStyle} value={iCat} onChange={e => setICat(e.target.value)}>{CATEGORIAS_SIM.map(c => <option key={c}>{c}</option>)}</select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Data prevista</label>
                    <input style={inputStyle} type="date" />
                  </div>
                </div>
              )}
              {tipo === "ajuste_categoria" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Categoria</label>
                    <select style={selectStyle} value={iCat} onChange={e => setICat(e.target.value)}>{CATEGORIAS_SIM.map(c => <option key={c}>{c}</option>)}</select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Direção</label>
                    <select style={selectStyle}><option>Cortar</option><option>Aumentar</option></select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Tipo de valor</label>
                    <select style={selectStyle}><option>Valor fixo (R$)</option><option>Percentual (%)</option></select>
                  </div>
                </div>
              )}

              {/* Ações do form */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={resetForm} style={{ ...G, height: 32, padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 8, background: "none", fontSize: 11, color: T.inkMid, cursor: "pointer" }}>Cancelar</button>
                <button onClick={addItem} style={{ ...G, height: 32, padding: "0 14px", background: T.purple, border: "none", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer" }}>+ Adicionar item</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)}
              style={{ ...G, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 14, border: `1.5px dashed ${T.border}`, borderRadius: 9, background: "none", fontSize: 11, fontWeight: 700, color: T.purple, cursor: "pointer", transition: "all 0.15s" }}>
              <Plus size={13} /> Adicionar {items.length === 0 ? "primeiro item" : "outro item"}
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.grayLight, flexShrink: 0 }}>
          <span style={{ ...G, fontSize: 10, color: T.inkLight }}>
            {items.length === 0 ? "Você pode adicionar itens depois de criar o cenário." : `${items.length} ${items.length === 1 ? "item" : "itens"} · ${fmtAbs(totalItems)} total`}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ ...G, height: 36, padding: "0 14px", border: `1px solid ${T.border}`, borderRadius: 9, background: "none", fontSize: 12, color: T.inkMid, cursor: "pointer" }}>Cancelar</button>
            <button onClick={criar} disabled={!nome.trim()} style={{ ...G, height: 36, padding: "0 18px", background: nome.trim() ? T.purple : T.inkGhost, border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, color: "#fff", cursor: nome.trim() ? "pointer" : "default", transition: "background 0.2s" }}>
              Criar cenário →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Onboarding (estado vazio) ─────────────────────────── */
const SimOnboarding = ({ onNovo }) => {
  const casos = [
    { emoji: "💻", titulo: "Compra grande",     desc: "Simule uma compra parcelada e veja o impacto no orçamento.", tipo: "despesa_parcelada"  },
    { emoji: "📈", titulo: "Aumento de salário", desc: "Veja como uma receita recorrente melhora sua margem mensal.", tipo: "receita_recorrente" },
    { emoji: "✂️", titulo: "Corte de gastos",   desc: "Simule a redução de uma categoria e descubra quanto sobra.", tipo: "ajuste_categoria"   },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 480, gap: 32 }}>
      {/* Ícone central */}
      <div style={{ width: 64, height: 64, borderRadius: 18, background: T.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 8px ${T.purple}0D` }}>
        <FlaskConical size={28} color={T.purple} />
      </div>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ ...G, fontSize: 20, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em", marginBottom: 8 }}>Nenhum cenário ativo</div>
        <div style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.7 }}>
          Crie um cenário para simular o impacto de despesas, receitas ou mudanças no orçamento — sem afetar os seus dados reais.
        </div>
      </div>
      {/* Cards de caso de uso — cada um passa o tipo correto */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%", maxWidth: 560 }}>
        {casos.map((c, i) => (
          <button key={i} onClick={() => onNovo(c.tipo)}
            style={{ ...G, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "14px 14px", background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, cursor: "pointer", textAlign: "left", transition: "border 0.15s, box-shadow 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.boxShadow = `0 0 0 3px ${T.purple}11`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}>
            <span style={{ fontSize: 22 }}>{c.emoji}</span>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{c.titulo}</div>
            <div style={{ fontSize: 11, color: T.inkMid, lineHeight: 1.5 }}>{c.desc}</div>
          </button>
        ))}
      </div>
      {/* CTA genérico — abre sem tipo pré-selecionado */}
      <button onClick={() => onNovo(null)} style={{ ...G, display: "flex", alignItems: "center", gap: 8, height: 42, padding: "0 24px", background: T.purple, border: "none", borderRadius: 11, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 4px 14px ${T.purple}44` }}>
        <Plus size={15} /> Criar primeiro cenário
      </button>
    </div>
  );
};

/* ── SimulacaoPage principal ───────────────────────────── */
export function SimulacaoPage({ cenarios, setCenarios, cenarioId, setCenarioId, autoOpenModal = false, autoTipo = null, isMobile = false, organizationId = null, dataMode = "live" }) {
  const [showModal,   setShowModal]  = useState(false);
  const [modalTipo,   setModalTipo]  = useState(null);

  useEffect(() => {
    if (autoOpenModal) {
      setModalTipo(autoTipo);
      setShowModal(true);
    }
  }, [autoOpenModal, autoTipo]);
  const [showDropCen, setShowDropCen]= useState(false);
  const [simTab, setSimTab] = useState("itens");

  const cenario = cenarios.find(c => c.id === cenarioId) || null;
  const items   = cenario?.items || [];
  const setItems = newItems => setCenarios(cs => cs.map(c => c.id === cenarioId ? { ...c, items: newItems } : c));

  // ── API simulation state ──
  const [simResult,  setSimResult]  = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError,   setSimError]   = useState("");
  const debounceRef = useRef(null);

  const runSimulation = useCallback(async () => {
    if (!organizationId || !cenario) return;
    setSimLoading(true);
    setSimError("");
    try {
      const maxMonths = Math.max(12, ...items.filter(i => i.meses).map(i => i.meses), ...items.filter(i => i.parcelas > 1).map(i => i.parcelas));
      const result = await simulateForUi(organizationId, items, Math.min(maxMonths, 60));
      setSimResult(result);
    } catch (err) {
      setSimError(formatSimulationApiError(err));
    } finally {
      setSimLoading(false);
    }
  }, [organizationId, cenario, items]);

  useEffect(() => {
    if (!organizationId || !cenario) { setSimResult(null); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSimulation, 400);
    return () => clearTimeout(debounceRef.current);
  }, [runSimulation]);

  // ── Derived data from API ──
  const apiBudgetBase = simResult ? Math.round(simResult.summary.income / (simResult.months.length || 1)) : BUDGET_FALLBACK;

  // Budget override inline
  const budgetOverride = cenario?.budgetOverride || null;
  const budgetAtivo    = budgetOverride !== null ? budgetOverride : apiBudgetBase;

  const apiKpis     = simResult ? deriveKpisFromResponse(simResult, budgetAtivo) : null;
  const apiChart    = simResult ? deriveChartDataFromResponse(simResult) : [];
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetInputVal, setBudgetInputVal] = useState("");

  const setBudgetOverride = val => setCenarios(cs => cs.map(c => c.id === cenarioId ? { ...c, budgetOverride: val } : c));

  const parseBudgetInput = raw => parseFloat(raw.replace(/[^\d.,]/g,"").replace(",",".")) || 0;
  const budgetPreview    = budgetEditing ? parseBudgetInput(budgetInputVal) : budgetAtivo;

  const total    = items.reduce((s, i) => s + Math.abs(i.total), 0);
  const totalMes = items.reduce((s, i) => s + i.valParcela, 0);

  // KPIs: prefer API, fallback to local computation
  const margem     = apiKpis ? apiKpis.margem : budgetAtivo - total;
  const projecaoOk = apiKpis ? apiKpis.projecaoOk : total <= budgetAtivo;
  const projFim    = apiKpis ? apiKpis.totalExpenses : total;

  const projFimOkPreview = (apiKpis ? apiKpis.totalExpenses : total) <= budgetPreview;

  const startBudgetEdit = () => { setBudgetInputVal(String(budgetAtivo)); setBudgetEditing(true); };
  const confirmBudget   = () => {
    const v = parseBudgetInput(budgetInputVal);
    if (v > 0) setBudgetOverride(v === apiBudgetBase ? null : v);
    setBudgetEditing(false);
  };
  const cancelBudget    = () => { setBudgetEditing(false); setBudgetInputVal(""); };
  const restoreBudget   = () => { setBudgetOverride(null); setBudgetEditing(false); };

  // Analysis: derived from API or fallbacks
  const riscos   = simResult ? deriveRisksFromResponse(simResult, fmtAbs) : [];
  const impactos = simResult ? deriveImpactsFromResponse(simResult, items) : [];
  const recs     = simResult ? deriveRecsFromResponse(simResult, items) : [];

  const criarCenario = ({ nome, budgetOverride: bo, items: its }) => {
    const novoId = Date.now();
    const novo = { id: novoId, nome, budgetOverride: bo, items: its.map((it, i) => ({ ...it, id: i + 1 })) };
    setCenarios(cs => [...cs, novo]);
    setCenarioId(novoId);
    setShowModal(false);
  };

  /* ── Mobile tab labels ── */
  const SIM_TABS = [
    { id:"itens",    label:"Itens",    icon:"✏️" },
    { id:"analise",  label:"Análise",  icon:"📊" },
    { id:"grafico",  label:"Ritmo",    icon:"📈" },
    { id:"insights", label:"Riscos",   icon:"⚠️" },
  ];

  /* ── SimTooltip (needed in both layouts) ── */
  const SimTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ ...G, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", boxShadow: T.md, fontSize: 11 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: T.ink }}>Dia {label}</div>
        {payload.filter(p => p.value != null).map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9999, background: p.color }} />
            <span style={{ color: T.inkMid, flex: 1 }}>{p.name}</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 600, marginLeft: 12 }}>{fmtAbs(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  /* ── Shared: items list ── */
  const ItemsList = () => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.length === 0 && (
        <div style={{ border: `1.5px dashed ${T.purple}44`, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "28px 16px", background: T.purpleLight, margin: "4px 0" }}>
          <div style={{ fontSize: 24 }}>✦</div>
          <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.purple }}>Nenhum item ainda</div>
          <div style={{ ...G, fontSize: 11, color: `${T.purple}99`, textAlign: "center" }}>Simule despesas, receitas ou ajustes de categoria</div>
        </div>
      )}
      {items.map(item => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: isMobile ? 18 : 20 }}>{TIPOS_ITEM.find(t => t.id === item.tipo)?.emoji || "📦"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nome}</div>
            <div style={{ ...G, fontSize: 11, color: T.inkMid }}>
              {item.cat}{item.parcelas > 1 ? ` · ${item.parcelas}× · ${fmtAbs(item.valParcela)}/mês` : item.meses ? ` · ${item.meses} meses` : ""}
            </div>
          </div>
          {item.badge && <Badge color={item.isReceita ? T.green : T.amber} bg={item.isReceita ? T.greenLight : T.amberLight}>{item.badge}</Badge>}
          <div style={{ ...M_MONO, ...NUM, fontSize: 13, fontWeight: 700, color: item.isReceita ? T.green : T.ink, flexShrink: 0 }}>{item.isReceita ? "+" : ""}{fmtAbs(Math.abs(item.total))}</div>
          <button onClick={() => setItems(items.filter(x => x.id !== item.id))} style={{ background: "none", border: "none", cursor: "pointer", color: T.inkLight, padding: 4, flexShrink: 0 }}><X size={14} /></button>
        </div>
      ))}
      {items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginTop: 4 }}>
          <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{items.length} {items.length === 1 ? "item" : "itens"}</span>
          <div style={{ ...M_MONO, ...NUM, fontSize: 14, fontWeight: 800, color: projecaoOk ? T.green : T.red }}>{fmtAbs(total)}</div>
        </div>
      )}
    </div>
  );

  /* ── Shared: analysis KPIs ── */
  const KpiGrid = () => (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 1, background: T.border, borderRadius: 10, overflow: "hidden" }}>
      {[
        { label: "Total simulado",  val: fmtAbs(total),    delta: `+${fmtAbs(total)}`, sub: "mês 1", deltaColor: T.red, bg: T.surface },
        { label: "Projeção março",  val: fmtAbs(projFim),  delta: projecaoOk ? `${Math.round(projFim/budgetAtivo*100)}% do orçamento` : `+${fmtAbs(Math.abs(margem))}`, sub: projecaoOk ? "dentro do limite ✓" : "acima do orçamento", deltaColor: projecaoOk ? T.green : T.red, bg: T.surface },
        { label: "Margem",          val: (margem < 0 ? "−" : "+") + fmtAbs(Math.abs(margem)), delta: margem < 0 ? "ultrapassado" : "dentro do limite", sub: "saldo do cenário", deltaColor: margem < 0 ? T.red : T.green, bg: margem < 0 ? T.redLight : T.greenLight },
      ].map((k, i) => (
        <div key={i} style={{ background: k.bg, padding: isMobile ? "12px 11px" : "13px 12px", gridColumn: isMobile && i === 2 ? "1 / -1" : undefined, transition: "background 0.4s" }}>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: i === 2 ? (margem < 0 ? T.red : T.green) : T.inkLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>{k.label}</div>
          <div style={{ ...M_MONO, ...NUM, fontSize: isMobile ? 16 : 15, fontWeight: 800, color: i === 1 ? k.deltaColor : (i === 2 ? k.deltaColor : T.red), marginBottom: 3, transition: "color 0.4s" }}>{k.val}</div>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: k.deltaColor, marginBottom: 2 }}>{k.delta}</div>
          <div style={{ ...G, fontSize: 10, color: T.inkMid }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );

  /* ── Shared: budget editor ── */
  const BudgetEditor = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid }}>Orçamento do período</div>
        <div style={{ ...G, fontSize: 10, color: budgetOverride ? T.purple : T.inkLight, fontWeight: budgetOverride ? 600 : 400 }}>
          {budgetOverride ? "ajustado para este cenário" : "orçamento real da conta"}
        </div>
      </div>
      {budgetEditing ? (
        <div style={{ border: `1.5px solid ${projFimOkPreview ? T.green : T.purple}`, borderRadius: 10, overflow: "hidden", boxShadow: `0 0 0 3px ${projFimOkPreview ? T.green : T.purple}11`, transition: "border 0.2s, box-shadow 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", background: projFimOkPreview ? T.greenLight : T.purpleLight, transition: "background 0.2s" }}>
            <span style={{ fontSize: 13 }}>💰</span>
            <span style={{ ...M_MONO, ...NUM, fontSize: 12, color: T.inkLight, textDecoration: "line-through" }}>R$ {apiBudgetBase.toLocaleString("pt-BR")}</span>
            <span style={{ fontSize: 11, color: T.inkLight }}>→</span>
            <input autoFocus
              style={{ ...G, fontFamily: "'Geist Mono', monospace", fontSize: 15, fontWeight: 800, color: projFimOkPreview ? T.green : T.purple, background: "none", border: "none", outline: "none", flex: 1, fontVariantNumeric: "tabular-nums" }}
              value={budgetInputVal} onChange={e => setBudgetInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmBudget(); if (e.key === "Escape") cancelBudget(); }} />
          </div>
          <div style={{ padding: "6px 13px", background: projFimOkPreview ? "#F0FDF4" : "#FAF8FF", borderTop: `1px solid ${projFimOkPreview ? T.green : T.purple}22`, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: projFimOkPreview ? T.green : T.red }}>
              {projFimOkPreview ? `✓ Projeção: ${fmtAbs(projFim)} · dentro do orçamento` : `✕ Projeção: ${fmtAbs(projFim)} · ainda acima`}
            </span>
            {projFimOkPreview && <span style={{ ...G, fontSize: 10, color: T.green, marginLeft: "auto", fontWeight: 600 }}>+{fmtAbs(budgetPreview - projFim)} de margem</span>}
            {!projFimOkPreview && <span style={{ ...G, fontSize: 10, color: T.inkMid, marginLeft: "auto" }}>precisa de {fmtAbs(projFim)}+</span>}
          </div>
          <div style={{ display: "flex", borderTop: `1px solid ${projFimOkPreview ? T.green : T.purple}22` }}>
            <button onClick={confirmBudget} style={{ ...G, flex: 1, height: 32, background: projFimOkPreview ? T.green : T.purple, color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, transition: "background 0.2s" }}>✓ Confirmar</button>
            <button onClick={cancelBudget}  style={{ ...G, flex: 1, height: 32, background: "none", borderLeft: `1px solid ${T.border}`, cursor: "pointer", fontSize: 11, color: T.inkMid }}>✕ Cancelar</button>
          </div>
        </div>
      ) : budgetOverride ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: T.purpleLight, border: `1.5px solid ${T.purple}44`, borderRadius: 10, cursor: "pointer" }} onClick={startBudgetEdit}>
          <span style={{ fontSize: 13 }}>💰</span>
          <span style={{ ...M_MONO, ...NUM, fontSize: 12, color: T.inkLight, textDecoration: "line-through" }}>R$ {apiBudgetBase.toLocaleString("pt-BR")}</span>
          <span style={{ fontSize: 11, color: T.inkLight }}>→</span>
          <span style={{ ...M_MONO, ...NUM, fontSize: 15, fontWeight: 800, color: T.purple, flex: 1 }}>R$ {budgetOverride.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          <div style={{ width: 7, height: 7, borderRadius: 99, background: T.purple, flexShrink: 0 }} />
          <button onClick={e => { e.stopPropagation(); restoreBudget(); }} style={{ ...G, background: "none", border: "none", fontSize: 10, color: T.inkLight, cursor: "pointer", textDecoration: "underline" }}>Restaurar</button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: T.grayLight, border: `1.5px solid ${T.border}`, borderRadius: 10, cursor: "pointer", transition: "border 0.15s" }}
          onClick={startBudgetEdit}
          onMouseEnter={e => e.currentTarget.style.borderColor = T.borderHov}
          onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
          <span style={{ fontSize: 13 }}>💰</span>
          <span style={{ ...M_MONO, ...NUM, fontSize: 15, fontWeight: 800, color: T.ink, flex: 1 }}>R$ {apiBudgetBase.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          <span style={{ ...G, fontSize: 10, color: T.inkLight, display: "flex", alignItems: "center", gap: 4 }}>✏️ Ajustar para este cenário</span>
        </div>
      )}
    </div>
  );

  /* ── Shared: projection chart (API-driven) ── */
  const ProjectionChart = () => {
    if (apiChart.length === 0) return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: isMobile ? 160 : 200, gap: 8 }}>
        <div style={{ fontSize: 24, color: T.inkGhost }}>📊</div>
        <div style={{ ...G, fontSize: 12, color: T.inkMid }}>Adicione itens ao cenário para ver a projeção</div>
      </div>
    );
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ ...G, fontSize: isMobile ? 13 : 14, fontWeight: 700, color: T.ink }}>Projeção Mensal</span>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: T.purpleLight, border: `1px solid ${T.purple}22`, borderRadius: 9999, padding: "3px 9px" }}>
            <div style={{ width: 5, height: 5, borderRadius: 9999, background: T.purple }} />
            <span style={{ ...G, fontSize: 10, fontWeight: 600, color: T.purple }}>com simulação</span>
          </div>
        </div>
        {!isMobile && <div style={{ ...G, fontSize: 11, color: T.inkMid, marginBottom: 14 }}>Receita vs despesas mês a mês{budgetOverride ? ` · orçamento ajustado para ${fmtAbs(budgetOverride)}` : ""}</div>}
        <ResponsiveContainer width="100%" height={isMobile ? 180 : 220}>
          <ComposedChart data={apiChart} margin={{ top: 10, right: isMobile ? 8 : 24, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="label" tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} />
            <YAxis tick={{ ...G, ...NUM, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
            <Tooltip content={<SimTooltip />} />
            <ReferenceLine y={budgetAtivo} stroke={`${T.red}66`} strokeDasharray="5 4"
              label={isMobile ? undefined : { value: "orçamento", position: "right", fill: T.red, fontSize: 10, fontFamily: "Geist,sans-serif" }} />
            <Bar dataKey="receita" name="Receita" fill={`${T.green}44`} stroke={T.green} strokeWidth={1} radius={[4, 4, 0, 0]} barSize={isMobile ? 14 : 20} />
            <Bar dataKey="comSim" name="Despesas + simulação" fill={`${T.red}33`} stroke={T.red} strokeWidth={1} radius={[4, 4, 0, 0]} barSize={isMobile ? 14 : 20} />
            <Line dataKey="saldo" name="Saldo" type="monotone" stroke={T.purple} strokeWidth={2.5} dot={{ r: 3, fill: T.purple }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: isMobile ? 10 : 16, marginTop: 8, flexWrap: "wrap" }}>
          {[{ c: T.green, l: "Receita", bar: true }, { c: T.red, l: "Despesas + sim.", bar: true }, { c: T.purple, l: "Saldo", bar: false }].map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {x.bar ? <div style={{ width: 10, height: 10, borderRadius: 2, background: `${x.c}44`, border: `1px solid ${x.c}` }} /> :
                <svg width="14" height="6"><line x1="0" y1="3" x2="14" y2="3" stroke={x.c} strokeWidth="2" /></svg>}
              <span style={{ ...G, fontSize: isMobile ? 9 : 10, color: T.inkMid }}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ── Shared: riscos + impactos + recomendações (Fragment — cards become direct grid children) ── */
  const InsightsContent = () => (
    <>
      {/* Riscos */}
      <Card style={{ padding: 18 }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} color={T.amber} /> Riscos identificados
        </div>
        {riscos.length === 0 && (
          <div style={{ ...G, fontSize: 12, color: T.inkMid, padding: "12px 0" }}>Simulação em andamento…</div>
        )}
        {riscos.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 10, paddingBottom: i < riscos.length - 1 ? 14 : 0, marginBottom: i < riscos.length - 1 ? 14 : 0, borderBottom: i < riscos.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ width: 8, height: 8, borderRadius: 9999, background: r.dot, flexShrink: 0, marginTop: 3 }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink }}>{r.title}</span>
                <Badge color={r.color} bg={`${r.color}18`}>{r.nivel}</Badge>
              </div>
              <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.55 }}>{r.desc}</div>
            </div>
          </div>
        ))}
      </Card>
      {/* Impacto */}
      <Card style={{ padding: 18 }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Target size={14} color={T.blue} /> Impacto por Orçamento
        </div>
        {impactos.length === 0 && (
          <div style={{ ...G, fontSize: 12, color: T.inkMid, padding: "12px 0" }}>Adicione itens para ver o impacto por categoria.</div>
        )}
        {impactos.map((imp, i) => (
          <div key={i} style={{ marginBottom: i < impactos.length - 1 ? 16 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16 }}>{imp.icon}</span>
                <span style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink }}>{imp.cat}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...M_MONO, ...NUM, fontSize: 12, fontWeight: 700, color: imp.pct > 100 ? T.red : T.ink }}>{fmtAbs(imp.val)}</div>
                <div style={{ ...G, fontSize: 10, color: T.inkMid }}>limite {imp.limite > 0 ? fmtAbs(imp.limite) : "sem limite"}</div>
              </div>
            </div>
            <div style={{ height: 6, background: T.border, borderRadius: 99, overflow: "hidden" }}>
              <div style={{ display: "flex", height: "100%" }}>
                <div style={{ width: `${Math.min(100, imp.limite > 0 ? (imp.limite / (imp.limite + imp.val)) * 100 : 0)}%`, background: T.greenBar, borderRadius: "99px 0 0 99px" }} />
                <div style={{ flex: 1, background: T.redBar, borderRadius: "0 99px 99px 0" }} />
              </div>
            </div>
            {imp.pct > 100 && <div style={{ ...G, fontSize: 10, color: T.red, fontWeight: 600, marginTop: 3 }}>+{imp.pct - 100}% acima do limite</div>}
          </div>
        ))}
      </Card>
      {/* Recomendações */}
      <Card style={{ padding: 18 }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={14} color={T.purple} /> Recomendações
        </div>
        {recs.length === 0 && (
          <div style={{ ...G, fontSize: 12, color: T.inkMid, padding: "12px 0" }}>Simulação em andamento…</div>
        )}
        {recs.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 10, paddingBottom: i < recs.length - 1 ? 14 : 0, marginBottom: i < recs.length - 1 ? 14 : 0, borderBottom: i < recs.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{ fontSize: 18, flexShrink: 0 }}>{r.emoji}</div>
            <div style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: r.txt.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${T.ink};font-weight:700">$1</strong>`) }} />
          </div>
        ))}
      </Card>
    </>
  );

  return (
    <>
    <ModalNovoCenario open={showModal} onClose={() => { setShowModal(false); setModalTipo(null); }} onCriar={criarCenario} initialTipo={modalTipo} />

    {/* ══════════════════════════════════════════
        MOBILE LAYOUT — Tabbed experience
    ══════════════════════════════════════════ */}
    {isMobile ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 0, minHeight: 0 }}>
        <style>{`@keyframes tabFadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>

        {/* ── Mobile page title ── */}
        <div style={{ paddingTop: 4, paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <PageTitle sans="Simulação" serif="de Despesas" />
          <button onClick={() => { setModalTipo(null); setShowModal(true); }} style={{ ...G, display: "flex", alignItems: "center", gap: 5, background: T.purple, border: "none", borderRadius: 9, padding: "8px 13px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            <Plus size={13} /> Novo
          </button>
        </div>

        {!cenario ? (
          /* ── Mobile onboarding ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
            <div style={{ background: T.purpleLight, border: `1px solid ${T.purple}22`, borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: T.purple + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FlaskConical size={24} color={T.purple} />
              </div>
              <div style={{ ...G, fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em" }}>Nenhum cenário ativo</div>
              <div style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.6, maxWidth: 280 }}>
                Crie um cenário para simular o impacto de despesas, receitas ou mudanças no orçamento — sem afetar seus dados reais.
              </div>
              <button onClick={() => { setModalTipo(null); setShowModal(true); }} style={{ ...G, display: "flex", alignItems: "center", gap: 7, height: 42, padding: "0 22px", background: T.purple, border: "none", borderRadius: 11, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 4px 14px ${T.purple}44` }}>
                <Plus size={14} /> Criar primeiro cenário
              </button>
            </div>
            {[
              { emoji:"💻", titulo:"Compra grande", desc:"Simule uma compra parcelada e veja o impacto no orçamento.", tipo: "despesa_parcelada" },
              { emoji:"📈", titulo:"Aumento de salário", desc:"Veja como uma receita recorrente melhora sua margem mensal.", tipo: "receita_recorrente" },
              { emoji:"✂️", titulo:"Corte de gastos", desc:"Simule a redução de uma categoria e descubra quanto sobra.", tipo: "ajuste_categoria" },
            ].map((c, i) => (
              <button key={i} onClick={() => { setModalTipo(c.tipo); setShowModal(true); }}
                style={{ ...G, display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.purple + "55"}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: T.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{c.emoji}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{c.titulo}</div>
                  <div style={{ fontSize: 11, color: T.inkMid, marginTop: 2, lineHeight: 1.5 }}>{c.desc}</div>
                </div>
                <ChevronRight size={14} color={T.inkGhost} style={{ marginLeft: "auto", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        ) : (
          <>
          {/* ── Error banner (mobile) ── */}
          {simError && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: T.redLight, borderRadius: 10, marginBottom: 10 }}>
              <AlertTriangle size={13} color={T.red} />
              <span style={{ ...G, fontSize: 11, color: T.red, flex: 1 }}>{simError}</span>
              <button onClick={runSimulation} style={{ ...G, fontSize: 10, fontWeight: 700, color: T.red, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Tentar</button>
            </div>
          )}
          {/* ── Scenario header card ── */}
          <div style={{ background: T.darkBg, borderRadius: 16, padding: "16px 18px", marginBottom: 14, boxShadow: T.dark, position: "relative", overflow: "hidden" }}>
            {/* Purple glow */}
            <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: `${T.purple}22`, pointerEvents: "none" }} />
            {/* Loading indicator */}
            {simLoading && (
              <div style={{ position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: 4 }}>
                <Loader2 size={11} color={T.darkMuted} style={{ animation: "spin 1s linear infinite" }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Cenário ativo</div>
                <div style={{ ...S, fontSize: 20, color: T.darkText, lineHeight: 1.2 }}>{cenario.nome}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                {/* Limpar — botão discreto direto no header */}
                <button onClick={() => {
                    setCenarios(cs => cs.filter(c => c.id !== cenarioId));
                    const next = cenarios.find(c => c.id !== cenarioId);
                    setCenarioId(next?.id || null);
                  }}
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  title="Limpar cenário">
                  <Trash2 size={13} color="rgba(255,255,255,0.45)" />
                </button>
                {/* Cenário switcher */}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowDropCen(v => !v)}
                    style={{ ...G, display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 600, color: T.darkText, cursor: "pointer" }}>
                    Trocar <ChevronDown size={11} />
                  </button>
                  {showDropCen && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: T.lg, zIndex: 50, minWidth: 210, overflow: "hidden" }}>
                      {/* Lista scrollável */}
                      <div style={{ maxHeight: 220, overflowY: "auto" }}>
                        {cenarios.map(c => (
                          <div key={c.id} onClick={() => { setCenarioId(c.id); setShowDropCen(false); }}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: c.id === cenarioId ? T.purpleLight : T.surface, transition: "background 0.12s" }}
                            onMouseEnter={e => e.currentTarget.style.background = c.id === cenarioId ? T.purpleLight : T.grayLight}
                            onMouseLeave={e => e.currentTarget.style.background = c.id === cenarioId ? T.purpleLight : T.surface}>
                            <FlaskConical size={12} color={c.id === cenarioId ? T.purple : T.inkLight} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</div>
                              <div style={{ fontSize: 10, color: T.inkMid }}>{c.items.length} itens · {fmtAbs(c.items.reduce((s,i) => s + Math.abs(i.total), 0))}</div>
                            </div>
                            {c.id === cenarioId && <div style={{ width: 6, height: 6, borderRadius: 9999, background: T.purple, flexShrink: 0 }} />}
                          </div>
                        ))}
                      </div>
                      <div style={{ borderTop: `1px solid ${T.border}`, padding: "8px 14px" }}>
                        <button onClick={() => { setShowModal(true); setShowDropCen(false); }} style={{ ...G, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", fontSize: 11, fontWeight: 600, color: T.purple, cursor: "pointer", padding: "4px 0" }}>
                          <Plus size={11} /> Novo cenário
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Stats row */}
            <div style={{ display: "flex", gap: 20 }}>
              <div>
                <div style={{ ...G, fontSize: 8, fontWeight: 700, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Total simulado</div>
                <div style={{ ...M_MONO, ...NUM, fontSize: 18, fontWeight: 800, color: projecaoOk ? "#86EFAC" : "#FCA5A5", letterSpacing: "-0.01em" }}>{fmtAbs(total)}</div>
              </div>
              <div>
                <div style={{ ...G, fontSize: 8, fontWeight: 700, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Margem</div>
                <div style={{ ...M_MONO, ...NUM, fontSize: 18, fontWeight: 800, color: projecaoOk ? "#86EFAC" : "#FCA5A5" }}>{margem >= 0 ? "+" : "−"}{fmtAbs(Math.abs(margem))}</div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end" }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: projecaoOk ? "#86EFAC" : "#FCA5A5", background: projecaoOk ? "rgba(134,239,172,0.15)" : "rgba(252,165,165,0.15)", padding: "4px 8px", borderRadius: 8 }}>
                  {projecaoOk ? "✓ ok" : "✕ estouro"}
                </div>
              </div>
            </div>
          </div>

          {/* ── Tab pills ── */}
          <div style={{ display: "flex", gap: 2, background: T.grayLight, borderRadius: 11, padding: 3, marginBottom: 14 }}>
            {SIM_TABS.map(t => (
              <button key={t.id} onClick={() => setSimTab(t.id)}
                style={{ ...G, flex: 1, padding: "7px 4px", borderRadius: 9, border: "none", fontSize: 11, fontWeight: simTab === t.id ? 700 : 500, cursor: "pointer", background: simTab === t.id ? T.surface : "transparent", color: simTab === t.id ? T.ink : T.inkMid, boxShadow: simTab === t.id ? T.sm : "none", transition: "all 0.18s", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <span style={{ fontSize: 13 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div style={{ animation: "tabFadeIn 0.22s ease-out" }} key={simTab}>

            {/* Tab: Itens */}
            {simTab === "itens" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 80 }}>
                <Card style={{ padding: 16 }}>
                  <ItemsList />
                </Card>
              </div>
            )}

            {/* Tab: Análise */}
            {simTab === "analise" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }}>
                <Card style={{ padding: 16 }}>
                  <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Análise do cenário</div>
                  <KpiGrid />
                </Card>
                <Card style={{ padding: 16 }}>
                  <BudgetEditor />
                </Card>
                {/* Impacto mensal */}
                <Card style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.ink }}>Impacto mensal recorrente</div>
                    <div style={{ ...M_MONO, ...NUM, fontSize: 15, fontWeight: 700, color: T.ink }}>
                      {fmtAbs(totalMes)}<span style={{ ...G, fontSize: 10, fontWeight: 400, color: T.inkMid }}>/mês</span>
                    </div>
                  </div>
                  <div style={{ height: 5, background: T.border, borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
                    <div style={{ width: "42%", height: "100%", background: T.purpleBar, borderRadius: 99 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ ...G, fontSize: 10, color: T.inkMid }}>por 12 meses · até mar/27</span>
                    <span style={{ ...G, fontSize: 10, color: T.purple, fontWeight: 700 }}>42% do período restante</span>
                  </div>
                </Card>
                {/* Ponto de equilíbrio */}
                <div style={{ background: T.darkBg, borderRadius: 14, padding: "16px 18px", boxShadow: T.dark }}>
                  <div style={{ ...G, fontSize: 8, fontWeight: 700, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Ponto de Equilíbrio</div>
                  <div style={{ ...G, fontSize: 20, fontWeight: 800, color: T.darkText, letterSpacing: "-0.02em", marginBottom: 2 }}>Março de 2027</div>
                  <div style={{ ...G, fontSize: 10, color: T.darkMuted, marginBottom: 12 }}>quando o impacto das parcelas se encerra</div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 99, marginBottom: 10, overflow: "hidden" }}>
                    <div style={{ width: "42%", height: "100%", background: T.darkPurple, borderRadius: 99 }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[{ label:"Comprometido", val: fmtAbs(total) }, { label:"Parcelas", val:"12 meses" }, { label:"Equilíbrio", val:"12 meses" }].map((m, i) => (
                      <div key={i}>
                        <div style={{ ...G, fontSize: 10, color: T.darkMuted, marginBottom: 3 }}>{m.label}</div>
                        <div style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.darkText }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Gráfico */}
            {simTab === "grafico" && (
              <Card style={{ padding: 16, paddingBottom: 20 }}>
                <ProjectionChart />
              </Card>
            )}

            {/* Tab: Insights */}
            {simTab === "insights" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 24 }}>
                <InsightsContent />
              </div>
            )}
          </div>

          {/* ── FAB: Adicionar item ── */}
          <div style={{ position: "fixed", bottom: 24, right: 20, zIndex: 100 }}>
            <button onClick={() => setShowModal(true)}
              style={{ ...G, display: "flex", alignItems: "center", gap: 7, height: 48, padding: "0 20px", background: T.purple, border: "none", borderRadius: 24, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 6px 20px ${T.purple}55`, transition: "transform 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
              <Plus size={16} /> Adicionar
            </button>
          </div>
          </>
        )}
      </div>

    ) : (
    /* ══════════════════════════════════════════
        DESKTOP LAYOUT
    ══════════════════════════════════════════ */
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{INSIGHTS_RESPONSIVE_CSS}</style>
      <style>{shimmerKeyframes}</style>

      {/* ── HEADER ── */}
      <div style={{ paddingTop: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div><Breadcrumb label="Planejar" /><PageTitle sans="Simulação" serif="de Despesas" /></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowDropCen(v => !v)}
              style={{ ...G, display: "flex", alignItems: "center", gap: 8, background: cenario ? T.surface : T.purpleLight, border: `1px solid ${cenario ? T.border : T.purple + "44"}`, borderRadius: 9, padding: "7px 12px", fontSize: 12, fontWeight: 600, color: T.ink, cursor: "pointer", boxShadow: T.sm }}>
              <FlaskConical size={12} color={cenario ? T.inkMid : T.purple} />
              <span>{cenario ? cenario.nome : "Selecionar cenário"}</span>
              <ChevronDown size={11} color={T.inkLight} />
            </button>
            {showDropCen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: T.lg, zIndex: 50, minWidth: 220, overflow: "hidden" }}>
                {cenarios.map(c => (
                  <div key={c.id} onClick={() => { setCenarioId(c.id); setShowDropCen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: c.id === cenarioId ? T.purpleLight : T.surface, transition: "background 0.12s" }}
                    onMouseEnter={e => e.currentTarget.style.background = c.id === cenarioId ? T.purpleLight : T.grayLight}
                    onMouseLeave={e => e.currentTarget.style.background = c.id === cenarioId ? T.purpleLight : T.surface}>
                    <FlaskConical size={12} color={c.id === cenarioId ? T.purple : T.inkLight} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{c.nome}</div>
                      <div style={{ fontSize: 10, color: T.inkMid, marginTop: 1 }}>{c.items.length} itens · {fmtAbs(c.items.reduce((s,i) => s + Math.abs(i.total), 0))}</div>
                    </div>
                    {c.id === cenarioId && <div style={{ width: 6, height: 6, borderRadius: 9999, background: T.purple }} />}
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${T.border}`, padding: "8px 14px" }}>
                  <button onClick={() => { setShowModal(true); setShowDropCen(false); }} style={{ ...G, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", fontSize: 11, fontWeight: 600, color: T.purple, cursor: "pointer", padding: 0 }}>
                    <Plus size={11} /> Novo cenário
                  </button>
                </div>
              </div>
            )}
          </div>
          <Btn variant="outGray">Salvar cenário</Btn>
          {cenario && <Btn variant="outRed" onClick={() => { setCenarios(cs => cs.filter(c => c.id !== cenarioId)); setCenarioId(cenarios.find(c => c.id !== cenarioId)?.id || null); }}>Limpar</Btn>}
          {!cenario && <Btn variant="primary" onClick={() => setShowModal(true)}><Plus size={12} /> Novo cenário</Btn>}
        </div>
      </div>

      {/* ── ESTADO VAZIO ── */}
      {!cenario ? (
        <SimOnboarding onNovo={(tipo) => { setModalTipo(tipo); setShowModal(true); }} />
      ) : simLoading && !simResult ? (
        <SimLoadingSkeleton />
      ) : (
        <>
        {/* ── Error banner ── */}
        {simError && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: T.redLight, border: `1px solid ${T.red}22`, borderRadius: 10 }}>
            <AlertTriangle size={14} color={T.red} />
            <span style={{ ...G, fontSize: 12, color: T.red, flex: 1 }}>{simError}</span>
            <button onClick={runSimulation} style={{ ...G, fontSize: 11, fontWeight: 700, color: T.red, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Tentar novamente</button>
          </div>
        )}

        {/* ── Inline loading indicator ── */}
        {simLoading && simResult && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: T.purpleLight, border: `1px solid ${T.purple}22`, borderRadius: 8 }}>
            <Loader2 size={13} color={T.purple} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ ...G, fontSize: 11, color: T.purple, fontWeight: 600 }}>Atualizando simulação…</span>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* ── ROW 1 ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "stretch" }}>

          {/* Itens simulados */}
          <Card style={{ padding: 18, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>✏️</span>
              <span style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>{cenario.nome}</span>
              <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{items.length} {items.length === 1 ? "item" : "itens"} · {fmtAbs(total)} total</span>
              <Btn variant="outGray" small style={{ marginLeft: "auto" }}>Renomear</Btn>
            </div>
            <div style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkMid, marginBottom: 2 }}>Itens simulados</div>
            <div style={{ ...G, fontSize: 10, color: T.inkLight, marginBottom: 12 }}>Hipotéticos — nenhum foi lançado</div>
            <ItemsList />
            {items.length < 3 && (
              <div style={{ border: `1.5px dashed ${T.border}`, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: "20px 16px", background: T.bg, flex: 1, margin: "12px 0", minHeight: 90 }}>
                <div style={{ fontSize: 20, color: T.inkGhost }}>＋</div>
                <div style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkLight }}>Adicione mais itens ao cenário</div>
                <div style={{ ...G, fontSize: 10, color: T.inkLight, textAlign: "center" }}>Simule despesas, receitas ou ajustes de categoria</div>
                <button onClick={() => setShowModal(true)} style={{ ...G, background: "none", border: "none", fontSize: 11, fontWeight: 700, color: T.purple, cursor: "pointer", marginTop: 4 }}>+ Adicionar item</button>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginTop: "auto", borderTop: `1px solid ${T.border}` }}>
              <Btn variant="outGray" onClick={() => setShowModal(true)}><Plus size={12} /> Adicionar</Btn>
              <div style={{ ...M_MONO, ...NUM, fontSize: 14, fontWeight: 700, color: projecaoOk ? T.green : T.red }}>Total simulado &nbsp; {fmtAbs(total)}</div>
            </div>
          </Card>

          {/* Análise do cenário */}
          <Card style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>Análise do cenário</div>
            <KpiGrid />
            <BudgetEditor />
            {/* Impacto mensal */}
            <div style={{ padding: "12px 14px", background: T.grayLight, borderRadius: 10, border: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em" }}>Impacto mensal recorrente</div>
                <div style={{ ...M_MONO, ...NUM, fontSize: 15, fontWeight: 700, color: T.ink }}>
                  {fmtAbs(totalMes)}<span style={{ ...G, fontSize: 10, fontWeight: 400, color: T.inkMid }}>/mês</span>
                </div>
              </div>
              <div style={{ height: 5, background: T.border, borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
                <div style={{ width: budgetAtivo > 0 ? `${Math.min(100, Math.round((totalMes / budgetAtivo) * 100))}%` : "0%", height: "100%", background: T.purpleBar, borderRadius: 99, transition: "width 0.4s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ ...G, fontSize: 10, color: T.inkMid }}>{simResult ? `por ${simResult.months.length} meses` : "calculando…"}</span>
                <span style={{ ...G, fontSize: 10, color: T.purple, fontWeight: 700 }}>{budgetAtivo > 0 ? `${Math.round((totalMes / budgetAtivo) * 100)}% do orçamento mensal` : "—"}</span>
              </div>
            </div>
            {/* Ponto de equilíbrio */}
            {simResult && (() => {
              const lastDanger = [...simResult.months].reverse().find(m => m.status === "danger" || m.status === "warning");
              const eqLabel = lastDanger ? lastDanger.month : simResult.months[simResult.months.length - 1]?.month;
              const progressPct = lastDanger ? Math.round((simResult.months.indexOf(lastDanger) + 1) / simResult.months.length * 100) : 100;
              const maxParcelas = Math.max(1, ...items.filter(i => i.parcelas > 1).map(i => i.parcelas));
              return (
                <div style={{ background: T.darkBg, borderRadius: 12, padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", boxShadow: T.dark }}>
                  <div style={{ ...G, fontSize: 8, fontWeight: 700, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>Ponto de Equilíbrio</div>
                  <div style={{ ...G, fontSize: 22, fontWeight: 800, color: T.darkText, letterSpacing: "-0.02em", marginBottom: 2 }}>{eqLabel || "—"}</div>
                  <div style={{ ...G, fontSize: 10, color: T.darkMuted, marginBottom: 12 }}>quando o impacto das parcelas se encerra</div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 99, marginBottom: 12, overflow: "hidden" }}>
                    <div style={{ width: `${progressPct}%`, height: "100%", background: T.darkPurple, borderRadius: 99, transition: "width 0.4s" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[{ label: "Comprometido", val: fmtAbs(total) }, { label: "Parcelas", val: `${maxParcelas} meses` }, { label: "Meses sim.", val: `${simResult.months.length} meses` }].map((m, i) => (
                      <div key={i}>
                        <div style={{ ...G, fontSize: 10, color: T.darkMuted, marginBottom: 3 }}>{m.label}</div>
                        <div style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.darkText }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>

        {/* ── ROW 2: Gráfico ── */}
        <Card style={{ padding: 20 }}>
          <ProjectionChart />
        </Card>

        {/* ── ROW 3: Riscos | Impacto | Recomendações ── */}
        <div className="fincla-sim-insights-grid">
          <InsightsContent />
        </div>
        </>
      )}
    </div>
    )}
    </>
  );
}
