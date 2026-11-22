// O atalho "Conciliar extrato" da tela de Transações no CELULAR (decisão do Owner de 2026-11-22,
// telas M1b, M2 e M3; no computador segue `ReconcileShortcut`).
// - M1b: com conciliação começada, um chip "Continuar conciliação" + "N de 8 passos" numa linha
//   própria entre a busca e a lista. Toque abre o rascunho.
// - M3: duas ou mais começadas → chip "Continuar conciliações" + selo com o número; o toque abre a
//   folha "Conciliações começadas" (uma linha por conta e "Conciliar outra conta…").
// - M2: nada começado → sem chip; "Conciliar extrato…" é o último item do menu ⋯ (na página).
// As regras de destino são as mesmas do computador (`shortcutTarget`) e os dados vêm do mesmo hook
// do nível da página (`useReconcileShortcutData`): nada é pedido aqui além do que se mostra.
import React, { useEffect } from "react";

import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { BottomSheet } from "../../components/BottomSheet.jsx";
import { mobileShortcutChip, shortcutTarget } from "./reconcileShortcut.js";
import {
  MENU_FOOTER, MENU_TITLE, ReconcileIcon, accountChoiceStatus, isForeignAccount, stepsLabel,
} from "./ReconcileShortcut.jsx";

export const STARTED_TITLE = "Conciliações começadas";

const RING_R = 7.5;
const RING_C = 2 * Math.PI * RING_R;

/** Anel de progresso: a fração de passos conferidos (a mesma conta da tela da conciliação). */
function ProgressRing({ progress }) {
  const filled = progress.total ? (progress.done / progress.total) * RING_C : 0;
  return (
    <svg data-testid="reconcile-progress-ring" data-progress={`${progress.done}/${progress.total}`}
      width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" style={{ flex: "none", transform: "rotate(-90deg)" }}>
      <circle cx="10" cy="10" r={RING_R} fill="none" stroke={T.blueBar} strokeOpacity="0.35" strokeWidth="3" />
      {filled > 0 ? (
        <circle cx="10" cy="10" r={RING_R} fill="none" stroke={T.blue} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${filled} ${RING_C}`} />
      ) : null}
    </svg>
  );
}

/** A seta › no fim do chip: ele abre algo. */
function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function ChipBadge({ children }) {
  return (
    <span data-testid="reconcile-chip-badge" style={{ ...NUM, fontSize: 11, fontWeight: 700, color: T.inkMid,
      background: T.surface, borderRadius: 999, padding: "2px 8px", flex: "none" }}>
      {children}
    </span>
  );
}

const chipStyle = {
  ...G, height: 34, boxSizing: "border-box", display: "inline-flex", alignItems: "center", gap: 8,
  padding: "0 8px 0 9px", borderRadius: 999, background: T.blueLight, border: `1.5px solid ${T.blue}`,
  color: T.blue, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", maxWidth: "100%", minWidth: 0,
};
const chipLabel = { overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };

/**
 * A linha do chip (entre a busca e a lista). Sem conciliação começada, sem rascunhos (carregando ou
 * erro) ou sem destino: não renderiza nada.
 * @param onOpen (accountId, importId) → abre a conciliação.
 * @param onOpenStarted (chipElement) → abre a folha "Conciliações começadas".
 */
export function MobileReconcileChip({ data, accounts, filteredIds, onOpen, onOpenStarted }) {
  const target = shortcutTarget({ accounts, filteredIds });
  const chip = mobileShortcutChip({ target, accounts, draftByAccount: data.draftByAccount });
  const { loadProgress, progressOf } = data;
  // M1b: só o detalhe do rascunho do chip (o "N de 8 passos"); na M3, só ao abrir a folha.
  const continueDraft = chip?.kind === "continue" ? chip.draft : null;
  useEffect(() => {
    if (continueDraft) loadProgress([continueDraft]);
  }, [continueDraft, loadProgress]);

  if (!chip) return null;

  let button;
  if (chip.kind === "continue") {
    const progress = progressOf(chip.draft);
    const name = `Continuar conciliação da ${chip.account.label}${progress ? `, ${stepsLabel(progress)}` : ""}`;
    button = (
      <button type="button" aria-label={name} onClick={() => onOpen(chip.account.id, chip.draft.id)}
        style={{ ...chipStyle, boxShadow: `0 0 0 4px ${T.blueLight}` }}>
        {progress ? <ProgressRing progress={progress} /> : <ReconcileIcon size={14} />}
        <span style={chipLabel}>Continuar conciliação</span>
        {progress ? <ChipBadge>{stepsLabel(progress)}</ChipBadge> : null}
        <Chevron />
      </button>
    );
  } else {
    const n = chip.started.length;
    button = (
      <button type="button" aria-haspopup="dialog" aria-label={`Continuar ${n.toLocaleString("pt-BR")} conciliações começadas`}
        onClick={(e) => onOpenStarted(e.currentTarget)} style={chipStyle}>
        <ReconcileIcon size={14} />
        <span style={chipLabel}>Continuar conciliações</span>
        <ChipBadge>{n.toLocaleString("pt-BR")}</ChipBadge>
        <Chevron />
      </button>
    );
  }
  return (
    <div data-testid="reconcile-mobile-chip-row" style={{ display: "flex", justifyContent: "flex-start", minWidth: 0, flex: "none" }}>
      {button}
    </div>
  );
}

const rowStyle = (started) => ({
  ...G, display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, width: "100%",
  boxSizing: "border-box", textAlign: "left", cursor: "pointer", color: T.ink, minHeight: 44,
  border: `1px solid ${started ? T.blueBar : T.border}`, background: started ? T.blueLight : T.surface,
});

function AccountName({ account, baseCurrency }) {
  return (
    <b style={{ fontSize: 14, overflowWrap: "anywhere" }}>
      {account.label}
      {isForeignAccount(account, baseCurrency) ? <span style={{ fontWeight: 500, color: T.inkLight }}>{` · ${account.currency}`}</span> : null}
    </b>
  );
}

/** M3: uma linha por conciliação começada, com o "N de 8 passos conferidos" e "Continuar". */
function StartedList({ data, accounts, baseCurrency, onOpen, onChooseOther }) {
  const { draftByAccount, progressOf, loadProgress } = data;
  const started = accounts.filter((a) => draftByAccount?.[a.id]).map((a) => ({ account: a, draft: draftByAccount[a.id] }));
  const draftsKey = started.map((s) => s.draft.id).join("|");
  useEffect(() => {
    loadProgress(started.map((s) => s.draft));
    // `draftsKey` resume a lista (recriada a cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftsKey, loadProgress]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <p style={{ ...G, fontSize: 12, color: T.inkLight, margin: "0 0 4px" }}>Continue de onde parou em cada conta.</p>
      {started.map(({ account, draft }) => {
        const progress = progressOf(draft);
        return (
          <button key={account.id} type="button" aria-label={`Continuar a conciliação da ${account.label}`}
            onClick={() => onOpen(account.id, draft.id)} style={rowStyle(true)}>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <AccountName account={account} baseCurrency={baseCurrency} />
              <span style={{ ...NUM, fontSize: 12, color: T.blue }}>
                {progress ? `${stepsLabel(progress)} conferidos` : "Conciliação começada"}
              </span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, flex: "none" }}>Continuar</span>
          </button>
        );
      })}
      <button type="button" onClick={onChooseOther}
        style={{ ...G, marginTop: 4, minHeight: 44, borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface,
          color: T.inkMid, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        Conciliar outra conta…
      </button>
    </div>
  );
}

/** A escolha da conta (a mesma do menu do computador, em folha): todas as elegíveis, sem cartões. */
function AccountChoice({ data, accounts, baseCurrency, onOpen }) {
  const { draftsStatus, draftByAccount, progressOf, concludedOf, loadProgress, loadConcluded } = data;
  const accountsKey = accounts.map((a) => a.id).join("|");
  useEffect(() => {
    // Enquanto os rascunhos não chegam, não se sabe quais contas precisam da lista de extratos.
    if (draftsStatus === "loading") return;
    loadProgress(accounts.map((a) => draftByAccount?.[a.id]).filter(Boolean));
    loadConcluded(accounts.filter((a) => !draftByAccount?.[a.id]).map((a) => a.id));
    // `accountsKey` resume `accounts` (a lista é recriada a cada render da página).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftsStatus, draftByAccount, accountsKey, loadProgress, loadConcluded]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {accounts.map((account) => {
        const draft = draftByAccount?.[account.id] ?? null;
        const status = accountChoiceStatus({ draft, progress: progressOf(draft), concluded: concludedOf(account.id) });
        return (
          <button key={account.id} type="button" onClick={() => onOpen(account.id, draft ? draft.id : null)} style={rowStyle(!!draft)}>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <AccountName account={account} baseCurrency={baseCurrency} />
              {status ? <span style={{ ...NUM, fontSize: 12, color: draft ? T.blue : T.inkLight }}>{status}</span> : null}
            </span>
            {draft ? <span style={{ fontSize: 12, fontWeight: 700, color: T.blue, flex: "none" }}>Continuar</span> : null}
          </button>
        );
      })}
      <p style={{ ...G, fontSize: 11, color: T.inkLight, margin: "6px 0 0" }}>{MENU_FOOTER}</p>
    </div>
  );
}

/**
 * A folha de baixo do atalho no celular. `mode`: "started" (M3) ou "choose" (a escolha da conta).
 * Fecha por Esc, arrasto, toque fora ou ✕; o foco fica preso dentro e volta a `returnFocusTo`.
 * Escolher uma conta fecha a folha e abre a conciliação.
 */
export function MobileReconcileSheet({ data, accounts, baseCurrency = null, mode, onModeChange, returnFocusTo, onClose, onOpen }) {
  const open = (accountId, importId) => {
    onClose();
    onOpen(accountId, importId);
  };
  const title = mode === "started" ? STARTED_TITLE : MENU_TITLE;
  return (
    <BottomSheet key={mode} title={title} testIdPrefix="reconcile-sheet" trapFocus returnFocusTo={returnFocusTo} onClose={onClose}>
      {mode === "started" ? (
        <StartedList data={data} accounts={accounts} baseCurrency={baseCurrency} onOpen={open}
          onChooseOther={() => onModeChange("choose")} />
      ) : (
        <AccountChoice data={data} accounts={accounts} baseCurrency={baseCurrency} onOpen={open} />
      )}
    </BottomSheet>
  );
}
