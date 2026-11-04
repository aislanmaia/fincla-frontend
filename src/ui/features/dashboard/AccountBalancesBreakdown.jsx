import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { useAccountsData } from "../accounts/useAccountsData.js";
import { accountMeta, consolidationReceipt, formatMoney } from "../accounts/accountMeta.js";
import { accountsFreshnessLabel } from "../accounts/accountsFreshness.js";

/**
 * "Saldo em conta" da Visão Geral → saldo POR CONTA.
 *
 * O texto das contas vira o controle: no desktop abre a lista no card; no celular,
 * num sheet de baixo. Os dados são os de Minhas Contas (`useAccountsData`: chave por
 * organização, mantém os valores na releitura, `refreshFailed`, metadados das contas).
 * Buscados em segundo plano ao carregar a Visão Geral (um GET), para o rótulo já
 * nascer com a contagem certa; uma transação gravada só relê com o painel aberto
 * (ou na próxima abertura).
 *
 * Todos os componentes ficam no nível do módulo: definidos dentro de outro, seriam
 * remontados a cada render (perde foco, reinicia animação).
 */

const SHEET_SLIDE_MS = 380;
const SHEET_EASE = "cubic-bezier(0.32,0.72,0,1)";

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

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Rótulo do controle, sempre a partir da lista POR CONTA: "em N contas", com N =
 * contas que entram no total (decisão do Owner: as de fora são explicadas dentro do
 * painel, não no card). O resumo só sabe o total de contas da organização (inclui as
 * fora do total), então antes da lista chegar o rótulo não afirma número: "ver contas".
 */
export function accountsControlLabel(accounts) {
  if (Array.isArray(accounts) && accounts.length > 0) {
    const included = accounts.filter((a) => a.include_in_total).length;
    return `em ${plural(included, "conta", "contas")}`;
  }
  return "ver contas";
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

/** Lista por conta + total (ou total por moeda) + recibo da conversão. `data` = `useAccountsData`. */
export function AccountBalancesList({ data }) {
  if (!data.hasLoaded) {
    return <div style={{ ...G, fontSize: 12.5, color: T.inkLight, padding: "6px 0" }}>Carregando contas…</div>;
  }
  if (data.error && !data.refreshFailed && (data.accounts || []).length === 0) {
    return <div style={{ ...G, fontSize: 12.5, color: T.red, padding: "6px 0" }}>Não foi possível carregar os saldos por conta.</div>;
  }
  const accounts = data.accounts || [];
  const included = accounts.filter((a) => a.include_in_total);
  const excluded = accounts.filter((a) => !a.include_in_total);
  const base = data.consolidation?.target_currency;
  const currencies = new Set(included.map((a) => a.currency).filter(Boolean));
  const consolidated = typeof data.total === "number" && !data.consolidation?.unavailable;
  const multiCurrency = currencies.size > 1 || (base && [...currencies].some((c) => c !== base));
  const receipt = multiCurrency ? consolidationReceipt(data.consolidation) : null;
  const freshness = accountsFreshnessLabel(data, true);
  return (
    <div data-testid="account-balances-list" style={{ ...G }}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {included.map((a) => <AccountRow key={a.account_id ?? a.id} account={a} />)}
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
            Não entram no saldo disponível
          </div>
          <div style={{ fontSize: 11.5, color: T.inkLight, marginTop: 3, lineHeight: 1.45 }}>
            Investimentos e contas que você marcou para não somar. Mude em Minhas Contas.
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {excluded.map((a) => <AccountRow key={a.account_id ?? a.id} account={a} muted />)}
          </ul>
        </div>
      ) : null}
      {freshness && freshness !== "atualizado agora" ? (
        <div data-testid="account-balances-freshness" style={{ fontSize: 11, color: data.refreshFailed ? T.amber : T.inkGhost, marginTop: 8 }}>
          {freshness}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Sheet de baixo do celular, PORTALIZADO no `body`: dentro do card ele herdaria o
 * `transform` da animação de entrada da grade (que vira o bloco de contenção de
 * `position: fixed`) e ficaria preso ao card, por baixo dos KPIs.
 *
 * Fecha por arrasto, fundo, Esc ou ✕. A saída anima e o desmontar vem por TIMER —
 * nunca por `onAnimationEnd`, que não é garantido e deixaria a camada presa.
 */
export function AccountBalancesSheet({ onClose, children }) {
  const [closing, setClosing] = useState(null); // null | "animated" | "dragged"
  const closingRef = useRef(false);
  const timerRef = useRef(null);
  const sheetRef = useRef(null);
  const listenersCleanupRef = useRef(null);
  const finishAfter = useCallback((ms) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(onClose, ms);
  }, [onClose]);
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing("animated");
    finishAfter(SHEET_SLIDE_MS);
  }, [finishAfter]);
  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    listenersCleanupRef.current?.();
  }, []);
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
    listenersCleanupRef.current?.();
    const startY = event.touches[0].clientY;
    let delta = 0;
    el.style.transition = "none";
    const cleanup = () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
      listenersCleanupRef.current = null;
    };
    const snapBack = () => {
      el.style.transition = `transform 0.3s ${SHEET_EASE}`;
      el.style.transform = "translateY(0)";
    };
    function onMove(move) {
      delta = Math.max(0, move.touches[0].clientY - startY);
      el.style.transform = `translateY(${delta}px)`;
    }
    function onEnd() {
      cleanup();
      if (delta > 80) {
        // Fecha A PARTIR de onde o dedo soltou: transição no próprio elemento, sem a
        // animação CSS `sheetDown` (que recomeçaria em 0 e daria um salto para cima).
        closingRef.current = true;
        setClosing("dragged");
        el.style.transition = `transform ${SHEET_SLIDE_MS}ms ${SHEET_EASE}`;
        el.style.transform = "translateY(105%)";
        finishAfter(SHEET_SLIDE_MS);
      } else snapBack();
    }
    // O sistema tomou o gesto (chamada, rolagem nativa): volta ao lugar, não fecha.
    function onCancel() {
      cleanup();
      snapBack();
    }
    listenersCleanupRef.current = cleanup;
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onCancel);
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div data-testid="account-balances-backdrop" aria-hidden="true" onClick={requestClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", animation: closing ? `backdropOut ${SHEET_SLIDE_MS}ms ease-in both` : "backdropIn 0.22s ease-out both" }} />
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Saldo por conta" data-closing={closing ?? ""}
        style={{ position: "relative", background: T.surface, borderRadius: "24px 24px 0 0", maxHeight: "85dvh", display: "flex", flexDirection: "column",
          animation: closing === "animated" ? `sheetDown ${SHEET_SLIDE_MS}ms ${SHEET_EASE} both` : closing ? "none" : `sheetUp 0.5s ${SHEET_EASE} backwards`,
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
    </div>,
    document.body,
  );
}

/**
 * A linha "dinheiro disponível hoje · em N contas" do card, com as contas como
 * controle. `accountCount` é o total do resumo (rótulo antes da primeira leitura).
 * `inlineContainer`: no desktop, onde a lista expande (abaixo da linha do card, para
 * não empurrar o "Resultado do período"); sem ele, logo abaixo do texto.
 */
export function AccountBalancesNote({ prefix, accountCount, isMobile = false, organizationId, refreshKey = 0, as = "div", inlineContainer = null }) {
  const [open, setOpen] = useState(false);
  // O token de transação só chega ao hook enquanto o painel está aberto; fechado, a
  // releitura espera a próxima abertura.
  const [refreshKeySeen, setRefreshKeySeen] = useState(refreshKey);
  useEffect(() => {
    if (open) setRefreshKeySeen(refreshKey);
  }, [open, refreshKey]);
  useEffect(() => {
    setOpen(false);
  }, [organizationId]);
  // Pré-busca: o rótulo precisa da contagem POR CONTA desde o primeiro render.
  // `useAccountsData` chaveia por organização, então trocar de org recomeça do zero.
  const enabled = !!organizationId;
  const data = useAccountsData({ organizationId, enabled, refreshKey: refreshKeySeen });
  const hasAccounts = (accountCount ?? 0) > 0 || (data.accounts || []).length > 0;
  const toggle = () => setOpen((v) => !v);
  const Wrapper = as;
  const label = accountsControlLabel(data.hasLoaded ? data.accounts : null);
  if (!hasAccounts) return <Wrapper style={{ ...G, fontSize: 12, color: T.inkMid }}>{prefix}</Wrapper>;
  const panel = (
    <div data-testid="account-balances-inline" style={{ marginTop: 8, padding: "6px 12px 10px", border: `1px solid ${T.border}`, borderRadius: 12, background: T.surface, maxWidth: 420 }}>
      <AccountBalancesList data={data} />
    </div>
  );
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
      {!isMobile && open ? (inlineContainer ? createPortal(panel, inlineContainer) : panel) : null}
      {/* Camada guardada pelo estado ABERTO; a saída anima dentro do sheet e o
          desmontar vem por timer. */}
      {isMobile && open ? (
        <AccountBalancesSheet onClose={() => setOpen(false)}>
          <AccountBalancesList data={data} />
        </AccountBalancesSheet>
      ) : null}
    </>
  );
}
