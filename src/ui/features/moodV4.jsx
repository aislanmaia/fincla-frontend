import React from "react";
import {
  Leaf,
  Activity,
  Gauge,
  Flame,
  TrendingUp,
  AlertTriangle,
  Target,
  FlaskConical,
  Repeat,
  ShieldCheck,
} from "lucide-react";
import { T } from "../tokens";
import { G, NUM } from "../typography";
import { fmtAbs } from "../formatters";

export const M_MONO = { fontFamily: "'Geist Mono', monospace" };

export const MOODS = {
  serene: {
    label: "Sereno",
    Icon: Leaf,
    accent: T.green,
    accentLight: T.greenLight,
    bar: T.greenBar,
    insightBorder: "#6EE7B7",
    insightBg: "#F0FDF6",
    kicker: "#059669",
    headlineColor: "#1A5C3A",
    topBorder: "transparent",
    badgeBg: "#D1FAE5",
    badgeColor: "#065F46",
    bgFx: "radial-gradient(ellipse at 85% 0%,rgba(52,211,153,0.06) 0%,transparent 55%)",
    greeting: "Suas finanças respiram bem hoje.",
    InsightIcon: ShieldCheck,
    headlineSize: "3.8rem",
  },
  healthy: {
    label: "Saudável",
    Icon: Activity,
    accent: T.amber,
    accentLight: T.amberLight,
    bar: "#F59E0B",
    insightBorder: "#FCD34D",
    insightBg: "#FFFBEB",
    kicker: T.amber,
    headlineColor: "#92400E",
    topBorder: "transparent",
    badgeBg: "#FDE68A",
    badgeColor: "#78350F",
    bgFx: "radial-gradient(ellipse at 85% 0%,rgba(245,158,11,0.06) 0%,transparent 55%)",
    greeting: "Ritmo equilibrado. Continue assim.",
    InsightIcon: Gauge,
    headlineSize: "3.5rem",
  },
  watchful: {
    label: "Atenção",
    Icon: Gauge,
    accent: "#D97706",
    accentLight: "#FFF7ED",
    bar: "#F97316",
    insightBorder: "#FDBA74",
    insightBg: "#FFF7ED",
    kicker: "#C2410C",
    headlineColor: "#9A3412",
    topBorder: "#FDBA74",
    badgeBg: "#FED7AA",
    badgeColor: "#9A3412",
    bgFx: "radial-gradient(ellipse at 85% 0%,rgba(249,115,22,0.07) 0%,transparent 55%)",
    greeting: "Olho no ritmo — você está acelerando.",
    InsightIcon: Flame,
    headlineSize: "3.3rem",
  },
  tense: {
    label: "Tenso",
    Icon: TrendingUp,
    accent: T.red,
    accentLight: T.redLight,
    bar: "#EF4444",
    insightBorder: "#FCA5A5",
    insightBg: "#FEF2F2",
    kicker: T.red,
    headlineColor: "#991B1B",
    topBorder: "#FCA5A5",
    badgeBg: "#FEE2E2",
    badgeColor: "#7F1D1D",
    bgFx: "radial-gradient(ellipse at 85% 0%,rgba(239,68,68,0.07) 0%,transparent 55%)",
    greeting: "Atenção: seu orçamento está pressionado.",
    InsightIcon: AlertTriangle,
    headlineSize: "3rem",
  },
  alert: {
    label: "Crítico",
    Icon: AlertTriangle,
    accent: "#B91C1C",
    accentLight: "#FFF1F2",
    bar: "#BE123C",
    insightBorder: "#FB7185",
    insightBg: "#FFF1F2",
    kicker: "#9F1239",
    headlineColor: "#7F1D1D",
    topBorder: "#FB7185",
    badgeBg: "#FFE4E6",
    badgeColor: "#881337",
    bgFx: "radial-gradient(ellipse at 85% 0%,rgba(190,18,60,0.09) 0%,transparent 55%)",
    greeting: "Situação crítica. Revise seus gastos agora.",
    InsightIcon: AlertTriangle,
    headlineSize: "2.8rem",
  },
};

export function moodRatio(day, budgetPct, daysInMonth = 31) {
  const dim = Math.max(daysInMonth, 1);
  return budgetPct / ((day / dim) * 100);
}

export function calcMood(day, budgetPct, freePct, daysInMonth = 31) {
  const ratio = moodRatio(day, budgetPct, daysInMonth);
  if (freePct < 10 || ratio > 1.3) return "alert";
  if (ratio > 1.1) return "tense";
  if (ratio > 0.95 || freePct < 20) return "watchful";
  if (ratio > 0.8) return "healthy";
  return "serene";
}

/**
 * Saudação do humor, corrigida pelo ritmo real (issue #67).
 *
 * A faixa `watchful` vai de 0,95 a 1,10, ou seja de *ligeiramente abaixo* do ritmo
 * até 10% acima. Na metade de baixo o usuário gasta mais devagar do que o período
 * passa — e a tela dizia "você está acelerando" ao lado de um "R$ X à frente do
 * ritmo esperado ✓". Os dois liam o mesmo número e discordavam.
 *
 * `aheadOfPace` é passado pelo chamador com EXATAMENTE a mesma expressão que decide
 * o "à frente / acima" (`spendPct <= timePct`), e não um ratio recalculado. Não é
 * preciosismo: `timePct` é arredondado e o ratio não, então derivar cada frase da
 * sua própria conta deixa uma faixa estreita em que elas voltam a discordar — 37
 * combinações de (dia, dias-no-período) fazem isso. Compartilhando a expressão, a
 * contradição fica impossível por construção, não por coincidência numérica.
 *
 * O LIMIAR fica como está de propósito: movê-lo de 0,95 para 1,0 muda a régua de
 * humor de todos os usuários, e o 0,95 pode ter sido escolhido para avisar cedo —
 * é decisão de produto, registrada na #67, e vira uma linha quando for tomada.
 */
export function moodGreeting(moodKey, aheadOfPace) {
  if (moodKey === "watchful" && aheadOfPace) {
    return "Ritmo apertado — perto do limite do período.";
  }
  return MOODS[moodKey]?.greeting ?? "";
}

/**
 * Conselho do card de insight, na mesma régua da saudação.
 *
 * `watchful` era uma string fixa — "Reduza cerca de R$ 80/dia" — que renderizava
 * logo abaixo de "R$ X à frente do ritmo esperado ✓": a mesma contradição da #67,
 * um card mais abaixo. E os R$ 80 eram constante mágica, sem relação com os dados
 * do usuário, enquanto todas as outras faixas usam `dailyBudget`.
 */
export function moodInsightBody(moodKey, { aheadOfPace, dailyBudgetLabel, daysLeft, periodPhrase }) {
  return {
    serene: `Com ${daysLeft} dias restantes no período, você pode gastar até ${dailyBudgetLabel}/dia com folga.`,
    healthy: `Ritmo equilibrado — tente manter ${dailyBudgetLabel}/dia pelos próximos ${daysLeft} dias.`,
    watchful: aheadOfPace
      ? `Ainda à frente, mas com pouca folga — manter ${dailyBudgetLabel}/dia fecha o período no zero.`
      : `Reduza para cerca de ${dailyBudgetLabel}/dia para fechar o período no zero. Revise categorias variáveis.`,
    tense: `Limite gastos a ${dailyBudgetLabel}/dia para não estourar o orçamento no período (${periodPhrase}).`,
    alert: "Evite novas despesas e avalie pausar recorrências não essenciais esta semana.",
  }[moodKey];
}

export function getMoodActions(moodKey) {
  return (
    {
      serene: [
        { label: "Definir meta extra", Icon: Target },
        { label: "Ver projeção", Icon: TrendingUp },
      ],
      healthy: [
        { label: "Simular uma compra", Icon: FlaskConical },
        { label: "Ver categorias", Icon: Activity },
      ],
      watchful: [
        { label: "Simular impacto", Icon: FlaskConical },
        { label: "Revisar recorrências", Icon: Repeat },
      ],
      tense: [
        { label: "O que posso cortar?", Icon: AlertTriangle },
        { label: "Recorrências caras", Icon: Repeat },
      ],
      alert: [
        { label: "Revisão urgente", Icon: AlertTriangle },
        { label: "Pausar recorrências", Icon: Repeat },
      ],
    }[moodKey] || []
  );
}

export function genRhythmData(day, budgetPct) {
  return Array.from({ length: 31 }, (_, i) => {
    const d = i + 1;
    const proj = Math.round((4200 / 31) * d);
    const real =
      d <= day
        ? Math.round(4200 * (budgetPct / 100) * (d / day) * (1 + Math.sin(d * 2.1) * 0.06))
        : null;
    return { dia: d, proj, real };
  });
}

export const CATS_V4 = [
  { name: "Alimentação", value: 847, avg: 720, color: T.green },
  { name: "Transporte", value: 401, avg: 380, color: T.amber },
  { name: "Moradia", value: 356, avg: 356, color: T.purple },
  { name: "Lazer", value: 267, avg: 180, color: T.blue },
  { name: "Saúde", value: 200, avg: 220, color: "#BE185D" },
  { name: "Streaming", value: 89, avg: 89, color: "#78716C" },
  { name: "Outros", value: 67, avg: 90, color: T.inkLight },
];

export const DEBITS_V4 = [
  { name: "Conta de Luz", value: 180.0, day: 13, daysLeft: 2, cat: "Utilidades" },
  { name: "Spotify Duo", value: 21.9, day: 15, daysLeft: 4, cat: "Assinaturas" },
  { name: "Adobe CC", value: 89.99, day: 18, daysLeft: 7, cat: "Trabalho" },
  { name: "Academia", value: 89.9, day: 20, daysLeft: 9, cat: "Saúde" },
  { name: "Seguro Auto", value: 342.0, day: 22, daysLeft: 11, cat: "Transporte" },
];

export const PERIODS_V4 = [
  { key: "mes", label: "Este mês", badge: "mar/26" },
  { key: "3m", label: "3 meses", badge: "jan–mar/26" },
  { key: "6m", label: "6 meses", badge: "out/25–mar/26" },
  { key: "12m", label: "12 meses", badge: "mar/25–mar/26" },
];

const LINE_LABELS = { proj: "Projeção", real: "Real", committed: "Comprometido" };

export function RhythmTooltipV4({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  // Quando Comprometido coincide com Real (no ponto de "hoje" eles se encontram pra dar
  // continuidade visual à linha), mostra só Real para evitar duplicidade no tooltip.
  const realEntry = payload.find((p) => p.name === "real" && p.value != null);
  const filteredPayload = realEntry
    ? payload.filter((p) => !(p.name === "committed" && p.value === realEntry.value))
    : payload;
  // Em dias futuros (sem entrada "real") expõe quanto já foi gasto até hoje como contexto.
  const pointData = payload?.[0]?.payload;
  const realAtToday = pointData?.realAtToday;
  const showRealAtToday = !realEntry
    && typeof realAtToday === "number"
    && realAtToday > 0;
  return (
    <div
      style={{
        ...G,
        fontSize: 11,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: T.md,
      }}
    >
      <div style={{ color: T.inkLight, marginBottom: 5 }}>
        {payload?.[0]?.payload?.dayLabel
          ? payload[0].payload.dayLabel
          : `Dia ${label}`}
      </div>
      {filteredPayload.map(
        (p, i) =>
          p.value != null && (
            <div key={i} style={{ ...NUM, color: p.color, fontWeight: 600 }}>
              {LINE_LABELS[p.name] ?? p.name}: {fmtAbs(p.value)}
            </div>
          )
      )}
      {showRealAtToday && (
        <div style={{
          ...NUM,
          color: T.inkLight,
          fontWeight: 500,
          fontSize: 10,
          marginTop: 5,
          paddingTop: 5,
          borderTop: `1px solid ${T.border}`,
        }}>
          Real até hoje: {fmtAbs(realAtToday)}
        </div>
      )}
    </div>
  );
}
