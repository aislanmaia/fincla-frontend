import React, { useState } from "react";
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
import {
  BUDGET,
  BUDGET_FEV,
  curProj,
  curReal,
  estouroDia,
  fev26Data,
  fev26Proj,
  fev26Real,
  rhythmData,
  TODAY_RIT,
} from "../data/mockFinance";
import { CardEmptyWithCta } from "../features/shellExtras.jsx";
import { shouldUseRealData as shouldUseRealDataForMode } from "../dataMode.js";
import { RitmoPageLive } from "./RitmoPageLive.jsx";
import { RitmoEmptyState } from "../features/spendingPace/RitmoEmptyState.jsx";

const DOW_DATA_MAR = [
  { day: "Dom", short: "D", val: 145 },
  { day: "Seg", short: "S", val: 318 },
  { day: "Ter", short: "T", val: 204 },
  { day: "Qua", short: "Q", val: 271 },
  { day: "Qui", short: "Q", val: 487 },
  { day: "Sex", short: "S", val: 362 },
  { day: "Sáb", short: "S", val: 231 },
];

const DOW_DATA_FEV = [
  { day: "Dom", short: "D", val: 98 },
  { day: "Seg", short: "S", val: 344 },
  { day: "Ter", short: "T", val: 221 },
  { day: "Qua", short: "Q", val: 298 },
  { day: "Qui", short: "Q", val: 510 },
  { day: "Sex", short: "S", val: 412 },
  { day: "Sáb", short: "S", val: 189 },
];

const PERIODOS_RITMO = [
  { key: "mar26", label: "mar/26", isClosed: false },
  { key: "fev26", label: "fev/26", isClosed: true },
];

function RitmoPageMock({ onNav, isMobile = false }) {
  const [periodoKey, setPeriodoKey] = useState("mar26");
  const periodo = PERIODOS_RITMO.find((p) => p.key === periodoKey);
  const isClosed = periodo.isClosed;

  const chartData = isClosed ? fev26Data : rhythmData;
  const totalDays = isClosed ? 28 : 31;
  const budgetVal = isClosed ? BUDGET_FEV : BUDGET;
  const todayDay = isClosed ? totalDays : TODAY_RIT;
  const realFinal = isClosed ? fev26Real : curReal;
  const projFinal = isClosed ? fev26Proj : curProj;
  const dowData = isClosed ? DOW_DATA_FEV : DOW_DATA_MAR;
  const dowMax = Math.max(...dowData.map((d) => d.val));

  const diff = realFinal - projFinal;
  const isOk = diff <= 0;
  const projFim = isClosed ? realFinal : Math.round((curReal / TODAY_RIT) * 31);
  const daysLeft = isClosed ? 0 : totalDays - todayDay;
  const spentPct = Math.round((realFinal / budgetVal) * 100);
  const timePct = Math.round((todayDay / totalDays) * 100);
  const dailyLeft = daysLeft > 0 ? Math.round((budgetVal - realFinal) / daysLeft) : 0;
  const dailyAvg = Math.round(realFinal / todayDay);
  const projOver = projFim > budgetVal;
  const projColor = projOver ? T.red : T.green;
  const diffColor = isOk ? T.green : T.red;

  const RitmoTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const realVal = payload.find((p) => p.dataKey === "real")?.value;
    const projVal = payload.find((p) => p.dataKey === "proj")?.value;
    const ritmoVal = payload.find((p) => p.dataKey === "ritmoAtual")?.value;
    const hasDiff = realVal != null && projVal != null;
    const diffVal = hasDiff ? realVal - projVal : null;
    const diffPct = hasDiff ? ((realVal / projVal - 1) * 100).toFixed(1) : null;
    const abaixo = diffVal < 0;
    return (
      <div style={{ ...G, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px", boxShadow: T.md, fontSize: 11, minWidth: 200 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: T.ink, fontSize: 12 }}>Dia {label}</div>
        {projVal != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9999, background: "#D1D5DB" }} />
            <span style={{ color: T.inkMid, flex: 1 }}>Projeção linear</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 600 }}>{fmtAbs(projVal)}</span>
          </div>
        )}
        {realVal != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9999, background: isOk ? T.green : T.red }} />
            <span style={{ color: T.inkMid, flex: 1 }}>Real acumulado</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 600 }}>{fmtAbs(realVal)}</span>
          </div>
        )}
        {ritmoVal != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 9999, background: T.purple }} />
            <span style={{ color: T.inkMid, flex: 1 }}>Se mantiver ritmo</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 600 }}>{fmtAbs(ritmoVal)}</span>
          </div>
        )}
        {hasDiff && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12 }}>{abaixo ? "↓" : "↑"}</span>
            <span style={{ ...M_MONO, ...NUM, fontWeight: 700, color: abaixo ? T.green : T.red }}>{fmtAbs(Math.abs(diffVal))}</span>
            <span style={{ color: abaixo ? T.green : T.red, fontWeight: 600 }}>
              {abaixo ? `−${Math.abs(diffPct)}% abaixo` : `+${diffPct}% acima`}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ paddingTop: 4, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <Breadcrumb label="Planejar" />
          <PageTitle sans="Ritmo" serif="de Gastos" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "4px 6px", boxShadow: T.sm }}>
          <button onClick={() => setPeriodoKey((k) => (k === "mar26" ? "fev26" : "mar26"))} style={{ background: "none", border: "none", cursor: periodoKey === "mar26" ? "default" : "pointer", color: periodoKey === "mar26" ? T.inkGhost : T.inkMid, padding: "4px 8px", borderRadius: 7, display: "flex", alignItems: "center" }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ ...G, fontSize: 12, fontWeight: 700, color: T.ink, padding: "0 6px", minWidth: 60, textAlign: "center" }}>
            {periodo.label}
            {isClosed && <span style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, marginLeft: 4 }}>fechado</span>}
          </span>
          <button onClick={() => setPeriodoKey((k) => (k === "fev26" ? "mar26" : "fev26"))} style={{ background: "none", border: "none", cursor: periodoKey === "mar26" ? "default" : "pointer", color: periodoKey === "mar26" ? T.inkGhost : T.inkMid, padding: "4px 8px", borderRadius: 7, display: "flex", alignItems: "center" }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div style={{ background: isOk ? T.greenLight : T.redLight, border: `1px solid ${isOk ? T.green : T.red}33`, borderRadius: 14, padding: "13px 18px", display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 14, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: isOk ? T.green : T.red, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {isOk ? <TrendingDown size={18} color="#fff" /> : <TrendingUp size={18} color="#fff" />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...G, fontSize: 13, fontWeight: 700, color: isOk ? T.green : T.red }}>
            {isClosed
              ? isOk
                ? `Fechou ${Math.abs(((realFinal / budgetVal) - 1) * 100).toFixed(1)}% abaixo do orçamento — mês controlado`
                : `Fechou ${(((realFinal / budgetVal) - 1) * 100).toFixed(1)}% acima do orçamento em ${periodo.label}`
              : isOk
                ? `${Math.abs(((curReal / curProj) - 1) * 100).toFixed(1)}% abaixo do ritmo esperado — você está no controle`
                : `${(((curReal / curProj) - 1) * 100).toFixed(1)}% acima do ritmo esperado — atenção necessária`}
          </div>
          <div style={{ ...G, fontSize: 11, color: `${isOk ? T.green : T.red}bb`, marginTop: 2 }}>
            {isClosed
              ? `${totalDays} dias · mês encerrado · total realizado: ${fmtAbs(realFinal)} de ${fmtAbs(budgetVal)} orçados`
              : `Dia ${todayDay} de ${totalDays} · ${timePct}% do período · ${daysLeft} dias restantes`}
          </div>
        </div>
        {!isClosed && (
          <Btn variant="dark" onClick={() => onNav("simulation")}>
            <FlaskConical size={12} /> Simular
          </Btn>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 10 }}>
        {(isClosed
          ? [
              { label: isMobile ? "Total realizado" : `Total realizado · ${periodo.label}`, val: fmtAbs(realFinal), color: projOver ? T.red : T.green, sub: `de ${fmtAbs(budgetVal)} orçados` },
              { label: isMobile ? "Média diária" : "Média diária realizada", val: fmtAbs(dailyAvg), color: T.ink, sub: `em ${totalDays} dias` },
              { label: "Diferença final", val: fmtAbs(Math.abs(realFinal - budgetVal)), color: diffColor, sub: isOk ? "abaixo do orçamento ✓" : "acima do orçamento ↑" },
            ]
          : [
              { label: isMobile ? `Gasto · dia ${todayDay}` : `Gasto real · dia ${todayDay}`, val: fmtAbs(realFinal), color: T.ink, sub: `de ${fmtAbs(budgetVal)} orçados` },
              { label: isMobile ? "Ritmo hoje" : "Ritmo esperado hoje", val: fmtAbs(projFinal), color: T.blue, sub: "acumulado linear" },
              { label: "Diferença", val: fmtAbs(Math.abs(diff)), color: diffColor, sub: isOk ? "abaixo do esperado ✓" : "acima do esperado ↑" },
            ]).map((k, i) => (
          <Card key={i} style={{ padding: isMobile ? "12px 14px" : "14px 18px", gridColumn: isMobile && i === 2 ? "1 / -1" : undefined }}>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{k.label}</div>
            <div style={{ ...M_MONO, ...NUM, fontSize: isMobile ? 16 : 18, fontWeight: 700, color: k.color, marginBottom: 3 }}>{k.val}</div>
            <div style={{ ...G, fontSize: isMobile ? 9 : 10, color: T.inkMid }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: 14 }}>
        <Card style={{ padding: "20px 20px 14px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>
              {isClosed ? "Histórico Real vs. Projeção" : "Acumulado vs. Projeção"}
            </div>
            <div style={{ display: "flex", gap: isMobile ? 8 : 12, flexWrap: "wrap" }}>
              {[
                ["#D1D5DB", true, isMobile ? "Projeção" : "Projeção linear"],
                [isOk ? T.green : T.red, false, "Real"],
                ...(!isClosed ? [[T.purple, true, isMobile ? "Ritmo atual" : "Se mantiver ritmo"]] : []),
              ].map(([c, dash, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="14" height="6"><line x1="0" y1="3" x2="14" y2="3" stroke={c} strokeWidth="2" strokeDasharray={dash ? "4 3" : ""} /></svg>
                  <span style={{ ...G, fontSize: isMobile ? 9 : 10, color: T.inkMid }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 14 }}>
            {isClosed ? `Mês completo · ${periodo.label} · ${totalDays} dias` : "Gasto real × ritmo orçado diário · Março 2026"}
          </div>
          <div style={{ flex: 1, minHeight: isMobile ? 160 : 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="day" tick={{ ...G, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} tickFormatter={(v) => (v % 5 === 0 || v === 1 ? `${v}` : "")} />
                <YAxis tick={{ ...G, ...NUM, fontSize: 10, fill: T.inkLight }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                <Tooltip content={<RitmoTooltip />} />
                {!isClosed && (
                  <ReferenceLine x={todayDay} stroke={T.amber} strokeWidth={1.5} strokeDasharray="4 3" label={{ value: "Hoje", position: "top", fill: T.amber, fontSize: 10, fontFamily: "Geist,sans-serif" }} />
                )}
                <ReferenceLine y={budgetVal} stroke={`${T.blue}44`} strokeDasharray="5 4" label={isMobile ? undefined : { value: "Orçamento", position: "right", fill: T.blue, fontSize: 10, fontFamily: "Geist,sans-serif" }} />
                {!isClosed && estouroDia && estouroDia <= 31 && estouroDia > TODAY_RIT && (
                  <ReferenceLine x={estouroDia} stroke={`${T.red}88`} strokeWidth={1.5} strokeDasharray="3 3" label={{ value: `estouro dia ${estouroDia}`, position: "insideTopLeft", fill: T.red, fontSize: 10, fontFamily: "Geist,sans-serif" }} />
                )}
                <Area dataKey="proj" name="proj" type="monotone" fill={`${T.blue}06`} stroke="#D1D5DB" strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
                <Line dataKey="real" name="real" type="monotone" stroke={isOk ? T.green : T.red} strokeWidth={2.5} dot={false} connectNulls={false} />
                {!isClosed && (
                  <Line dataKey="ritmoAtual" name="ritmoAtual" type="monotone" stroke={T.purple} strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {isMobile ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: isClosed ? "Total realizado" : "Projeção fim de mês", val: fmtAbs(projFim), color: projColor, sub: projOver ? `+${fmtAbs(projFim - budgetVal)} acima` : `${fmtAbs(budgetVal - projFim)} de margem` },
              { label: "Orçamento", val: fmtAbs(budgetVal), color: T.ink, sub: periodo.label },
              { label: "Diferença", val: fmtAbs(Math.abs(projFim - budgetVal)), color: projOver ? T.red : T.green, sub: projOver ? "acima ↑" : "abaixo ✓" },
              { label: isClosed ? "Média diária" : "Ritmo necessário", val: `${fmtAbs(isClosed ? dailyAvg : dailyLeft)}/dia`, color: T.ink, sub: isClosed ? `${totalDays} dias` : `${daysLeft} dias restantes` },
            ].map((k, i) => (
              <Card key={i} style={{ padding: "12px 14px" }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{k.label}</div>
                <div style={{ ...M_MONO, ...NUM, fontSize: 15, fontWeight: 800, color: k.color, marginBottom: 2 }}>{k.val}</div>
                <div style={{ ...G, fontSize: 10, color: k.color === T.ink ? T.inkMid : k.color, fontWeight: 500 }}>{k.sub}</div>
              </Card>
            ))}
            <Card style={{ padding: "12px 14px", gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em" }}>{isClosed ? "Execução" : "Progresso"}</span>
                <span style={{ ...G, ...NUM, fontSize: 10, fontWeight: 700, color: spentPct > timePct ? T.red : T.green }}>{spentPct}% consumido</span>
              </div>
              {!isClosed && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Tempo</span>
                    <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{timePct}%</span>
                  </div>
                  <div style={{ height: 4, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${timePct}%`, background: T.inkGhost, borderRadius: 99 }} />
                  </div>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Gasto</span>
                <span style={{ ...G, ...NUM, fontSize: 10, color: spentPct > timePct ? T.red : T.green }}>{spentPct}%</span>
              </div>
              <div style={{ height: 5, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(spentPct, 100)}%`, background: spentPct > timePct ? T.red : T.green, borderRadius: 99, transition: "width 0.6s" }} />
              </div>
            </Card>
          </div>
        ) : (
          <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 3 }}>
              {isClosed ? "Resultado do Período" : "Projeção Fim de Período"}
            </div>
            <div style={{ ...G, fontSize: 11, color: T.inkLight, marginBottom: 20 }}>
              {isClosed ? `Mês encerrado · ${periodo.label}` : "Baseado no ritmo atual"}
            </div>
            <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                {isClosed ? "Total realizado" : "Projeção atual"}
              </div>
              <div style={{ ...M_MONO, ...NUM, fontSize: 22, fontWeight: 800, color: projColor, letterSpacing: "-0.02em" }}>{fmtAbs(projFim)}</div>
              <div style={{ ...G, fontSize: 10, color: projColor, marginTop: 3, fontWeight: 600 }}>
                {projOver ? `+${fmtAbs(projFim - budgetVal)} acima do orçamento` : `${fmtAbs(budgetVal - projFim)} ${isClosed ? "de economia" : "de margem"}`}
              </div>
            </div>
            <div style={{ marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Orçamento do período</div>
              <div style={{ ...M_MONO, ...NUM, fontSize: 18, fontWeight: 700, color: T.ink }}>{fmtAbs(budgetVal)}</div>
            </div>
            <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: `1px solid ${T.border}` }}>
              <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Diferença {isClosed ? "final" : "estimada"}</div>
              <div style={{ ...M_MONO, ...NUM, fontSize: 18, fontWeight: 700, color: projOver ? T.red : T.green }}>
                {projOver ? "+" : "−"}{fmtAbs(Math.abs(projFim - budgetVal))}
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  {isClosed ? "Execução do período" : "Progresso do período"}
                </div>
                <span style={{ ...G, ...NUM, fontSize: 11, fontWeight: 700, color: spentPct > timePct ? T.red : T.green }}>{spentPct}%</span>
              </div>
              {isClosed ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Realizado vs. orçamento</span>
                    <span style={{ ...G, ...NUM, fontSize: 10, color: projOver ? T.red : T.green }}>{spentPct}%</span>
                  </div>
                  <div style={{ height: 7, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(spentPct, 100)}%`, background: projOver ? T.red : T.green, borderRadius: 99 }} />
                  </div>
                  {spentPct > 100 && <div style={{ ...G, fontSize: 10, color: T.red, marginTop: 4, fontWeight: 600 }}>+{spentPct - 100}% além do orçamento</div>}
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Tempo decorrido</span>
                      <span style={{ ...G, ...NUM, fontSize: 10, color: T.inkMid }}>{timePct}%</span>
                    </div>
                    <div style={{ height: 5, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${timePct}%`, background: T.inkGhost, borderRadius: 99 }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Orçamento consumido</span>
                      <span style={{ ...G, ...NUM, fontSize: 10, color: spentPct > timePct ? T.red : T.green }}>{spentPct}%</span>
                    </div>
                    <div style={{ height: 5, background: T.grayLight, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(spentPct, 100)}%`, background: spentPct > timePct ? T.red : T.green, borderRadius: 99, transition: "width 0.6s" }} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ background: T.grayLight, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ ...G, fontSize: 10, fontWeight: 600, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                {isClosed ? "Média diária realizada" : "Ritmo necessário"}
              </div>
              <div style={{ ...M_MONO, ...NUM, fontSize: 17, fontWeight: 800, color: T.ink }}>
                {fmtAbs(isClosed ? dailyAvg : dailyLeft)}
                <span style={{ ...G, fontSize: 10, fontWeight: 500, color: T.inkMid }}>/dia</span>
              </div>
              <div style={{ ...G, fontSize: 10, color: T.inkMid, marginTop: 3 }}>
                {isClosed ? `média ao longo de ${totalDays} dias` : `para fechar dentro do orçamento · ${daysLeft} dias restantes`}
              </div>
            </div>
          </Card>
        )}
      </div>

      <Card style={{ padding: "20px 20px 14px" }}>
        <div style={{ marginBottom: 4 }}>
          <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>Gasto por Dia da Semana</div>
          <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>
            Média de gastos por dia · {periodo.label}
          </div>
        </div>
        <div style={{ marginTop: 20, display: "flex", alignItems: "flex-end", gap: 10, height: 140 }}>
          {dowData.map((d, i) => {
            const pct = d.val / dowMax;
            const isWeekend = i === 0 || i === 6;
            const isToday = !isClosed && i === 3;
            const barH = Math.round(pct * 110);
            const barColor = isToday ? T.blue : pct > 0.75 ? T.red : pct > 0.5 ? T.amber : T.inkGhost;
            return (
              <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                {!isMobile && <span style={{ ...M_MONO, ...NUM, fontSize: 10, fontWeight: 600, color: pct > 0.75 ? T.red : pct > 0.5 ? T.amber : T.inkMid }}>{fmtAbs(d.val)}</span>}
                <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 110 }}>
                  <div style={{ width: "100%", height: barH, background: barColor, borderRadius: "5px 5px 3px 3px", opacity: isWeekend && !isToday ? 0.5 : 1, transition: "height 0.4s, background 0.3s", position: "relative" }}>
                    {isToday && (
                      <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", ...G, fontSize: 8, fontWeight: 700, color: T.blue, whiteSpace: "nowrap", background: T.blueLight, padding: "2px 5px", borderRadius: 4 }}>
                        hoje
                      </div>
                    )}
                  </div>
                </div>
                <span style={{ ...G, fontSize: isMobile ? 10 : 11, fontWeight: isToday ? 700 : 500, color: isToday ? T.blue : isWeekend ? T.inkMid : T.ink }}>
                  {isMobile ? d.short : d.day}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ display: isMobile ? "grid" : "flex", gridTemplateColumns: isMobile ? "1fr 1fr" : undefined, gap: isMobile ? 6 : 16, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
          {[
            { color: T.blue, label: "Hoje" },
            { color: T.red, label: isMobile ? "Alto >75%" : "Alto (>75%)" },
            { color: T.amber, label: isMobile ? "Moderado 50–75%" : "Moderado (50–75%)" },
            { color: T.inkGhost, label: isMobile ? "Baixo <50%" : "Baixo (<50%)" },
          ].map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: l.color, flexShrink: 0 }} />
              <span style={{ ...G, fontSize: 10, color: T.inkMid }}>{l.label}</span>
            </div>
          ))}
          {!isMobile && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...G, fontSize: 10, color: T.inkMid }}>Maior gasto:</span>
              <span style={{ ...G, fontSize: 10, fontWeight: 700, color: T.ink }}>{dowData.reduce((a, b) => (a.val > b.val ? a : b)).day}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export function RitmoPage({
  onNav,
  isMobile = false,
  dataMode = "live",
  organizationId = null,
  onNewTx,
}) {
  if (dataMode === "empty") {
    return <RitmoEmptyState onNewTx={onNewTx} />;
  }
  if (dataMode === "mock") {
    return <RitmoPageMock onNav={onNav} isMobile={isMobile} />;
  }
  if (shouldUseRealDataForMode(organizationId, dataMode)) {
    return (
      <RitmoPageLive
        organizationId={organizationId}
        onNav={onNav}
        isMobile={isMobile}
        onNewTx={onNewTx}
      />
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ paddingTop: 4 }}>
        <Breadcrumb label="Planejar" />
        <PageTitle sans="Ritmo" serif="de Gastos" />
      </div>
      <Card>
        <CardEmptyWithCta
          icon="🏢"
          title="Nenhuma organização ativa"
          sub="Selecione ou crie uma organização para ver o ritmo de gastos com dados reais."
          primaryLabel="Ir às configurações"
          onPrimary={() => onNav("profile")}
        />
      </Card>
    </div>
  );
}
