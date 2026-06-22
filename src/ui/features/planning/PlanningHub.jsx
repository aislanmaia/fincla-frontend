import React, { useEffect, useState } from "react";
import { T } from "../../tokens";
import { G } from "../../typography";
import { PageEnter, Card } from "../../components/primitives";
import { MetasPage } from "../../pages/MetasPage.jsx";
import { OrcamentosPage } from "../../pages/OrcamentosPage.jsx";
import { SimulacaoPage } from "../../pages/SimulacaoPage.jsx";
import { CapacityPanel } from "../financialHealth/CapacityPanel.jsx";
import { UpgradeWall, useEntitlement } from "../entitlements/index.js";

/** Sub-áreas do hub. `soon` = placeholder (M5/M6/M7 ainda não implementados). */
const NAV = [
  {
    group: "Saúde Financeira",
    items: [
      { id: "capacidade", label: "Capacidade de Economia" },
      { id: "painel", label: "Painel de Saúde", soon: true },
    ],
  },
  {
    group: "Objetivos",
    items: [
      { id: "metas", label: "Metas" },
      { id: "simulador", label: "Simulador" },
    ],
  },
  {
    group: "Rotina",
    items: [
      { id: "orcamentos", label: "Orçamentos" },
      { id: "planejado", label: "Planejado × Realizado", soon: true },
      { id: "calendario", label: "Calendário", soon: true },
    ],
  },
];
const FIRST_AREA = "capacidade";
const ALL_ITEMS = NAV.flatMap((g) => g.items);

function useIsWide(bp = 1024) {
  const [wide, setWide] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= bp : true));
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= bp);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bp]);
  return wide;
}

function Placeholder({ label }) {
  return (
    <Card style={{ padding: "40px 24px", textAlign: "center", marginTop: 4 }}>
      <div style={{ fontSize: 24 }}>🛠️</div>
      <div style={{ ...G, fontSize: 15, fontWeight: 700, color: T.ink, marginTop: 8 }}>{label}</div>
      <div style={{ ...G, fontSize: 12.5, color: T.inkLight, marginTop: 4 }}>Em breve, nesta fase do Planejamento.</div>
    </Card>
  );
}

const groupLabelStyle = { ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.1em", padding: "12px 10px 5px" };

/**
 * Hub "Planejamento" — sub-nav lateral no desktop (≥1024, estilo Perfil) e dropdown
 * de seção no tablet/mobile (sem scroll lateral). Renderiza a sub-área ativa.
 */
export function PlanningHub({ organizationId, dataMode = "live", isMobile = false, navTo, onContribuir, simulation, user, initialMetas }) {
  const [area, setArea] = useState(FIRST_AREA);
  const isWide = useIsWide(1024);
  const canSimulate = useEntitlement("what_if_simulations", user);

  function renderArea() {
    switch (area) {
      case "capacidade":
        return <CapacityPanel organizationId={organizationId} dataMode={dataMode} />;
      case "metas":
        return (
          <MetasPage
            isMobile={isMobile}
            initialMetas={dataMode === "empty" ? [] : initialMetas}
            dataMode={dataMode}
            organizationId={organizationId}
            onContribuir={onContribuir}
          />
        );
      case "orcamentos":
        return <OrcamentosPage onNav={navTo} isMobile={isMobile} dataMode={dataMode} organizationId={organizationId} />;
      case "simulador":
        return canSimulate ? (
          <SimulacaoPage
            cenarios={simulation?.cenarios}
            setCenarios={simulation?.setCenarios}
            cenarioId={simulation?.cenarioId}
            setCenarioId={simulation?.setCenarioId}
            isMobile={isMobile}
            organizationId={organizationId}
            dataMode={dataMode}
          />
        ) : (
          <UpgradeWall
            feature="what_if_simulations"
            title="Simulador — disponível no plano Pro"
            description="Faça upgrade para simular metas e cenários financeiros."
            ctaLabel="Ver planos"
            currentPlanId={user?.subscription?.plan}
          />
        );
      default: {
        const item = ALL_ITEMS.find((i) => i.id === area);
        return <Placeholder label={item?.label || "Em breve"} />;
      }
    }
  }

  return (
    <PageEnter>
      {isWide ? (
        <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
          <nav style={{ width: 188, flex: "0 0 188px", display: "flex", flexDirection: "column", gap: 2, position: "sticky", top: 0 }}>
            {NAV.map((g) => (
              <div key={g.group}>
                <div style={groupLabelStyle}>{g.group}</div>
                {g.items.map((it) => {
                  const active = area === it.id;
                  return (
                    <button
                      key={it.id}
                      onClick={it.soon ? undefined : () => setArea(it.id)}
                      disabled={it.soon}
                      style={{
                        ...G,
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 9,
                        border: "none",
                        cursor: it.soon ? "default" : "pointer",
                        textAlign: "left",
                        fontSize: 13,
                        background: active ? T.ink : "transparent",
                        color: active ? "#fff" : it.soon ? T.inkGhost : T.inkMid,
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {it.label}
                      {it.soon ? <span style={{ marginLeft: "auto", fontSize: 9, color: T.inkGhost }}>em breve</span> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div style={{ flex: 1, minWidth: 0 }}>{renderArea()}</div>
        </div>
      ) : (
        <div>
          <div style={{ ...G, fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: T.inkLight, marginBottom: 8 }}>
            Planejamento
          </div>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            aria-label="Seção do planejamento"
            style={{ ...G, width: "100%", fontSize: 14, fontWeight: 600, color: T.ink, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 11, padding: "11px 14px", outline: "none", boxSizing: "border-box" }}
          >
            {NAV.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((it) => (
                  <option key={it.id} value={it.id} disabled={it.soon}>
                    {it.label}{it.soon ? " · em breve" : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div style={{ marginTop: 16 }}>{renderArea()}</div>
        </div>
      )}
    </PageEnter>
  );
}
