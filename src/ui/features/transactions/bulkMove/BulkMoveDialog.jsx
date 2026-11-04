import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { T } from "../../../tokens";
import { G, NUM } from "../../../typography";
import { BottomSheet } from "../../../components/BottomSheet.jsx";
import { ModalShell } from "../../accounts/ModalShell.jsx";
import { getQuotation } from "../../../../api/transfers";
import { quoteDirection } from "../../../money/quoteDirection.js";
import { useOrganizationBaseCurrency } from "../../../money/useOrganizationBaseCurrency.js";
import { PLAIN_DECIMAL_RE } from "../../../money/convertAmount.js";
import { formatMoneyPlainSpace } from "../../../money/formatMoney.js";
import { currencyInfo } from "../../../money/currencyRegistry.js";
import { conversionHeadline, parseAmountInput } from "../../novaTransacao/accountConversion.js";
import { formatTransactionsApiError, updateTransactionForUi } from "../../../data/transactionsAdapter.js";
import { buildMovePayload, planBulkMove, rowCurrency, runWithConcurrency, suggestedMoveValue } from "./bulkMoveModel.js";

/**
 * "Mover para a conta…" em lote (#281). Escolher a conta → confirmar → executar.
 *
 * Entre moedas, UMA cotação por par (destino/origem), mostrada com a data, e cada
 * valor editável antes de confirmar ("Converter pela cotação" ou "Manter os
 * números"). Sem cotação, "Converter" deixa os campos vazios — nunca taxa 1.
 * Inelegíveis aparecem com o motivo e não são tentados. Execução: um PUT por
 * lançamento, no máximo 3 em voo, resultado por item, sem "sucesso" total se algo
 * falhou — e só os que falharam são tentados de novo.
 *
 * Tudo no nível do módulo (componentes aninhados remontam inputs e perdem foco).
 */

const CONCURRENCY = 3;
const btn = (primary, disabled) => ({
  ...G, flex: 1, padding: "11px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
  border: primary ? "none" : `1px solid ${T.border}`, background: primary ? (disabled ? T.inkFaint : T.ink) : T.surface, color: primary ? "#fff" : T.inkMid,
});

function AccountPicker({ accounts, onPick }) {
  return (
    <div role="group" aria-label="Contas de destino" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {accounts.map((a) => (
        <button key={a.id} type="button" onClick={() => onPick(a)}
          style={{ ...G, display: "flex", justifyContent: "space-between", gap: 8, padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: T.surface, cursor: "pointer", fontSize: 13, fontWeight: 600, color: T.ink, textAlign: "left" }}>
          <span>{a.label}</span>
          {/* Moeda desconhecida = sem símbolo (nunca um "R$" chutado). */}
          <span style={{ color: T.inkLight, fontWeight: 500 }}>{a.currency ? currencyInfo(a.currency).symbol : ""}</span>
        </button>
      ))}
    </div>
  );
}

/** Antes de a busca começar (a moeda base ainda chegando), a cotação já está "buscando". */
const QUOTE_PENDING = { status: "loading" };

function CrossCurrencyGroup({ group, target, quote, mode, onMode, values, onValue }) {
  const toSymbol = currencyInfo(target.currency).symbol;
  const headline = quote?.status === "ready" ? conversionHeadline({ to: target.currency, quote, direction: quote.direction }) : null;
  return (
    <section data-testid={`bulk-move-group-${group.from}`} style={{ border: `1px solid ${T.amber}33`, background: T.amberLight, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ ...G, fontSize: 12, color: T.ink, lineHeight: 1.45 }}>
        {quote?.status === "loading"
          ? "Buscando a cotação…"
          : headline || `Sem cotação agora — informe os valores em ${toSymbol} ou mantenha os números.`}
      </div>
      <div style={{ ...G, fontSize: 11.5, color: T.inkMid }}>A cotação é a de hoje, não a da data de cada lançamento.</div>
      <div role="radiogroup" aria-label={`Como mover os lançamentos em ${group.from}`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[["convert", "Converter pela cotação"], ["keep", `Manter os números (eu digitei em ${toSymbol} por engano)`]].map(([value, label]) => (
          <label key={value} style={{ ...G, display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.ink, cursor: "pointer" }}>
            <input type="radio" name={`mode-${group.from}`} value={value} checked={mode === value} onChange={() => onMode(value)} />
            {label}
          </label>
        ))}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {group.rows.map((tx) => {
          const text = values[tx.id] ?? "";
          // Problema do valor apontado NA linha, não só no botão travado: texto que não é
          // número ("abc") é inválido; número que arredonda para 0,00 pede um maior.
          // parseBRL devolve 0 para texto sem número, então "sem dígito" é o sinal de inválido.
          const parsed = /\d/.test(text) ? parseAmountInput(text) : null;
          const invalid = text.trim() !== "" && parsed === null;
          const zeroed = parsed !== null && parsed <= 0;
          return (
          <li key={tx.id} style={{ ...G, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.ink }}>{tx.desc}</span>
            <span style={{ ...NUM, color: T.inkMid }}>{formatMoneyPlainSpace(Math.abs(tx.val), group.from)}</span>
            <span aria-hidden>→</span>
            <label style={{ display: "flex", alignItems: "center", gap: 4, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 6px" }}>
              <span style={{ color: T.inkMid, fontWeight: 600 }}>{toSymbol}</span>
              <input aria-label={`Valor de ${tx.desc} em ${toSymbol}`} inputMode="decimal" placeholder="0,00" value={values[tx.id] ?? ""}
                onChange={(e) => onValue(tx.id, e.target.value)}
                style={{ ...G, ...NUM, width: 76, border: "none", outline: "none", background: "transparent", fontSize: 12.5, fontWeight: 700, color: T.ink }} />
            </label>
            {invalid || zeroed ? (
              <span role="alert" style={{ flexBasis: "100%", fontSize: 11.5, color: T.red }}>
                {invalid ? "Valor inválido" : `Fica ${toSymbol} 0,00 nessa moeda — informe um valor maior.`}
              </span>
            ) : null}
          </li>
          );
        })}
      </ul>
    </section>
  );
}

function Results({ results }) {
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return (
    <div data-testid="bulk-move-results" style={{ ...G, display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
      <div role="status" style={{ fontWeight: 700, color: failed.length ? T.red : T.green }}>
        {ok} movido{ok === 1 ? "" : "s"}
        {failed.length ? `, ${failed.length} falh${failed.length === 1 ? "ou" : "aram"}` : ""}
      </div>
      {failed.length ? (
        <ul style={{ margin: 0, paddingLeft: 18, color: T.inkMid }}>
          {failed.map((r) => <li key={r.tx.id}><b style={{ color: T.ink }}>{r.tx.desc}</b>: {r.message}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

/** Corpo do diálogo (mesmo conteúdo no sheet do celular e no modal do desktop). */
function BulkMoveBody({ state, accounts, onPick, quotes, modes, setMode, values, setValue, plan, results }) {
  if (state === "pick") return <AccountPicker accounts={accounts} onPick={onPick} />;
  if (state === "results") return <Results results={results} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {plan.sameCurrency.length ? (
        <div style={{ ...G, fontSize: 12.5, color: T.ink }}>
          {plan.sameCurrency.length} na mesma moeda: só trocam de conta.
        </div>
      ) : null}
      {plan.crossGroups.map((group) => (
        <CrossCurrencyGroup key={group.from} group={group} target={plan.target} quote={quotes[group.from] ?? QUOTE_PENDING} mode={modes[group.from] || "convert"}
          onMode={(m) => setMode(group.from, m)} values={values} onValue={setValue} />
      ))}
      {plan.ineligible.length ? (
        <div data-testid="bulk-move-ineligible" style={{ ...G, fontSize: 12, color: T.inkMid }}>
          <div style={{ fontWeight: 700, color: T.ink, marginBottom: 4 }}>Não podem ser movidos ({plan.ineligible.length}):</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {plan.ineligible.map(({ tx, reason }) => <li key={tx.id}>{tx.desc} — {reason}</li>)}
          </ul>
        </div>
      ) : null}
      {state === "running" ? <div role="status" style={{ ...G, fontSize: 12, color: T.inkMid }}>Movendo…</div> : null}
    </div>
  );
}

export function BulkMoveDialog({ isMobile = false, organizationId, accounts, transactions, baseCurrency = null, onClose, onMoved }) {
  const [state, setState] = useState("pick"); // pick | confirm | running | results
  const [target, setTarget] = useState(null);
  const [quotes, setQuotes] = useState({});
  const [modes, setModes] = useState({});
  const [values, setValues] = useState({});
  const [touched, setTouched] = useState({});
  const [results, setResults] = useState([]);

  // Conta de origem fora da lista quando TODAS as selecionadas estão nela.
  const pickable = useMemo(() => {
    const sources = new Set(transactions.map((tx) => String(tx.accountId ?? "")));
    const single = sources.size === 1 ? [...sources][0] : null;
    return accounts.filter((a) => String(a.id) !== single);
  }, [accounts, transactions]);

  const plan = useMemo(() => {
    if (!target) return null;
    const planned = planBulkMove(transactions, target, baseCurrency);
    return { ...planned, target: { ...target, currency: planned.targetCurrency } };
  }, [transactions, target, baseCurrency]);

  // A moeda base da organização orienta a cotação ("1 <estrangeira> = <base>").
  const orgBase = useOrganizationBaseCurrency(organizationId, { enabled: !!plan && plan.crossGroups.length > 0 });

  // Uma cotação por par, buscada JÁ na direção em que é mostrada e usada.
  useEffect(() => {
    if (!plan || orgBase.status !== "ready") return undefined;
    let cancelled = false;
    for (const group of plan.crossGroups) {
      if (quotes[group.from]) continue;
      const direction = quoteDirection({ from: group.from, to: plan.target.currency, base: orgBase.currency });
      setQuotes((cur) => ({ ...cur, [group.from]: { status: "loading" } }));
      getQuotation(organizationId, direction.base, direction.quote)
        .then((q) => {
          const rate = String(q?.rate ?? "").trim();
          if (!PLAIN_DECIMAL_RE.test(rate) || !/[1-9]/.test(rate)) throw new Error("unusable rate");
          return { status: "ready", rate, quoted_on: q.quoted_on ?? null, direction };
        })
        .catch(() => ({ status: "unavailable" }))
        .then((entry) => {
          if (!cancelled) setQuotes((cur) => ({ ...cur, [group.from]: entry }));
        });
    }
    return () => {
      cancelled = true;
    };
    // `quotes` fora de propósito: a busca é por par, uma vez.
  }, [plan, organizationId, orgBase.status, orgBase.currency]);

  // Valores sugeridos: seguem o modo e a cotação enquanto a pessoa não editou a linha.
  useEffect(() => {
    if (!plan) return;
    setValues((cur) => {
      const next = { ...cur };
      for (const group of plan.crossGroups) {
        const mode = modes[group.from] || "convert";
        const q = quotes[group.from]?.status === "ready" ? quotes[group.from] : null;
        for (const tx of group.rows) if (!touched[tx.id]) next[tx.id] = suggestedMoveValue(tx, mode, q?.rate ?? null, q?.direction.op);
      }
      return next;
    });
  }, [plan, modes, quotes, touched]);

  const setMode = (from, mode) => {
    setModes((cur) => ({ ...cur, [from]: mode }));
    // Escolher o modo é uma decisão explícita: reaplica a sugestão no grupo inteiro.
    setTouched((cur) => {
      const next = { ...cur };
      for (const tx of plan.crossGroups.find((g) => g.from === from)?.rows || []) delete next[tx.id];
      return next;
    });
  };
  const setValue = (id, text) => {
    setTouched((cur) => ({ ...cur, [id]: true }));
    setValues((cur) => ({ ...cur, [id]: text }));
  };

  const crossItems = plan ? plan.crossGroups.flatMap((g) => g.rows) : [];
  // Só a cotação de um grupo que vai CONVERTER segura o botão; "Manter os números" não precisa dela.
  const anyQuoteLoading = plan
    ? plan.crossGroups.some((g) => (modes[g.from] || "convert") === "convert" && (quotes[g.from] ?? QUOTE_PENDING).status === "loading")
    : false;
  const crossValid = crossItems.every((tx) => (parseAmountInput(values[tx.id]) ?? 0) > 0);
  const total = plan ? plan.eligible.length : 0;
  const canConfirm = state === "confirm" && total > 0 && crossValid && !anyQuoteLoading;

  const execute = async (items) => {
    setState("running");
    const outcome = await runWithConcurrency(items, CONCURRENCY, (tx) => {
      const cross = rowCurrency(tx, baseCurrency) !== plan.target.currency;
      const payload = buildMovePayload(tx, plan.target.id, cross ? { value: parseAmountInput(values[tx.id]), currency: plan.target.currency } : {});
      return updateTransactionForUi(tx.id, organizationId, payload);
    });
    const perItem = items.map((tx, i) => (outcome[i].ok
      ? { tx, ok: true }
      : { tx, ok: false, message: formatTransactionsApiError(outcome[i].error) }));
    // Junta com o que já tinha dado certo numa rodada anterior (o "tentar de novo").
    const merged = [...results.filter((r) => r.ok && !items.some((tx) => tx.id === r.tx.id)), ...perItem];
    setResults(merged);
    setState("results");
    const movedIds = perItem.filter((r) => r.ok).map((r) => r.tx.id);
    if (movedIds.length) onMoved?.(movedIds);
  };

  const failed = results.filter((r) => !r.ok);
  const title = state === "pick"
    ? "Mover para a conta…"
    : `Mover ${total} lançamento${total === 1 ? "" : "s"} para ${target?.label ?? ""}${plan?.target.currency ? ` (${currencyInfo(plan.target.currency).symbol})` : ""}`;
  // Com o lote em voo nada fecha (Esc, ✕, fundo, arrasto): os resultados por item e o
  // "tentar de novo" se perderiam, e reabrir dispararia um segundo lote nos mesmos ids.
  // Com valores editados, o fundo não descarta o que a pessoa digitou (✕/Cancelar fecham).
  const running = state === "running";
  const anyTouched = Object.keys(touched).length > 0;
  const close = () => {
    if (running) return;
    onClose();
  };

  const footer = state === "pick" ? null : state === "results" ? (
    <div style={{ display: "flex", gap: 8 }}>
      {failed.length ? (
        <button type="button" style={btn(false, false)} onClick={() => execute(failed.map((r) => r.tx))}>
          Tentar de novo os que falharam
        </button>
      ) : null}
      <button type="button" style={btn(true, false)} onClick={onClose}>Fechar</button>
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8 }}>
      <button type="button" style={btn(false, false)} onClick={close} disabled={running}>Cancelar</button>
      <button type="button" style={btn(true, !canConfirm)} disabled={!canConfirm} onClick={() => execute(plan.eligible)}>
        Mover {total} lançamento{total === 1 ? "" : "s"}
      </button>
    </div>
  );

  const body = (
    <BulkMoveBody state={state} accounts={pickable} onPick={(a) => { setTarget(a); setState("confirm"); }} quotes={quotes} modes={modes}
      setMode={setMode} values={values} setValue={setValue} plan={plan} results={results} />
  );

  if (isMobile) {
    return (
      <BottomSheet title={title} closeLabel="Fechar mover para conta" testIdPrefix="bulk-move" onClose={onClose} footer={footer}
        dismissible={!running} backdropDismissible={!running && !anyTouched}>
        {body}
      </BottomSheet>
    );
  }
  return createPortal(
    <ModalShell titleSans={title} onClose={close} footer={footer}
      onBackdropClick={() => { if (!running && !anyTouched) onClose(); }}>{body}</ModalShell>,
    document.body,
  );
}
