import React from "react";
import { createPortal } from "react-dom";

import { T } from "../../tokens";
import { G } from "../../typography";
import { HealthRing, Icon, RiskBadge, RiskDot } from "./consultantUi";

/**
 * Anel de saúde interativo: hover/clique abre um popover com a idade do score e
 * a ação de recalcular.
 *
 * Por que existe: `health` é o snapshot canônico (`financial_health_scores`), e
 * ele é **mensal**. Um número de dois meses atrás continua útil, mas o consultor
 * precisa saber a idade dele antes de agir. E quando o score ainda não existe
 * (`health == null`), o consultor precisa de uma saída explícita — em vez de
 * recarregar a Carteira até o preenchimento automático do backend alcançar
 * aquele cliente.
 *
 * Porte do `HealthScoreControl` da referência canônica de design (projeto
 * DesignSync `116d951e-de37-47f8-9ea2-45b8a9fb5afb`, `consultor/cons-ui.jsx`).
 */

/** Snapshot com mais de 30 dias merece aviso: pode não refletir o mês corrente. */
const STALE_AFTER_DAYS = 30;

const HOVER_OPEN_MS = 130;
const HOVER_CLOSE_MS = 240;

/**
 * `new Date("2026-05-30")` é lido como UTC meia-noite; em BRT (UTC-3) isso volta
 * um dia e a tela mostra 29/05. Datas sem hora precisam ser LOCAIS. Só ISO com
 * hora vai pelo parser nativo.
 */
export function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtScoreDate(value) {
  const d = parseLocalDate(value);
  return d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
}

export function fmtScoreAge(value, now = new Date()) {
  const d = parseLocalDate(value);
  if (!d) return null;
  const days = Math.floor((now - d) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < STALE_AFTER_DAYS) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

export function isStaleScore(value, now = new Date()) {
  const d = parseLocalDate(value);
  if (!d) return false;
  return (now - d) / 86400000 > STALE_AFTER_DAYS;
}

const GAP = 9;
const BRIDGE = 11;

/**
 * Popover em **portal** com posição fixa, ancorado num elemento.
 *
 * Portal porque a tabela da carteira vive num `Card` com `overflowX: auto` e o
 * grid de cards tem containers próprios: um popover `position: absolute`
 * apareceria **recortado**. Fixed + portal escapa de qualquer `overflow`.
 *
 * Vira para cima quando não há espaço abaixo (cards da última linha nasciam fora
 * da viewport), e se ajeita horizontalmente para não sangrar pela direita.
 */
export function Popover({ open, onClose, anchorRef, children, width = 272, align = "right" }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState(null);

  React.useLayoutEffect(() => {
    if (!open || !anchorRef?.current) {
      setPos(null);
      return undefined;
    }
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const height = ref.current?.getBoundingClientRect().height ?? 0;
      if (!a) return;
      const flip = a.bottom + GAP + height > window.innerHeight - 8 && a.top - GAP - height > 8;
      const top = flip ? a.top - GAP - height : a.bottom + GAP;
      const rawLeft = align === "right" ? a.right - width : a.left;
      const left = Math.max(8, Math.min(rawLeft, window.innerWidth - width - 8));
      setPos({ top, left, flip });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, align, width]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        visibility: pos ? "visible" : "hidden",
        zIndex: 60,
        width,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        boxShadow: T.lg,
        padding: 14,
        textAlign: "left",
        cursor: "default",
        animation: "popIn 0.14s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Ponte invisível sobre o vão de 9px: sem ela o mouse "sai" do popover ao
          viajar do anel até o botão, e ele fecharia no meio do caminho. */}
      <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, height: BRIDGE, [pos?.flip ? "bottom" : "top"]: -BRIDGE }} />
      {children}
    </div>,
    document.body,
  );
}

/** Hover só em ponteiro fino: em touch, o toque É o clique. */
function useFinePointer() {
  const [fine, setFine] = React.useState(true);
  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setFine(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return fine;
}

export function HealthScorePopover({ health, computedAt, busy, error, onRecompute }) {
  const empty = health == null;
  const stale = isStaleScore(computedAt);
  const when = fmtScoreDate(computedAt);
  const age = fmtScoreAge(computedAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <HealthRing health={health} size={44} stroke={4.5} />
        <div style={{ minWidth: 0 }}>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Saúde financeira
          </div>
          <div style={{ marginTop: 3 }}><RiskBadge health={health} /></div>
        </div>
      </div>

      <div style={{ ...G, fontSize: 11.5, color: T.inkLight, lineHeight: 1.45 }}>
        {empty
          ? "Este cliente ainda não teve a saúde financeira calculada."
          : "Considera sobra mensal, reserva de emergência, comprometimento de renda e progresso das metas."}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
        <Icon name="clock" size={12} color={stale ? T.amber : T.inkGhost} />
        <span style={{ ...G, fontSize: 11, color: stale ? T.amber : T.inkLight, fontWeight: stale ? 700 : 500 }}>
          {empty ? "Nunca calculado" : `Calculado em ${when} · ${age}`}
        </span>
      </div>

      {stale && !empty && (
        <div style={{ ...G, fontSize: 10.5, color: T.amber, background: T.amberLight, borderRadius: 8, padding: "6px 8px", lineHeight: 1.4 }}>
          Este score é de um mês anterior e pode não refletir a situação atual.
        </div>
      )}

      {error && (
        <div role="alert" style={{ ...G, fontSize: 10.5, color: T.red, background: T.redLight, borderRadius: 8, padding: "6px 8px", lineHeight: 1.4 }}>
          Não foi possível recalcular agora. Tente novamente.
        </div>
      )}

      <button
        type="button"
        onClick={onRecompute}
        disabled={busy}
        style={{
          ...G,
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "6px 11px", borderRadius: 9,
          border: `1px solid ${empty || stale ? T.ink : T.border}`,
          background: empty || stale ? T.ink : T.surface,
          color: empty || stale ? "#fff" : T.inkMid,
          fontSize: 12, fontWeight: 700, width: "100%",
          cursor: busy ? "progress" : "pointer",
          opacity: busy ? 0.65 : 1,
        }}
      >
        <Icon
          name="refresh"
          size={12}
          color={empty || stale ? "#fff" : T.inkMid}
          style={busy ? { animation: "spin 0.9s linear infinite" } : undefined}
        />
        {busy ? "Calculando…" : empty ? "Calcular agora" : "Recalcular agora"}
      </button>
    </div>
  );
}

/**
 * Anel + popover. `stopPropagation` impede que o clique suba para o `onClick` do
 * card/linha ("abrir cliente"). Hover abre; clique **fixa** (senão o popover
 * fecharia no caminho até o botão). Nunca fecha durante um recálculo.
 */
export function HealthScoreControl({
  health,
  computedAt,
  size = 44,
  stroke = 4.5,
  compact = false,
  align = "right",
  onRecompute,
}) {
  const [open, setOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);
  const finePointer = useFinePointer();
  const anchorRef = React.useRef(null);
  const timer = React.useRef(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  React.useEffect(() => clearTimer, []);

  const close = React.useCallback(() => {
    clearTimer();
    setOpen(false);
    setPinned(false);
  }, []);

  const onEnter = () => {
    if (!finePointer) return;
    clearTimer();
    timer.current = setTimeout(() => setOpen(true), HOVER_OPEN_MS);
  };

  const onLeave = () => {
    if (!finePointer || pinned || busy) return;
    clearTimer();
    timer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
  };

  const onToggleClick = () => {
    clearTimer();
    if (open && pinned) {
      setOpen(false);
      setPinned(false);
      return;
    }
    setOpen(true);
    setPinned(true);
  };

  const recompute = async () => {
    setBusy(true);
    setError(false);
    try {
      await onRecompute?.();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const label = health == null ? "Score não calculado. Abrir detalhes." : `Saúde ${Math.round(health)} de 100. Abrir detalhes.`;

  return (
    <div
      ref={anchorRef}
      style={{ position: "relative", flexShrink: 0 }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        onClick={onToggleClick}
        // Só foco por TECLADO abre (e fixa): sem o pin não haveria como fechar,
        // já que o fechamento por hover depende do mouse. Um `onFocus` cru abriria
        // no clique também — e aí o próprio clique, logo em seguida, fecharia.
        onFocus={(e) => {
          let keyboard = false;
          try {
            keyboard = e.target.matches(":focus-visible");
          } catch {
            keyboard = false; // jsdom / browsers sem suporte ao seletor
          }
          if (!keyboard) return;
          setOpen(true);
          setPinned(true);
        }}
        aria-expanded={open}
        aria-label={label}
        title="Detalhes da saúde financeira"
        style={{
          border: "none", background: "transparent", padding: 0, cursor: "pointer",
          display: "flex", alignItems: "center", borderRadius: 9999,
          outline: pinned ? `2px solid ${T.blue}` : "none", outlineOffset: 2,
        }}
      >
        {compact ? <RiskDot health={health} size={12} /> : <HealthRing health={health} size={size} stroke={stroke} />}
      </button>

      <Popover open={open} onClose={close} anchorRef={anchorRef} align={align}>
        <HealthScorePopover health={health} computedAt={computedAt} busy={busy} error={error} onRecompute={recompute} />
      </Popover>
    </div>
  );
}
