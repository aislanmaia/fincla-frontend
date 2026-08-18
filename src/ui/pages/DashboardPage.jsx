import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  moodGreeting,
  moodInsightBody,
  RhythmTooltipV4,
  calcMood,
} from "../features/moodV4";
import { useDashboardData } from "../features/dashboard/useDashboardData.js";
import { pickCommittedExpenseForDashboard } from "../features/dashboard/dashboardRecurringKpi.js";
import { getRecurringProjection } from "../../api/recurringSeries";
import { DashboardPeriodSelector } from "../features/dashboard/DashboardPeriodSelector.jsx";
import {
  formatDashboardKpiPeriodPhrase,
  formatDashboardRangeBadge,
  parseLocalYmd,
  rangeForDashboardPreset,
} from "../features/dashboard/dashboardDateRange.js";
import {
  getDashboardPeriodBootstrap,
  writeDashboardPeriodToStorage,
} from "../features/dashboard/dashboardPeriodStorage.js";
import { CardEmptyWithCta } from "../features/shellExtras.jsx";

/** Os dois "saldos" da tela respondem perguntas diferentes; o tooltip é o que
 *  impede o usuário de ler um pelo outro. */
const SALDO_EM_CONTA_TOOLTIP =
  "Dinheiro que você tem hoje, somando suas contas. Conta só o que já foi pago " +
  "de fato — compromissos a pagar ainda não entram aqui. Diferente do 'Saldo do " +
  "período', que é só receitas menos despesas do ciclo escolhido.";

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

  /** Primeira pintura já alinhada ao localStorage (evita useEffect gravar "este mês" antes da hidratação). */
  const periodBootstrapRef = useRef(null);
  if (periodBootstrapRef.current === null) {
    periodBootstrapRef.current = getDashboardPeriodBootstrap(organizationId);
  }
  const b0 = periodBootstrapRef.current;
  const [periodPreset, setPeriodPreset] = useState(b0.periodPreset);
  const [customStart, setCustomStart] = useState(b0.customStart);
  const [customEnd, setCustomEnd] = useState(b0.customEnd);

  /** Evita gravar no mesmo ciclo em que hidratamos do localStorage (e evita write redundante). */
  const periodPersistFingerprintRef = useRef("");

  useLayoutEffect(() => {
    if (!organizationId) {
      periodPersistFingerprintRef.current = "";
      return;
    }
    const row = getDashboardPeriodBootstrap(organizationId);
    periodPersistFingerprintRef.current = JSON.stringify({
      org: organizationId,
      p: row.periodPreset,
      s: row.customStart,
      e: row.customEnd,
    });
    setPeriodPreset(row.periodPreset);
    setCustomStart(row.customStart);
    setCustomEnd(row.customEnd);
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    const fp = JSON.stringify({
      org: organizationId,
      p: periodPreset,
      s: customStart,
      e: customEnd,
    });
    if (fp === periodPersistFingerprintRef.current) return;
    periodPersistFingerprintRef.current = fp;
    writeDashboardPeriodToStorage(organizationId, {
      presetId: periodPreset,
      customStart,
      customEnd,
    });
  }, [organizationId, periodPreset, customStart, customEnd]);

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
  const hasComparison = categoryData.some((c) => typeof c.avg === "number" && c.avg > 0);
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
  // total_expenses do backend é bruto; net = bruto - refunds.
  const expGross = summary?.total_expenses ?? 0;
  const refundsTotal = summary?.total_refunds ?? 0;
  const exp = Math.max(0, expGross - refundsTotal); // exibimos despesa líquida no KPI principal
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

  /**
   * Projeção de recorrências futuras (após hoje) no período do dashboard.
   * Carregada em paralelo aos dados do dashboard; representa "compromissos
   * fechados" que ainda não viraram transação real (materialização lazy).
   */
  /**
   * `null` = não sabemos (endpoint fora do ar, sem org, mocks ligados).
   * `[]` = sabemos que não há recorrência a vencer. A distinção existe porque dois
   * KPIs passaram a exibir esses valores: mostrar R$ 0,00 quando a chamada falhou
   * afirmaria "você não tem nada comprometido", que é a informação oposta.
   */
  const [recurringProjection, setRecurringProjection] = useState(null);
  useEffect(() => {
    if (!apiDataEnabled || !organizationId || !appliedRange.start || !appliedRange.end) {
      setRecurringProjection(null);
      return undefined;
    }
    let cancelled = false;
    getRecurringProjection(organizationId, appliedRange.start, appliedRange.end)
      .then((res) => { if (!cancelled) setRecurringProjection(res.items || []); })
      .catch(() => { if (!cancelled) setRecurringProjection(null); });
    return () => { cancelled = true; };
  }, [apiDataEnabled, organizationId, appliedRange.start, appliedRange.end]);

  /** Mapa dia-do-período (1..dim) → soma de projeções de despesa naquele dia. */
  const projectedExpenseByDay = useMemo(() => {
    const map = new Map();
    if (!appliedRange.start || !recurringProjection?.length) return map;
    const baseMs = new Date(`${appliedRange.start}T00:00:00`).getTime();
    if (!Number.isFinite(baseMs)) return map;
    const ONE_DAY = 86400000;
    for (const item of recurringProjection) {
      if (item.type !== "expense") continue;
      const occMs = new Date(`${item.date}T00:00:00`).getTime();
      if (!Number.isFinite(occMs)) continue;
      const dia = Math.floor((occMs - baseMs) / ONE_DAY) + 1;
      if (dia < 1 || dia > dim) continue;
      map.set(dia, (map.get(dia) || 0) + Number(item.value));
    }
    return map;
  }, [recurringProjection, appliedRange.start, dim]);

  const rhythmSafe = useMemo(() => {
    const base = rhythmData.length > 0
      ? rhythmData
      : (() => {
          const d = Math.max(dim, 1);
          const env = Math.max(envelope, 1);
          return Array.from({ length: d }, (_, i) => ({
            dia: i + 1,
            proj: Math.round((env / d) * (i + 1)),
            real: null,
            dayLabel: `${i + 1}`,
          }));
        })();
    if (projectedExpenseByDay.size === 0) return base;
    const todayReal = base.find((p) => p.dia === calendarDay)?.real ?? 0;
    let acc = todayReal;
    return base.map((point) => {
      if (point.dia < calendarDay) return { ...point, committed: null };
      if (point.dia === calendarDay) return { ...point, committed: todayReal };
      acc += projectedExpenseByDay.get(point.dia) || 0;
      // realAtToday: contexto p/ tooltip de dias futuros (a linha "Real" para em hoje;
      // esse campo deixa o usuário ver quanto já foi gasto até agora, sem poluir o gráfico).
      return { ...point, committed: acc, realAtToday: todayReal };
    });
  }, [rhythmData, dim, envelope, projectedExpenseByDay, calendarDay]);
  const day = calendarDay;
  const timePct = Math.round((day / Math.max(dim, 1)) * 100);
  const spendPct =
    envelope > 0 ? Math.min(250, (exp / envelope) * 100) : 0;
  // Fonte única do "está à frente?": a saudação, o conselho do insight e o número
  // "R$ X à frente/acima" saem todos daqui. Recalcular em cada lugar reabre a
  // contradição da #67 numa faixa estreita — `timePct` é arredondado e um ratio
  // cru não é, e 37 combinações de (dia, dias-no-período) caem nessa fresta.
  const aheadOfPace = spendPct <= timePct;
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
  // A saudação depende do ritmo, não só da faixa: dentro de `watchful`, ratio <= 1
  // é gasto ABAIXO do esperado e não pode ser anunciado como aceleração (#67).
  const moodGreetingText = moodGreeting(moodKey, aheadOfPace);
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
  /** Comprometido recorrente no período do datepicker (`recurring_in_period`) ou fallback mensal. */
  const committed = pickCommittedExpenseForDashboard(
    dashboardData.summary,
    dashboardData.recurringSummary,
  );
  /**
   * Recorrências que ainda VÃO cair no período, por tipo.
   *
   * Diferente de `committed` acima: aquele é `recurring_in_period.total_expense`,
   * que o backend descreve como projeção do intervalo INTEIRO ("valor × ocorrências
   * esperadas no calendário", não soma de linhas em `transactions`). Ou seja, ele
   * inclui recorrências que já caíram e portanto já estão dentro de `exp`.
   * `getRecurringProjection` devolve só o que ainda não virou transação.
   */
  const projectedToCome = useMemo(() => {
    if (!Array.isArray(recurringProjection)) {
      return { expense: 0, income: 0, known: false };
    }
    let expense = 0;
    let income = 0;
    for (const item of recurringProjection) {
      const value = Number(item.value) || 0;
      if (item.type === "expense") expense += value;
      else if (item.type === "income") income += value;
    }
    return { expense, income, known: true };
  }, [recurringProjection]);

  const balance = bal;
  /**
   * Composição do período — uma PARTIÇÃO das receitas, não uma soma de grandezas
   * soltas.
   *
   * A versão anterior desenhava `Gasto + Comprometido + Sobra` e imprimia o total.
   * Mas `Sobra` é `receitas − Gasto` por definição, então aquele total era sempre
   * `receitas + Comprometido` — 19.685,42 + 4.127,64 = 23.813,06 numa org medida em
   * produção, um número que não representava nada. Pior: o `Comprometido` cobria o
   * mês inteiro, então parte dele já estava dentro do `Gasto` e o resto dentro da
   * `Sobra` — contado duas vezes e desenhado como terceira fatia. Todas as larguras
   * saíam comprimidas pelo mesmo fator.
   *
   * Agora as três fatias somam exatamente as receitas, e sobra um número que a tela
   * não tinha: o que resta DEPOIS das recorrências que ainda vão vencer.
   */
  const committedToCome = projectedToCome.expense;
  /**
   * O clamp existe só para a GEOMETRIA da barra: uma fatia não pode ser maior que a
   * sobra que ela ocupa. Usar o valor limitado no KPI faria o card relatar um
   * compromisso que não é o compromisso — com sobra R$ 100 e recorrências R$ 3.000
   * ele leria "R$ 100,00", e com resultado negativo leria "nenhuma recorrência a
   * vencer" tendo uma lista cheia. Exatamente o falso-negativo que o `null ≠ []`
   * acima existe para impedir.
   */
  const committedInBar = Math.min(committedToCome, Math.max(0, bal));
  const freeAmt = Math.max(0, bal - committedInBar);
  /**
   * A barra só é partição das receitas enquanto sobra dinheiro. Com resultado
   * negativo não existe "sobra", as três fatias colapsam em `Gasto` e o total passa
   * a ser a despesa — então o cabeçalho não pode continuar dizendo "receitas".
   */
  /**
   * Período inteiramente no passado. `getRecurringProjection` só devolve ocorrências
   * DEPOIS de hoje, então num mês fechado ela é sempre vazia — e dois KPIs passariam
   * a dizer "nenhuma recorrência a vencer" para um mês que já acabou, onde "a vencer"
   * não quer dizer nada. Nesse caso vale o comprometido DO período (`recurring_in_period`).
   */
  const periodEnded = useMemo(() => {
    const e = parseLocalYmd(appliedRange.end);
    if (!e) return false;
    const now = new Date();
    return (
      new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime() <
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    );
  }, [appliedRange.end]);

  const barIsIncomeSplit = bal >= 0;
  const barTotal = Math.max(barIsIncomeSplit ? inc : usedAmt + committedInBar, 1);

  /**
   * Fatias da barra. Sem a projeção (endpoint fora do ar, mocks, sem org) a fatia do
   * meio simplesmente não existe e o rótulo da última volta a ser "Sobra do período":
   * prometer "depois das recorrências" sem saber quais são seria afirmar o que não
   * foi verificado. `mood.bar` some do meio junto com a fatia.
   *
   * "Livre" continua fora de cogitação como rótulo — a #68 tirou esse nome porque
   * sugeria dinheiro disponível para gastar, e este número é competência, não caixa.
   * O dinheiro que dá para gastar agora é o headline "Saldo em conta".
   */
  const compositionSlices = useMemo(() => {
    const slices = [
      { label: "Gasto", color: T.inkGhost, value: fmtAbs(usedAmt), opacity: 1 },
    ];
    // Num período encerrado não existe "a vencer": a projeção é vazia por construção
    // e o comprometido do período já está inteiro dentro do `Gasto`. Desenhá-lo como
    // fatia própria seria a contagem dupla que esta barra existe para eliminar.
    if (projectedToCome.known && !periodEnded) {
      slices.push({
        label: "Comprometido a vencer",
        color: mood.bar,
        // O valor é o ÍNTEGRO, não o clampado: a largura da fatia é geometria (não
        // pode passar da sobra que ocupa), mas o número tem de bater com o KPI que
        // leva o mesmo rótulo dois blocos abaixo.
        value: fmtAbs(committedToCome),
        opacity: 0.5,
      });
    }
    slices.push({
      label: projectedToCome.known && !periodEnded
        ? "Sobra depois das recorrências"
        : "Sobra do período",
      color: mood.bar,
      value: fmtAbs(freeAmt),
      opacity: 1,
    });
    return slices;
  }, [usedAmt, committedToCome, freeAmt, mood.bar, projectedToCome.known, periodEnded]);

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
  /**
   * Quanto dá para gastar por dia — limitado pelo CAIXA, não só pelo ciclo.
   *
   * Antes era `bal / diasRestantes`, e `bal` é receitas − despesas do período: uma
   * grandeza de competência. Numa org medida em produção isso rendia "mantenha
   * R$ 625/dia pelos próximos 16 dias" — R$ 10.000 — com R$ 315,57 na conta, porque
   * o caixa já tinha ido no pagamento da fatura. O conselho não era conservador
   * demais nem otimista demais: era impossível de seguir.
   *
   * O teto real é o dinheiro que existe hoje, mais o que ainda entra, menos o que
   * já está comprometido. `total_available` ausente (endpoint fora do ar) NÃO vira
   * zero — sem saber o caixa, cair no comportamento antigo é melhor que inventar
   * um teto.
   */

  const dailyBudget = useMemo(() => {
    const byCycle = Math.max(0, bal);
    const cash = dashboardData.balanceSummary?.total_available;
    if (typeof cash !== "number") {
      return Math.round(byCycle / daysLeftInRange);
    }
    // Sem a projeção, entradas e compromissos futuros são DESCONHECIDOS — somá-los
    // como zero produziria o teto otimista que este cálculo existe para eliminar.
    // O caixa sozinho continua sendo um fato e um limite superior legítimo: o que
    // falta só pode baixá-lo.
    const byCash = projectedToCome.known
      ? Math.max(0, cash + projectedToCome.income - projectedToCome.expense)
      : Math.max(0, cash);
    return Math.round(Math.min(byCycle, byCash) / daysLeftInRange);
  }, [bal, daysLeftInRange, dashboardData.balanceSummary, projectedToCome]);

  /**
   * Saldo em conta no HEADLINE (opção D).
   *
   * Deixou de ser o quarto KPI e virou o número principal: a pergunta que traz o
   * usuário para a Visão Geral é "quanto eu tenho", e a resposta estava em corpo 20
   * enquanto o resultado do período ocupava 3,3rem. `total_available` ausente NÃO
   * vira zero — zero é um saldo legítimo e a diferença importa aqui mais que em
   * qualquer outro lugar da tela.
   */
  const accountHeadline = useMemo(() => {
    const summaryBalance = dashboardData.balanceSummary;
    const total = summaryBalance?.total_available;
    if (typeof total !== "number") {
      return { available: false, value: "—", note: "Dados indisponíveis" };
    }
    const n = summaryBalance.account_count ?? 0;
    const contas = n === 1 ? "1 conta" : `${n} contas`;
    return {
      available: true,
      negative: total < 0,
      value: total < 0 ? fmtSgn(total) : fmtAbs(total),
      note: total < 0
        ? `conta negativa · ${contas}`
        : `dinheiro disponível hoje · em ${contas}`,
    };
  }, [dashboardData.balanceSummary]);

  const { Icon: MoodIcon, InsightIcon } = mood;
  /**
   * Despesa que o ritmo linear preveria para hoje.
   *
   * O card mostrava a DIFERENÇA ("R$ 544 à frente") em corpo 26 — uma grandeza que
   * não está em conta nenhuma, não é orçamento e não é economia. Pior: o mesmo
   * número aparecia três vezes na tela com três nomes diferentes ("vs ritmo",
   * "à frente / do ritmo esperado ✓", "à frente do ritmo"), como se fossem três
   * medidas. Mostrar as duas quantias deixa a diferença evidente sozinha, ancorada
   * em valores que existem, e o nome único fica com o card de Ritmo.
   */
  const expectedByNow = Math.round((inc * timePct) / 100);
  /**
   * Percentual da RECEITA gasta — dividido por `inc`, não pelo `envelope`.
   *
   * `envelope` é `max(inc, exp)`, então quem gasta mais do que recebe teria o
   * numerador travado em 100%: com receita 1.000 e despesa 2.000 o chip diria
   * "100% da receita gasta" (verdade: 200%). Justo o caso mais grave seria o que a
   * tela leria mais errado. Passar de 100 aqui é informação, não bug.
   *
   * Sem receita no período a fração não existe e o chip não aparece — o humor
   * continua saindo do `envelope`, que é outra conta e não muda nesta PR.
   */
  const spentOfIncomePct = inc > 0 ? Math.round((exp / inc) * 100) : null;


  const insightBody = moodInsightBody(moodKey, {
    aheadOfPace,
    dailyBudgetLabel: fmtAbs(dailyBudget),
    daysLeft: daysLeftInRange,
    periodPhrase: kpiPeriodPhrase,
  });


  const kpiItems = useMemo(() => {
    if (apiFailedNoSummary) {
      return [
        { key: "inc", label: `Receitas · ${kpiPeriodPhrase}`, value: "—", delta: "Dados indisponíveis", up: null, emptyCta: false },
        { key: "exp", label: `Despesas · ${kpiPeriodPhrase}`, value: "—", delta: "Dados indisponíveis", up: null, emptyCta: false },
        { key: "cmt", label: "Comprometido a vencer", value: "—", delta: "Dados indisponíveis", up: null, emptyCta: false },
        { key: "left", label: "Sobra depois das recorrências", value: "—", delta: "Dados indisponíveis", up: null, emptyCta: false },
      ];
    }
    if (isPeriodWithoutActivity) {
      const n = txCount ?? 0;
      return [
        { key: "inc", label: `Receitas · ${kpiPeriodPhrase}`, value: fmtAbs(0), delta: `${n} lançamentos no período`, up: null, emptyCta: true },
        { key: "exp", label: `Despesas · ${kpiPeriodPhrase}`, value: fmtAbs(0), delta: "registre para acompanhar o ritmo", up: null, emptyCta: true },
        // Uma org que configurou recorrências mas ainda não lançou nada cai aqui com
        // total_income e total_expenses zerados — e a projeção pode estar cheia. Não
        // dá para afirmar "nenhuma recorrência" só porque não houve transação.
        {
          key: "cmt",
          label: "Comprometido a vencer",
          value: projectedToCome.known ? fmtAbs(committedToCome) : "—",
          delta: projectedToCome.known
            ? (committedToCome > 0 ? "recorrências até o fim do período" : "nenhuma recorrência a vencer")
            : "Projeção indisponível",
          up: null,
          emptyCta: true,
        },
        { key: "left", label: "Sobra do período", value: fmtAbs(0), delta: "sem movimento ainda", up: null, emptyCta: true },
      ];
    }
    const s = dashboardData.summary;
    if (!s) {
      return [
        { key: "inc", label: `Receitas · ${kpiPeriodPhrase}`, value: fmtAbs(0), delta: "Carregando resumo…", up: null, emptyCta: false },
        { key: "exp", label: `Despesas · ${kpiPeriodPhrase}`, value: fmtAbs(0), delta: "Carregando resumo…", up: null, emptyCta: false },
        { key: "cmt", label: "Comprometido a vencer", value: fmtAbs(0), delta: "Carregando resumo…", up: null, emptyCta: false },
        { key: "left", label: "Sobra depois das recorrências", value: fmtAbs(0), delta: "Carregando resumo…", up: null, emptyCta: false },
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
        // Despesa líquida (bruto - estornos). Quando há estornos, sub-linha mostra o abate.
        value: fmtAbs(Math.max(0, (s?.total_expenses ?? 0) - (s?.total_refunds ?? 0))),
        delta: s && (s.total_refunds ?? 0) > 0
          ? `↳ ${fmtAbs(s.total_refunds)} em estornos abatidos`
          : (s ? (s.balance >= 0 ? "saldo positivo" : "saldo pressionado") : "aguardando resumo do período"),
        up: s ? spendPct <= timePct : null,
        emptyCta: false,
      },
      // "Saldo do período" e "Saldo em conta" saíram daqui: os dois subiram para o
      // headline (opção D). Repeti-los em corpo 20 logo abaixo seria dizer o mesmo
      // número duas vezes na mesma dobra da tela.
      {
        key: "cmt",
        label: periodEnded ? "Comprometido no período" : "Comprometido a vencer",
        value: periodEnded
          ? fmtAbs(committed)
          : projectedToCome.known
            ? fmtAbs(committedToCome)
            : "—",
        delta: periodEnded
          ? "recorrências projetadas no período"
          : projectedToCome.known
            ? (committedToCome > 0 ? "recorrências até o fim do período" : "nenhuma recorrência a vencer")
            : "Projeção indisponível",
        up: null,
        emptyCta: false,
      },
      {
        key: "left",
        label: periodEnded
          ? "Saldo do período"
          : projectedToCome.known
            ? "Sobra depois das recorrências"
            : "Sobra do período",
        value: periodEnded
          ? fmtAbs(Math.abs(s?.balance ?? 0))
          : projectedToCome.known
            ? fmtAbs(freeAmt)
            : fmtAbs(Math.max(0, bal)),
        delta: periodEnded
          ? (s && s.balance >= 0 ? "resultado acumulado" : "resultado negativo")
          : projectedToCome.known
            ? "do que já entrou, menos o que ainda vence"
            : "sem a projeção das recorrências",
        // Sem seta no período aberto. Esta sobra sai só das receitas JÁ recebidas —
        // é partição do que entrou — enquanto o valor/dia do Insight conta também as
        // entradas previstas. Uma seta vermelha aqui contradiz o conselho ali com um
        // sinal visual, e as duas contas estão certas: respondem perguntas diferentes.
        up: periodEnded ? (s ? s.balance >= 0 : null) : null,
        emptyCta: false,
      },
    ];
  }, [
    apiFailedNoSummary,
    isPeriodWithoutActivity,
    kpiPeriodPhrase,
    dashboardData.summary,
    committedToCome,
    committed,
    freeAmt,
    bal,
    periodEnded,
    projectedToCome.known,
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
                  Sobra do período
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
                  <button onClick={() => onNav("planning", { area: "budgets" })} style={{ ...G, width: "100%", background: T.blueLight, color: T.blue, border: "none", borderRadius: 9, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    📋 Criar orçamento
                  </button>
                  <button onClick={() => onNav("planning", { area: "goals" })} style={{ ...G, width: "100%", background: T.purpleLight, color: T.purple, border: "none", borderRadius: 9, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
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
                  <button onClick={() => onNav("recurring")} style={{ ...G, width: "100%", background: "none", color: T.inkMid, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
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
              <button onClick={() => onNav("recurring")} style={{ ...G, padding: "7px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, fontSize: 12, fontWeight: 600, color: T.inkMid, cursor: "pointer", flexShrink: 0 }}>
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
                <button onClick={() => onNav("recurring")} style={{ ...G, background: "none", color: T.inkMid, border: `1px solid ${T.border}`, borderRadius: 11, padding: "11px 22px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
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
              <button onClick={() => onNav("recurring")} style={{ ...G, fontSize: 11, fontWeight: 700, color: T.blue, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}>
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
                  {/* O saldo em conta vem de outro endpoint. Se ELE respondeu, é o único
                      número confiável da tela neste estado — esconder seria desperdiçar
                      a independência das fontes que a #S2 introduziu de propósito. */}
                  {accountHeadline.available ? (
                    <div data-testid="dashboard-headline-saldo-conta" style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14, marginBottom: 18 }}>
                      <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                        Saldo em conta
                      </div>
                      <div style={{ ...S, ...NUM, fontSize: isMobile ? "2rem" : "2.35rem", lineHeight: 1.05, color: accountHeadline.negative ? T.red : T.ink, letterSpacing: "-1px", marginBottom: 4 }}>
                        {accountHeadline.value}
                      </div>
                      <div style={{ ...G, fontSize: 12, color: T.inkMid }}>{accountHeadline.note}</div>
                    </div>
                  ) : null}
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
                  {/* Mesmo sem resumo do período (backend fora) ou sem lançamento
                      algum, "quanto eu tenho" continua tendo resposta: o saldo em
                      conta vem de outro endpoint. Antes da opção D esse número vivia
                      num KPI que sobrevivia à queda do resumo; ao subir para o
                      headline ele precisa sobreviver aqui também, senão a tela mais
                      degradada é justamente a que esconde o único dado que ela tem. */}
                  <div data-testid="dashboard-headline-saldo-conta" style={{ marginBottom: 18 }}>
                    <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                      Saldo em conta
                    </div>
                    <div style={{ ...S, ...NUM, fontSize: isMobile ? "2rem" : "2.35rem", lineHeight: 1.05, color: accountHeadline.negative ? T.red : T.ink, letterSpacing: "-1px", marginBottom: 4 }}>
                      {accountHeadline.value}
                    </div>
                    <div style={{ ...G, fontSize: 12, color: T.inkMid }}>{accountHeadline.note}</div>
                  </div>
                  <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{kpiPeriodPhrase}</div>
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
                      onClick={() => onNav("recurring")}
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
                  <button type="button" onClick={() => onNav("planning", { area: "budgets" })} style={{ ...G, width: "100%", background: T.blueLight, color: T.blue, border: "none", borderRadius: 9, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    📋 Criar orçamento
                  </button>
                  <button type="button" onClick={() => onNav("planning", { area: "goals" })} style={{ ...G, width: "100%", background: T.purpleLight, color: T.purple, border: "none", borderRadius: 9, padding: "8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
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
                <span style={{ ...S, fontSize: 13, fontWeight: 600, color: mood.kicker, transition: "color 0.18s" }}>
                  {moodGreetingText}
                </span>
                {/* A régua do ritmo, que a tela não mostrava: o percentual do período
                    só aparecia no rodapé do card de Ritmo e o de gasto, em lugar
                    nenhum. Sem o par não há como reconstruir por que a tela está na
                    cor que está.

                    Enquanto receitas ≥ despesas — o caso normal — este par é
                    exatamente o que `calcMood` compara, porque aí `envelope === inc`.
                    Quando a despesa passa a receita os dois divergem: o humor satura
                    (envelope vira `exp`, o ratio trava) e o chip continua contando a
                    verdade, acima de 100%. Preferi o chip honesto ao chip fiel ao
                    cálculo — trocar a régua do humor é decisão de produto à parte. */}
                {spentOfIncomePct === null ? null : (
                <span
                  data-testid="dashboard-regua-ritmo"
                  style={{ ...G, display: "inline-flex", alignItems: "center", gap: 6, background: T.grayLight, borderRadius: 9999, padding: "3px 11px" }}
                >
                  <span style={{ ...M_MONO, ...NUM, fontSize: 11, fontWeight: 700, color: spentOfIncomePct > 100 ? T.red : T.ink }}>{spentOfIncomePct}%</span>
                  <span style={{ fontSize: 10, color: T.inkLight }}>da receita gasta</span>
                  <span style={{ color: T.border }}>·</span>
                  <span style={{ ...M_MONO, ...NUM, fontSize: 11, fontWeight: 700, color: T.ink }}>{timePct}%</span>
                  <span style={{ fontSize: 10, color: T.inkLight }}>do período</span>
                </span>
                )}
              </div>

              {/* Opção D: o saldo em conta assume o corpo principal e o resultado do
                  período fica ao lado, menor. Os dois são corretos, mas respondem a
                  perguntas diferentes — e quem abre a Visão Geral está perguntando
                  "quanto eu tenho". Medido em produção: R$ 9.992,73 em 3,3rem ao lado
                  de R$ 315,57 de saldo real, num KPI de corpo 20.

                  O saldo em conta fica em `T.ink`, NÃO na cor do humor: a cor da faixa
                  descreve o ritmo do período, e pintar com ela um número que não é do
                  período é o que fazia o laranja parecer um veredito sobre o caixa. */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 16 : 30, flexWrap: "wrap", marginBottom: 18 }}>
                <div data-testid="dashboard-headline-saldo-conta" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ ...G, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Saldo em conta
                    </span>
                    <InfoTip width={280} text={SALDO_EM_CONTA_TOOLTIP} />
                  </div>
                  <div
                    style={{ ...S, ...NUM, fontSize: isMobile ? "2.2rem" : "3.3rem", lineHeight: 1.02, color: accountHeadline.negative ? T.red : T.ink, letterSpacing: "-1px" }}
                  >
                    {accountHeadline.value}
                  </div>
                  <span style={{ ...G, fontSize: 12, color: T.inkMid }}>{accountHeadline.note}</span>
                </div>

                {isMobile ? null : (
                  <div style={{ width: 1, alignSelf: "stretch", background: T.border, marginBottom: 4 }} />
                )}

                <div data-testid="dashboard-headline-resultado" style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 4 }}>
                  <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Resultado do período
                  </span>
                  {/* `fmtAbs` aplica Math.abs, então um resultado negativo renderizava
                      idêntico a um positivo. Na `main` o sinal sobrevivia no KPI
                      "Saldo do período" (seta vermelha, "resultado negativo") — que
                      esta PR removeu ao subir o número para cá. A cor não salva: ela
                      é do humor, que mede ritmo, não sinal. */}
                  <div
                    style={{ ...S, ...NUM, fontSize: isMobile ? "1.6rem" : "2rem", lineHeight: 1.05, color: balance < 0 ? T.red : mood.headlineColor, transition: "color 0.8s", letterSpacing: "-0.5px" }}
                  >
                    {balance < 0 ? fmtSgn(balance) : fmtAbs(balance)}
                  </div>
                  <div style={{ ...G, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: T.inkMid }}>receitas − despesas</span>
                    <InfoTip
                      width={280}
                      text={
                        "Receitas no período: " +
                        fmtAbs(inc) +
                        "\nDespesas no período: " +
                        fmtAbs(exp) +
                        "\nResultado: " +
                        fmtAbs(balance) +
                        (committedToCome > 0
                          ? "\nComprometido a vencer: " + fmtAbs(committedToCome)
                          : "")
                      }
                    />
                  </div>
                </div>
              </div>

              <div data-testid="dashboard-composicao">
                <div style={{ ...G, display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: T.inkMid }}>{barIsIncomeSplit ? "Para onde foram as receitas do período" : "Despesas do período"}</span>
                  <span data-testid="dashboard-composicao-total" style={{ ...M_MONO, ...NUM, fontSize: 12, fontWeight: 700, color: T.ink }}>
                    {fmtAbs(barTotal)}
                  </span>
                </div>
                <div style={{ height: 7, background: T.grayLight, borderRadius: 99, overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${(usedAmt / barTotal) * 100}%`, background: T.inkGhost, transition: "width 0.6s" }} />
                  <div style={{ width: `${(committedInBar / barTotal) * 100}%`, background: mood.bar, opacity: 0.4, transition: "width 0.6s, background 0.8s" }} />
                  <div style={{ flex: 1, background: mood.bar, transition: "background 0.18s" }} />
                </div>
                <div style={{ ...G, display: "flex", gap: 14, marginTop: 7 }}>
                  {compositionSlices.map(({ label, color, value, opacity }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: color, opacity, transition: "background 0.18s", flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: T.inkMid }}>{label}</span>
                      <span
                        style={{ ...M_MONO, ...NUM, fontSize: 10, color: T.inkMid, fontWeight: 600 }}
                        data-testid={label === "Comprometido a vencer" ? "dashboard-composicao-comprometido" : undefined}
                      >
                        {value}
                      </span>
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
                    INSIGHT
                  </span>
                </div>
                <Sparkles size={12} color={mood.kicker} style={{ opacity: 0.5 }} />
              </div>

              <div data-testid="dashboard-insight-quantias">
                <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 3 }}>
                  <span style={{ ...M_MONO, ...NUM, fontSize: 23, fontWeight: 700, color: mood.headlineColor, lineHeight: 1, transition: "color 0.18s" }}>
                    {fmtAbs(exp)}
                  </span>
                  <span style={{ ...G, fontSize: 12, color: T.inkMid }}>gastos no período</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 12 }}>
                  <span style={{ ...M_MONO, ...NUM, fontSize: 23, fontWeight: 700, color: T.inkGhost, lineHeight: 1 }}>
                    {fmtAbs(expectedByNow)}
                  </span>
                  <span style={{ ...G, fontSize: 12, color: T.inkMid }}>seria o ritmo linear da receita</span>
                </div>
              </div>

              <p style={{ ...G, fontSize: 13, lineHeight: 1.6, color: T.inkMid, marginBottom: 16 }}>
                {insightBody}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {moodActions.map(({ label, Icon: ActionIcon, nav, navOpts }) => (
                  <button key={label} type="button" onClick={() => onNav?.(nav, navOpts)} style={{ ...G, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.7)", border: `1px solid ${mood.insightBorder}`, borderRadius: 9, padding: "7px 11px", fontSize: 12, color: mood.kicker, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                    <ActionIcon size={12} color={mood.kicker} /> {label}
                    <ChevronRight size={11} style={{ marginLeft: "auto" }} />
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>

      <div style={{ ...anim(0.1), display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, position: "relative", zIndex: 1 }}>
        {kpiItems.map(({ key, label, value, delta, up, emptyCta, tooltip }) => (
          <Card
            key={key}
            data-testid={
              key === "inc"
                ? "dashboard-kpi-receitas"
                : key === "exp"
                  ? "dashboard-kpi-despesas"
                  : key === "cmt"
                    ? "dashboard-kpi-comprometido"
                    : key === "left"
                      ? "dashboard-kpi-sobra"
                      : "dashboard-kpi-saldo"
            }
            style={{ padding: "16px 18px" }}
          >
            <div style={{ ...G, fontSize: 11, fontWeight: 500, color: T.inkMid, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              {label}
              {key === "bal" && (
                <InfoTip
                  width={260}
                  text={"Saldo deste ciclo apenas: receitas menos despesas dentro do período escolhido. Não inclui saldo de meses anteriores — o Fincla trata cada período como um ciclo fechado, para incentivar a revisão regular das suas finanças."}
                />
              )}
              {tooltip && <InfoTip width={280} text={tooltip} />}
            </div>
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
                {[
                  ["#9CA3AF", "Projeção"],
                  [mood.bar, "Real"],
                  ...(projectedExpenseByDay.size > 0 ? [["#7C3AED", "Comprometido"]] : []),
                ].map(([c, l]) => (
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
                  <Line type="monotone" dataKey="proj" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                  <Line type="monotone" dataKey="real" stroke={mood.bar} strokeWidth={2.5} dot={false} connectNulls={false} style={{ transition: "stroke 0.8s" }} />
                  <Line type="stepAfter" dataKey="committed" stroke="#7C3AED" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls={false} />
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
            {hasComparison && (
              <div style={{ display: "flex", gap: 12, marginBottom: 12, marginTop: 4, flexShrink: 0 }}>
                {[["#9CA3AF", "atual"], ["#9CA3AF", "referência"], ["#FCA5A5", "acima"]].map(([c, l]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 10, height: l === "referência" ? 2 : 5, background: c, borderRadius: l === "referência" ? 1 : 2 }} />
                    <span style={{ ...G, fontSize: 10, color: T.inkLight }}>{l}</span>
                  </div>
                ))}
              </div>
            )}
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
              const maxVal = Math.max(...categoryData.map((c) => Math.max(c.value, c.avg ?? 0)));
              return (
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
                  {categoryData.map((c) => {
                    const hasRowComparison = typeof c.avg === "number" && c.avg > 0;
                    const barPct = (c.value / maxVal) * 100;
                    const avgPct = hasRowComparison ? (c.avg / maxVal) * 100 : 0;
                    const isOver = hasRowComparison && c.value > c.avg;
                    const safePct = hasRowComparison ? Math.min(barPct, avgPct) : barPct;
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
                          {hasRowComparison && overPct > 0 && <div style={{ position: "absolute", left: `${avgPct}%`, top: 0, height: "100%", width: `${overPct}%`, background: T.red, opacity: 0.5, borderRadius: "0 99px 99px 0" }} />}
                          {hasRowComparison && <div style={{ position: "absolute", top: -3, left: `${avgPct}%`, width: 2, height: 12, background: T.inkMid, borderRadius: 1, transform: "translateX(-50%)", zIndex: 2 }} />}
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
            <button onClick={() => onNav("transactions")} style={{ ...G, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", fontSize: 12, fontWeight: 600, color: T.blue, cursor: "pointer" }}>
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
              onSecondary={() => onNav("transactions")}
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
                onClick={() => onNav("recurring")}
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
