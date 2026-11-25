// O atalho "Conciliar extrato" da tela de Transações (decisão do Owner de 2026-11-17, telas T1–T4):
// fica na linha que conta as transações e leva à conciliação da conta certa. Todo o trabalho
// acontece na conciliação; aqui só se escolhe para onde ir.
//
// Os dados (rascunhos, "N de 8 passos", última concluída) vêm de `useReconcileShortcutData`, chamado
// no nível da página: o botão muda de lugar e é remontado sem perder nada nem repetir pedidos. Os
// pedidos são acessórios: nenhum bloqueia a lista de transações e nenhum erro quebra a tela — sem os
// rascunhos, o atalho cai no texto básico.
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn } from "../../components/primitives";
import { plural } from "../../plural.js";
import { bankDateLabel } from "./StatementEntryCard.jsx";
import { shortcutTarget } from "./reconcileShortcut.js";

export const MENU_TITLE = "Conciliar o extrato de qual conta?";
const MENU_WIDTH = 340;
const SIDE_GUTTER = 16;

/** Ícone de duas setas (ida e volta): banco × Fincla. */
export function ReconcileIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
      <path d="M4 7h11" />
      <path d="m12 4 3 3-3 3" />
      <path d="M20 17H9" />
      <path d="m12 14-3 3 3 3" />
    </svg>
  );
}

export const stepsLabel = (progress) => `${progress.done.toLocaleString("pt-BR")} de ${plural(progress.total, "passo", "passos")}`;

/**
 * @param data o resultado de `useReconcileShortcutData` (no nível da página).
 * @param accounts contas elegíveis ({ id, label, currency }) — as que aceitam "Importar extrato".
 * @param filteredIds contas do filtro da tela.
 * @param onOpen (accountId, importId|null) → abre a conciliação (o rascunho, quando houver).
 */
export function ReconcileShortcut({ data, accounts, filteredIds, baseCurrency = null, onOpen }) {
  const target = shortcutTarget({ accounts, filteredIds });
  const { draftByAccount, progressOf, loadProgress } = data;

  // Modo direto: só o rascunho da conta de destino (o número aparece no próprio botão).
  const directDraft = target?.kind === "direct" ? draftByAccount?.[target.account.id] ?? null : null;
  useEffect(() => {
    if (directDraft) loadProgress([directDraft]);
  }, [directDraft, loadProgress]);

  // Como o menu abriu: o foco vai para a primeira conta ou (seta para cima) para a última.
  const [open, setOpen] = useState(null);
  const buttonRef = useRef(null);
  const close = useCallback((returnFocus) => {
    setOpen(null);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  if (!target) return null;

  // Encolhe com o espaço (G3 achado 7): o rótulo corta com "…" e nunca empurra a contagem.
  const style = { maxWidth: "100%", minWidth: 0, flex: "0 1 auto" };
  const label = (text) => (
    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{text}</span>
  );

  if (target.kind === "direct") {
    const draft = directDraft;
    if (draft) {
      const progress = progressOf(draft);
      return (
        <Btn small variant="outGray" ref={buttonRef} onClick={() => onOpen(target.account.id, draft.id)}
          style={{ ...style, background: T.blueLight, color: T.blue, borderColor: T.blue }}>
          <ReconcileIcon />
          {label("Continuar conciliação")}
          {progress ? (
            <span style={{ ...NUM, fontSize: 11, fontWeight: 600, color: T.inkMid, background: T.surface,
              borderRadius: 999, padding: "1px 8px", flex: "none" }}>
              {stepsLabel(progress)}
            </span>
          ) : null}
        </Btn>
      );
    }
    return (
      <Btn small variant="outGray" ref={buttonRef} onClick={() => onOpen(target.account.id, null)} style={style}
        title={`Conciliar extrato da ${target.account.label}`}>
        <ReconcileIcon />
        {label(`Conciliar extrato da ${target.account.label}`)}
      </Btn>
    );
  }

  return (
    <>
      <Btn small variant={open ? "dark" : "outGray"} ref={buttonRef} aria-haspopup="menu" aria-expanded={!!open}
        onClick={() => setOpen((v) => (v ? null : "first"))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(e.key === "ArrowDown" ? "first" : "last");
          }
        }}
        style={style}>
        <ReconcileIcon />
        {label("Conciliar extrato…")}
      </Btn>
      {open ? (
        <AccountMenu
          data={data}
          accounts={accounts}
          baseCurrency={baseCurrency}
          initialFocus={open}
          anchor={buttonRef.current}
          onClose={close}
          onChoose={(accountId, importId) => { setOpen(null); onOpen(accountId, importId); }}
        />
      ) : null}
    </>
  );
}

/** A situação de uma conta na escolha (menu do computador, folha do celular). */
export function accountChoiceStatus({ draft, progress, concluded }) {
  if (draft) return progress ? `Conciliação começada · ${stepsLabel(progress)}` : "Conciliação começada";
  if (concluded?.end) return `Última conciliação até ${bankDateLabel(concluded.end)}`;
  if (concluded) return concluded.any ? "Nenhuma conciliação concluída ainda" : "Nenhum extrato importado ainda";
  return null;
}

/** Conta em outra moeda que a base da organização: a moeda vai ao lado do nome. */
export const isForeignAccount = (account, baseCurrency) => !!(baseCurrency && account.currency && account.currency !== baseCurrency);

export const MENU_FOOTER = "Cartões de crédito não aparecem: a fatura não é conciliada por extrato.";

/** Onde o menu fica: logo abaixo do botão, alinhado à direita dele, sem sair da tela. */
function menuPosition(anchor) {
  const vw = window.innerWidth;
  const width = Math.min(MENU_WIDTH, vw - SIDE_GUTTER * 2);
  const rect = anchor?.getBoundingClientRect?.() ?? { right: vw, bottom: 0 };
  const left = Math.min(Math.max(rect.right - width, SIDE_GUTTER), vw - width - SIDE_GUTTER);
  return { left, top: rect.bottom + 6, width };
}

/** Leva o foco ao vizinho do botão na ordem do Tab (o menu, com itens fora da ordem, não conta). */
const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';
function focusBeside(anchor, delta) {
  if (!anchor) return;
  const list = [...document.querySelectorAll(TABBABLE)].filter((el) => el.tabIndex >= 0 && !el.closest("[inert]"));
  const at = list.indexOf(anchor);
  (at < 0 ? anchor : list[at + delta] ?? anchor).focus();
}

/**
 * A escolha da conta (T4): uma linha por conta elegível, com a situação real de cada uma. O que só
 * aparece aqui (o "N de 8 passos" de cada rascunho e a última concluída das contas sem rascunho) é
 * pedido ao abrir, uma vez enquanto a tela está montada.
 *
 * Teclado (padrão de botão de menu do WAI-ARIA): setas/Home/End percorrem, Esc fecha e devolve o foco
 * ao botão, Tab/Shift+Tab fecham e o foco segue do botão para o próximo/anterior. Rolar a página
 * fecha o menu (ele é `position: fixed` e ficaria parado longe do botão).
 */
function AccountMenu({ data, accounts, baseCurrency, initialFocus, anchor, onClose, onChoose }) {
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const footerId = useId();
  const [pos, setPos] = useState(() => menuPosition(anchor));
  const { draftsStatus, draftByAccount, progressOf, concludedOf, loadProgress, loadConcluded } = data;

  // Enquanto os rascunhos não chegam, não se sabe quais contas precisam da lista de extratos.
  const accountsKey = accounts.map((a) => a.id).join("|");
  useEffect(() => {
    if (draftsStatus === "loading") return;
    loadProgress(accounts.map((a) => draftByAccount?.[a.id]).filter(Boolean));
    loadConcluded(accounts.filter((a) => !draftByAccount?.[a.id]).map((a) => a.id));
    // `accountsKey` resume `accounts` (a lista é recriada a cada render da página).
  }, [draftsStatus, draftByAccount, accountsKey, loadProgress, loadConcluded]);

  const menuItems = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];
  useEffect(() => {
    const list = menuItems();
    (initialFocus === "last" ? list.at(-1) : list[0])?.focus();
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target) || anchor?.contains(e.target)) return;
      onClose(false);
    };
    const onResize = () => setPos(menuPosition(anchor));
    // Rolar qualquer coisa fora do menu (a lista, a página) fecha; rolar o próprio menu, não.
    const onScroll = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      onClose(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [anchor, onClose]);

  const onKeyDown = (e) => {
    const list = menuItems();
    const at = list.indexOf(document.activeElement);
    const move = (delta) => {
      e.preventDefault();
      list[(at + delta + list.length) % list.length]?.focus();
    };
    if (e.key === "Escape") {
      e.preventDefault();
      onClose(true);
    } else if (e.key === "Tab") {
      // Não prende o teclado: fecha e o foco segue do BOTÃO para o próximo (ou anterior) da página.
      // O menu mora no fim do <body> (portal); deixar o navegador seguir daqui levaria o foco para
      // fora da página.
      e.preventDefault();
      onClose(false);
      focusBeside(anchor, e.shiftKey ? -1 : 1);
    } else if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); list.at(-1)?.focus(); }
  };

  return createPortal(
    <div ref={wrapRef}
      style={{ ...G, position: "fixed", left: pos.left, top: pos.top, width: pos.width, boxSizing: "border-box",
        maxHeight: "70dvh", overflowY: "auto", background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 13, boxShadow: T.xl, padding: 6, zIndex: 150 }}>
      <div ref={menuRef} role="menu" aria-label={MENU_TITLE} aria-describedby={footerId} onKeyDown={onKeyDown}
        style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div aria-hidden="true" style={{ fontSize: 12, fontWeight: 700, color: T.inkMid, padding: "8px 10px 6px" }}>{MENU_TITLE}</div>
        {accounts.map((account) => {
          const draft = draftByAccount?.[account.id] ?? null;
          const progress = progressOf(draft);
          const concluded = concludedOf(account.id);
          const status = accountChoiceStatus({ draft, progress, concluded });
          const foreign = isForeignAccount(account, baseCurrency);
          return (
            <button key={account.id} type="button" role="menuitem" tabIndex={-1}
              onClick={() => onChoose(account.id, draft ? draft.id : null)}
              style={{ ...G, display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9,
                border: "none", textAlign: "left", cursor: "pointer", color: T.ink, width: "100%",
                background: draft ? T.blueLight : "transparent" }}>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <b style={{ fontSize: 13, overflowWrap: "anywhere" }}>
                  {account.label}
                  {foreign ? <span style={{ fontWeight: 500, color: T.inkLight }}>{` · ${account.currency}`}</span> : null}
                </b>
                {status ? <span style={{ fontSize: 11, color: draft ? T.blue : T.inkLight }}>{status}</span> : null}
              </span>
              {draft ? <span style={{ fontSize: 11, fontWeight: 600, color: T.blue, flex: "none" }}>Continuar</span> : null}
            </button>
          );
        })}
      </div>
      {/* Fora do role="menu" (que só pode ter itens): descreve o menu pelo aria-describedby. */}
      <p id={footerId} style={{ fontSize: 11, color: T.inkLight, padding: "6px 10px 8px", borderTop: `1px solid ${T.border}`, margin: "4px 0 0" }}>
        {MENU_FOOTER}
      </p>
    </div>,
    document.body,
  );
}
