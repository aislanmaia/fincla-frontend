import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Lock } from "lucide-react";

import { T } from "../../../tokens";
import { G, NUM } from "../../../typography";
import { BottomSheet } from "../../../components/BottomSheet.jsx";
import { ModalShell } from "../../accounts/ModalShell.jsx";
import { applyBaseCurrencyChange, previewBaseCurrencyChange } from "../../../../api/baseCurrencyChange";
import { getApiErrorCode, handleApiError } from "../../../../api/client";
import { currencyInfo } from "../../../money/currencyRegistry.js";
import { formatMoney } from "../../../money/formatMoney.js";
import { reformatMoneyInputOnBlur } from "../../../money/moneyInput.js";
import { useCurrencyOptions } from "../../../money/useCurrencyRegistry.js";
import {
  buildApplyRequest,
  effectiveMode,
  groupCanSkip,
  groupLabel,
  initialChoices,
  itemWarningLabel,
  itemOutcome,
  lockedReasonLabel,
  quoteDisplay,
  setGroupMode,
  setItemMode,
  setItemText,
  summarize,
  summaryLine,
} from "./baseCurrencyChangeModel.js";

/**
 * Trocar a moeda base da organização (fincla-api#465, desenho do Owner 2026-11-05).
 *
 * moeda → prévia → (sem impacto: confirmação simples | com impacto: tela agrupada)
 * → aplicando → pronto. Uma escolha global (Manter os números / Converter pela
 * cotação), grupos fechados com contagem que abrem numa lista com rolagem, ajuste
 * por grupo e por item (inclusive valor digitado). Os números vêm do servidor;
 * a tela só escolhe entre eles.
 *
 * `409` na confirmação = a prévia envelheceu: refaz a prévia, mantém as escolhas
 * e avisa. Tudo no nível do módulo (componente aninhado remonta input e perde foco).
 */

const money = (m) => (m ? formatMoney(m.amount, m.currency) : null) ?? "—";
const sym = (code) => currencyInfo(code).symbol;

const btn = (primary, disabled) => ({
  ...G, flex: 1, padding: "11px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
  border: primary ? "none" : `1px solid ${T.border}`, background: primary ? (disabled ? T.inkFaint : T.ink) : T.surface, color: primary ? "#fff" : T.inkMid,
});

const selectStyle = {
  ...G, border: `1px solid ${T.border}`, borderRadius: 8, background: T.surface, color: T.ink, padding: "5px 8px", fontSize: 12, cursor: "pointer", maxWidth: "100%",
};

function CurrencyPicker({ currentCurrency, onPick }) {
  const { carregado, moedas } = useCurrencyOptions(currentCurrency);
  const options = moedas.filter((m) => m.code !== currentCurrency);
  if (options.length === 0) {
    return (
      <div role="status" style={{ ...G, fontSize: 13, color: T.inkMid, padding: "8px 0" }}>
        {carregado ? "Não há outra moeda disponível." : "Carregando as moedas…"}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.45 }}>
        Hoje a moeda base é <b style={{ color: T.ink }}>{currencyInfo(currentCurrency).name} ({sym(currentCurrency)})</b>.
        Antes de trocar, você vê o que muda.
      </div>
      <div role="group" aria-label="Nova moeda base" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((m) => (
          <button key={m.code} type="button" onClick={() => onPick(m.code)}
            style={{ ...G, display: "flex", justifyContent: "space-between", gap: 8, padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface, cursor: "pointer", fontSize: 13, fontWeight: 600, color: T.ink, textAlign: "left" }}>
            <span>{m.label}</span>
            <span style={{ color: T.inkLight, fontWeight: 500 }}>{m.symbol} · {m.code}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GlobalChoice({ preview, quote, mode, onMode }) {
  const from = sym(preview.from_currency);
  const to = sym(preview.to_currency);
  const noQuote = !quote;
  const options = [
    ["keep", "Manter os números", `${from} 100,00 vira ${to} 100,00 — para quem digitou na moeda errada.`, false],
    ["convert", "Converter pela cotação", noQuote
      ? `Indisponível: ${preview.quote_unavailable_reason || "sem cotação agora"}.`
      : `Pela cotação de ${quote.date || "hoje"} (${quote.pair}).`, noQuote],
  ];
  return (
    <div role="radiogroup" aria-label="O que fazer com os valores" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map(([value, label, hint, disabled]) => (
        <label key={value} style={{ ...G, display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
          border: `1.5px solid ${mode === value ? T.ink : T.border}`, background: disabled ? T.bg : T.surface, opacity: disabled ? 0.7 : 1 }}>
          <input type="radio" name="base-currency-mode" value={value} checked={mode === value} disabled={disabled} onChange={() => onMode(value)} style={{ marginTop: 2 }} />
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{label}</span>
            <span style={{ fontSize: 11.5, color: T.inkMid, lineHeight: 1.4 }}>{hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function modeOptions({ canSkip, hasQuote, fromCurrency, followLabel, allowValue }) {
  return [
    ["", followLabel, false],
    ["keep", "Manter o número", false],
    ["convert", hasQuote ? "Converter" : "Converter (sem cotação)", !hasQuote],
    ...(canSkip ? [["skip", `Deixar em ${sym(fromCurrency)}`, false]] : []),
    ...(allowValue ? [["value", "Digitar valor", false]] : []),
  ];
}

function ItemRow({ item, group, preview, choices, onItemMode, onItemText }) {
  const to = preview.to_currency;
  const out = itemOutcome(item, group, choices, to);
  const ov = choices.items[item.key];
  const text = ov?.text ?? "";
  const warning = out.mode === "skip" ? null : itemWarningLabel(item.warning, to);
  return (
    <li data-testid={`bcc-item-${item.key}`} style={{ ...G, display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderTop: `1px solid ${T.border}`, fontSize: 12.5 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ flex: "1 1 140px", minWidth: 0, color: T.ink, fontWeight: 600 }}>{item.label}</span>
        <span style={{ ...NUM, color: T.inkMid, whiteSpace: "nowrap" }}>
          {money(item.current)} <span aria-hidden>→</span> <b style={{ color: out.mode === "skip" ? T.inkMid : T.ink }}>{out.mode == null ? "?" : money(out.after)}</b>
        </span>
      </div>
      {item.locked_reason ? (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: T.inkMid }}>
          <Lock size={12} aria-hidden /> {lockedReasonLabel(item.locked_reason, preview.from_currency)}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <select aria-label={`Escolha para ${item.label}`} value={ov?.mode ?? ""} style={selectStyle}
            onChange={(e) => onItemMode(group, item, e.target.value || null)}>
            {modeOptions({ canSkip: item.can_skip, hasQuote: !!preview.quote, fromCurrency: preview.from_currency, allowValue: true,
              followLabel: choices.groups[group] ? "Como o grupo" : "Como a escolha geral" })
              .map(([value, label, disabled]) => <option key={value} value={value} disabled={disabled}>{label}</option>)}
          </select>
          {ov?.mode === "value" ? (
            <label style={{ display: "flex", alignItems: "center", gap: 4, background: T.surface, border: `1px solid ${out.error ? T.red : T.border}`, borderRadius: 8, padding: "4px 6px" }}>
              <span style={{ color: T.inkMid, fontWeight: 600 }}>{sym(to)}</span>
              <input aria-label={`Valor de ${item.label} em ${sym(to)}`} inputMode="decimal" placeholder="0,00"
                value={text} onChange={(e) => onItemText(item.key, e.target.value)}
                onBlur={() => {
                  const shown = reformatMoneyInputOnBlur(text, to);
                  if (shown !== text) onItemText(item.key, shown);
                }}
                style={{ ...G, ...NUM, width: 96, border: "none", outline: "none", background: "transparent", fontSize: 12.5, fontWeight: 700, color: T.ink }} />
            </label>
          ) : null}
        </div>
      )}
      {warning ? <span data-testid={`bcc-warning-${item.key}`} style={{ fontSize: 11.5, color: T.amber }}>{warning}</span> : null}
      {out.error ? <span role="alert" style={{ fontSize: 11.5, color: T.red }}>{out.error}</span> : null}
    </li>
  );
}

function GroupSection({ group, preview, choices, open, onToggle, onGroupMode, onItemMode, onItemText }) {
  const label = groupLabel(group.group);
  const groupMode = choices.groups[group.group] ?? "";
  const lockedNote = group.locked_count ? ` · ${group.locked_count} travad${group.locked_count === 1 ? "a" : "as"}` : "";
  const modes = new Set(group.items.map((i) => effectiveMode(i, group.group, choices)));
  return (
    <section data-testid={`bcc-group-${group.group}`} style={{ border: `1px solid ${T.border}`, borderRadius: 10, background: T.surface }}>
      <button type="button" aria-expanded={open} onClick={onToggle}
        style={{ ...G, width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", border: "none", background: "none", cursor: "pointer", textAlign: "left" }}>
        {open ? <ChevronDown size={14} color={T.inkMid} aria-hidden /> : <ChevronRight size={14} color={T.inkMid} aria-hidden />}
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.ink }}>{label} ({group.count})</span>
        <span style={{ fontSize: 11.5, color: T.inkMid }}>
          {modes.size > 1 ? "misto" : groupModeLabel([...modes][0], preview.from_currency)}{lockedNote}
        </span>
      </button>
      {open ? (
        <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ ...G, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: T.inkMid }}>
            Todo o grupo:
            <select aria-label={`Escolha para ${label}`} value={groupMode} style={selectStyle}
              onChange={(e) => onGroupMode(group.group, e.target.value || null)}>
              {modeOptions({ canSkip: groupCanSkip(group), hasQuote: !!preview.quote, fromCurrency: preview.from_currency, allowValue: false, followLabel: "Como a escolha geral" })
                .map(([value, text, disabled]) => <option key={value} value={value} disabled={disabled}>{text}</option>)}
            </select>
          </label>
          <ul className="fincla-scroll" style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 300, overflowY: "auto", minHeight: 0 }}>
            {group.items.map((item) => (
              <ItemRow key={item.key} item={item} group={group.group} preview={preview} choices={choices} onItemMode={onItemMode} onItemText={onItemText} />
            ))}
          </ul>
          {group.undisclosed_count ? (
            <div data-testid={`bcc-undisclosed-${group.group}`} style={{ ...G, fontSize: 11.5, color: T.inkMid, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
              {group.undisclosed_count} {group.undisclosed_count === 1 ? "item" : "itens"} de outro consultor (valor não exibido) — segue{group.undisclosed_count === 1 ? "" : "m"} a escolha do grupo.
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function groupModeLabel(mode, fromCurrency) {
  if (mode === "keep") return "manter";
  if (mode === "convert") return "converter";
  if (mode === "skip") return `fica em ${sym(fromCurrency)}`;
  if (mode === "value") return "valor digitado";
  return "a escolher";
}

function AccountsNote({ preview, onGoToTransactions }) {
  return (
    <div style={{ ...G, fontSize: 11.5, color: T.inkMid, lineHeight: 1.5, background: T.bg, borderRadius: 10, padding: "10px 12px" }}>
      Contas e lançamentos não mudam: cada conta continua na moeda dela, e saldos e resumos passam a sair em {sym(preview.to_currency)} sozinhos.
      Conta criada na moeda errada? Em Transações, selecione os lançamentos e use <b>Mover para conta…</b> (uma conta nova em {sym(preview.to_currency)}, com «Manter os números»).
      {onGoToTransactions ? (
        <>
          {" "}
          <button type="button" onClick={onGoToTransactions}
            style={{ ...G, border: "none", background: "none", padding: 0, color: T.blue, fontWeight: 700, fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>
            Ir para Transações
          </button>
        </>
      ) : null}
    </div>
  );
}

function ImpactBody({ preview, choices, setChoices, openGroups, toggleGroup, notice, error, onGoToTransactions }) {
  const quote = quoteDisplay(preview);
  const summary = summarize(preview, choices);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div data-testid="bcc-header" style={{ ...G, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>
          {sym(preview.from_currency)} {preview.from_currency} <span aria-hidden>→</span> {sym(preview.to_currency)} {preview.to_currency}
        </div>
        <div style={{ ...NUM, fontSize: 12, color: T.inkMid }}>
          {quote ? `Cotação: ${quote.pair}${quote.date ? ` (${quote.date})` : ""}` : `Sem cotação: ${preview.quote_unavailable_reason || "indisponível agora"}`}
        </div>
      </div>
      {notice ? <div role="status" style={{ ...G, fontSize: 12, color: T.amber, background: T.amberLight, borderRadius: 10, padding: "9px 12px" }}>{notice}</div> : null}
      <GlobalChoice preview={preview} quote={quote} mode={choices.mode} onMode={(mode) => setChoices((c) => ({ ...c, mode }))} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {preview.groups.map((g) => (
          <GroupSection key={g.group} group={g} preview={preview} choices={choices} open={!!openGroups[g.group]} onToggle={() => toggleGroup(g.group)}
            onGroupMode={(group, mode) => setChoices((c) => setGroupMode(c, group, mode))}
            onItemMode={(group, item, mode) => setChoices((c) => setItemMode(c, preview, group, item, mode))}
            onItemText={(key, text) => setChoices((c) => setItemText(c, key, text))} />
        ))}
      </div>
      <AccountsNote preview={preview} onGoToTransactions={onGoToTransactions} />
      <div data-testid="bcc-summary" style={{ ...G, fontSize: 12, color: summary.canApply ? T.ink : T.inkMid, lineHeight: 1.45 }}>
        {summary.canApply ? summaryLine(summary, preview.from_currency) : summary.reason}
      </div>
      {error ? <div role="alert" style={{ ...G, fontSize: 12, color: T.red }}>{error}</div> : null}
    </div>
  );
}

function SimpleConfirmBody({ preview, error, onGoToTransactions }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>
        Trocar moeda base de {sym(preview.from_currency)} para {sym(preview.to_currency)}?
      </div>
      <div style={{ ...G, fontSize: 12.5, color: T.inkMid, lineHeight: 1.45 }}>
        Nada está gravado na moeda base hoje (renda, orçamentos, metas ou plano do mês), então nenhum valor muda.
      </div>
      <AccountsNote preview={preview} onGoToTransactions={onGoToTransactions} />
      {error ? <div role="alert" style={{ ...G, fontSize: 12, color: T.red }}>{error}</div> : null}
    </div>
  );
}

function DoneBody({ result }) {
  const changed = (result?.items ?? []).filter((i) => i.mode !== "skip").length;
  return (
    <div role="status" style={{ ...G, display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: T.ink }}>
      <div style={{ fontWeight: 800, color: T.green }}>Moeda base trocada para {sym(result.to_currency)}.</div>
      <div style={{ color: T.inkMid, fontSize: 12.5 }}>
        {changed > 0 ? `${changed} ${changed === 1 ? "valor atualizado" : "valores atualizados"}. ` : ""}
        Saldos, resumos e painéis já aparecem em {sym(result.to_currency)}.
      </div>
    </div>
  );
}

export function BaseCurrencyChangeDialog({ isMobile = false, organizationId, currentCurrency, onClose, onChanged, onGoToTransactions = null }) {
  const [state, setState] = useState("pick"); // pick | loading | review | applying | done | failed
  const [target, setTarget] = useState(null);
  const [preview, setPreview] = useState(null);
  const [choices, setChoices] = useState(initialChoices);
  const [openGroups, setOpenGroups] = useState({});
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const loadPreview = useCallback(async (to) => {
    setError(null);
    try {
      const p = await previewBaseCurrencyChange(organizationId, to);
      setPreview(p);
      setState("review");
      return p;
    } catch (e) {
      setError(handleApiError(e));
      setState("failed");
      return null;
    }
  }, [organizationId]);

  useEffect(() => {
    if (state === "loading" && target) void loadPreview(target);
  }, [state, target, loadPreview]);

  const empty = preview ? preview.groups.length === 0 : false;
  const summary = preview && !empty ? summarize(preview, choices) : null;
  const canApply = state === "review" && (empty || summary?.canApply);

  const apply = async () => {
    if (!preview || !canApply) return;
    setState("applying");
    setError(null);
    setNotice(null);
    const body = empty
      ? { to: preview.to_currency, fingerprint: preview.fingerprint, mode: "keep", quote: null, groups: {}, items: {} }
      : buildApplyRequest(preview, choices);
    try {
      const applied = await applyBaseCurrencyChange(organizationId, body);
      setResult(applied);
      setState("done");
      onChanged?.(applied);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409 || getApiErrorCode(e) === "conflict") {
        // A prévia envelheceu (a cotação ou os dados mudaram). Refaz e mostra de novo;
        // as escolhas ficam — os números novos aparecem, e a pessoa confirma outra vez.
        const fresh = await loadPreview(preview.to_currency);
        if (fresh) setNotice("A cotação ou os dados mudaram desde a prévia. Confira os valores atualizados e confirme de novo.");
        return;
      }
      setError(handleApiError(e));
      setState("review");
    }
  };

  const busy = state === "loading" || state === "applying";
  const dirty = state === "review" && (choices.mode != null || Object.keys(choices.groups).length > 0 || Object.keys(choices.items).length > 0);
  const close = () => {
    if (state === "applying") return;
    onClose();
  };
  const goToTransactions = onGoToTransactions ? () => { onClose(); onGoToTransactions(); } : null;

  const title = state === "done" ? "Moeda base trocada" : preview && state !== "pick" ? `Trocar moeda base para ${sym(preview.to_currency)}` : "Trocar moeda base";

  let body;
  if (state === "pick") body = <CurrencyPicker currentCurrency={currentCurrency} onPick={(code) => { setTarget(code); setChoices(initialChoices()); setOpenGroups({}); setNotice(null); setState("loading"); }} />;
  else if (state === "loading") body = <div role="status" style={{ ...G, fontSize: 13, color: T.inkMid }}>Calculando o impacto…</div>;
  else if (state === "failed") body = <div role="alert" style={{ ...G, fontSize: 13, color: T.red }}>{error}</div>;
  else if (state === "done") body = <DoneBody result={result} />;
  else if (empty) body = <SimpleConfirmBody preview={preview} error={error} onGoToTransactions={goToTransactions} />;
  else {
    body = (
      <ImpactBody preview={preview} choices={choices} setChoices={setChoices} openGroups={openGroups}
        toggleGroup={(g) => setOpenGroups((cur) => ({ ...cur, [g]: !cur[g] }))} notice={notice} error={error} onGoToTransactions={goToTransactions} />
    );
  }

  let footer;
  if (state === "done") footer = <div style={{ display: "flex", gap: 8, width: "100%" }}><button type="button" style={btn(true, false)} onClick={onClose}>Fechar</button></div>;
  else if (state === "failed") {
    footer = (
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <button type="button" style={btn(false, false)} onClick={() => { setState("pick"); setError(null); }}>Escolher outra moeda</button>
        <button type="button" style={btn(true, false)} onClick={() => setState("loading")}>Tentar de novo</button>
      </div>
    );
  } else if (state === "pick") footer = null;
  else {
    const to = preview ? sym(preview.to_currency) : "";
    footer = (
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <button type="button" style={btn(false, false)} onClick={close} disabled={state === "applying"}>Cancelar</button>
        <button type="button" style={btn(true, !canApply)} disabled={!canApply} onClick={apply}>
          {state === "applying" ? "Trocando…" : `Trocar para ${to}`}
        </button>
      </div>
    );
  }

  if (isMobile) {
    return (
      <BottomSheet title={title} closeLabel="Fechar troca de moeda base" testIdPrefix="base-currency-change" onClose={onClose} footer={footer}
        dismissible={!busy} backdropDismissible={!busy && !dirty}>
        {body}
      </BottomSheet>
    );
  }
  return createPortal(
    <ModalShell titleSans={title} onClose={close} footer={footer} maxWidth={560}
      onBackdropClick={() => { if (!busy && !dirty) onClose(); }}>{body}</ModalShell>,
    document.body,
  );
}
