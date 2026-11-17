// O atalho "Conciliar extrato" da tela de Transações (decisão do Owner de 2026-11-17, telas T1–T4):
// fica na linha que conta as transações e leva à conciliação da conta certa. Todo o trabalho
// acontece na conciliação; aqui só se escolhe para onde ir.
//
// Os pedidos daqui são acessórios: nenhum bloqueia a lista de transações e nenhum erro quebra a
// tela — sem os rascunhos, o atalho cai no texto básico.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { Btn } from "../../components/primitives";
import { plural } from "../../plural.js";
import { getStatementImport, listStatementImportDrafts, listStatementImports } from "../../../api/statementImports";
import { bankDateLabel } from "./StatementEntryCard.jsx";
import { passedStepsOf, stepProgress } from "./reconciliationSteps.js";
import { latestConcludedEnd, latestDraftByAccount, shortcutTarget } from "./reconcileShortcut.js";

const MENU_TITLE = "Conciliar o extrato de qual conta?";
const MENU_WIDTH = 340;
const SIDE_GUTTER = 16;

/** Ícone de duas setas (ida e volta): banco × Fincla. */
function ReconcileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
      <path d="M4 7h11" />
      <path d="m12 4 3 3-3 3" />
      <path d="M20 17H9" />
      <path d="m12 14-3 3 3 3" />
    </svg>
  );
}

const stepsLabel = (progress) => `${progress.done.toLocaleString("pt-BR")} de ${plural(progress.total, "passo", "passos")}`;

/**
 * @param accounts contas elegíveis ({ id, label, currency }) — as que aceitam "Importar extrato".
 * @param filteredIds contas do filtro da tela.
 * @param onOpen (accountId, importId|null) → abre a conciliação (o rascunho, quando houver).
 */
export function ReconcileShortcut({ organizationId, accounts, filteredIds, baseCurrency = null, onOpen, compact = false }) {
  const target = shortcutTarget({ accounts, filteredIds });
  const hasTarget = target !== null;

  // Rascunhos por conta: `null` = não se sabe (carregando ou falhou) → texto básico.
  const [drafts, setDrafts] = useState({ orgId: null, byAccount: null });
  useEffect(() => {
    if (!organizationId || !hasTarget) return undefined;
    let alive = true;
    listStatementImportDrafts(organizationId)
      .then((list) => { if (alive) setDrafts({ orgId: organizationId, byAccount: latestDraftByAccount(list) }); })
      .catch(() => { if (alive) setDrafts({ orgId: organizationId, byAccount: null }); });
    return () => { alive = false; };
  }, [organizationId, hasTarget]);
  const draftByAccount = drafts.orgId === organizationId ? drafts.byAccount : null;

  // Progresso dos rascunhos necessários (por id): { done, total } ou "error".
  const [progressById, setProgressById] = useState({});
  const requested = useRef(new Set());
  const neededDrafts = !draftByAccount || !target
    ? []
    : (target.kind === "direct" ? [target.account] : accounts).map((a) => draftByAccount[a.id]).filter(Boolean);
  const neededKey = neededDrafts.map((d) => d.id).join("|");
  useEffect(() => {
    let alive = true;
    for (const d of neededDrafts) {
      if (requested.current.has(d.id)) continue;
      requested.current.add(d.id);
      getStatementImport(d.account_id, organizationId, d.id)
        .then((detail) => {
          if (alive) setProgressById((cur) => ({ ...cur, [d.id]: stepProgress(detail, passedStepsOf(detail)) }));
        })
        .catch(() => { if (alive) setProgressById((cur) => ({ ...cur, [d.id]: "error" })); });
    }
    return () => { alive = false; };
    // `neededKey` resume `neededDrafts` (a lista é recriada a cada render).
  }, [neededKey, organizationId]);
  const progressOf = (draft) => {
    const p = draft ? progressById[draft.id] : null;
    return p && p !== "error" ? p : null;
  };

  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const close = useCallback((returnFocus) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  if (!target) return null;

  const style = { maxWidth: "100%", minWidth: 0, flex: "none" };
  const label = (text) => <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{text}</span>;

  if (target.kind === "direct") {
    const draft = draftByAccount?.[target.account.id] ?? null;
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
      <Btn small variant={open ? "dark" : "outGray"} ref={buttonRef} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)} style={style}>
        <ReconcileIcon />
        {label("Conciliar extrato…")}
      </Btn>
      {open ? (
        <AccountMenu
          organizationId={organizationId}
          accounts={accounts}
          baseCurrency={baseCurrency}
          draftByAccount={draftByAccount}
          progressOf={progressOf}
          anchor={buttonRef.current}
          compact={compact}
          onClose={close}
          onChoose={(accountId, importId) => { setOpen(false); onOpen(accountId, importId); }}
        />
      ) : null}
    </>
  );
}

/** Onde o menu fica: logo abaixo do botão, alinhado à direita dele, sem sair da tela. */
function menuPosition(anchor) {
  const vw = window.innerWidth;
  const width = Math.min(MENU_WIDTH, vw - SIDE_GUTTER * 2);
  const rect = anchor?.getBoundingClientRect?.() ?? { right: vw, bottom: 0 };
  const left = Math.min(Math.max(rect.right - width, SIDE_GUTTER), vw - width - SIDE_GUTTER);
  return { left, top: rect.bottom + 6, width };
}

/** A escolha da conta (T4): uma linha por conta elegível, com a situação real de cada uma. */
function AccountMenu({ organizationId, accounts, baseCurrency, draftByAccount, progressOf, anchor, compact, onClose, onChoose }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(() => menuPosition(anchor));

  // A última concluída de cada conta sem rascunho: só agora, com o menu aberto.
  const [concludedByAccount, setConcludedByAccount] = useState({});
  const withoutDraftKey = accounts.filter((a) => !draftByAccount?.[a.id]).map((a) => a.id).join("|");
  useEffect(() => {
    let alive = true;
    for (const id of withoutDraftKey ? withoutDraftKey.split("|") : []) {
      listStatementImports(id, organizationId)
        .then((items) => {
          if (alive) setConcludedByAccount((cur) => ({ ...cur, [id]: { end: latestConcludedEnd(items), any: items.length > 0 } }));
        })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [withoutDraftKey, organizationId]);

  const menuItems = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];
  useEffect(() => {
    menuItems()[0]?.focus();
  }, []);

  useEffect(() => {
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || anchor?.contains(e.target)) return;
      onClose(false);
    };
    const onResize = () => setPos(menuPosition(anchor));
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
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
    } else if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) move(1);
    else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) move(-1);
    else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); list.at(-1)?.focus(); }
  };

  return createPortal(
    <div ref={menuRef} role="menu" aria-label={MENU_TITLE} onKeyDown={onKeyDown}
      style={{ ...G, position: "fixed", left: pos.left, top: pos.top, width: pos.width, boxSizing: "border-box",
        maxHeight: compact ? "60dvh" : "70dvh", overflowY: "auto", background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: 13, boxShadow: T.xl, padding: 6, display: "flex", flexDirection: "column", gap: 2, zIndex: 150 }}>
      <div aria-hidden="true" style={{ fontSize: 12, fontWeight: 700, color: T.inkMid, padding: "8px 10px 6px" }}>{MENU_TITLE}</div>
      {accounts.map((account) => {
        const draft = draftByAccount?.[account.id] ?? null;
        const progress = progressOf(draft);
        const concluded = concludedByAccount[account.id];
        let status = null;
        if (draft) status = progress ? `Conciliação começada · ${stepsLabel(progress)}` : "Conciliação começada";
        else if (concluded?.end) status = `Última conciliação até ${bankDateLabel(concluded.end)}`;
        else if (concluded) status = concluded.any ? "Nenhuma conciliação concluída ainda" : "Nenhum extrato importado ainda";
        const foreign = baseCurrency && account.currency && account.currency !== baseCurrency;
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
      <div style={{ fontSize: 11, color: T.inkLight, padding: "6px 10px 8px", borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
        Cartões de crédito não aparecem: a fatura não é conciliada por extrato.
      </div>
    </div>,
    document.body,
  );
}
