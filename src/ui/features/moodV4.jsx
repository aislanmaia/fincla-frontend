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
    accent: "#047857",
    accentLight: "#ECFDF5",
    bar: "#059669",
    insightBorder: "#6EE7B7",
    insightBg: "#ECFDF5",
    kicker: "#065F46",
    headlineColor: "#064E3B",
    topBorder: "transparent",
    badgeBg: "#A7F3D0",
    badgeColor: "#064E3B",
    bgFx: "radial-gradient(ellipse at 85% 0%,rgba(5,150,105,0.06) 0%,transparent 55%)",
    greeting: "Suas finanças respiram bem hoje.",
    InsightIcon: ShieldCheck,
    headlineSize: "3.8rem",
  },
  healthy: {
    label: "Saudável",
    Icon: Activity,
    accent: "#22C55E",
    accentLight: "#F0FDF4",
    bar: "#4ADE80",
    insightBorder: "#86EFAC",
    insightBg: "#F0FDF4",
    kicker: "#166534",
    headlineColor: "#15803D",
    topBorder: "transparent",
    badgeBg: "#DCFCE7",
    badgeColor: "#166534",
    bgFx: "radial-gradient(ellipse at 85% 0%,rgba(34,197,94,0.06) 0%,transparent 55%)",
    greeting: "Ritmo equilibrado. Continue assim.",
    InsightIcon: Gauge,
    headlineSize: "3.5rem",
  },
  watchful: {
    label: "Atenção",
    Icon: Gauge,
    accent: "#EAB308",
    accentLight: "#FEFCE8",
    bar: "#FACC15",
    insightBorder: "#FDE047",
    insightBg: "#FEFCE8",
    kicker: "#713F12",
    headlineColor: "#854D0E",
    topBorder: "#FDE047",
    badgeBg: "#FEF9C3",
    badgeColor: "#713F12",
    bgFx: "radial-gradient(ellipse at 85% 0%,rgba(234,179,8,0.07) 0%,transparent 55%)",
    greeting: "Olho no ritmo — você está acelerando.",
    InsightIcon: Flame,
    headlineSize: "3.3rem",
  },
  tense: {
    label: "Tenso",
    Icon: TrendingUp,
    accent: "#D97706",
    accentLight: "#FFFBEB",
    bar: "#F59E0B",
    insightBorder: "#FCD34D",
    insightBg: "#FFFBEB",
    kicker: "#78350F",
    headlineColor: "#92400E",
    topBorder: "#FCD34D",
    badgeBg: "#FDE68A",
    badgeColor: "#78350F",
    bgFx: "radial-gradient(ellipse at 85% 0%,rgba(217,119,6,0.07) 0%,transparent 55%)",
    greeting: "Atenção: seu orçamento está pressionado.",
    InsightIcon: AlertTriangle,
    headlineSize: "3rem",
  },
  alert: {
    label: "Crítico",
    Icon: AlertTriangle,
    accent: "#DC2626",
    accentLight: "#FEF2F2",
    bar: "#EF4444",
    insightBorder: "#FCA5A5",
    insightBg: "#FEF2F2",
    kicker: "#7F1D1D",
    headlineColor: "#991B1B",
    topBorder: "#FCA5A5",
    badgeBg: "#FEE2E2",
    badgeColor: "#7F1D1D",
    bgFx: "radial-gradient(ellipse at 85% 0%,rgba(220,38,38,0.09) 0%,transparent 55%)",
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
  if (ratio > 1.0 || freePct < 20) return "watchful";
  if (ratio > 0.8) return "healthy";
  return "serene";
}

/**
 * Saudação do humor, corrigida pelo ritmo real (issue #67).
 *
 * A faixa `watchful` começa em 1,00 (o corte saiu de 0,95 — ver abaixo) e vai até
 * 1,10. Mesmo assim a saudação continua condicionada: `timePct` é arredondado e o
 * ratio não, então sobra uma fresta em que o ratio passa de 1 enquanto o gasto
 * ainda está abaixo do ritmo pela conta arredondada.
 *
 * `aheadOfPace` é passado pelo chamador com EXATAMENTE a mesma expressão que decide
 * o "à frente / acima" (`spendPct <= timePct`), e não um ratio recalculado. Não é
 * preciosismo: `timePct` é arredondado e o ratio não, então derivar cada frase da
 * sua própria conta deixa uma faixa estreita em que elas voltam a discordar — 37
 * combinações de (dia, dias-no-período) fazem isso. Compartilhando a expressão, a
 * contradição fica impossível por construção, não por coincidência numérica.
 *
 * O LIMIAR foi movido de 0,95 para 1,00 (decisão do Owner). Com 0,95, gastar
 * *exatamente* no ritmo do mês já caía em "Atenção", e uma org media 0,954 — entrava
 * na faixa laranja por 0,004 gastando 49,2% da receita com 51,6% do mês decorrido.
 * Agora "Atenção" significa o que o nome diz: você passou do ritmo.
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

/**
 * Ações do card de Insight, agora com DESTINO.
 *
 * Os botões existiam desde o protótipo sem `onClick` — `cursor: pointer` sem efeito,
 * pendência registrada em `docs/DASHBOARD_INSIGHT_CTA_SPEC.md`. Botão que parece
 * clicável e não responde é pior que botão ausente: o usuário clica, nada acontece,
 * e conclui que o app está quebrado.
 *
 * Os ids são os que `navTo` de fato despacha: só o que está em `AUTH_ROUTE_SEGMENTS`
 * navega. `goals`, `budgets` e `simulation` NÃO estão lá — migraram para o hub
 * `planning` e sobrevivem apenas como rotas de redirect. Mandar esses ids reproduz
 * exatamente o bug que este código existe para corrigir: clique sem efeito. O destino
 * certo é `planning` com a sub-área em `opts.area`.
 *
 * `reports` é rota Pro: para um usuário Essential o clique cai no `<UpgradeWall>`,
 * mesmo comportamento dos itens marcados na sidebar.
 */
export function getMoodActions(moodKey) {
  return (
    {
      serene: [
        { label: "Definir meta extra", Icon: Target, nav: "planning", navOpts: { area: "goals" } },
        { label: "Ver projeção", Icon: TrendingUp, nav: "planning", navOpts: { area: "simulator" } },
      ],
      healthy: [
        { label: "Simular uma compra", Icon: FlaskConical, nav: "planning", navOpts: { area: "simulator" } },
        { label: "Ver categorias", Icon: Activity, nav: "reports" },
      ],
      watchful: [
        { label: "Simular impacto", Icon: FlaskConical, nav: "planning", navOpts: { area: "simulator" } },
        { label: "Revisar recorrências", Icon: Repeat, nav: "recurring" },
      ],
      tense: [
        { label: "O que posso cortar?", Icon: AlertTriangle, nav: "reports" },
        { label: "Recorrências caras", Icon: Repeat, nav: "recurring" },
      ],
      alert: [
        { label: "Revisão urgente", Icon: AlertTriangle, nav: "transactions" },
        { label: "Pausar recorrências", Icon: Repeat, nav: "recurring" },
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
