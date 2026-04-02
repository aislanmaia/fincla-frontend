import React, { useCallback, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ChevronRight,
  Repeat,
  Sparkles,
} from "lucide-react";
import {
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
import { fmtAbs, fmtK, fmtSgn } from "../formatters";
import {
  AnimNum,
  Badge,
  Breadcrumb,
  Card,
  InfoTip,
  PageTitle,
} from "../components/primitives";
import {
  getMoodActions,
  M_MONO,
  MOODS,
  RhythmTooltipV4,
  calcMood,
} from "../features/moodV4";
import { useDashboardData } from "../features/dashboard/useDashboardData.js";
import { DashboardPeriodSelector } from "../features/dashboard/DashboardPeriodSelector.jsx";
import {
  formatDashboardKpiPeriodPhrase,
  formatDashboardRangeBadge,
  parseLocalYmd,
  rangeForDashboardPreset,
} from "../features/dashboard/dashboardDateRange.js";
import { CardEmptyWithCta } from "../features/shellExtras.jsx";

export function DashboardPage({
  onNav,
  stateCtrl,
  dataMode = "live",
  onboardingData = null,
  extraRecs = [],
  onNewTx,
  organizationId = null,
}) {
  const { mounted, isMobile } = stateCtrl;
  const apiDataEnabled = Boolean(organizationId);

  const [periodPreset, setPeriodPreset] = useState("este_mes");
  const defaultEste = useMemo(
    () => rangeForDashboardPreset("este_mes", new Date()),
    [],
  );
  const [customStart, setCustomStart] = useState(defaultEste.start);
  const [customEnd, setCustomEnd] = useState(defaultEste.end);

  const appliedRange = useMemo(() => {
    if (periodPreset === "personalizado") {
      let s = customStart;
      let e = customEnd;
      if (s > e) {
        const t = s;
        s = e;
        e = t;
      }
      return { start: s, end: e };
    }
    return rangeForDashboardPreset(periodPreset, new Date());
  }, [periodPreset, customStart, customEnd]);

  const onCustomDatesChange = useCallback(({ start, end }) => {
    setCustomStart(start);
    setCustomEnd(end);
  }, []);

  const dashboardData = useDashboardData({
    organizationId,
    enabled: apiDataEnabled,
    dateStart: appliedRange.start,
    dateEnd: appliedRange.end,
  });
  const recentTransactions = dashboardData.transactions;
  const categoryData = dashboardData.categories;
  const rhythmData = dashboardData.rhythmChart;
  const upcomingDebits = dashboardData.upcomingDebits;
  const {
    dim,
    today: calendarDay,
    showTodayMarker,
    refLabel,
    progressSuffix,
  } = dashboardData.rhythmMeta;

  const summary = dashboardData.summary;
  const inc = summary?.total_income ?? 0;
  const exp = summary?.total_expenses ?? 0;
  const bal = summary?.balance ?? 0;
  const txCount = summary?.total_transactions;
  const apiFailedNoSummary = Boolean(
    dashboardData.error && !dashboardData.summary && !dashboardData.isLoading,
  );
  const isPeriodWithoutActivity = Boolean(
    summary &&
      inc === 0 &&
      exp === 0 &&
      (txCount === undefined || txCount === 0),
  );
  const showNeutralLiveHero = apiFailedNoSummary || isPeriodWithoutActivity;
  const refetch = dashboardData.refetch;
  const envelope = Math.max(inc, exp, 1);
  const rhythmSafe = useMemo(() => {
    if (rhythmData.length > 0) return rhythmData;
    const d = Math.max(dim, 1);
    const env = Math.max(envelope, 1);
    return Array.from({ length: d }, (_, i) => ({
      dia: i + 1,
      proj: Math.round((env / d) * (i + 1)),
      real: null,
      dayLabel: `${i + 1}`,
    }));
  }, [rhythmData, dim, envelope]);
  const day = calendarDay;
  const timePct = Math.round((day / Math.max(dim, 1)) * 100);
  const spendPct =
    envelope > 0 ? Math.min(250, (exp / envelope) * 100) : 0;
  const freePctMood =
    inc > 0
      ? Math.min(100, Math.max(0, (bal / inc) * 100))
      : bal >= 0
        ? 55
        : 5;

  const moodKey = useMemo(
    () => calcMood(day, spendPct, freePctMood, dim),
    [day, spendPct, freePctMood, dim],
  );
  const mood = MOODS[moodKey];
  const moodActions = getMoodActions(moodKey);
  const kpiPeriodPhrase = useMemo(
    () =>
      formatDashboardKpiPeriodPhrase(
        appliedRange.start,
        appliedRange.end,
        "pt-BR",
      ),
    [appliedRange.start, appliedRange.end],
  );
  const periodBadge = useMemo(
    () => formatDashboardRangeBadge(appliedRange.start, appliedRange.end),
    [appliedRange.start, appliedRange.end],
  );

  const pool = Math.max(inc, exp, Math.abs(bal), 1);
  const usedAmt = exp;
  const committed = 0;
  const freeAmt = Math.max(0, bal);
  const balance = bal;
  const barTotal = Math.max(usedAmt + committed + freeAmt, 1);
  const daysLeftInRange = useMemo(() => {
    const e = parseLocalYmd(appliedRange.end);
    if (!e) return 1;
    const now = new Date();
    const tMs = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const eMs = new Date(
      e.getFullYear(),
      e.getMonth(),
      e.getDate(),
    ).getTime();
    if (eMs < tMs) return 1;
    return Math.max(1, Math.floor((eMs - tMs) / 86400000) + 1);
  }, [appliedRange.end]);
  const dailyBudget = Math.round(Math.max(0, bal) / daysLeftInRange);

  const { Icon: MoodIcon, InsightIcon } = mood;
  const insightStat =
    spendPct <= timePct
      ? `R$ ${Math.abs(Math.round((envelope * (timePct - spendPct)) / 100))} à frente`
      : `R$ ${Math.abs(Math.round((envelope * (spendPct - timePct)) / 100))} acima`;

  const rhythmVsProj = Math.round((envelope * (timePct - spendPct)) / 100);

  const insightBody = {
    serene: `Com ${daysLeftInRange} dias restantes no período, você pode gastar até ${fmtAbs(dailyBudget)}/dia com folga.`,
    healthy: `Ritmo equilibrado — tente manter ${fmtAbs(dailyBudget)}/dia pelos próximos ${daysLeftInRange} dias.`,
    watchful: "Reduza cerca de R$ 80/dia para fechar o mês no zero. Revise categorias variáveis.",
    tense: `Limite gastos a ${fmtAbs(dailyBudget)}/dia para não estourar o orçamento no período (${kpiPeriodPhrase}).`,
    alert: "Evite novas despesas e avalie pausar recorrências não essenciais esta semana.",
  }[moodKey];

  const kpiItems = useMemo(() => {
    if (apiFailedNoSummary) {
      return [
        { key: "inc", label: `Receitas · ${kpiPeriodPhrase}`, value: "—", delta: "Dados indisponíveis", up: null, emptyCta: false },
        { key: "exp", label: `Despesas · ${kpiPeriodPhrase}`, value: "—", delta: "Dados indisponíveis", up: null, emptyCta: false },
        { key: "bal", label: "Saldo do período", value: "—", delta: "Dados indisponíveis", up: null, emptyCta: false },
      ];
    }
    if (isPeriodWithoutActivity) {
      const n = txCount ?? 0;
      return [
        { key: "inc", label: `Receitas · ${kpiPeriodPhrase}`, value: fmtAbs(0), delta: `${n} lançamentos no período`, up: null, emptyCta: true },
        { key: "exp", label: `Despesas · ${kpiPeriodPhrase}`, value: fmtAbs(0), delta: "registre para acompanhar o ritmo", up: null, emptyCta: true },
        { key: "bal", label: "Saldo do período", value: fmtAbs(0), delta: "sem movimento ainda", up: null, emptyCta: true },
      ];
    }
    const s = dashboardData.summary;
    if (!s) {
      return [
        { key: "inc", label: `Receitas · ${kpiPeriodPhrase}`, value: fmtAbs(0), delta: "Carregando resumo…", up: null, emptyCta: false },
        { key: "exp", label: `Despesas · ${kpiPeriodPhrase}`, value: fmtAbs(0), delta: "Carregando resumo…", up: null, emptyCta: false },
        { key: "bal", label: "Saldo do período", value: fmtAbs(0), delta: "Carregando resumo…", up: null, emptyCta: false },
      ];
    }
    return [
      {
        key: "inc",
        label: `Receitas · ${kpiPeriodPhrase}`,
        value: fmtAbs(s?.total_income ?? 0),
        delta: `${s?.total_transactions ?? 0} lançamentos no período`,
        up: s ? s.total_income > 0 : null,
        emptyCta: false,
      },
      {
        key: "exp",
        label: `Despesas · ${kpiPeriodPhrase}`,
        value: fmtAbs(s?.total_expenses ?? 0),
        delta: s ? (s.balance >= 0 ? "saldo positivo" : "saldo pressionado") : "aguardando resumo do período",
        up: s ? spendPct <= timePct : null,
        emptyCta: false,
      },
      {
        key: "bal",
        label: "Saldo do período",
        value: fmtAbs(Math.abs(s?.balance ?? 0)),
        delta: s ? (s.balance >= 0 ? "resultado acumulado" : "resultado negativo") : "sem saldo consolidado",
        up: s ? s.balance >= 0 : null,
        emptyCta: false,
      },
    ];
  }, [
    apiFailedNoSummary,
    isPeriodWithoutActivity,
    kpiPeriodPhrase,
    dashboardData.summary,
    spendPct,
    timePct,
    txCount,
  ]);

  const anim = (d = 0) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(12px)",
    transition: `opacity 0.45s ${d}s, transform 0.45s ${d}s`,
  });

  const showEmptyState =
    !organizationId ||
    (!dashboardData.isLoading &&
      !dashboardData.error &&
      !dashboardData.hasRealData);

  if (showEmptyState) {
    const rec = extraRecs && extraRecs[0];
    const orgLabel = onboardingData?.orgNome || "Organização";
    const recValNum = rec ? rec.val : 0;
    const fmtR = (v) =>
      "R$\u00a0" + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <PageTitle sans="Visão" serif="Geral" />
          <button
            onClick={onNewTx}
            style={{
              ...G,
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: T.ink,
              color: "#fff",
              border: "none",
              borderRadius: 11,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Nova transação
          </button>
        </div>

        {rec ? (
          <>
            <div
              style={{
                background: T.darkBg,
                borderRadius: 16,
                padding: "20px 24px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -50,
                  right: -50,
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  background: "rgba(134,239,172,0.07)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  ...G,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                  marginBottom: 4,
                }}
              >
                Receita mensal registrada
              </div>
              <div
                style={{
                  ...G,
                  ...NUM,
                  fontSize: isMobile ? 24 : 30,
                  fontWeight: 800,
                  color: "#86EFAC",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  marginBottom: 5,
                }}
              >
                <AnimNum
                  value={recValNum}
                  style={{
                    ...G,
                    ...NUM,
                    fontSize: isMobile ? 24 : 30,
                    fontWeight: 800,
                    color: "#86EFAC",
                    letterSpacing: "-0.02em",
                  }}
                />
              </div>
              <div style={{ ...G, fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 14 }}>
                {rec.desc} · todo dia {rec.dia}
                {rec.valorTipo === "estimado" ? (
                  <span style={{ ...G, fontSize: 11, color: "#FCD34D", marginLeft: 8 }}>
                    ≈ estimado
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 18,
                  flexWrap: "wrap",
                  paddingTop: 14,
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {[
                  {
                    label: "Saldo projetado",
                    val: fmtR(recValNum),
                    sub: "sem despesas",
                    color: "#86EFAC",
                  },
                  {
                    label: "Próximo crédito",
                    val: `dia ${rec.dia}`,
                    sub: "de cada mês",
                    color: "rgba(255,255,255,0.8)",
                  },
                  {
                    label: "Comprometido fixo",
                    val: "R$ 0",
                    sub: "sem recorrências",
                    color: "rgba(255,255,255,0.45)",
                  },
                ].map((k, i) => (
                  <div key={i}>
                    <div
                      style={{
                        ...G,
                        fontSize: 10,
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.35)",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        marginBottom: 3,
                      }}
                    >
                      {k.label}
                    </div>
                    <div style={{ ...G, ...NUM, fontSize: 15, fontWeight: 800, color: k.color }}>
                      {k.val}
                    </div>
                    <div style={{ ...G, fontSize: 10, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>
                      {k.sub}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
                gap: 10,
              }}
            >
              <Card style={{ padding: "13px 14px", borderColor: T.green, borderWidth: 1.5 }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  Receita do mês
                </div>
                <div style={{ ...G, ...NUM, fontSize: 18, fontWeight: 800, color: T.green, marginBottom: 3 }}>
                  {fmtR(recValNum)}
                </div>
                <div style={{ ...G, fontSize: 10, color: T.green }}>registrada ✓</div>
              </Card>
              <Card style={{ padding: "13px 14px", background: "#FAFAF9" }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  Gastos
                </div>
                <div style={{ ...G, ...NUM, fontSize: 18, fontWeight: 800, color: T.inkGhost, marginBottom: 5 }}>
                  R$ 0
                </div>
                <button onClick={onNewTx} style={{ ...G, background: T.redLight, color: T.red, border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  + Registrar
                </button>
              </Card>
              <Card style={{ padding: "13px 14px", background: "#FAFAF9" }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  Saldo livre
                </div>
                <div style={{ ...G, ...NUM, fontSize: 18, fontWeight: 800, color: T.inkGhost, marginBottom: 3 }}>
                  —
                </div>
                <div style={{ ...G, fontSize: 10, color: T.inkLight }}>após transações</div>
              </Card>
              <Card style={{ padding: "13px 14px", background: "#FAFAF9" }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  Saúde
                </div>
                <div style={{ fontSize: 18, margin: "4px 0" }}>⚪</div>
                <div style={{ ...G, fontSize: 10, color: T.inkLight }}>sem dados</div>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: 14 }}>
              <Card style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>Ritmo de gastos</div>
                  <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkLight, background: T.grayLight, borderRadius: 99, padding: "3px 9px" }}>
                    {periodBadge}
                  </div>
                </div>
                <div style={{ background: T.bg, borderRadius: 10, padding: "10px 10px 0", marginBottom: 12, position: "relative", overflow: "hidden", height: 80 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60, filter: "blur(2px)", opacity: 0.15, pointerEvents: "none" }}>
                    {[32, 54, 41, 72, 46, 63, 37, 85, 53, 67].map((h, i) => (
                      <div key={i} style={{ flex: 1, borderRadius: "2px 2px 0 0", background: T.ink, height: `${h}%` }} />
                    ))}
                  </div>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    <span style={{ fontSize: 14 }}>📊</span>
                    <span style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkMid }}>
                      Desbloqueado com a primeira transação
                    </span>
                  </div>
                </div>
                <button onClick={onNewTx} style={{ ...G, width: "100%", background: T.redLight, color: T.red, border: "none", borderRadius: 9, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  + Registrar primeira transação
                </button>
              </Card>
              <Card style={{ padding: 16, display: "flex", flexDirection: "column" }}>
                <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Insight do mês</div>
                <div style={{ flex: 1, background: T.bg, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 26 }}>🔮</div>
                  <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>Sem dados ainda</div>
                  <div style={{ ...G, fontSize: 11, color: T.inkLight, lineHeight: 1.6, maxWidth: 160 }}>
                    Aparece após a primeira transação do mês.
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <button onClick={() => onNav("orcamentos")} style={{ ...G, width: "100%", background: T.blueLight, color: T.blue, border: "none", borderRadius: 9, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    📋 Criar orçamento
                  </button>
                  <button onClick={() => onNav("metas")} style={{ ...G, width: "100%", background: T.purpleLight, color: T.purple, border: "none", borderRadius: 9, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    🎯 Definir meta
                  </button>
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: 14 }}>
              <Card style={{ overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px" }}>
                  <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>Transações recentes</div>
                  <div style={{ ...G, fontSize: 11, color: T.inkLight }}>nenhuma ainda</div>
                </div>
                <div style={{ height: 1, background: T.border }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: T.greenLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    💼
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.ink }}>{rec.desc}</div>
                    <div style={{ ...G, fontSize: 10, color: T.inkLight }}>
                      Renda · Pix · dia {String(rec.dia).padStart(2, "0")}/04
                      <span style={{ ...G, fontSize: 10, fontWeight: 700, background: T.grayLight, color: T.inkMid, borderRadius: 99, padding: "1px 7px", marginLeft: 6 }}>
                        agendado
                      </span>
                    </div>
                  </div>
                  <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: T.green }}>
                    +{fmtR(recValNum)}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", gap: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 20 }}>📭</div>
                  <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>Nenhuma despesa ainda</div>
                  <div style={{ ...G, fontSize: 11, color: T.inkLight, maxWidth: 220, lineHeight: 1.6 }}>
                    Suas transações aparecerão aqui conforme forem registradas.
                  </div>
                  <button onClick={onNewTx} style={{ ...G, background: T.redLight, color: T.red, border: "none", borderRadius: 9, padding: "7px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    + Registrar primeiro gasto
                  </button>
                </div>
              </Card>
              <Card style={{ padding: "14px 16px" }}>
                <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Próximos vencimentos</div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                  <div style={{ background: T.greenLight, borderRadius: 7, padding: "3px 7px", textAlign: "center", flexShrink: 0 }}>
                    <div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 800, color: T.green }}>{String(rec.dia).padStart(2, "0")}</div>
                    <div style={{ ...G, fontSize: 8, fontWeight: 700, color: T.green, textTransform: "uppercase", letterSpacing: "0.06em" }}>ABR</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ ...G, fontSize: 11, fontWeight: 600, color: T.ink }}>{rec.desc}</div>
                    <div style={{ ...G, fontSize: 10, color: T.inkMid }}>Pix · recorrente</div>
                  </div>
                  <div style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: T.green }}>
                    +{fmtR(recValNum)}
                  </div>
                </div>
                <div style={{ background: T.bg, border: `1.5px dashed ${T.border}`, borderRadius: 9, padding: 12, textAlign: "center" }}>
                  <div style={{ ...G, fontSize: 11, color: T.inkLight, lineHeight: 1.6, marginBottom: 8 }}>
                    Registre despesas fixas para ver boletos e assinaturas aqui.
                  </div>
                  <button onClick={() => onNav("recorrencias")} style={{ ...G, width: "100%", background: "none", color: T.inkMid, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    + Adicionar recorrência
                  </button>
                </div>
              </Card>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 18, flexShrink: 0 }}>💡</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 2 }}>
                  Sua receita já está em Recorrências
                </div>
                <div style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.6 }}>
                  {rec.desc} aparece na tela de Recorrências. Você pode editar o valor ou adicionar outras entradas e despesas fixas.
                </div>
              </div>
              <button onClick={() => onNav("recorrencias")} style={{ ...G, padding: "7px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, fontSize: 12, fontWeight: 600, color: T.inkMid, cursor: "pointer", flexShrink: 0 }}>
                Ver →
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "28px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
              <div style={{ ...G, fontSize: 18, fontWeight: 800, color: T.ink, marginBottom: 8 }}>
                Olá, {orgLabel}!
              </div>
              <div style={{ ...G, fontSize: 14, color: T.inkMid, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 20px" }}>
                O dashboard nasce aqui. Comece registrando sua primeira transação — receita ou despesa.
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={onNewTx} style={{ ...G, background: T.ink, color: "#fff", border: "none", borderRadius: 11, padding: "11px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  + Nova transação
                </button>
                <button onClick={() => onNav("recorrencias")} style={{ ...G, background: "none", color: T.inkMid, border: `1px solid ${T.border}`, borderRadius: 11, padding: "11px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Recorrências
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: T.blueLight, border: `1px solid ${T.blue}22`, borderRadius: 10, padding: "11px 13px" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
              <div style={{ flex: 1 }}>
                <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 2 }}>
                  Registre sua receita mensal
                </div>
                <div style={{ ...G, fontSize: 11, color: T.inkMid, lineHeight: 1.55 }}>
                  Em Recorrências, adicione seu salário ou renda. O dashboard mostrará projeções reais desde o início.
                </div>
              </div>
              <button onClick={() => onNav("recorrencias")} style={{ ...G, fontSize: 11, fontWeight: 700, color: T.blue, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
                Ir →
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: showNeutralLiveHero ? T.bg : mood.bgFx, pointerEvents: "none", zIndex: 0, transition: "background 0.18s" }} />

      <div style={{ position: "relative", zIndex: 1, paddingTop: 4 }}>
        <Breadcrumb label="Início" />
        <PageTitle sans="Visão" serif="Geral" />
      </div>

      {dashboardData.error && (
        <div style={{ ...anim(0.01), position: "relative", zIndex: 1, background: T.amberLight, border: `1px solid ${T.amber}33`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ ...G, fontSize: 12, color: T.inkMid, flex: "1 1 220px" }}>
            Não foi possível carregar o dashboard agora. Os valores abaixo podem estar incompletos até a próxima tentativa.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => refetch()}
              style={{
                ...G,
                background: T.ink,
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>
            <span style={{ ...G, fontSize: 11, fontWeight: 700, color: T.amber, maxWidth: "100%", wordBreak: "break-word" }}>
              API: {dashboardData.error}
            </span>
          </div>
        </div>
      )}

      <div style={{ ...anim(0.03), position: "relative", zIndex: 1 }}>
        <DashboardPeriodSelector
          isMobile={isMobile}
          presetId={periodPreset}
          onPresetChange={setPeriodPreset}
          customStart={customStart}
          customEnd={customEnd}
          onCustomDatesChange={onCustomDatesChange}
        />
        <div
          style={{
            ...G,
            marginTop: 8,
            fontSize: 11,
            color: T.inkLight,
            lineHeight: 1.45,
            maxWidth: isMobile ? "100%" : 480,
          }}
        >
          Os cards abaixo usam o período escolhido. Próximos débitos: sempre os próximos 14 dias.
        </div>
      </div>

      <div style={{ ...anim(0.06), display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 14, position: "relative", zIndex: 1 }}>
        {showNeutralLiveHero ? (
          <>
            <Card style={{ padding: 22 }}>
              {apiFailedNoSummary ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 10, lineHeight: 1 }}>⚠️</div>
                  <div style={{ ...G, fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Dados do mês indisponíveis</div>
                  <div style={{ ...G, fontSize: 13, color: T.inkMid, lineHeight: 1.6, marginBottom: 18 }}>
                    Não foi possível buscar o resumo na API. Verifique a conexão ou tente de novo em instantes.
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => refetch()}
                      style={{
                        ...G,
                        background: T.ink,
                        color: "#fff",
                        border: "none",
                        borderRadius: 11,
                        padding: "11px 22px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Tentar novamente
                    </button>
                    <button
                      type="button"
                      onClick={onNewTx}
                      style={{
                        ...G,
                        background: "none",
                        color: T.inkMid,
                        border: `1px solid ${T.border}`,
                        borderRadius: 11,
                        padding: "11px 22px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      + Nova transação
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{kpiPeriodPhrase}</div>
                  <div style={{ ...S, ...NUM, fontSize: isMobile ? "2rem" : "2.35rem", lineHeight: 1.05, color: T.ink, letterSpacing: "-1px", marginBottom: 8 }}>{fmtAbs(balance)}</div>
                  <div style={{ ...G, fontSize: 13, color: T.inkMid, marginBottom: 18, lineHeight: 1.55 }}>
                    Nenhum lançamento neste mês. Sem receitas nem despesas no período — registre uma transação ou configure recorrências para ver saldo e ritmo aqui.
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={onNewTx}
                      style={{
                        ...G,
                        background: T.ink,
                        color: "#fff",
                        border: "none",
                        borderRadius: 11,
                        padding: "11px 22px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      + Nova transação
                    </button>
                    <button
                      type="button"
                      onClick={() => onNav("recorrencias")}
                      style={{
                        ...G,
                        background: "none",
                        color: T.inkMid,
                        border: `1px solid ${T.border}`,
                        borderRadius: 11,
                        padding: "11px 22px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Recorrências
                    </button>
                  </div>
                </>
              )}
            </Card>

            <Card style={{ padding: isMobile ? 14 : 20, background: T.bg, border: `1px solid ${T.border}`, boxShadow: "none" }}>
              <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 12 }}>Insight do mês</div>
              <div style={{ background: T.surface, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 26 }}>🔮</div>
                <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>{apiFailedNoSummary ? "Insights indisponíveis" : "Sem dados ainda"}</div>
                <div style={{ ...G, fontSize: 11, color: T.inkLight, lineHeight: 1.6, maxWidth: 200 }}>
                  {apiFailedNoSummary
                    ? "Quando a API responder, você verá ritmo e sugestões aqui."
                    : "Aparece após a primeira transação do mês."}
                </div>
              </div>
              {apiFailedNoSummary ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    style={{ ...G, width: "100%", background: T.ink, color: "#fff", border: "none", borderRadius: 9, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                  >
                    Tentar novamente
                  </button>
                  <button
                    type="button"
                    onClick={onNewTx}
                    style={{ ...G, width: "100%", background: "none", color: T.inkMid, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                  >
                    + Nova transação
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <button type="button" onClick={() => onNav("orcamentos")} style={{ ...G, width: "100%", background: T.blueLight, color: T.blue, border: "none", borderRadius: 9, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    📋 Criar orçamento
                  </button>
                  <button type="button" onClick={() => onNav("metas")} style={{ ...G, width: "100%", background: T.purpleLight, color: T.purple, border: "none", borderRadius: 9, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    🎯 Definir meta
                  </button>
                </div>
              )}
            </Card>
          </>
        ) : (
          <>
            <Card style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, background: mood.badgeBg, color: mood.badgeColor, borderRadius: 9999, padding: "3px 10px", fontSize: 11, fontWeight: 700, border: `1px solid ${mood.insightBorder}`, transition: "all 0.8s" }}>
                  <MoodIcon size={10} /> {mood.label}
                </div>
                <span style={{ ...S, fontSize: 13, fontWeight: 600, color: moodKey === "serene" || moodKey === "healthy" ? T.inkMid : moodKey === "watchful" ? T.amber : T.red, transition: "color 0.18s" }}>
                  {mood.greeting}
                </span>
              </div>

              <div style={{ ...S, ...NUM, fontSize: isMobile ? "2.2rem" : mood.headlineSize, lineHeight: 1.05, color: mood.headlineColor, transition: "font-size 0.6s, color 0.8s", letterSpacing: "-1px", marginBottom: 8 }}>
                {fmtAbs(balance)}
              </div>
              <div style={{ ...G, display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <span style={{ fontSize: 12, color: T.inkMid }}>resultado do período (receitas − despesas)</span>
                <InfoTip
                  width={280}
                  text={
                    "Receitas no mês: " +
                    fmtAbs(inc) +
                    "\nDespesas no mês: " +
                    fmtAbs(exp) +
                    "\nSaldo do período: " +
                    fmtAbs(balance) +
                    (committed > 0 ? "\nComprometido (recorrências): " + fmtAbs(committed) : "")
                  }
                />
                <span style={{ fontSize: 12, fontWeight: 700, color: moodKey === "serene" || moodKey === "healthy" ? T.green : T.red, display: "flex", alignItems: "center", gap: 3 }}>
                  {spendPct <= timePct ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  <span>
                    {fmtSgn(rhythmVsProj)}{" "}
                    <span style={{ fontWeight: 400, color: T.inkMid }}>vs ritmo</span>
                  </span>
                  <InfoTip
                    width={260}
                    text={
                      "Projeção linear no mês (dia " +
                      day +
                      "/" +
                      dim +
                      "): despesas esperadas ~ " +
                      fmtAbs(Math.round((envelope * timePct) / 100)) +
                      ". Despesas reais: " +
                      fmtAbs(exp) +
                      "."
                    }
                  />
                </span>
              </div>

              <div>
                <div style={{ ...G, display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: T.inkMid }}>Composição do saldo</span>
                  <span style={{ ...M_MONO, ...NUM, fontSize: 12, fontWeight: 700, color: T.ink }}>
                    {fmtAbs(barTotal)}
                  </span>
                </div>
                <div style={{ height: 7, background: T.grayLight, borderRadius: 99, overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${(usedAmt / barTotal) * 100}%`, background: T.inkGhost, transition: "width 0.6s" }} />
                  <div style={{ width: `${(committed / barTotal) * 100}%`, background: mood.bar, opacity: 0.4, transition: "width 0.6s, background 0.8s" }} />
                  <div style={{ flex: 1, background: mood.bar, transition: "background 0.18s" }} />
                </div>
                <div style={{ ...G, display: "flex", gap: 14, marginTop: 7 }}>
                  {[
                    { label: "Gasto", color: T.inkGhost, value: fmtAbs(usedAmt), opacity: 1 },
                    { label: "Comprometido", color: mood.bar, value: fmtAbs(committed), opacity: 0.5 },
                    { label: "Livre", color: mood.bar, value: fmtAbs(freeAmt), opacity: 1 },
                  ].map(({ label, color, value, opacity }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: color, opacity, transition: "background 0.18s", flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: T.inkMid }}>{label}</span>
                      <span style={{ ...M_MONO, ...NUM, fontSize: 10, color: T.inkMid, fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card style={{ padding: isMobile ? 14 : 20, background: mood.insightBg, border: `1px solid ${mood.insightBorder}`, boxShadow: "none", transition: "all 0.8s" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <InsightIcon size={13} color={mood.kicker} />
                  <span style={{ ...G, fontSize: 10, fontWeight: 700, color: mood.kicker, letterSpacing: "0.08em" }}>
                    INSIGHT DO DIA
                  </span>
                </div>
                <Sparkles size={12} color={mood.kicker} style={{ opacity: 0.5 }} />
              </div>

              <div style={{ ...M_MONO, ...NUM, fontSize: 26, fontWeight: 700, color: mood.headlineColor, lineHeight: 1, marginBottom: 4, transition: "color 0.18s" }}>
                {insightStat}
              </div>
              <div style={{ ...G, fontSize: 11, color: mood.kicker, fontWeight: 600, marginBottom: 12, transition: "color 0.18s" }}>
                {spendPct <= timePct ? "do ritmo esperado ✓" : "do ritmo esperado ↑"}
              </div>

              <p style={{ ...G, fontSize: 13, lineHeight: 1.6, color: T.inkMid, marginBottom: 16 }}>
                {insightBody}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {moodActions.map(({ label, Icon: ActionIcon }) => (
                  <button key={label} type="button" style={{ ...G, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.7)", border: `1px solid ${mood.insightBorder}`, borderRadius: 9, padding: "7px 11px", fontSize: 12, color: mood.kicker, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                    <ActionIcon size={12} color={mood.kicker} /> {label}
                    <ChevronRight size={11} style={{ marginLeft: "auto" }} />
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>

      <div style={{ ...anim(0.1), display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 12, position: "relative", zIndex: 1 }}>
        {kpiItems.map(({ key, label, value, delta, up, emptyCta }) => (
          <Card key={key} style={{ padding: "16px 18px" }}>
            <div style={{ ...G, fontSize: 11, fontWeight: 500, color: T.inkMid, marginBottom: 8 }}>{label}</div>
            <div style={{ ...G, ...NUM, fontSize: 20, fontWeight: 700, color: T.ink, marginBottom: 4 }}>{value}</div>
            <div style={{ ...G, display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: up == null ? T.inkLight : up ? T.green : T.red }}>
              {up === true && <TrendingUp size={10} />}
              {up === false && <TrendingDown size={10} />}
              {delta}
            </div>
            {emptyCta ? (
              <button
                type="button"
                onClick={onNewTx}
                style={{
                  ...G,
                  marginTop: 10,
                  width: "100%",
                  background: T.redLight,
                  color: T.red,
                  border: "none",
                  borderRadius: 7,
                  padding: "6px 10px",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + Nova transação
              </button>
            ) : null}
          </Card>
        ))}
      </div>

      <div
        style={{
          ...anim(0.14),
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 300px",
          gap: 14,
          position: "relative",
          zIndex: 1,
          alignItems: "stretch",
        }}
      >
        <Card style={{ padding: "20px 20px 14px", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>Ritmo de Gastos</div>
              <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>Real acumulado vs. projeção linear — {periodBadge}</div>
            </div>
            {!apiFailedNoSummary && !isPeriodWithoutActivity ? (
              <div style={{ display: "flex", gap: 12 }}>
                {[["#D1D5DB", "Projeção"], [mood.bar, "Real"]].map(([c, l]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 14, height: 2, background: c, borderRadius: 1, transition: "background 0.18s" }} />
                    <span style={{ ...G, fontSize: 10, color: T.inkLight }}>{l}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {apiFailedNoSummary ? (
            <>
              <div style={{ ...G, fontSize: 12, color: T.inkMid, marginBottom: 14, lineHeight: 1.55 }}>Não foi possível carregar o ritmo de gastos.</div>
              <button
                type="button"
                onClick={() => refetch()}
                style={{
                  ...G,
                  width: "100%",
                  background: T.ink,
                  color: "#fff",
                  border: "none",
                  borderRadius: 9,
                  padding: "9px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Tentar novamente
              </button>
            </>
          ) : isPeriodWithoutActivity ? (
            <>
              <div style={{ background: T.bg, borderRadius: 10, padding: "10px 10px 0", marginBottom: 12, position: "relative", overflow: "hidden", height: isMobile ? 120 : 150 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: isMobile ? 80 : 110, filter: "blur(2px)", opacity: 0.15, pointerEvents: "none" }}>
                  {[32, 54, 41, 72, 46, 63, 37, 85, 53, 67].map((h, i) => (
                    <div key={i} style={{ flex: 1, borderRadius: "2px 2px 0 0", background: T.ink, height: `${h}%` }} />
                  ))}
                </div>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "0 12px" }}>
                  <span style={{ fontSize: 14 }}>📊</span>
                  <span style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkMid, textAlign: "center" }}>Desbloqueado com a primeira transação</span>
                </div>
              </div>
              <button type="button" onClick={onNewTx} style={{ ...G, width: "100%", background: T.redLight, color: T.red, border: "none", borderRadius: 9, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                + Registrar primeira transação
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: mood.accentLight, borderRadius: 9, padding: "7px 13px", marginBottom: 12, transition: "background 0.18s" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: mood.bar, transition: "background 0.18s", flexShrink: 0 }} />
                <span style={{ ...G, fontSize: 12, color: mood.kicker, fontWeight: 700, transition: "color 0.18s" }}>
                  {spendPct <= timePct
                    ? `R$ ${Math.abs(Math.round((envelope * (timePct - spendPct)) / 100))} à frente do ritmo`
                    : `R$ ${Math.abs(Math.round((envelope * (spendPct - timePct)) / 100))} acima do ritmo`}
                </span>
                <span style={{ ...G, fontSize: 11, color: T.inkMid, marginLeft: "auto" }}>
                  {progressSuffix || `dia ${day}/${dim} · ${timePct}%`}
                </span>
              </div>

              <ResponsiveContainer width="100%" height={isMobile ? 150 : 190}>
                <ComposedChart data={rhythmSafe} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                  <XAxis dataKey="dia" tick={{ ...G, fontSize: 10, fill: T.inkLight }} tickLine={false} axisLine={false} tickFormatter={(v) => (v % 5 === 0 || v === 1 ? `${v}` : "")} />
                  <YAxis tick={{ ...G, ...NUM, fontSize: 10, fill: T.inkLight }} tickLine={false} axisLine={false} tickFormatter={fmtK} />
                  <Tooltip content={<RhythmTooltipV4 />} />
                  {showTodayMarker ? (
                    <ReferenceLine
                      x={day}
                      stroke={mood.bar}
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      label={{
                        value: refLabel,
                        position: "top",
                        fill: mood.bar,
                        fontSize: 10,
                        fontFamily: "Geist,sans-serif",
                      }}
                    />
                  ) : null}
                  <Line type="monotone" dataKey="proj" stroke="#D1D5DB" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                  <Line type="monotone" dataKey="real" stroke={mood.bar} strokeWidth={2.5} dot={false} connectNulls={false} style={{ transition: "stroke 0.8s" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </Card>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            minHeight: isMobile ? undefined : "100%",
          }}
        >
          <Card
            style={{
              padding: 18,
              flex: isMobile ? undefined : 1,
              display: "flex",
              flexDirection: "column",
              minHeight: isMobile ? undefined : 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexShrink: 0 }}>
              <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>Gastos por Categoria</div>
              <Badge color={T.inkMid} bg={T.grayLight}>{periodBadge}</Badge>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 12, marginTop: 4, flexShrink: 0 }}>
              {[["#D1D5DB", "atual"], ["#9CA3AF", "referência"], ["#FCA5A5", "acima"]].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 10, height: l === "referência" ? 2 : 5, background: c, borderRadius: l === "referência" ? 1 : 2 }} />
                  <span style={{ ...G, fontSize: 10, color: T.inkLight }}>{l}</span>
                </div>
              ))}
            </div>
            {categoryData.length === 0 ? (
              <div style={{ flex: isMobile ? undefined : 1, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: isMobile ? undefined : 0 }}>
                <CardEmptyWithCta
                  icon="📭"
                  title="Nenhuma despesa categorizada"
                  sub="Assim que você registrar gastos com categoria, elas aparecem aqui."
                  primaryLabel="+ Registrar primeiro gasto"
                  onPrimary={onNewTx}
                  primaryVariant="redLight"
                />
              </div>
            ) : (() => {
              const maxVal = Math.max(...categoryData.map((c) => Math.max(c.value, c.avg)));
              return (
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
                  {categoryData.map((c) => {
                const barPct = (c.value / maxVal) * 100;
                const avgPct = (c.avg / maxVal) * 100;
                const isOver = c.value > c.avg;
                const safePct = Math.min(barPct, avgPct);
                const overPct = isOver ? barPct - avgPct : 0;
                return (
                  <div key={c.tagId || c.name} style={{ marginBottom: 9 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                        <span style={{ ...G, fontSize: 12, fontWeight: 500, color: T.ink }}>{c.name}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isOver && <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.red, background: T.redLight, borderRadius: 99, padding: "1px 5px" }}>+{Math.round((c.value / c.avg - 1) * 100)}%</span>}
                        <span style={{ ...M_MONO, ...NUM, fontSize: 11, fontWeight: 600, color: T.ink }}>{fmtAbs(c.value)}</span>
                      </div>
                    </div>
                    <div style={{ position: "relative", height: 6, background: T.grayLight, borderRadius: 99 }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${safePct}%`, background: c.color, opacity: 0.55, borderRadius: 99 }} />
                      {overPct > 0 && <div style={{ position: "absolute", left: `${avgPct}%`, top: 0, height: "100%", width: `${overPct}%`, background: T.red, opacity: 0.5, borderRadius: "0 99px 99px 0" }} />}
                      <div style={{ position: "absolute", top: -3, left: `${avgPct}%`, width: 2, height: 12, background: T.inkMid, borderRadius: 1, transform: "translateX(-50%)", zIndex: 2 }} />
                    </div>
                  </div>
                );
                  })}
                </div>
              );
            })()}
          </Card>
        </div>
      </div>

      <div style={{ ...anim(0.18), display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 14, position: "relative", zIndex: 1 }}>
        <Card style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
            <span style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>Últimas Transações</span>
            <button onClick={() => onNav("transacoes")} style={{ ...G, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", fontSize: 12, fontWeight: 600, color: T.blue, cursor: "pointer" }}>
              Ver todas <ArrowUpRight size={12} />
            </button>
          </div>
          {recentTransactions.length === 0 ? (
            <CardEmptyWithCta
              icon="📭"
              title="Nenhuma transação neste mês"
              sub="Suas transações aparecerão aqui conforme forem registradas. Registre receitas, despesas e transferências para acompanhar seu fluxo."
              primaryLabel="+ Nova transação"
              onPrimary={onNewTx}
              secondaryLabel="Ver todas"
              onSecondary={() => onNav("transacoes")}
            />
          ) : (
            recentTransactions.map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, padding: isMobile ? "10px 14px" : "12px 20px", borderBottom: i < recentTransactions.length - 1 ? `1px solid ${T.border}` : "none", transition: "background 0.1s" }} onMouseEnter={(e) => (e.currentTarget.style.background = T.surfaceHov)} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                <div style={{ fontSize: 22 }}>{t.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}>
                    {t.desc} {t.rec && <Repeat size={10} color={T.blue} />}
                    {t.status === "pendente" && <Badge color={T.amber} bg={T.amberLight}>Pendente</Badge>}
                  </div>
                  <div style={{ ...G, fontSize: 11, color: T.inkMid, marginTop: 1 }}>{t.cat} · {t.date}</div>
                </div>
                <div style={{ ...G, ...NUM, fontSize: 14, fontWeight: 700, color: t.val > 0 ? T.green : T.ink }}>
                  {fmtSgn(t.val)}
                </div>
              </div>
            ))
          )}
        </Card>

        <Card style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>Próximos Débitos</div>
            <Badge color={T.inkMid} bg={T.grayLight}>próx. 14 dias</Badge>
          </div>

          {upcomingDebits.length === 0 ? (
            <div style={{ background: T.bg, border: `1.5px dashed ${T.border}`, borderRadius: 9, padding: 12, textAlign: "center" }}>
              <div style={{ ...G, fontSize: 11, color: T.inkLight, lineHeight: 1.6, marginBottom: 8 }}>
                Nenhuma despesa recorrente com vencimento nos próximos 14 dias. Registre despesas fixas para ver boletos e assinaturas aqui.
              </div>
              <button
                type="button"
                onClick={() => onNav("recorrencias")}
                style={{
                  ...G,
                  width: "100%",
                  background: "none",
                  color: T.inkMid,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: "7px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Adicionar recorrência
              </button>
            </div>
          ) : (
            <>
              <div style={{ background: mood.accentLight, border: `1px solid ${mood.insightBorder}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.8s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "center", minWidth: 32 }}>
                    <div style={{ ...M_MONO, ...NUM, fontSize: 16, fontWeight: 700, color: mood.headlineColor, lineHeight: 1, transition: "color 0.18s" }}>{upcomingDebits[0].day}</div>
                    <div style={{ ...G, fontSize: 8, color: T.inkLight, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{upcomingDebits[0].monthShort}</div>
                  </div>
                  <div style={{ width: 1, height: 28, background: mood.insightBorder }} />
                  <div>
                    <div style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink }}>{upcomingDebits[0].name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                      <span style={{ ...G, fontSize: 10, color: T.inkMid }}>{upcomingDebits[0].cat}</span>
                      <Badge color={mood.kicker} bg={mood.badgeBg}>em {upcomingDebits[0].daysLeft}d</Badge>
                    </div>
                  </div>
                </div>
                <div style={{ ...M_MONO, ...NUM, fontSize: 14, fontWeight: 700, color: mood.headlineColor, transition: "color 0.18s" }}>
                  {fmtAbs(upcomingDebits[0].value)}
                </div>
              </div>

              {upcomingDebits.slice(1).map((d, i) => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 2px", borderBottom: i < upcomingDebits.length - 2 ? `1px solid ${T.bg}` : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...M_MONO, ...NUM, fontSize: 11, fontWeight: 600, color: T.inkMid, width: 40, textAlign: "center" }}>{d.dateLabel}</span>
                    <div>
                      <div style={{ ...G, fontSize: 12, fontWeight: 500, color: T.ink }}>{d.name}</div>
                      <div style={{ ...G, fontSize: 10, color: T.inkMid }}>{d.cat}</div>
                    </div>
                  </div>
                  <span style={{ ...M_MONO, ...NUM, fontSize: 12, fontWeight: 600, color: T.ink }}>{fmtAbs(d.value)}</span>
                </div>
              ))}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
            <span style={{ ...G, fontSize: 11, color: T.inkMid }}>Total · próx. 14 dias</span>
            <span style={{ ...M_MONO, ...NUM, fontSize: 13, fontWeight: 700, color: T.ink }}>{fmtAbs(upcomingDebits.reduce((s, d) => s + d.value, 0))}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
