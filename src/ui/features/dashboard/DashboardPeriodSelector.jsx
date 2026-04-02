import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Check, ChevronDown, X } from "lucide-react";
import { T } from "../../tokens";
import { G } from "../../typography";
import { LocaleDatePicker } from "../../components/LocaleDatePicker.jsx";
import { APP_UI_LOCALE } from "../../appLocale.js";
import { todayLocalYmd } from "../../data/transactionsAdapter.js";
import {
  DASHBOARD_PERIOD_PRESETS,
  formatDashboardRangeBadge,
  normalizeCustomRange,
  rangeForDashboardPreset,
} from "./dashboardDateRange.js";

const PRESET_LIST = DASHBOARD_PERIOD_PRESETS.filter((p) => p.id !== "personalizado");

function resolvePresetTitle(presetId, isMobile) {
  if (presetId === "personalizado") {
    return isMobile ? "Personalizado" : "Período personalizado";
  }
  const row = PRESET_LIST.find((p) => p.id === presetId);
  if (!row) return "Período";
  return isMobile ? row.short : row.label;
}

/**
 * Gatilho único + menu com abas Predefinido | Personalizado.
 */
export function DashboardPeriodSelector({
  isMobile,
  presetId,
  onPresetChange,
  customStart,
  customEnd,
  onCustomDatesChange,
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [menuTab, setMenuTab] = useState("predefinido");
  const wrapRef = useRef(null);
  const panelRootRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 300 });

  const applied =
    presetId === "personalizado"
      ? normalizeCustomRange(customStart, customEnd) ??
        rangeForDashboardPreset("este_mes")
      : rangeForDashboardPreset(presetId);

  const rangeBadge = formatDashboardRangeBadge(applied.start, applied.end);
  const maxYmd = todayLocalYmd();
  const titleLine = resolvePresetTitle(presetId, isMobile);

  useEffect(() => {
    if (!panelOpen) return;
    setMenuTab(presetId === "personalizado" ? "personalizado" : "predefinido");
  }, [panelOpen, presetId]);

  const updatePopoverPos = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.min(340, Math.max(292, r.width));
    let left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
    let top = r.bottom + 10;
    const estH = menuTab === "personalizado" ? 520 : 420;
    if (top + estH > window.innerHeight - 12) {
      top = Math.max(12, r.top - estH - 10);
    }
    setPopoverPos({ top, left, width: w });
  }, [menuTab]);

  useLayoutEffect(() => {
    if (!panelOpen || isMobile) return;
    updatePopoverPos();
  }, [panelOpen, isMobile, updatePopoverPos]);

  useEffect(() => {
    if (!panelOpen) return;
    const fn = () => {
      if (!isMobile) updatePopoverPos();
    };
    window.addEventListener("resize", fn);
    window.addEventListener("scroll", fn, true);
    return () => {
      window.removeEventListener("resize", fn);
      window.removeEventListener("scroll", fn, true);
    };
  }, [panelOpen, isMobile, updatePopoverPos]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    const onDoc = (e) => {
      const t = e.target;
      if (t && typeof t.closest === "function") {
        if (t.closest("[data-fincla-locale-calendar-popover]")) return;
      }
      if (wrapRef.current?.contains(e.target)) return;
      if (panelRootRef.current?.contains(e.target)) return;
      setPanelOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [panelOpen]);

  const applyPreset = (id) => {
    onPresetChange(id);
    const r = rangeForDashboardPreset(id);
    onCustomDatesChange({ start: r.start, end: r.end });
    setPanelOpen(false);
  };

  const rowMinH = isMobile ? 46 : 38;
  const touchPad = isMobile ? "12px 14px" : "8px 12px";

  const presetRows = PRESET_LIST.map((p) => {
    const selected = presetId === p.id;
    return (
      <button
        key={p.id}
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        onClick={() => applyPreset(p.id)}
        style={{
          ...G,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          minHeight: rowMinH,
          padding: touchPad,
          margin: 0,
          border: "none",
          borderRadius: isMobile ? 10 : 8,
          background: selected ? T.blueLight : "transparent",
          color: selected ? T.blue : T.ink,
          fontSize: isMobile ? 15 : 14,
          fontWeight: selected ? 600 : 500,
          cursor: "pointer",
          textAlign: "left",
          WebkitTapHighlightColor: "transparent",
          transition: "background 0.15s ease, color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.background = T.surfaceHov;
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={{ flex: 1, lineHeight: 1.35 }}>{p.label}</span>
        {selected ? (
          <Check size={isMobile ? 18 : 16} strokeWidth={2.5} color={T.blue} style={{ flexShrink: 0 }} />
        ) : (
          <span style={{ width: isMobile ? 18 : 16, flexShrink: 0 }} aria-hidden />
        )}
      </button>
    );
  });

  const tabIds = {
    predefinido: "dash-period-tab-predefinido",
    personalizado: "dash-period-tab-personalizado",
  };
  const panelIds = {
    predefinido: "dash-period-panel-predefinido",
    personalizado: "dash-period-panel-personalizado",
  };

  const segmentedControl = (
    <div
      role="tablist"
      aria-label="Tipo de período"
      style={{
        display: "flex",
        background: T.grayLight,
        borderRadius: isMobile ? 12 : 10,
        padding: 3,
        margin: isMobile ? "0 14px 14px" : "0 12px 12px",
        gap: 3,
      }}
    >
      {[
        { id: "predefinido", label: "Predefinido" },
        { id: "personalizado", label: "Personalizado" },
      ].map(({ id, label }) => {
        const active = menuTab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={tabIds[id]}
            aria-selected={active}
            aria-controls={panelIds[id]}
            tabIndex={active ? 0 : -1}
            onClick={() => setMenuTab(id)}
            style={{
              ...G,
              flex: 1,
              border: "none",
              borderRadius: isMobile ? 9 : 8,
              padding: isMobile ? "10px 12px" : "8px 10px",
              fontSize: isMobile ? 14 : 13,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              background: active ? T.surface : "transparent",
              color: active ? T.ink : T.inkLight,
              boxShadow: active ? T.sm : "none",
              transition: "background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  const predefinidoPanel = (
    <div
      id={panelIds.predefinido}
      role="tabpanel"
      aria-labelledby={tabIds.predefinido}
      hidden={menuTab !== "predefinido"}
      style={{
        display: menuTab === "predefinido" ? "flex" : "none",
        flexDirection: "column",
        padding: isMobile ? "0 10px 8px" : "0 8px 10px",
        overflowY: "auto",
        maxHeight: isMobile ? "42vh" : 320,
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          ...G,
          fontSize: 11,
          fontWeight: 700,
          color: T.inkLight,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 8,
          paddingLeft: 4,
        }}
      >
        Períodos prontos
      </div>
      <div role="menu" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {presetRows}
      </div>
    </div>
  );

  const personalizadoPanel = (
    <div
      id={panelIds.personalizado}
      role="tabpanel"
      aria-labelledby={tabIds.personalizado}
      hidden={menuTab !== "personalizado"}
      style={{
        display: menuTab === "personalizado" ? "flex" : "none",
        flexDirection: "column",
        gap: isMobile ? 12 : 10,
        padding: isMobile ? "0 14px 12px" : "0 12px 12px",
        overflowY: "auto",
        overflowX: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <p
        style={{
          ...G,
          fontSize: isMobile ? 13 : 12,
          color: T.inkMid,
          lineHeight: 1.5,
          margin: "0 0 4px 0",
          paddingLeft: 2,
        }}
      >
        Defina o primeiro e o último dia. KPIs, ritmo e categorias usam esse intervalo.
      </p>
      <div>
        <div
          style={{
            ...G,
            fontSize: 12,
            fontWeight: 600,
            color: T.inkMid,
            marginBottom: 6,
          }}
        >
          Data inicial
        </div>
        <LocaleDatePicker
          value={customStart}
          onChange={(ymd) => {
            onPresetChange("personalizado");
            onCustomDatesChange({ start: ymd, end: customEnd });
          }}
          min="2000-01-01"
          max={customEnd <= maxYmd ? customEnd : maxYmd}
          locale={APP_UI_LOCALE}
          variant={isMobile ? "mobile" : "desktop"}
          popoverMode="expand"
        />
      </div>
      <div>
        <div
          style={{
            ...G,
            fontSize: 12,
            fontWeight: 600,
            color: T.inkMid,
            marginBottom: 6,
          }}
        >
          Data final
        </div>
        <LocaleDatePicker
          value={customEnd}
          onChange={(ymd) => {
            onPresetChange("personalizado");
            onCustomDatesChange({ start: customStart, end: ymd });
          }}
          min={customStart}
          max={maxYmd}
          locale={APP_UI_LOCALE}
          variant={isMobile ? "mobile" : "desktop"}
          popoverMode="expand"
        />
      </div>
    </div>
  );

  const panelContent = (
    <div
      ref={panelRootRef}
      style={
        isMobile
          ? {
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9600,
              maxHeight: "min(90vh, 720px)",
              display: "flex",
              flexDirection: "column",
              background: T.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              boxShadow: "0 -8px 40px rgba(15,15,13,0.18)",
              paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
              overflow: "hidden",
            }
          : {
              position: "fixed",
              top: popoverPos.top,
              left: popoverPos.left,
              width: popoverPos.width,
              zIndex: 9600,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              boxShadow: T.lg,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              maxHeight:
                menuTab === "personalizado" ? "min(92vh, 720px)" : "min(85vh, 480px)",
            }
      }
    >
      {isMobile ? (
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 99,
            background: T.border,
            margin: "10px auto 8px",
            flexShrink: 0,
          }}
          aria-hidden
        />
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          padding: isMobile ? "4px 14px 8px 16px" : "10px 12px 6px 14px",
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>
          <div
            style={{
              ...G,
              fontSize: isMobile ? 17 : 15,
              fontWeight: 700,
              color: T.ink,
              letterSpacing: "-0.02em",
            }}
          >
            Período
          </div>
          <div
            style={{
              ...G,
              fontSize: isMobile ? 13 : 12,
              color: T.inkLight,
              marginTop: 2,
              lineHeight: 1.35,
            }}
          >
            {rangeBadge}
          </div>
        </div>
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => setPanelOpen(false)}
          style={{
            flexShrink: 0,
            background: T.grayLight,
            border: "none",
            cursor: "pointer",
            padding: 7,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <X size={14} color={T.inkMid} strokeWidth={2} />
        </button>
      </div>

      {segmentedControl}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {predefinidoPanel}
        {personalizadoPanel}
      </div>

      {isMobile ? (
        <div style={{ padding: "10px 16px 0", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            style={{
              ...G,
              width: "100%",
              minHeight: 48,
              borderRadius: 14,
              border: "none",
              background: T.ink,
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Concluir
          </button>
        </div>
      ) : null}
    </div>
  );

  const overlay = panelOpen
    ? createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9450,
            background: isMobile ? "rgba(15,15,13,0.45)" : "rgba(15,15,13,0.12)",
            backdropFilter: isMobile ? "blur(2px)" : "none",
          }}
          aria-hidden
          onClick={() => setPanelOpen(false)}
        />,
        document.body,
      )
    : null;

  const floatingPanel = panelOpen ? createPortal(panelContent, document.body) : null;

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width: isMobile ? "100%" : "auto",
        maxWidth: isMobile ? "100%" : 340,
      }}
    >
      <button
        type="button"
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        onClick={() => setPanelOpen((o) => !o)}
        style={{
          ...G,
          width: isMobile ? "100%" : "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          minHeight: isMobile ? 52 : 46,
          padding: isMobile ? "12px 14px" : "10px 14px",
          borderRadius: isMobile ? 14 : 12,
          border: `1px solid ${T.border}`,
          background: T.surface,
          boxShadow: T.sm,
          cursor: "pointer",
          textAlign: "left",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          WebkitTapHighlightColor: "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = T.borderHov;
          e.currentTarget.style.boxShadow = T.md;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = T.border;
          e.currentTarget.style.boxShadow = T.sm;
        }}
      >
        <div
          style={{
            width: isMobile ? 40 : 36,
            height: isMobile ? 40 : 36,
            borderRadius: 10,
            background: T.grayLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Calendar size={isMobile ? 20 : 18} color={T.inkMid} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              ...G,
              fontSize: isMobile ? 15 : 14,
              fontWeight: 600,
              color: T.ink,
              lineHeight: 1.25,
            }}
          >
            {titleLine}
          </div>
          <div
            style={{
              ...G,
              fontSize: isMobile ? 13 : 12,
              color: T.inkLight,
              marginTop: 2,
              lineHeight: 1.3,
            }}
          >
            {rangeBadge}
          </div>
        </div>
        <ChevronDown
          size={isMobile ? 22 : 20}
          color={T.inkGhost}
          strokeWidth={2}
          style={{
            flexShrink: 0,
            transform: panelOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        />
      </button>
      {overlay}
      {floatingPanel}
    </div>
  );
}
