import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
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
import { G, NUM } from "../typography";
import { fmtAbs, fmtK } from "../formatters";
import { Breadcrumb, Btn, Card, PageTitle } from "../components/primitives";
import { M_MONO } from "../features/moodV4";
import { CardEmptyWithCta } from "../features/shellExtras.jsx";
import {
  shiftYearMonth,
  useSpendingPaceData,
} from "../features/spendingPace/useSpendingPaceData.js";

const MAX_MONTHS_BACK = 24;

function monthNavBounds(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return {
    currentYear: y,
    currentMonth: m,
    min: shiftYearMonth(y, m, -MAX_MONTHS_BACK),
  };
}

export function RitmoPageLive({
  onNav,
  isMobile = false,
  organizationId,
  onNewTx,
}) {
  const bounds = useMemo(() => monthNavBounds(), []);
  const [year, setYear] = useState(bounds.currentYear);
  const [month, setMonth] = useState(bounds.currentMonth);

  const sp = useSpendingPaceData({
    organizationId,
    enabled: Boolean(organizationId),
    year,
    month,
  });

  const canGoNext =
    year < bounds.currentYear ||
    (year === bounds.currentYear && month < bounds.currentMonth);
  const canGoPrev =
    year > bounds.min.year ||
    (year === bounds.min.year && month > bounds.min.month);

  const goPrev = () => {
    if (!canGoPrev) return;
    const n = shiftYearMonth(year, month, -1);
    setYear(n.year);
    setMonth(n.month);
  };

  const goNext = () => {
    if (!canGoNext) return;
    const n = shiftYearMonth(year, month, 1);
    setYear(n.year);
    setMonth(n.month);
  };

  const {
    isLoading,
    error,
    refetch,
    viewMode,
    periodLabel,
    daysInMonth,
    todayInView,
    chartData,
    dowData,
    budgetVal,
    hasBudget,
    hasAnyExpense,
    realFinal,
    projFinal,
    projFim,
    diff,
    isOk,
    estouroDia,
    isClosed,
  } = sp;

  const pastLight = viewMode === "pastLight";
  const showBudgetChart = !pastLight && hasBudget;
  const showFullKpis = showBudgetChart;
  const dowMax = Math.max(...dowData.map((d) => d.val), 1);
  const todayWd = new Date().getDay();
  const highlightDowToday =
    !pastLight && !isClosed && year === bounds.currentYear && month === bounds.currentMonth;

  const daysLeft = Math.max(0, daysInMonth - todayInView);
  const timePct = Math.round((todayInView / Math.max(daysInMonth, 1)) * 100);
  const spentPct =
    hasBudget && budgetVal > 0
      ? Math.round((realFinal / budgetVal) * 100)
      : 0;
  const dailyLeft =
    daysLeft > 0 && hasBudget ? Math.round((budgetVal - realFinal) / daysLeft) : 0;
  const dailyAvg = daysInMonth > 0 ? Math.round(realFinal / todayInView) : 0;
  const projOver = projFim > budgetVal;
  const projColor = projOver ? T.red : T.green;
  const diffColor = isOk ? T.green : T.red;

  const RitmoTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const realVal = payload.find((p) => p.dataKey === "real")?.value;
    const projVal = payload.find((p) => p.dataKey === "proj")?.value;
    const ritmoVal = payload.find((p) => p.dataKey === "ritmoAtual")?.value;
    const hasDiff =
      realVal != null && projVal != null && showBudgetChart;
    const diffVal = hasDiff ? realVal - projVal : null;
    const diffPct = hasDiff ? ((realVal / projVal - 1) * 100).toFixed(1) : null;
    const abaixo = diffVal < 0;
    return (
      <div
        style={{
          ...G,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          padding: "11px 14px",
          boxShadow: T.md,
          fontSize: 11,
          minWidth: 200,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8, color: T.ink, fontSize: 12 }}>
          Dia {label}
        </div>
        {projVal != null && showBudgetChart && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9999, background: "#D1D5DB" }} />
            <span style={{ color: T.inkMid, flex: 1 }}>Projeção linear</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 600 }}>{fmtAbs(projVal)}</span>
          </div>
        )}
        {realVal != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: 9999,
                background: pastLight || isOk ? T.green : T.red,
              }}
            />
            <span style={{ color: T.inkMid, flex: 1 }}>Real acumulado</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 600 }}>{fmtAbs(realVal)}</span>
          </div>
        )}
        {ritmoVal != null && showBudgetChart && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9999, background: T.purple }} />
            <span style={{ color: T.inkMid, flex: 1 }}>Se mantiver ritmo</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 600 }}>{fmtAbs(ritmoVal)}</span>
          </div>
        )}
        {hasDiff && (
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 12 }}>{abaixo ? "↓" : "↑"}</span>
            <span
              style={{
                ...M_MONO,
                ...NUM,
                fontWeight: 700,
                color: abaixo ? T.green : T.red,
              }}
            >
              {fmtAbs(Math.abs(diffVal))}
            </span>
            <span style={{ color: abaixo ? T.green : T.red, fontWeight: 600 }}>
              {abaixo ? `−${Math.abs(diffPct)}% abaixo` : `+${diffPct}% acima`}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (isLoading && !chartData.length && !error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ paddingTop: 4 }}>
          <Breadcrumb label="Planejar" />
          <PageTitle sans="Ritmo" serif="de Gastos" />
        </div>
        <Card style={{ padding: 40 }}>
          <div style={{ ...G, fontSize: 13, color: T.inkMid, textAlign: "center" }}>
            Carregando ritmo de gastos…
          </div>
        </Card>
      </div>
    );
  }

  if (error && !isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ paddingTop: 4 }}>
          <Breadcrumb label="Planejar" />
          <PageTitle sans="Ritmo" serif="de Gastos" />
        </div>
        <div
          style={{
            background: T.amber + "18",
            border: `1px solid ${T.amber}44`,
            borderRadius: 12,
            padding: "12px 16px",
            ...G,
            fontSize: 12,
            color: T.ink,
          }}
        >
          {error}
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              ...G,
              marginLeft: 12,
              fontWeight: 700,
              background: T.ink,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
        <Card>
          <CardEmptyWithCta
            icon="📊"
            title="Dados indisponíveis"
            sub="Não foi possível carregar o ritmo. Verifique a conexão e tente de novo."
            primaryLabel="Tentar novamente"
            onPrimary={() => refetch()}
          />
        </Card>
      </div>
    );
  }

  if (!pastLight && !hasBudget && !hasAnyExpense && !isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ paddingTop: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <Breadcrumb label="Planejar" />
            <PageTitle sans="Ritmo" serif="de Gastos" />
          </div>
          <MonthChevrons
            periodLabel={periodLabel}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPrev={goPrev}
            onNext={goNext}
          />
        </div>
        <Card>
          <CardEmptyWithCta
            icon="📈"
            title="Defina orçamento e registre despesas"
            sub="O ritmo compara seu gasto real com um teto mensal. Crie orçamentos por categoria e lance despesas para ver a curva."
            primaryLabel="Ir para orçamentos"
            onPrimary={() => onNav("budgets")}
            secondaryLabel="+ Nova transação"
            onSecondary={onNewTx}
          />
        </Card>
      </div>
    );
  }

  if (pastLight && !hasAnyExpense && !isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ paddingTop: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <Breadcrumb label="Planejar" />
            <PageTitle sans="Ritmo" serif="de Gastos" />
          </div>
          <MonthChevrons
            periodLabel={periodLabel}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPrev={goPrev}
            onNext={goNext}
          />
        </div>
        <div style={{ ...G, fontSize: 12, color: T.inkLight, lineHeight: 1.5 }}>
          Visão do gasto real neste mês. O comparativo com orçamento fica no{" "}
          <strong>mês atual</strong>.
        </div>
        <Card>
          <CardEmptyWithCta
            icon="📭"
            title="Nenhuma despesa neste período"
            sub={`Não há despesas registradas em ${periodLabel}.`}
            primaryLabel="+ Nova transação"
            onPrimary={onNewTx}
            secondaryLabel="Ir ao mês atual"
            onSecondary={() => {
              setYear(bounds.currentYear);
              setMonth(bounds.currentMonth);
            }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ paddingTop: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <Breadcrumb label="Planejar" />
          <PageTitle sans="Ritmo" serif="de Gastos" />
        </div>
        <MonthChevrons
          periodLabel={periodLabel}
          isClosed={pastLight}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={goPrev}
          onNext={goNext}
        />
      </div>

      {pastLight && (
        <div style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.55 }}>
          Visão do <strong>gasto real</strong> em {periodLabel}. Comparativo com seu orçamento
          (projeção linear) está disponível apenas no <strong>mês atual</strong>.
        </div>
      )}

      {!pastLight && !hasBudget && hasAnyExpense && (
        <div style={{ ...G, fontSize: 12, color: T.inkMid, lineHeight: 1.55 }}>
          Sem orçamento mensal definido — mostrando só a curva de despesas.{" "}
          <button
            type="button"
            onClick={() => onNav("budgets")}
            style={{
              ...G,
              fontWeight: 700,
              color: T.blue,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Definir orçamentos
          </button>
        </div>
      )}

      <div
        style={{
          background: pastLight
            ? T.grayLight
            : isOk
              ? T.greenLight
              : T.redLight,
          border: `1px solid ${pastLight ? T.border : isOk ? T.green : T.red}33`,
          borderRadius: 14,
          padding: "13px 18px",
          display: "flex",
          alignItems: isMobile ? "flex-start" : "center",
          gap: 14,
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: pastLight ? T.inkGhost : isOk ? T.green : T.red,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {pastLight || isOk ? (
            <TrendingDown size={18} color="#fff" />
          ) : (
            <TrendingUp size={18} color="#fff" />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              ...G,
              fontSize: 13,
              fontWeight: 700,
              color: pastLight ? T.ink : isOk ? T.green : T.red,
            }}
          >
            {pastLight
              ? `Resumo de ${periodLabel} · total ${fmtAbs(realFinal)}`
              : showFullKpis
                ? isOk
                  ? `${Math.abs((realFinal / Math.max(projFinal, 1) - 1) * 100).toFixed(1)}% abaixo do ritmo esperado — você está no controle`
                  : `${(((realFinal / Math.max(projFinal, 1)) - 1) * 100).toFixed(1)}% acima do ritmo esperado — atenção necessária`
                : `Acompanhe seu gasto acumulado até o dia ${todayInView}`}
          </div>
          <div
            style={{
              ...G,
              fontSize: 11,
              color: pastLight ? T.inkMid : `${isOk ? T.green : T.red}bb`,
              marginTop: 2,
            }}
          >
            {pastLight
              ? `${daysInMonth} dias · média ${fmtAbs(Math.round(realFinal / Math.max(daysInMonth, 1)))}/dia`
              : `Dia ${todayInView} de ${daysInMonth} · ${timePct}% do período · ${daysLeft} dias restantes`}
          </div>
        </div>
        {!pastLight && (
          <Btn variant="dark" onClick={() => onNav("simulation")}>
            <FlaskConical size={12} /> Simular
          </Btn>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 10 }}>
        {(pastLight
          ? [
              {
                label: isMobile ? "Total no mês" : `Total em ${periodLabel}`,
                val: fmtAbs(realFinal),
                color: T.ink,
                sub: `${daysInMonth} dias`,
              },
              {
                label: "Média diária",
                val: fmtAbs(Math.round(realFinal / Math.max(daysInMonth, 1))),
                color: T.ink,
                sub: "no período",
              },
              {
                label: "Só gastos reais",
                val: "—",
                color: T.inkLight,
                sub: "sem teto retroativo",
              },
            ]
          : showFullKpis
            ? [
                {
                  label: isMobile ? `Gasto · dia ${todayInView}` : `Gasto real · dia ${todayInView}`,
                  val: fmtAbs(realFinal),
                  color: T.ink,
                  sub: `de ${fmtAbs(budgetVal)} orçados`,
                },
                {
                  label: isMobile ? "Ritmo hoje" : "Ritmo esperado hoje",
                  val: fmtAbs(projFinal),
                  color: T.blue,
                  sub: "acumulado linear",
                },
                {
                  label: "Diferença",
                  val: fmtAbs(Math.abs(diff)),
                  color: diffColor,
                  sub: isOk ? "abaixo do esperado ✓" : "acima do esperado ↑",
                },
              ]
            : [
                {
                  label: `Gasto · dia ${todayInView}`,
                  val: fmtAbs(realFinal),
                  color: T.ink,
                  sub: "acumulado",
                },
                {
                  label: "Orçamento",
                  val: "—",
                  color: T.inkMid,
                  sub: "não definido",
                },
                {
                  label: "Diferença",
                  val: "—",
                  color: T.inkMid,
                  sub: "defina orçamento",
                },
              ]
        ).map((k, i) => (
          <Card
            key={i}
            style={{
              padding: isMobile ? "12px 14px" : "14px 18px",
              gridColumn: isMobile && i === 2 ? "1 / -1" : undefined,
            }}
          >
            <div
              style={{
                ...G,
                fontSize: 10,
                fontWeight: 700,
                color: T.inkMid,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 5,
              }}
            >
              {k.label}
            </div>
            <div
              style={{
                ...M_MONO,
                ...NUM,
                fontSize: isMobile ? 16 : 18,
                fontWeight: 700,
                color: k.color,
                marginBottom: 3,
              }}
            >
              {k.val}
            </div>
            <div style={{ ...G, fontSize: isMobile ? 9 : 10, color: T.inkMid }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: 14 }}>
        <Card style={{ padding: "20px 20px 14px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>
              {pastLight ? "Gasto acumulado no mês" : isClosed ? "Histórico Real vs. Projeção" : "Acumulado vs. Projeção"}
            </div>
            <div style={{ display: "flex", gap: isMobile ? 8 : 12, flexWrap: "wrap" }}>
              {showBudgetChart && (
                <>
                  {[
                    ["#D1D5DB", true, isMobile ? "Projeção" : "Projeção linear"],
                    [isOk ? T.green : T.red, false, "Real"],
                    [T.purple, true, isMobile ? "Ritmo atual" : "Se mantiver ritmo"],
                  ].map(([c, dash, l]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="14" height="6">
                        <line
                          x1="0"
                          y1="3"
                          x2="14"
                          y2="3"
                          stroke={c}
                          strokeWidth="2"
                          strokeDasharray={dash ? "4 3" : ""}
                        />
                      </svg>
                      <span style={{ ...G, fontSize: isMobile ? 9 : 10, color: T.inkMid }}>{l}</span>
                    </div>
                  ))}
                </>
              )}
              {!showBudgetChart && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="14" height="6">
                    <line x1="0" y1="3" x2="14" y2="3" stroke={T.green} strokeWidth="2" />
                  </svg>
                  <span style={{ ...G, fontSize: isMobile ? 9 : 10, color: T.inkMid }}>Real acumulado</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 14 }}>
            {pastLight
              ? `Despesas no período · ${periodLabel}`
              : showBudgetChart
                ? `Gasto real × ritmo orçado diário · ${periodLabel}`
                : `Despesas até o dia ${todayInView} · ${periodLabel}`}
          </div>
          <div style={{ flex: 1, minHeight: isMobile ? 160 : 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ ...G, fontSize: 10, fill: T.inkLight }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v % 5 === 0 || v === 1 ? `${v}` : "")}
                />
                <YAxis
                  tick={{ ...G, ...NUM, fontSize: 10, fill: T.inkLight }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtK}
                />
                <Tooltip content={<RitmoTooltip />} />
                {!pastLight && !isClosed && (
                  <ReferenceLine
                    x={todayInView}
                    stroke={T.amber}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    label={{
                      value: "Hoje",
                      position: "top",
                      fill: T.amber,
                      fontSize: 10,
                      fontFamily: "Geist,sans-serif",
                    }}
                  />
                )}
                {showBudgetChart && (
                  <ReferenceLine
                    y={budgetVal}
                    stroke={`${T.blue}44`}
                    strokeDasharray="5 4"
                    label={
                      isMobile
                        ? undefined
                        : {
                            value: "Orçamento",
                            position: "right",
                            fill: T.blue,
                            fontSize: 10,
                            fontFamily: "Geist,sans-serif",
                          }
                    }
                  />
                )}
                {!pastLight &&
                  showBudgetChart &&
                  estouroDia != null &&
                  estouroDia <= daysInMonth &&
                  estouroDia > todayInView && (
                    <ReferenceLine
                      x={estouroDia}
                      stroke={`${T.red}88`}
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      label={{
                        value: `estouro dia ${estouroDia}`,
                        position: "insideTopLeft",
                        fill: T.red,
                        fontSize: 10,
                        fontFamily: "Geist,sans-serif",
                      }}
                    />
                  )}
                {showBudgetChart && (
                  <Area
                    dataKey="proj"
                    name="proj"
                    type="monotone"
                    fill={`${T.blue}06`}
                    stroke="#D1D5DB"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    dot={false}
                  />
                )}
                <Line
                  dataKey="real"
                  name="real"
                  type="monotone"
                  stroke={pastLight || isOk ? T.green : T.red}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                />
                {showBudgetChart && (
                  <Line
                    dataKey="ritmoAtual"
                    name="ritmoAtual"
                    type="monotone"
                    stroke={T.purple}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    dot={false}
                    connectNulls={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {showBudgetChart &&
          (isMobile ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                {
                  label: isClosed ? "Total realizado" : "Projeção fim de mês",
                  val: fmtAbs(projFim),
                  color: projColor,
                  sub: projOver
                    ? `+${fmtAbs(projFim - budgetVal)} acima`
                    : `${fmtAbs(budgetVal - projFim)} de margem`,
                },
                { label: "Orçamento", val: fmtAbs(budgetVal), color: T.ink, sub: periodLabel },
                {
                  label: "Diferença",
                  val: fmtAbs(Math.abs(projFim - budgetVal)),
                  color: projOver ? T.red : T.green,
                  sub: projOver ? "acima ↑" : "abaixo ✓",
                },
                {
                  label: isClosed ? "Média diária" : "Ritmo necessário",
                  val: `${fmtAbs(isClosed ? dailyAvg : dailyLeft)}/dia`,
                  color: T.ink,
                  sub: isClosed ? `${daysInMonth} dias` : `${daysLeft} dias restantes`,
                },
              ].map((k, i) => (
                <Card key={i} style={{ padding: "12px 14px" }}>
                  <div
                    style={{
                      ...G,
                      fontSize: 10,
                      fontWeight: 700,
                      color: T.inkMid,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: 5,
                    }}
                  >
                    {k.label}
                  </div>
                  <div
                    style={{
                      ...M_MONO,
                      ...NUM,
                      fontSize: 15,
                      fontWeight: 800,
                      color: k.color,
                      marginBottom: 2,
                    }}
                  >
                    {k.val}
                  </div>
                  <div
                    style={{
                      ...G,
                      fontSize: 10,
                      color: k.color === T.ink ? T.inkMid : k.color,
                      fontWeight: 500,
                    }}
                  >
                    {k.sub}
                  </div>
                </Card>
              ))}
              <Card style={{ padding: "12px 14px", gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span
                    style={{
                      ...G,
                      fontSize: 10,
                      fontWeight: 700,
                      color: T.inkMid,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                  >
                    Progresso
                  </span>
                  <span
                    style={{
                      ...G,
                      ...NUM,
                      fontSize: 10,
                      fontWeight: 700,
                      color: spentPct > timePct ? T.red : T.green,
                    }}
                  >
                    {spentPct}% consumido
                  </span>
                </div>
                {!isClosed && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Tempo</span>
                      <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{timePct}%</span>
                    </div>
                    <div style={{ height: 4, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${timePct}%`,
                          background: T.inkGhost,
                          borderRadius: 99,
                        }}
                      />
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Gasto</span>
                  <span
                    style={{
                      ...G,
                      ...NUM,
                      fontSize: 10,
                      color: spentPct > timePct ? T.red : T.green,
                    }}
                  >
                    {spentPct}%
                  </span>
                </div>
                <div style={{ height: 5, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(spentPct, 100)}%`,
                      background: spentPct > timePct ? T.red : T.green,
                      borderRadius: 99,
                      transition: "width 0.6s",
                    }}
                  />
                </div>
              </Card>
            </div>
          ) : (
            <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 3 }}>
                Projeção Fim de Período
              </div>
              <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 20 }}>Baseado no ritmo atual</div>
              <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${T.border}` }}>
                <div
                  style={{
                    ...G,
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.inkMid,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 6,
                  }}
                >
                  Projeção atual
                </div>
                <div
                  style={{
                    ...M_MONO,
                    ...NUM,
                    fontSize: 22,
                    fontWeight: 800,
                    color: projColor,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {fmtAbs(projFim)}
                </div>
                <div style={{ ...G, fontSize: 10, color: projColor, marginTop: 3, fontWeight: 600 }}>
                  {projOver
                    ? `+${fmtAbs(projFim - budgetVal)} acima do orçamento`
                    : `${fmtAbs(budgetVal - projFim)} de margem`}
                </div>
              </div>
              <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${T.border}` }}>
                <div
                  style={{
                    ...G,
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.inkMid,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 6,
                  }}
                >
                  Orçamento do período
                </div>
                <div style={{ ...M_MONO, ...NUM, fontSize: 18, fontWeight: 700, color: T.ink }}>
                  {fmtAbs(budgetVal)}
                </div>
              </div>
              <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: `1px solid ${T.border}` }}>
                <div
                  style={{
                    ...G,
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.inkMid,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 6,
                  }}
                >
                  Diferença estimada
                </div>
                <div
                  style={{
                    ...M_MONO,
                    ...NUM,
                    fontSize: 18,
                    fontWeight: 700,
                    color: projOver ? T.red : T.green,
                  }}
                >
                  {projOver ? "+" : "−"}
                  {fmtAbs(Math.abs(projFim - budgetVal))}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div
                    style={{
                      ...G,
                      fontSize: 10,
                      fontWeight: 600,
                      color: T.inkMid,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}
                  >
                    Progresso do período
                  </div>
                  <span
                    style={{
                      ...G,
                      ...NUM,
                      fontSize: 11,
                      fontWeight: 700,
                      color: spentPct > timePct ? T.red : T.green,
                    }}
                  >
                    {spentPct}%
                  </span>
                </div>
                <div style={{ marginBottom: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Tempo decorrido</span>
                    <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{timePct}%</span>
                  </div>
                  <div style={{ height: 5, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${timePct}%`,
                        background: T.inkGhost,
                        borderRadius: 99,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Orçamento consumido</span>
                    <span
                      style={{
                        ...G,
                        ...NUM,
                        fontSize: 10,
                        color: spentPct > timePct ? T.red : T.green,
                      }}
                    >
                      {spentPct}%
                    </span>
                  </div>
                  <div style={{ height: 5, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(spentPct, 100)}%`,
                        background: spentPct > timePct ? T.red : T.green,
                        borderRadius: 99,
                        transition: "width 0.6s",
                      }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ background: T.grayLight, borderRadius: 10, padding: "12px 14px" }}>
                <div
                  style={{
                    ...G,
                    fontSize: 10,
                    fontWeight: 600,
                    color: T.inkMid,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 5,
                  }}
                >
                  Ritmo necessário
                </div>
                <div style={{ ...M_MONO, ...NUM, fontSize: 17, fontWeight: 800, color: T.ink }}>
                  {fmtAbs(dailyLeft)}
                  <span style={{ ...G, fontSize: 10, fontWeight: 500, color: T.inkMid }}>/dia</span>
                </div>
                <div style={{ ...G, fontSize: 10, color: T.inkMid, marginTop: 3 }}>
                  para fechar dentro do orçamento · {daysLeft} dias restantes
                </div>
              </div>
            </Card>
          ))}

        {(pastLight || !showBudgetChart) && (
          <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>
              {pastLight ? "Resumo do período" : "Sem painel de orçamento"}
            </div>
            <div style={{ ...G, fontSize: 11, color: T.inkLight, lineHeight: 1.55 }}>
              {pastLight
                ? "Valores apenas a partir das despesas lançadas neste mês."
                : "Defina orçamentos para ver projeção de fechamento e ritmo necessário."}
            </div>
            <div style={{ ...M_MONO, ...NUM, fontSize: 20, fontWeight: 800, color: T.ink }}>
              {fmtAbs(realFinal)}
            </div>
            <div style={{ ...G, fontSize: 11, color: T.inkMid }}>Total de despesas no período</div>
            {!pastLight && (
              <Btn variant="dark" onClick={() => onNav("budgets")}>
                Configurar orçamentos
              </Btn>
            )}
          </Card>
        )}
      </div>

      <Card style={{ padding: "20px 20px 14px" }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>Gasto por Dia da Semana</div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>
            Média de gastos por dia · {periodLabel}
          </div>
        </div>
        <div style={{ marginTop: 20, display: "flex", alignItems: "flex-end", gap: 10, height: 140 }}>
          {dowData.map((d, i) => {
            const pct = d.val / dowMax;
            const isWeekend = i === 0 || i === 6;
            const isToday = highlightDowToday && i === todayWd;
            const barH = Math.round(pct * 110);
            const barColor = isToday ? T.blue : pct > 0.75 ? T.red : pct > 0.5 ? T.amber : T.inkGhost;
            return (
              <div
                key={d.day}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
              >
                {!isMobile && (
                  <span
                    style={{
                      ...M_MONO,
                      ...NUM,
                      fontSize: 10,
                      fontWeight: 600,
                      color: pct > 0.75 ? T.red : pct > 0.5 ? T.amber : T.inkMid,
                    }}
                  >
                    {fmtAbs(d.val)}
                  </span>
                )}
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                    height: 110,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: barH,
                      background: barColor,
                      borderRadius: "5px 5px 3px 3px",
                      opacity: isWeekend && !isToday ? 0.5 : 1,
                      transition: "height 0.4s, background 0.3s",
                      position: "relative",
                    }}
                  >
                    {isToday && (
                      <div
                        style={{
                          position: "absolute",
                          top: -18,
                          left: "50%",
                          transform: "translateX(-50%)",
                          ...G,
                          fontSize: 8,
                          fontWeight: 700,
                          color: T.blue,
                          whiteSpace: "nowrap",
                          background: T.blueLight,
                          padding: "2px 5px",
                          borderRadius: 4,
                        }}
                      >
                        hoje
                      </div>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    ...G,
                    fontSize: isMobile ? 10 : 11,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? T.blue : isWeekend ? T.inkMid : T.ink,
                  }}
                >
                  {isMobile ? d.short : d.day}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: isMobile ? "grid" : "flex",
            gridTemplateColumns: isMobile ? "1fr 1fr" : undefined,
            gap: isMobile ? 6 : 16,
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${T.border}`,
          }}
        >
          {[
            { color: T.blue, label: "Hoje" },
            { color: T.red, label: isMobile ? "Alto >75%" : "Alto (>75%)" },
            { color: T.amber, label: isMobile ? "Moderado 50–75%" : "Moderado (50–75%)" },
            { color: T.inkGhost, label: isMobile ? "Baixo <50%" : "Baixo (<50%)" },
          ].map((l, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: l.color, flexShrink: 0 }} />
              <span style={{ ...G, fontSize: 10, color: T.inkMid }}>{l.label}</span>
            </div>
          ))}
          {!isMobile && dowData.length > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Maior gasto:</span>
              <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.ink }}>
                {dowData.reduce((a, b) => (a.val > b.val ? a : b)).day}
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function MonthChevrons({
  periodLabel,
  isClosed,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: "4px 6px",
        boxShadow: T.sm,
      }}
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!canGoPrev}
        style={{
          background: "none",
          border: "none",
          cursor: canGoPrev ? "pointer" : "default",
          color: canGoPrev ? T.inkMid : T.inkGhost,
          padding: "4px 8px",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
        }}
      >
        <ChevronLeft size={14} />
      </button>
      <span
        style={{
          ...G,
          fontSize: 12,
          fontWeight: 700,
          color: T.ink,
          padding: "0 6px",
          minWidth: 72,
          textAlign: "center",
        }}
      >
        {periodLabel}
        {isClosed && (
          <span style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, marginLeft: 4 }}>
            fechado
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        style={{
          background: "none",
          border: "none",
          cursor: canGoNext ? "pointer" : "default",
          color: canGoNext ? T.inkMid : T.inkGhost,
          padding: "4px 8px",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
        }}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
