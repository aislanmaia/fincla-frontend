import React from "react";

import { Badge, Card } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { getCategoryLucideIcon } from "../../data/categoryLucideIcons.js";
import { fmtBRL0 } from "./consultantFormat";
import { Icon, useIsNarrow } from "./consultantUi";
import { TX_FILTERS, filterTransactions, summarizeTransactions } from "./consultantClientTransactions";

const CAT_COLORS = ["#0F0F0D", "#2563EB", "#7C3AED", "#D97706", "#059669", "#DC2626", "#9CA3AF"];

/** Cor determinística por categoria (para o ícone da linha). */
function catColor(key) {
  const s = String(key ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CAT_COLORS[h % CAT_COLORS.length];
}

function CatIcon({ tx, color }) {
  const Lucide = getCategoryLucideIcon(tx.categoryIconKey);
  if (Lucide) return <Lucide size={16} color={color} />;
  return <Icon name="wallet" size={16} color={color} />;
}

// ── Card de resumo ──────────────────────────────────────────────
function SummaryCard({ label, value, color }) {
  return (
    <Card style={{ padding: "13px 16px" }}>
      <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ ...G, ...NUM, fontSize: 18, fontWeight: 800, color, marginTop: 5 }}>{value}</div>
    </Card>
  );
}

// ── Linha de transação (responsiva) ─────────────────────────────
function TxRow({ tx, narrow }) {
  const color = catColor(tx.categoryIconKey || tx.cat);
  const isPos = (Number(tx.val) || 0) >= 0;
  const parcela = tx.parcela && tx.parcela.total > 1 ? ` · ${tx.parcela.atual}/${tx.parcela.total}x` : "";
  const value = (
    <span style={{ ...G, ...NUM, fontSize: 13.5, fontWeight: 800, color: isPos ? T.green : T.ink, textAlign: "right", whiteSpace: "nowrap" }}>{isPos ? "+" : ""}{fmtBRL0(tx.val)}</span>
  );
  const nameRow = (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      <span style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.desc}</span>
      {tx.rec && <span title="Recorrente" style={{ display: "flex", flexShrink: 0 }}><Icon name="repeat" size={12} color={T.inkGhost} /></span>}
      {tx.status === "cancelada" && <Badge color={T.inkMid} bg={T.grayLight}>cancelada</Badge>}
    </div>
  );
  const iconBox = (
    <div style={{ width: 34, height: 34, borderRadius: 9, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <CatIcon tx={tx} color={color} />
    </div>
  );

  // Estreito: ícone | (nome + subtexto "cat · método · data") | valor.
  if (narrow) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "38px minmax(0,1fr) auto", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: `1px solid ${T.border}` }}>
        {iconBox}
        <div style={{ minWidth: 0 }}>
          {nameRow}
          <div style={{ ...G, fontSize: 10.5, color: T.inkLight, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.cat}{parcela} · {tx.method} · {tx.date}</div>
        </div>
        {value}
      </div>
    );
  }

  // Largo (fiel à referência): ícone | nome+categoria | método | data | valor.
  return (
    <div style={{ display: "grid", gridTemplateColumns: "38px minmax(0,2fr) 1.1fr 1fr 120px", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: `1px solid ${T.border}` }}>
      {iconBox}
      <div style={{ minWidth: 0 }}>
        {nameRow}
        <div style={{ ...G, fontSize: 10.5, color: T.inkLight, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.cat}{parcela}</div>
      </div>
      <span style={{ ...G, fontSize: 12, color: T.inkMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.method}</span>
      <span style={{ ...G, fontSize: 12, color: T.inkLight, whiteSpace: "nowrap" }}>{tx.date}</span>
      {value}
    </div>
  );
}

const FILTER_BTN = (active) => ({
  ...G, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? T.ink : T.inkLight,
  background: active ? T.grayLight : "transparent", border: "none", borderRadius: 7, padding: "6px 11px", cursor: "pointer", whiteSpace: "nowrap",
});

/**
 * Aba "Transações" do relatório do cliente (RF.2), fiel a `TransacoesTab` da
 * referência: cards de resumo (receitas/despesas/resultado) + busca/filtro + lista
 * com ícone de categoria, recorrência, método, data e valor. A lista é **read-only**
 * (o lançamento/edição em nome do cliente é Trilha B → "Nova transação" fica stub).
 * Recebe o estado do hook `useClientTransactions` via prop.
 */
export function ConsultantClientTransactionsTab({ transactions }) {
  const [filter, setFilter] = React.useState("todos");
  const [q, setQ] = React.useState("");
  const narrow = useIsNarrow(760);

  const all = transactions.transactions || [];
  const { income, expense, result } = summarizeTransactions(all);
  const list = filterTransactions(all, { filter, query: q });

  const body = () => {
    if (transactions.loading && !transactions.hasLoaded) return <div style={{ ...G, padding: 40, textAlign: "center", color: T.inkLight, fontSize: 13 }}>Carregando transações…</div>;
    if (transactions.error && all.length === 0) return <div style={{ ...G, padding: 40, textAlign: "center", color: T.inkLight, fontSize: 13 }}>Não foi possível carregar as transações.</div>;
    if (list.length === 0) return <div style={{ ...G, padding: 40, textAlign: "center", color: T.inkLight, fontSize: 13 }}>Nenhuma transação encontrada.</div>;
    return list.map((tx) => <TxRow key={tx.id} tx={tx} narrow={narrow} />);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
        <SummaryCard label="Receitas no mês" value={`+${fmtBRL0(income)}`} color={T.green} />
        <SummaryCard label="Despesas no mês" value={`−${fmtBRL0(expense)}`} color={T.ink} />
        <SummaryCard label="Resultado" value={`${result >= 0 ? "+" : ""}${fmtBRL0(result)}`} color={result >= 0 ? T.green : T.red} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "13px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 11px", width: 200, maxWidth: "100%" }}>
            <Icon name="search" size={13} color={T.inkMid} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar transação…" aria-label="Buscar transação" style={{ ...G, border: "none", outline: "none", fontSize: 12.5, color: T.ink, background: "transparent", flex: 1, minWidth: 0 }} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TX_FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} style={FILTER_BTN(filter === f.id)}>{f.label}</button>
            ))}
          </div>
          <button
            type="button"
            disabled
            title="Em breve"
            style={{ ...G, marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: `1px solid ${T.ink}`, background: T.ink, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "default", opacity: 0.55, whiteSpace: "nowrap" }}
          >
            <Icon name="plus" size={13} color="#fff" /> Nova transação
            <span style={{ ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: "rgba(255,255,255,0.2)", borderRadius: 5, padding: "1px 5px" }}>em breve</span>
          </button>
        </div>
        <div>{body()}</div>
      </Card>
    </div>
  );
}
