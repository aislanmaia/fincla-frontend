import React, { useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  Plus,
  Sparkles,
  Upload,
  Pause,
  Play,
  Pencil,
  CalendarDays,
} from "lucide-react";
import { BarChart as ReBarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { fmtAbs, fmtSgn } from "../formatters";
import {
  Badge,
  Breadcrumb,
  Btn,
  Card,
  CollapsibleSection,
  PageTitle,
  ProgBar,
} from "../components/primitives";
import { RECORRENCIAS } from "../data/mockFinance";
import { CategoryLucideIcon } from "../components/CategoryLucideIcon.jsx";
import { buildUpcomingRecurringSummary } from "../data/recurringTransactionsAdapter.js";
import { useRecurringTransactionsData } from "../features/recurringTransactions/useRecurringTransactionsData.js";
import { resolveLocalData, shouldUseRealData as shouldUseRealDataForMode } from "../dataMode.js";
const MONTH_NAMES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function MiniCalendar({ recorrencias = [], selectedDay, onSelectDay }) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const daysInMonth = new Date(ano, mes + 1, 0).getDate();
  const firstDow = new Date(ano, mes, 1).getDay();
  const diasVenc = new Set(recorrencias.filter((r) => r.ativa).map((r) => r.dia));
  const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

  const handleDayClick = (day) => {
    if (onSelectDay) onSelectDay(selectedDay === day ? null : day);
  };

  return (
    <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, padding: "12px 14px" }}>
      <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.ink, marginBottom: 10 }}>
        {MONTH_NAMES_PT[mes]} {ano}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ ...G, fontSize: 9, fontWeight: 600, color: T.inkGhost, textAlign: "center", padding: "2px 0" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const isHoje = day === hoje.getDate();
          const isVenc = diasVenc.has(day);
          const isSel = selectedDay === day;
          return (
            <div key={day}
              onClick={() => handleDayClick(day)}
              style={{
                ...G,
                fontSize: 10,
                fontWeight: isVenc || isHoje || isSel ? 700 : 400,
                textAlign: "center",
                padding: "4px 2px",
                borderRadius: 6,
                background: isSel ? T.purple : isHoje ? T.ink : isVenc ? T.blueLight : "transparent",
                color: isSel || isHoje ? "#fff" : isVenc ? T.blue : T.inkMid,
                position: "relative",
                cursor: "pointer",
                transition: "background 0.12s, color 0.12s",
                outline: isSel ? `2px solid ${T.purple}44` : "none",
                outlineOffset: 1,
              }}>
              {day}
              {isVenc && !isHoje && !isSel && (
                <div style={{ width: 3, height: 3, borderRadius: "50%", background: T.blue, margin: "1px auto 0" }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: T.ink }} />
          <span style={{ ...G, fontSize: 9, color: T.inkGhost }}>Hoje</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: T.blueLight, border: `1px solid ${T.blue}` }} />
          <span style={{ ...G, fontSize: 9, color: T.inkGhost }}>Vencimento</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: T.purple }} />
          <span style={{ ...G, fontSize: 9, color: T.inkGhost }}>Selecionado</span>
        </div>
      </div>
      {selectedDay && (
        <button onClick={() => onSelectDay(null)} style={{ ...G, fontSize: 10, fontWeight: 600, color: T.purple, background: "none", border: "none", cursor: "pointer", marginTop: 8, padding: 0 }}>
          ✕ Limpar seleção
        </button>
      )}
    </div>
  );
}

/* ── Loading Skeleton ── */
const shimmerKeyframes = `@keyframes fincla-rec-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`;
const shimmerBg = { background: `linear-gradient(90deg, ${T.grayLight} 25%, ${T.border} 50%, ${T.grayLight} 75%)`, backgroundSize: "200% 100%", animation: "fincla-rec-shimmer 1.4s ease-in-out infinite" };
const Skel = ({ h = 16, w = "100%", r = 6, style }) => (
  <div style={{ height: h, width: w, borderRadius: r, ...shimmerBg, ...style }} />
);

/* ── Empty State ── */
function RecEmptyState({ onNovaRec }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 24 }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: T.blueLight, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 8px ${T.blue}0D` }}>
        <CalendarDays size={28} color={T.blue} />
      </div>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ ...G, fontSize: 20, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em", marginBottom: 8 }}>Nenhuma recorrência cadastrada</div>
        <div style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.7 }}>
          Cadastre suas despesas fixas e receitas recorrentes para acompanhar compromissos mensais e ter controle do seu fluxo.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%", maxWidth: 520 }}>
        {[
          { emoji: "🏠", titulo: "Moradia", desc: "Aluguel, condomínio, contas de luz e água." },
          { emoji: "💼", titulo: "Salário", desc: "Receitas fixas que entram todo mês." },
          { emoji: "📱", titulo: "Assinaturas", desc: "Streaming, plano celular, apps." },
        ].map((c, i) => (
          <div key={i} style={{ ...G, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: 14, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, textAlign: "left" }}>
            <span style={{ fontSize: 22 }}>{c.emoji}</span>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{c.titulo}</div>
            <div style={{ fontSize: 11, color: T.inkMid, lineHeight: 1.5 }}>{c.desc}</div>
          </div>
        ))}
      </div>
      <button onClick={onNovaRec} style={{ ...G, display: "flex", alignItems: "center", gap: 8, height: 42, padding: "0 24px", background: T.ink, border: "none", borderRadius: 11, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: `0 4px 14px rgba(0,0,0,0.15)` }}>
        <Plus size={15} /> Criar primeira recorrência
      </button>
    </div>
  );
}

function SimRow({ item, isExp, onToggle, isMuted, onToggleMute, onNav, isMobile }) {
  const isReceita = !!item.isReceita;
  const valColor = isReceita ? T.green : T.purple;
  const sign = isReceita ? "+" : "−";

  return (
    <div style={{ background: isMuted ? T.grayLight : T.surface, borderRadius: 12, border: `1px solid ${isMuted ? T.border : T.purple}40`, overflow: "hidden", opacity: isMuted ? 0.5 : 1, transition: "opacity 0.18s" }}>
      <div onClick={onToggle} className="fincla-row"
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: T.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
          <Sparkles size={14} color={T.purple} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ ...G, fontSize: 13, fontWeight: 600, color: isMuted ? T.inkGhost : T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.nome}
            </span>
            <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.purple, background: T.purpleLight, borderRadius: 99, padding: "2px 6px", whiteSpace: "nowrap" }}>
              Simulada
            </span>
          </div>
          <div style={{ ...G, fontSize: 11, color: T.inkGhost }}>
            {item.cat} · {item.badge || (item.meses ? `${item.meses} meses` : "recorrente")} · {item.cenarioNome}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ ...G, ...NUM, fontSize: 14, fontWeight: 700, color: isMuted ? T.inkGhost : valColor }}>
            {sign} R$ {Math.abs(item.valParcela).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ ...G, fontSize: 10, color: T.inkGhost, marginTop: 1 }}>por mês</div>
        </div>

        <div style={{ marginLeft: 4, transition: "transform 0.2s", transform: isExp ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
          <ChevronDown size={14} color={T.inkGhost} />
        </div>
      </div>

      <CollapsibleSection open={isExp}>
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Cenário", val: item.cenarioNome },
              { label: "Categoria", val: item.cat },
              { label: "Duração", val: item.badge || `${item.meses || "∞"} meses` },
              { label: "Tipo", val: isReceita ? "Receita" : "Despesa" },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
                <div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.inkMid }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 4 }}>
            <button onClick={(e) => { e.stopPropagation(); onToggleMute && onToggleMute(); }}
              style={{ ...G, fontSize: 11, fontWeight: 600, color: isMuted ? T.purple : T.inkMid, background: isMuted ? T.purpleLight : T.grayLight, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>
              {isMuted ? "Restaurar" : "Silenciar"}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onNav && onNav("simulacao"); }}
              style={{ ...G, fontSize: 11, fontWeight: 600, color: T.purple, background: T.purpleLight, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer" }}>
              Ver simulação →
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function RecRow({ r, isExp, onToggle, onTogglePause, onNav, onEditar, isMobile }) {
  const isReceita = r.tipo === "receita";
  const valColor = isReceita ? T.green : T.ink;
  const sign = isReceita ? "+" : "−";

  return (
    <div style={{ background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden", opacity: r.ativa ? 1 : 0.55, transition: "opacity 0.18s" }}>
      <div onClick={onToggle} className="fincla-row"
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: isReceita ? T.greenLight : T.redLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <CategoryLucideIcon
            iconKey={r.categoryIconKey}
            labelPt={r.cat}
            size={18}
            color={isReceita ? T.green : T.red}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.desc}
            </span>
            {!r.ativa && (
              <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkGhost, background: T.grayLight, borderRadius: 99, padding: "2px 6px" }}>
                PAUSADA
              </span>
            )}
            {r.urgente && r.ativa && (
              <span style={{ ...G, fontSize: 9, fontWeight: 700, color: T.amber, background: T.amberLight, borderRadius: 99, padding: "2px 6px" }}>
                {r.diasUrg}d
              </span>
            )}
          </div>
          <div style={{ ...G, fontSize: 11, color: T.inkGhost }}>
            {r.freq} · {r.cat}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ ...G, ...NUM, fontSize: 14, fontWeight: 700, color: valColor }}>
            {sign} R$ {Math.abs(r.val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <div style={{ ...G, fontSize: 10, color: r.pago ? T.green : T.inkGhost, marginTop: 1 }}>
            {r.pago ? "✓ pago" : `dia ${r.dia}`}
          </div>
        </div>

        <div style={{ marginLeft: 4, transition: "transform 0.2s", transform: isExp ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
          <ChevronDown size={14} color={T.inkGhost} />
        </div>
      </div>

      <CollapsibleSection open={isExp}>
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {r.progPct !== undefined && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ ...G, fontSize: 10, color: T.inkGhost }}>Progresso do mês</span>
                <span style={{ ...G, ...NUM, fontSize: 10, fontWeight: 600, color: r.progPct >= 100 ? T.green : T.inkMid }}>{r.progPct}%</span>
              </div>
              <ProgBar pct={r.progPct} color={r.progPct >= 100 ? T.green : isReceita ? T.green : T.blue} h={4} />
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Próximo", val: r.proximo },
              { label: "Método", val: r.metodo },
              { label: "Início", val: r.inicio },
              { label: "Encerra", val: r.enc },
            ].map(({ label, val }) => (
              <div key={label}>
                <div style={{ ...G, fontSize: 9, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
                <div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.inkMid }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 2 }}>
            <button onClick={(e) => { e.stopPropagation(); onEditar && onEditar(r); }}
              style={{ ...G, fontSize: 11, fontWeight: 600, color: T.ink, background: T.grayLight, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Pencil size={11} /> Editar
            </button>
            <button onClick={(e) => { e.stopPropagation(); onTogglePause && onTogglePause(); }}
              style={{ ...G, fontSize: 11, fontWeight: 600, color: r.ativa ? T.amber : T.green, background: r.ativa ? T.amberLight : T.greenLight, border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {r.ativa ? <><Pause size={11} /> Pausar</> : <><Play size={11} /> Reativar</>}
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function daysUntil(dateIso) {
  if (!dateIso) return null;
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - base.getTime()) / 86400000);
}

export function RecorrenciasPage({ onNav, cenarios = [], onNovaRec, onEditar, isMobile = false, dataMode = "live", extraRecs = [], organizationId = null }) {
  const [list, setList] = useState(() => resolveLocalData({
    dataMode,
    mockData: RECORRENCIAS,
    emptyData: extraRecs,
  }));
  const [expanded, setExp] = useState(null);
  const [activeTab, setTab] = useState("todos");
  const [search, setSearch] = useState("");
  const [secOpen, setSecOpen] = useState({ sim: true, desp: true, rec: true });
  const PAGE_SIZE = 5;
  const [shown, setShown] = useState({ sim: PAGE_SIZE, desp: PAGE_SIZE, rec: PAGE_SIZE });
  const [mutedItems, setMuted] = useState(new Set());
  const [calendarDay, setCalendarDay] = useState(null);
  const shouldUseRealData = shouldUseRealDataForMode(organizationId, dataMode);
  const recurringData = useRecurringTransactionsData({ organizationId, enabled: shouldUseRealData });

  const toggleSec = (key) => setSecOpen((s) => ({ ...s, [key]: !s[key] }));
  const showMore = (key) => setShown((s) => ({ ...s, [key]: s[key] + PAGE_SIZE }));
  const toggleMute = (uid) =>
    setMuted((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  const toggle = (id) => {
    if (shouldUseRealData) {
      recurringData.toggleRecurring(id).catch(() => {});
      return;
    }
    setList((l) => l.map((r) => (r.id === id ? { ...r, ativa: !r.ativa } : r)));
  };

  const simRecorrencias = useMemo(() => {
    const items = [];
    cenarios.forEach((c) => {
      c.items
        .filter((it) => it.tipo === "despesa_recorrente" || it.tipo === "receita_recorrente")
        .forEach((it) => items.push({ ...it, cenarioId: c.id, cenarioNome: c.nome, uid: `${c.id}-${it.id}` }));
    });
    return items;
  }, [cenarios]);

  const visibleSim = simRecorrencias.filter((it) => !mutedItems.has(it.uid));
  const totalSimVal =
    visibleSim.filter((it) => !it.isReceita).reduce((s, it) => s + it.valParcela, 0) -
    visibleSim.filter((it) => it.isReceita).reduce((s, it) => s + it.valParcela, 0);
  const simCenCount = new Set(visibleSim.map((x) => x.cenarioId)).size;

  const hasRealRecurringData = shouldUseRealData && recurringData.hasRealData;
  const isLoading = shouldUseRealData && recurringData.isLoading;
  const apiError = recurringData.error;
  const baseList = shouldUseRealData ? recurringData.list : list;
  const filteredList = useMemo(() => {
    const term = search.trim().toLowerCase();
    return baseList.filter((item) => {
      if (activeTab === "despesas" && item.tipo !== "despesa") return false;
      if (activeTab === "receitas" && item.tipo !== "receita") return false;
      if (activeTab === "pausados" && item.ativa) return false;
      if (!term) return true;
      return item.desc.toLowerCase().includes(term) || item.cat.toLowerCase().includes(term);
    });
  }, [activeTab, baseList, search]);
  const despesas = filteredList.filter((r) => r.tipo === "despesa");
  const receitas = filteredList.filter((r) => r.tipo === "receita");
  const totalDesp = despesas.filter((r) => r.ativa).reduce((s, r) => s + r.val, 0);
  const totalRec = receitas.filter((r) => r.ativa).reduce((s, r) => s + r.val, 0);
  const saldoFixo = totalRec - totalDesp;
  const summary = hasRealRecurringData && !search && activeTab === "todos"
    ? recurringData.summary
    : {
        totalDesp,
        totalRec,
        saldoFixo,
        activeCount: filteredList.filter((item) => item.ativa).length,
        pausedCount: filteredList.filter((item) => !item.ativa).length,
      };
  const upcomingSummary = buildUpcomingRecurringSummary(filteredList);
  const upcomingNext7 = upcomingSummary.items.sort((a, b) => (daysUntil(a.nextOccurrenceIso) || 0) - (daysUntil(b.nextOccurrenceIso) || 0));
  const next7Amount = upcomingSummary.total;

  // ── Derive "Próximos vencimentos" from real data ──
  const proximosVencimentos = useMemo(() => {
    const all = baseList.filter((r) => r.ativa && r.dia);
    if (calendarDay !== null) {
      return all.filter((r) => r.dia === calendarDay).map((r) => ({
        dia: r.dia,
        mes: MONTH_NAMES_PT[new Date().getMonth()].slice(0, 3).toUpperCase(),
        desc: r.desc,
        tipo: r.tipo,
        metodo: r.metodo,
        val: r.tipo === "receita" ? r.val : -r.val,
      }));
    }
    const sorted = [...all].sort((a, b) => {
      const da = daysUntil(a.nextOccurrenceIso);
      const db = daysUntil(b.nextOccurrenceIso);
      return (da ?? 999) - (db ?? 999);
    });
    return sorted.slice(0, 6).map((r) => {
      const d = r.nextOccurrenceIso ? new Date(`${r.nextOccurrenceIso}T00:00:00`) : null;
      return {
        dia: r.dia || (d ? d.getDate() : "—"),
        mes: d ? MONTH_NAMES_PT[d.getMonth()].slice(0, 3).toUpperCase() : "—",
        desc: r.desc,
        tipo: r.tipo,
        metodo: r.metodo,
        val: r.tipo === "receita" ? r.val : -r.val,
      };
    });
  }, [baseList, calendarDay]);

  // ── Derive "Fluxo fixo mensal" chart from real data ──
  const fluxoMensal = useMemo(() => {
    const MON = ["jan", "fev", "mar", "abr", "mai", "jun"];
    const activeDespesas = baseList.filter((r) => r.ativa && r.tipo === "despesa");
    const activeReceitas = baseList.filter((r) => r.ativa && r.tipo === "receita");
    const totalD = activeDespesas.reduce((s, r) => s + r.val, 0);
    const totalR = activeReceitas.reduce((s, r) => s + r.val, 0);
    const simVal = visibleSim.filter((it) => !it.isReceita).reduce((s, it) => s + it.valParcela, 0);
    return MON.map((mes) => ({ mes, desp: totalD, rec: totalR, sim: simVal }));
  }, [baseList, visibleSim]);

  const isEmpty = !isLoading && baseList.length === 0 && simRecorrencias.length === 0;

  const SectionHeader = ({ label, count, total, color, secKey, open }) => (
    <div onClick={() => toggleSec(secKey)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 2px", cursor: "pointer", userSelect: "none", marginTop: 6 }}>
      <div style={{ width: 3, height: 16, borderRadius: 99, background: color, flexShrink: 0 }} />
      <span style={{ ...G, fontSize: 11, fontWeight: 700, color: T.ink, textTransform: "uppercase", letterSpacing: "0.07em", flex: 1 }}>{label}</span>
      <span style={{ ...G, fontSize: 10, color: T.inkMid }}>{count}</span>
      <span style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color }}>{total}</span>
      <div style={{ width: 18, height: 18, borderRadius: 6, background: T.grayLight, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
        <ChevronDown size={11} color={T.inkMid} />
      </div>
    </div>
  );

  const VerMais = ({ total, shown: s, secKey }) =>
    s < total ? (
      <button onClick={() => showMore(secKey)} style={{ ...G, width: "100%", padding: "9px", background: "none", border: `1px dashed ${T.border}`, borderRadius: 9, fontSize: 11, fontWeight: 600, color: T.inkMid, cursor: "pointer", marginTop: 4 }}>
        Ver mais {Math.min(PAGE_SIZE, total - s)} de {total - s} restantes
      </button>
    ) : null;

  const RightPanel = () => (
    <div style={{ width: isMobile ? "100%" : 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
      {visibleSim.length > 0 && (
        <div style={{ background: T.darkBg, borderRadius: 14, padding: 16, boxShadow: T.dark }}>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.darkPurple, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Recorrências em simulação</div>
          {isMobile ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                { label: "Custo adicional", val: `−${fmtAbs(totalSimVal)}`, color: T.darkRed },
                { label: "Saldo fixo atual", val: fmtAbs(saldoFixo), color: T.darkText },
                { label: "Saldo simulado", val: fmtAbs(saldoFixo - totalSimVal), color: T.darkText },
                { label: "Redução", val: saldoFixo > 0 ? `−${((totalSimVal / saldoFixo) * 100).toFixed(1)}%` : "—", color: T.darkRed },
              ].map((m, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ ...G, fontSize: 8, fontWeight: 600, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{m.label}</div>
                  <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>
          ) : (
            [
              { label: "Custo mensal adicional", val: `−${fmtAbs(totalSimVal)}`, color: T.darkRed },
              { label: "Saldo fixo atual", val: fmtAbs(saldoFixo), color: T.darkText },
              { label: "Saldo fixo simulado", val: fmtAbs(saldoFixo - totalSimVal), color: T.darkText },
              { label: "Redução", val: saldoFixo > 0 ? `−${((totalSimVal / saldoFixo) * 100).toFixed(1)}%` : "—", color: T.darkRed },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ ...G, fontSize: 11, color: T.darkMuted }}>{m.label}</span>
                <span style={{ ...G, ...NUM, fontSize: 12, fontWeight: 700, color: m.color }}>{m.val}</span>
              </div>
            ))
          )}
          <div style={{ marginTop: isMobile ? 0 : 12, marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ ...G, fontSize: 10, color: T.darkMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>saldo comprometido</span>
              <span style={{ ...G, ...NUM, fontSize: 10, color: T.darkPurple, fontWeight: 700 }}>{totalRec > 0 ? Math.round((totalDesp / totalRec) * 100) : 0}%</span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.12)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, totalRec > 0 ? (totalDesp / totalRec) * 100 : 0)}%`, height: "100%", background: T.darkPurple, borderRadius: 99 }} />
            </div>
          </div>
          <button onClick={() => onNav("simulacao")} style={{ ...G, marginTop: 14, width: "100%", padding: "9px", background: T.purple, color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Abrir simulação completa
          </button>
        </div>
      )}
      <Card style={{ padding: 16 }}>
        <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Fluxo fixo mensal</div>
        <div style={{ ...G, ...NUM, fontSize: 14, fontWeight: 700, color: T.green, marginBottom: 12 }}>Saldo comprometido {fmtSgn(saldoFixo)}</div>
        <ResponsiveContainer width="100%" height={80}>
          <ReBarChart data={fluxoMensal} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ ...G, fontSize: 10, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8 }}
              formatter={(v, n) => [fmtAbs(v), n === "rec" ? "Receitas" : n === "desp" ? "Despesas" : "Simulado"]}
            />
            <Bar dataKey="desp" stackId="a" fill={T.redBar} radius={[0, 0, 0, 0]} />
            <Bar dataKey="sim" stackId="a" fill={T.purpleBar} radius={[3, 3, 0, 0]} />
            <Bar dataKey="rec" fill={T.greenBar} radius={[3, 3, 0, 0]} />
          </ReBarChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          {[
            { c: T.redBar, l: "Despesas" },
            { c: T.greenBar, l: "Receitas" },
            { c: T.purpleBar, l: "Simulado" },
          ].map((x, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: 9999, background: x.c }} />
              <span style={{ ...G, fontSize: 10, color: T.inkMid }}>{x.l}</span>
            </div>
          ))}
        </div>
      </Card>
      {!isMobile && (
        <Card style={{ padding: 16 }}>
          <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.ink, marginBottom: 12 }}>
            {calendarDay !== null ? `Vencimentos do dia ${calendarDay}` : "Próximos vencimentos"}
          </div>
          <MiniCalendar recorrencias={baseList} selectedDay={calendarDay} onSelectDay={setCalendarDay} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {proximosVencimentos.length === 0 && (
              <div style={{ ...G, fontSize: 11, color: T.inkMid, textAlign: "center", padding: "12px 0" }}>
                {calendarDay !== null ? `Nenhum vencimento no dia ${calendarDay}.` : "Sem vencimentos próximos."}
              </div>
            )}
            {proximosVencimentos.map((p, i) => {
              const col = p.tipo === "receita" ? T.green : p.tipo === "simulada" ? T.purple : T.inkMid;
              const bg = p.tipo === "receita" ? T.greenLight : p.tipo === "simulada" ? T.purpleLight : T.grayLight;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ background: bg, borderRadius: 6, padding: "3px 6px", textAlign: "center", flexShrink: 0 }}>
                    <div style={{ ...G, ...NUM, fontSize: 12, fontWeight: 800, color: col }}>{p.dia}</div>
                    <div style={{ ...G, fontSize: 7, fontWeight: 600, color: col, textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.mes}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...G, fontSize: 11, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.desc}</div>
                    <div style={{ ...G, fontSize: 10, color: T.inkMid }}>{p.metodo}</div>
                  </div>
                  <div style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: p.val > 0 ? T.green : p.tipo === "simulada" ? T.purple : T.ink, flexShrink: 0 }}>
                    {p.val > 0 ? "+" : "−"}R$ {Math.abs(p.val).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
      <style>{shimmerKeyframes}</style>
      <div style={{ paddingTop: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
        <div>
          <Breadcrumb label="Planejar" />
          <PageTitle sans="Recorrências &" serif="Compromissos" />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isMobile && (
            <Btn variant="outGray">
              <Upload size={12} /> Exportar
            </Btn>
          )}
          {!isMobile && (
            <Btn variant="outPurp" onClick={() => onNav("simulacao", { autoOpenModal: true, autoTipo: "despesa_recorrente" })}>
              <Sparkles size={12} /> Simular recorrência
            </Btn>
          )}
          <button onClick={onNovaRec} style={{ ...G, display: "flex", alignItems: "center", gap: 5, background: T.ink, border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
            <Plus size={13} /> {isMobile ? "Nova" : "Nova Recorrência"}{" "}
            <span style={{ width: 5, height: 5, background: T.purple, borderRadius: 9999, display: "inline-block", marginLeft: 2 }} />
          </button>
        </div>
      </div>

      {/* ── Loading state ── */}
      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10 }}>
            {[1, 2, 3, 4].map(i => <Card key={i} style={{ padding: 16 }}><Skel h={12} w="60%" style={{ marginBottom: 8 }} /><Skel h={24} w="50%" style={{ marginBottom: 6 }} /><Skel h={10} w="80%" /></Card>)}
          </div>
          <Skel h={40} />
          {[1, 2, 3].map(i => <Skel key={i} h={60} r={12} />)}
        </div>
      )}

      {/* ── Empty state ── */}
      {isEmpty && !isLoading && <RecEmptyState onNovaRec={onNovaRec} />}

      {/* ── Error banner ── */}
      {apiError && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: T.redLight, border: `1px solid ${T.red}22`, borderRadius: 10 }}>
          <span style={{ ...G, fontSize: 12, color: T.red, flex: 1 }}>{apiError}</span>
        </div>
      )}

      {/* ── Main content (only when not loading and not empty) ── */}
      {!isLoading && !isEmpty && (<>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10 }}>
        {[
          {
            label: "Compromissos mensais",
            val: fmtAbs(summary.totalDesp),
            sub: `${despesas.filter((r) => r.ativa).length} ativas · ${despesas.filter((r) => r.ativa && r.valorTipo === "estimado").length} estimadas`,
            color: T.red,
          },
          {
            label: "Receitas recorrentes",
            val: fmtAbs(summary.totalRec),
            sub: `${receitas.filter((r) => r.ativa).length} ativas · ${receitas.filter((r) => r.ativa && r.valorTipo === "estimado").length} estimadas`,
            color: T.green,
          },
          { label: "Saldo fixo mensal", val: fmtSgn(summary.saldoFixo), sub: "após todos compromissos", color: summary.saldoFixo > 0 ? T.green : T.red },
          { label: "Próximos 7 dias", val: fmtAbs(next7Amount), sub: `${upcomingNext7.length} vencimentos chegando`, color: T.amber },
        ].map((k, i) => (
          <Card key={i} style={{ padding: isMobile ? "12px 14px" : "14px 16px" }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{k.label}</div>
            <div style={{ ...G, ...NUM, fontSize: isMobile ? 17 : 22, fontWeight: 700, color: k.color }}>{k.val}</div>
            <div style={{ ...G, fontSize: 10, color: T.inkMid, marginTop: 3 }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: isMobile ? 8 : 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 13px", flex: isMobile ? undefined : 1, maxWidth: isMobile ? undefined : 280 }}>
          <Search size={12} color={T.inkLight} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar recorrência..." style={{ ...G, border: "none", outline: "none", fontSize: 12, color: T.ink, background: "transparent", flex: 1 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10 }}>
          <div style={{ display: "flex", gap: 2, background: T.grayLight, borderRadius: 9, padding: 3, flex: isMobile ? 1 : undefined }}>
            {["todos", "despesas", "receitas", "pausados"].map((tab) => (
              <button
                key={tab}
                onClick={() => setTab(tab)}
                style={{
                  ...G,
                  flex: isMobile ? 1 : undefined,
                  padding: isMobile ? "6px 8px" : "6px 12px",
                  borderRadius: 7,
                  border: "none",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: activeTab === tab ? T.surface : "transparent",
                  color: activeTab === tab ? T.ink : T.inkMid,
                  boxShadow: activeTab === tab ? T.sm : "none",
                  transition: "all 0.12s",
                  whiteSpace: "nowrap",
                }}
              >
                {isMobile
                  ? tab === "todos"
                    ? "Todos"
                    : tab === "despesas"
                      ? "Desp."
                      : tab === "receitas"
                        ? "Rec."
                        : "Pausa."
                  : tab === "todos"
                    ? "Todos"
                    : tab === "despesas"
                      ? "Despesas"
                      : tab === "receitas"
                        ? "Receitas"
                        : "Pausados"}
              </button>
            ))}
          </div>
          {!isMobile && (
            <Btn variant="outGray" small>
              <ChevronDown size={11} /> Próx. vencimento
            </Btn>
          )}
        </div>
      </div>

      {visibleSim.length > 0 && (
        <div style={{ background: T.purpleLight, border: `1px solid ${T.purple}33`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16 }}>✦</div>
          <div style={{ flex: 1, minWidth: isMobile ? "100%" : 0 }}>
            <div style={{ ...G, fontSize: isMobile ? 12 : 13, fontWeight: 700, color: T.purple }}>
              {visibleSim.length} {visibleSim.length === 1 ? "recorrência simulada" : "recorrências simuladas"} · {simCenCount} {simCenCount === 1 ? "cenário" : "cenários"} · {fmtAbs(Math.abs(totalSimVal))}/mês
            </div>
            <div style={{ ...G, fontSize: 11, color: `${T.purple}99`, marginTop: 2 }}>
              Impacto no saldo fixo: {fmtAbs(saldoFixo)} → {fmtAbs(saldoFixo - totalSimVal)}
              {mutedItems.size > 0 && (
                <span style={{ marginLeft: 8, color: T.inkLight }}>
                  · {mutedItems.size} muted
                </span>
              )}
            </div>
          </div>
          <Btn variant="purple" small onClick={() => onNav("simulacao")}>
            Abrir simulação completa
          </Btn>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {simRecorrencias.length > 0 && (
            <>
              <SectionHeader label="Simuladas" count={`${visibleSim.length} de ${simRecorrencias.length}`} total={`${fmtAbs(Math.abs(totalSimVal))}/mês`} color={T.purple} secKey="sim" open={secOpen.sim} />
              <CollapsibleSection open={secOpen.sim}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
                  {simRecorrencias.slice(0, shown.sim).map((item) => (
                    <SimRow
                      key={item.uid}
                      item={item}
                      isExp={expanded === item.uid}
                      onToggle={() => setExp(expanded === item.uid ? null : item.uid)}
                      isMuted={mutedItems.has(item.uid)}
                      onToggleMute={() => toggleMute(item.uid)}
                      onNav={onNav}
                      isMobile={isMobile}
                    />
                  ))}
                  <VerMais total={simRecorrencias.length} shown={shown.sim} secKey="sim" />
                </div>
              </CollapsibleSection>
            </>
          )}

          <SectionHeader label="Despesas Fixas" count={`${despesas.filter((r) => r.ativa).length} ativas`} total={`−${fmtAbs(totalDesp)}/mês`} color={T.red} secKey="desp" open={secOpen.desp} />
          <CollapsibleSection open={secOpen.desp}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
              {despesas.slice(0, shown.desp).map((r) => (
                <RecRow key={r.id} r={r} isExp={expanded === r.id} onToggle={() => setExp(expanded === r.id ? null : r.id)} onTogglePause={() => toggle(r.id)} onNav={onNav} onEditar={onEditar} isMobile={isMobile} />
              ))}
              <VerMais total={despesas.length} shown={shown.desp} secKey="desp" />
            </div>
          </CollapsibleSection>

          <SectionHeader label="Receitas Fixas" count={`${receitas.filter((r) => r.ativa).length} ativas`} total={`+${fmtAbs(totalRec)}/mês`} color={T.green} secKey="rec" open={secOpen.rec} />
          <CollapsibleSection open={secOpen.rec}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
              {receitas.slice(0, shown.rec).map((r) => (
                <RecRow key={r.id} r={r} isExp={expanded === r.id} onToggle={() => setExp(expanded === r.id ? null : r.id)} onTogglePause={() => toggle(r.id)} onNav={onNav} onEditar={onEditar} isMobile={isMobile} />
              ))}
              <VerMais total={receitas.length} shown={shown.rec} secKey="rec" />
            </div>
          </CollapsibleSection>
        </div>
        <RightPanel />
      </div>
      </>)}
    </div>
  );
}
