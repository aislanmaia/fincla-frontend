import React, { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { getOrgBalances } from "../../../api/balances";
import { accountMeta, consolidationReceipt, formatMoney } from "../accounts/accountMeta.js";

/**
 * "Saldo em conta" da Visão Geral → saldo POR CONTA.
 *
 * O texto "em N contas" vira o controle: no desktop abre a lista dentro do próprio
 * card; no celular, num sheet de baixo. Os dados são `GET /v1/balances` (o mesmo de
 * Minhas Contas), buscados só na primeira abertura e relidos a cada transação
 * gravada (`refreshKey`) — sem apagar a lista da tela durante a releitura.
 *
 * Todos os componentes ficam no nível do módulo: definidos dentro de outro, seriam
 * remontados a cada render (perde foco, reinicia animação).
 */

const SHEET_SLIDE_MS = 380;

/** Saldos por conta, sob demanda. `enabled` liga na primeira abertura e não desliga mais. */
export function useAccountBalancesBreakdown({ organizationId, enabled, refreshKey = 0 }) {
  const [state, setState] = useState({ status: "idle", data: null });
  useEffect(() => {
    if (!enabled || !organizationId) return undefined;
    let cancelled = false;
    // Mantém o que já está na tela enquanto relê (#270): só o status muda.
    setState((cur) => ({ status: cur.data ? "refreshing" : "loading", data: cur.data }));
    getOrgBalances(organizationId)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState((cur) => ({ status: "error", data: cur.data }));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, organizationId, refreshKey]);
  return state;
}

/** Soma em centavos inteiros por moeda — o "por moeda" quando não há consolidação. */
function totalsByCurrency(accounts) {
  const cents = new Map();
  for (const a of accounts) {
    if (typeof a.balance !== "number") continue;
    const code = a.currency || "BRL";
    cents.set(code, (cents.get(code) ?? 0) + Math.round(a.balance * 100));
  }
  return [...cents.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([currency, c]) => ({ currency, amount: c / 100 }));
}

function AccountRow({ account, muted }) {
  const meta = accountMeta(account.type);
  return (
    <li data-testid="account-balance-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0" }}>
      <span aria-hidden style={{ width: 30, height: 30, flex: "0 0 30px", borderRadius: 9, display: "grid", placeItems: "center", fontSize: 15, background: meta.tint, opacity: muted ? 0.6 : 1 }}>
        {account.icon_key || meta.emoji}
      </span>
      <span style={{ ...G, flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: muted ? T.inkLight : T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {account.name}
      </span>
      <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: muted ? T.inkLight : (account.balance < 0 ? T.red : T.ink) }}>
        {/* Na moeda DA CONTA: uma conta em dólar não vira "R$". */}
        {formatMoney(account.balance, account.currency) ?? "—"}
      </span>
    </li>
  );
}

/** Lista por conta + total (ou total por moeda) + recibo da conversão. */
export function AccountBalancesList({ state }) {
  const { status, data } = state;
  if (!data) {
    return (
      <div style={{ ...G, fontSize: 12.5, color: status === "error" ? T.red : T.inkLight, padding: "6px 0" }}>
        {status === "error" ? "Não foi possível carregar os saldos por conta." : "Carregando contas…"}
      </div>
    );
  }
  const accounts = data.accounts || [];
  const included = accounts.filter((a) => a.include_in_total);
  const excluded = accounts.filter((a) => !a.include_in_total);
  const base = data.consolidation?.target_currency;
  const currencies = new Set(included.map((a) => a.currency).filter(Boolean));
  const consolidated = typeof data.total === "number" && !data.consolidation?.unavailable;
  const receipt = currencies.size > 1 || (base && [...currencies].some((c) => c !== base))
    ? consolidationReceipt(data.consolidation)
    : null;
  return (
    <div data-testid="account-balances-list" style={{ ...G }}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {included.map((a) => <AccountRow key={a.account_id} account={a} />)}
      </ul>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, borderTop: `1px solid ${T.border}`, paddingTop: 9, marginTop: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</span>
        {consolidated ? (
          <span data-testid="account-balances-total" style={{ ...NUM, fontSize: 14, fontWeight: 800, color: T.ink }}>
            {formatMoney(data.total, base) ?? "—"}
          </span>
        ) : (
          // Sem cotação: o total por moeda — nunca um "R$ 0,00" que afirmaria que a
          // pessoa não tem dinheiro, quando quem não conseguiu somar fomos nós.
          <span data-testid="account-balances-by-currency" style={{ ...NUM, fontSize: 13, fontWeight: 700, color: T.ink, textAlign: "right" }}>
            {totalsByCurrency(included).map((t) => formatMoney(t.amount, t.currency)).join(" + ") || "—"}
          </span>
        )}
      </div>
      {!consolidated ? (
        <div style={{ fontSize: 11.5, color: T.amber, marginTop: 6, lineHeight: 1.45 }}>
          Não deu para somar as moedas agora — os saldos por conta acima estão certos.
        </div>
      ) : receipt ? (
        <div data-testid="account-balances-receipt" style={{ fontSize: 11.5, color: T.inkGhost, marginTop: 6, lineHeight: 1.45 }}>{receipt}</div>
      ) : null}
      {excluded.length > 0 ? (
        <div data-testid="account-balances-excluded" style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.inkGhost, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Fora do saldo disponível
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {excluded.map((a) => <AccountRow key={a.account_id} account={a} muted />)}
          </ul>
        </div>
      ) : null}
      {status === "refreshing" ? <div style={{ fontSize: 11, color: T.inkGhost, marginTop: 6 }}>atualizando…</div> : null}
    </div>
  );
}

/**
 * Sheet de baixo do celular. Fecha por arrasto para baixo, toque no fundo, Esc ou ✕.
 * A saída anima e o desmontar vem por TIMER — nunca por `onAnimationEnd`, que não é
 * garantido (jsdom, movimento reduzido, quadro descartado) e deixaria o sheet preso.
 */
export function AccountBalancesSheet({ onClose, children }) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timerRef = useRef(null);
  const sheetRef = useRef(null);
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timerRef.current = window.setTimeout(onClose, SHEET_SLIDE_MS);
  }, [onClose]);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  const onHandleTouchStart = (event) => {
    const el = sheetRef.current;
    if (!el || closingRef.current) return;
    const startY = event.touches[0].clientY;
    let delta = 0;
    const onMove = (move) => {
      delta = Math.max(0, move.touches[0].clientY - startY);
      el.style.transform = `translateY(${delta}px)`;
    };
    const onEnd = () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      if (delta > 80) requestClose();
      else el.style.transform = "";
    };
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div data-testid="account-balances-backdrop" aria-hidden="true" onClick={requestClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", animation: closing ? `backdropOut ${SHEET_SLIDE_MS}ms ease-in both` : "backdropIn 0.22s ease-out both" }} />
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Saldo por conta"
        style={{ position: "relative", background: T.surface, borderRadius: "24px 24px 0 0", maxHeight: "85dvh", display: "flex", flexDirection: "column",
          animation: closing ? `sheetDown ${SHEET_SLIDE_MS}ms cubic-bezier(0.32,0.72,0,1) both` : "sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) backwards",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.14)" }}>
        <div data-testid="account-balances-handle" onTouchStart={onHandleTouchStart} aria-hidden="true"
          style={{ padding: "12px 0 6px", display: "flex", justifyContent: "center", touchAction: "none", cursor: "grab" }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(0,0,0,0.18)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 18px 10px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink }}>Saldo por conta</div>
          <button type="button" aria-label="Fechar saldo por conta" onClick={requestClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex" }}>
            <X size={18} color={T.inkMid} />
          </button>
        </div>
        <div className="fincla-scroll" style={{ overflowY: "auto", minHeight: 0, flex: 1, padding: "8px 18px", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))", overscrollBehavior: "contain" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * A linha "dinheiro disponível hoje · em N contas" do card, com "N contas" como
 * controle. `prefix` e `label` vêm do cálculo do card (o número não muda aqui).
 */
export function AccountBalancesNote({ prefix, label, isMobile = false, organizationId, refreshKey = 0, as = "div" }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const state = useAccountBalancesBreakdown({ organizationId, enabled: everOpened, refreshKey });
  const toggle = () => {
    setEverOpened(true);
    setOpen((v) => !v);
  };
  const Wrapper = as;
  if (!label) return <Wrapper style={{ ...G, fontSize: 12, color: T.inkMid }}>{prefix}</Wrapper>;
  return (
    <>
      <Wrapper style={{ ...G, fontSize: 12, color: T.inkMid }}>
        {prefix}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isMobile ? undefined : open}
          aria-haspopup={isMobile ? "dialog" : undefined}
          style={{ ...G, fontSize: 12, color: T.inkMid, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}
        >
          {label}
        </button>
      </Wrapper>
      {!isMobile && open ? (
        <div data-testid="account-balances-inline" style={{ marginTop: 8, padding: "6px 12px 10px", border: `1px solid ${T.border}`, borderRadius: 12, background: T.surface, minWidth: 260 }}>
          <AccountBalancesList state={state} />
        </div>
      ) : null}
      {/* Camada guardada pelo estado ABERTO; a saída anima dentro do sheet e o
          desmontar vem por timer. */}
      {isMobile && open ? (
        <AccountBalancesSheet onClose={() => setOpen(false)}>
          <AccountBalancesList state={state} />
        </AccountBalancesSheet>
      ) : null}
    </>
  );
}
