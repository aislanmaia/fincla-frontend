import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { PageTitle, Btn } from "../../components/primitives";
import { formatMoney } from "../../money/formatMoney.js";
import { currencyInfo } from "../../money/currencyRegistry.js";
import { moneyInputStatus, parseMoneyInputFor } from "../../money/moneyInput.js";
import { todayLocalYmd } from "../../data/transactionsAdapter.js";
import { accountMeta } from "../accounts/accountMeta.js";
import { listAccounts } from "../../../api/accounts";
import { getOrgBalances } from "../../../api/balances";
import { getReservedSummary } from "../../../api/goals";

/**
 * Novo aporte — todo aporte sai de algum lugar (Owner, 2026-11-05).
 *
 * Um campo só decide o caminho: "Onde o dinheiro fica guardado". A primeira opção
 * deixa o dinheiro na conta de onde ele sai (só RESERVA: nada se move no banco); as
 * outras são contas da pessoa (TRANSFERÊNCIA, criada pelo backend na mesma gravação);
 * a última cria uma conta ali mesmo. Quem tem uma conta só vê o convite para separar,
 * mas reservar continua marcado — ninguém transfere uma conta para ela mesma.
 *
 * A prévia mostra o efeito antes de confirmar: o total nas contas não muda, a reserva
 * cresce e o disponível para gastar cai.
 */

const SAME = "same";
const NEW = "new";
const NEW_ACCOUNT_TYPES = [
  { value: "savings", label: "Poupança" },
  { value: "investment", label: "Investimento" },
  { value: "wallet", label: "Carteira" },
];

const fmt = (v, moeda) => formatMoney(Number(v || 0), moeda || "BRL") ?? "";

/** Contas, saldos e o reservado de hoje — só o que o modal precisa para a prévia. */
function useContributionContext(organizationId, currency, enabled) {
  const [state, setState] = useState({ loading: enabled, error: "", accounts: [], reserved: 0 });
  useEffect(() => {
    if (!enabled || !organizationId) return undefined;
    let cancelled = false;
    Promise.all([listAccounts(organizationId), getOrgBalances(organizationId), getReservedSummary(organizationId)])
      .then(([accounts, balances, reserved]) => {
        if (cancelled) return;
        const saldo = Object.fromEntries((balances?.accounts || []).map((b) => [b.account_id, b.balance]));
        const naMoeda = (accounts || [])
          .filter((a) => a.is_active !== false && (a.currency || "BRL") === currency)
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
          .map((a) => ({ ...a, balance: saldo[a.id] ?? null }));
        const reservedNow = (reserved?.totals || []).find((t) => t.currency === currency)?.amount ?? 0;
        setState({ loading: false, error: "", accounts: naMoeda, reserved: Number(reservedNow) || 0 });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, error: "Não consegui carregar suas contas.", accounts: [], reserved: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, currency, enabled]);
  return state;
}

function Field({ label, htmlFor, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={htmlFor} style={{ ...G, fontSize: 11, fontWeight: 600, color: T.inkMid, display: "block", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = { ...G, width: "100%", fontSize: 14, color: T.ink, background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 9, padding: "9px 11px", outline: "none", boxSizing: "border-box" };

function Row({ label, value, strong, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, ...G, ...NUM, fontSize: 12, fontWeight: strong ? 700 : 400 }}>
      <span style={{ color: strong ? T.ink : T.inkLight }}>{label}</span>
      <span style={{ color: color || T.ink, fontWeight: color ? 700 : undefined }}>{value}</span>
    </div>
  );
}

export function ContributionModal({ goal, organizationId = null, live = false, onClose, onSubmit, isSaving = false }) {
  const currency = goal.moeda || "BRL";
  const symbol = currencyInfo(currency).symbol;
  const ctx = useContributionContext(organizationId, currency, live);

  const [valor, setValor] = useState("");
  const [date, setDate] = useState(() => todayLocalYmd());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const [dest, setDest] = useState(SAME);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("savings");

  // Conta criada aqui num aporte que depois falhou: entra na lista e fica escolhida.
  const [created, setCreated] = useState([]);
  const accounts = useMemo(() => [...ctx.accounts, ...created], [ctx.accounts, created]);
  const single = live && accounts.length === 1;
  // Origem padrão: a conta mais antiga na moeda da meta (a principal).
  useEffect(() => {
    if (!source && accounts.length) setSource(accounts[0].id);
  }, [accounts, source]);
  const origin = accounts.find((a) => a.id === source) || null;
  const others = accounts.filter((a) => a.id !== source);

  const status = moneyInputStatus(valor, currency);
  const amount = status === "ok" ? parseMoneyInputFor(valor, currency) : null;
  const futureDate = !!date && date > todayLocalYmd();
  const needsAccounts = live && !ctx.loading;
  const noAccount = needsAccounts && accounts.length === 0;
  const newOk = dest !== NEW || newName.trim().length > 0;
  const canSave =
    amount != null && amount > 0 && !!date && !futureDate && !isSaving && newOk && (!live || (needsAccounts && !!origin));

  function chooseDest(value) {
    setDest(value);
    if (value === NEW && !newName) setNewName(single ? "Poupança" : "");
  }

  const total = accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const reservedAfter = ctx.reserved + (amount || 0);
  const free = total - reservedAfter;
  const pctFree = total > 0 ? Math.max(0, Math.min(100, (free / total) * 100)) : 0;

  const verb = !live || !amount ? "Registrar aporte" : dest === SAME ? `Reservar ${fmt(amount, currency)}` : dest === NEW ? "Criar conta e transferir" : `Transferir ${fmt(amount, currency)}`;

  async function save() {
    if (!canSave) return;
    setError("");
    const payload = { amount, contributed_at: date, note: note.trim() || null };
    let newAccount = null;
    if (live) {
      payload.account_id = origin.id;
      if (dest === NEW) newAccount = { name: newName.trim(), type: newType, currency };
      else if (dest !== SAME) payload.destination_account_id = dest;
    }
    try {
      await onSubmit(goal, payload, { newAccount });
    } catch (e) {
      // Nada foi gravado no aporte: o modal fica, com o que foi digitado.
      if (e?.createdAccount) {
        setCreated((cur) => [...cur, { ...e.createdAccount, balance: 0 }]);
        setDest(e.createdAccount.id);
      }
      setError(e?.message || "Não foi possível registrar o aporte.");
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div role="dialog" aria-label="Novo aporte" onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: "100%", background: T.surface, borderRadius: 14, boxShadow: T.lg, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <PageTitle sans="Novo" serif="aporte" />
          <button onClick={onClose} aria-label="Fechar" style={{ border: "none", background: "none", cursor: "pointer", color: T.inkLight }}><X size={18} /></button>
        </div>
        <div style={{ ...G, fontSize: 12, color: T.inkLight, marginBottom: 14 }}>
          Para <b data-contribution-goal style={{ color: T.ink }}>{goal.nome}</b> · {fmt(goal.atual, currency)} de {fmt(goal.meta, currency)}
        </div>

        <Field label={`Valor do aporte (${symbol})`} htmlFor="contrib-valor">
          <input id="contrib-valor" style={inputStyle} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="500,00" inputMode="decimal" autoFocus aria-invalid={status === "invalid" || undefined} />
          {status === "invalid" ? <span role="alert" style={{ ...G, display: "block", fontSize: 11, color: T.red, marginTop: 4 }}>Valor inválido</span> : null}
        </Field>

        {live ? (
          <>
            {ctx.loading ? <div style={{ ...G, fontSize: 12, color: T.inkLight, marginBottom: 12 }}>Carregando suas contas…</div> : null}
            {ctx.error ? <div role="alert" style={{ ...G, fontSize: 12, color: T.red, marginBottom: 12 }}>{ctx.error}</div> : null}
            {noAccount && !ctx.error ? (
              <div role="alert" style={{ ...G, fontSize: 12, color: T.inkMid, background: T.grayLight, borderRadius: 9, padding: "9px 11px", marginBottom: 12 }}>
                Você não tem conta em {currency} para tirar esse dinheiro. Crie uma em Contas e volte aqui.
              </div>
            ) : null}
            {accounts.length ? (
              <>
                <Field label="Sai de" htmlFor="contrib-source">
                  <select id="contrib-source" style={inputStyle} value={source} onChange={(e) => { setSource(e.target.value); if (e.target.value === dest) setDest(SAME); }}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{accountMeta(a.type).emoji} {a.name}{a.balance != null ? ` · ${fmt(a.balance, currency)}` : ""}</option>
                    ))}
                  </select>
                </Field>

                {single ? (
                  <div style={{ ...G, borderRadius: 12, border: `1.5px solid ${T.blue}`, background: T.blueLight, padding: "10px 11px", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.blue }}>Quer separar esse dinheiro?</div>
                    <div style={{ fontSize: 12, color: T.inkMid, marginTop: 3, lineHeight: 1.45 }}>
                      Você tem só a {origin?.name}. Pode guardar numa conta à parte, como a poupança ou a caixinha do seu banco, ou só reservar o valor aqui.
                    </div>
                  </div>
                ) : null}

                <Field label="Onde o dinheiro fica guardado" htmlFor="contrib-dest">
                  <select id="contrib-dest" style={inputStyle} value={dest} onChange={(e) => chooseDest(e.target.value)}>
                    <option value={SAME}>Na própria {origin?.name} (só reservar)</option>
                    {others.map((a) => (
                      <option key={a.id} value={a.id}>{accountMeta(a.type).emoji} {a.name}</option>
                    ))}
                    <option value={NEW}>{single ? "+ Nova conta: Poupança" : "+ Criar conta para guardar"}</option>
                  </select>
                  <span style={{ ...G, display: "block", fontSize: 11, color: T.inkLight, marginTop: 5 }}>
                    {dest === SAME
                      ? "O dinheiro não sai do banco. Fica reservado para a meta."
                      : dest === NEW
                        ? `A conta é criada junto com o aporte e recebe o valor da ${origin?.name}.`
                        : `Transferir da ${origin?.name} para ${others.find((a) => a.id === dest)?.name}.`}
                  </span>
                </Field>

                {dest === NEW ? (
                  <div style={{ border: `1.5px dashed ${T.green}`, borderRadius: 11, padding: 10, background: T.greenLight, marginBottom: 12, display: "grid", gap: 8 }}>
                    <Field label="Nome da nova conta" htmlFor="contrib-new-name">
                      <input id="contrib-new-name" style={inputStyle} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ex: Caixinha da Viagem" />
                    </Field>
                    <div role="radiogroup" aria-label="Tipo da nova conta" style={{ display: "flex", gap: 6 }}>
                      {NEW_ACCOUNT_TYPES.map((t) => {
                        const on = newType === t.value;
                        return (
                          <button key={t.value} type="button" role="radio" aria-checked={on} onClick={() => setNewType(t.value)} style={{ ...G, flex: 1, fontSize: 12, fontWeight: 600, borderRadius: 8, padding: "6px 0", cursor: "pointer", border: `1.5px solid ${on ? T.ink : T.border}`, background: on ? T.ink : T.surface, color: on ? "#fff" : T.inkMid }}>{t.label}</button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {amount ? (
                  <div aria-label="Prévia do aporte" style={{ borderRadius: 12, background: T.grayLight, padding: 12, display: "grid", gap: 7, marginBottom: 12 }}>
                    <Row label="Total nas contas" value={fmt(total, currency)} strong />
                    <div style={{ height: 8, borderRadius: 99, background: T.border, display: "flex", overflow: "hidden", gap: 2 }}>
                      <i style={{ display: "block", width: `${pctFree}%`, background: T.green }} />
                      <i style={{ display: "block", flex: 1, background: T.amberBar }} />
                    </div>
                    <Row label="Reservado nas metas" value={fmt(reservedAfter, currency)} />
                    <Row label="Disponível para gastar" value={fmt(free, currency)} color={free < 0 ? T.red : T.green} />
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        <Field label="Data do aporte" htmlFor="contrib-date">
          <input id="contrib-date" type="date" style={inputStyle} value={date} max={todayLocalYmd()} onChange={(e) => setDate(e.target.value)} aria-invalid={futureDate || undefined} />
          {futureDate ? <span role="alert" style={{ ...G, display: "block", fontSize: 11, color: T.red, marginTop: 4 }}>A data não pode ser no futuro</span> : null}
        </Field>
        <Field label="Observação (opcional)" htmlFor="contrib-note"><input id="contrib-note" style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex: sobra do mês" /></Field>

        {error ? <div role="alert" style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "8px 11px", marginBottom: 10 }}>{error}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 6 }}>
          <Btn variant="outGray" onClick={onClose}>Cancelar</Btn>
          <Btn variant="dark" onClick={save} disabled={!canSave}>{isSaving ? "Salvando…" : verb}</Btn>
        </div>
      </div>
    </div>
  );
}
