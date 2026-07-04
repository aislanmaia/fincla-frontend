import React from "react";

import { Card, ProgBar } from "../../components/primitives";
import { T } from "../../tokens";
import { G, NUM } from "../../typography";
import { fmtBRL0 } from "./consultantFormat";
import { Icon, useIsNarrow } from "./consultantUi";
import { selectClientCards } from "./consultantClientCards";

const LIMIT_LABEL = { ...G, fontSize: 9.5, color: T.inkLight, textTransform: "uppercase", letterSpacing: "0.05em" };

// Botão "Adicionar cartão" — stub Trilha B (escrita cross-org). Espelha o estilo
// desabilitado de "Nova transação" da aba Transações (RF.2).
const ADD_CARD_STUB = {
  ...G, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9,
  border: `1px solid ${T.ink}`, background: T.ink, color: "#fff", fontSize: 12.5, fontWeight: 700,
  cursor: "default", opacity: 0.55, whiteSpace: "nowrap",
};
const SOON_PILL = {
  ...G, fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
  background: "rgba(255,255,255,0.2)", borderRadius: 5, padding: "1px 5px",
};

// ── Visual do cartão (gradiente + fatura atual) ─────────────────
function CreditCardVisual({ card }) {
  return (
    <div style={{ borderRadius: 16, padding: 18, background: `linear-gradient(135deg, ${card.gradient[0]}, ${card.gradient[1]})`, color: "#fff", minHeight: 158, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: T.md }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...G, fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.name}</div>
          <div style={{ ...G, fontSize: 10, opacity: 0.8, marginTop: 2 }}>•••• {card.last4}</div>
        </div>
        <div style={{ width: 30, height: 22, borderRadius: 4, background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
      </div>
      <div>
        <div style={{ ...G, fontSize: 10, opacity: 0.85, marginBottom: 2 }}>Fatura atual</div>
        <div style={{ ...G, ...NUM, fontSize: 21, fontWeight: 800 }}>{fmtBRL0(card.invoiceTotal)}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9, gap: 8 }}>
          <span style={{ ...G, fontSize: 10, opacity: 0.85 }}>{card.brand}</span>
          <span style={{ ...G, fontSize: 10, opacity: 0.85 }}>vence dia {card.dueDay}</span>
        </div>
      </div>
    </div>
  );
}

// ── Card de uso do limite ───────────────────────────────────────
function LimitCard({ card }) {
  const over = card.usagePct > 70;
  const barColor = over ? T.red : card.usagePct > 45 ? T.amber : T.green;
  return (
    <Card style={{ padding: 15 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ ...G, fontSize: 11.5, color: T.inkLight }}>Limite usado</span>
        <span style={{ ...G, ...NUM, fontSize: 11.5, fontWeight: 700, color: over ? T.red : T.ink }}>{card.usagePct}%</span>
      </div>
      <ProgBar pct={card.usagePct} color={barColor} h={7} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <div><div style={LIMIT_LABEL}>Disponível</div><div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 800, color: T.green }}>{fmtBRL0(card.available)}</div></div>
        <div style={{ textAlign: "right" }}><div style={LIMIT_LABEL}>Limite</div><div style={{ ...G, ...NUM, fontSize: 13, fontWeight: 800, color: T.ink }}>{fmtBRL0(card.limit)}</div></div>
      </div>
    </Card>
  );
}

// Fundo do ícone: só acrescenta alpha "15" quando a cor é hex de 6 dígitos
// (catColor vem de dado externo — nome/rgb quebraria o hex de 8 dígitos).
function iconTint(color) {
  return /^#[0-9a-fA-F]{6}$/.test(String(color || "")) ? color + "15" : T.grayLight;
}

// ── Linha de item da fatura ─────────────────────────────────────
function InvoiceItemRow({ item }) {
  const color = item.color || T.inkMid;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 17px", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: iconTint(color), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15 }}>{item.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...G, fontSize: 12.5, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</div>
        <div style={{ ...G, fontSize: 10.5, color: T.inkLight }}>{item.dateLabel}{item.installments}</div>
      </div>
      <span style={{ ...G, ...NUM, fontSize: 13, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>{fmtBRL0(item.value)}</span>
    </div>
  );
}

function CenteredCard({ children }) {
  return (
    <Card style={{ padding: 40, textAlign: "center" }}>
      <span style={{ ...G, color: T.inkLight, fontSize: 13 }}>{children}</span>
    </Card>
  );
}

/**
 * Aba "Cartões" do relatório do cliente (RF.3), fiel a `CartoesTab` da referência:
 * por cartão, um grid `300px / 1fr` com o visual do cartão + uso do limite à
 * esquerda e os itens da fatura corrente à direita. Read-only — "Adicionar cartão"
 * é stub "em breve" (escrita cross-org = Trilha B). Recebe o estado do hook
 * `useClientCreditCards` via prop. Responsivo: colapsa o grid no mobile.
 */
export function ConsultantClientCardsTab({ cards: state, clientName }) {
  const narrow = useIsNarrow(760);
  const cards = selectClientCards(state.cards || []);

  if (state.loading && !state.hasLoaded) return <CenteredCard>Carregando cartões…</CenteredCard>;
  if (state.error && cards.length === 0) return <CenteredCard>Não foi possível carregar os cartões.</CenteredCard>;

  if (cards.length === 0) {
    const firstName = String(clientName || "O cliente").trim().split(" ")[0] || "O cliente";
    return (
      <Card style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: T.grayLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Icon name="card" size={24} color={T.inkGhost} />
        </div>
        <div style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 5 }}>Nenhum cartão cadastrado</div>
        <div style={{ ...G, fontSize: 12.5, color: T.inkLight, maxWidth: 320, lineHeight: 1.5, marginBottom: 16 }}>
          {firstName} ainda não registrou cartões de crédito. Você poderá adicionar um para acompanhar faturas e parcelas.
        </div>
        <button type="button" disabled title="Em breve" style={ADD_CARD_STUB}>
          <Icon name="plus" size={13} color="#fff" /> Adicionar cartão
          <span style={SOON_PILL}>em breve</span>
        </button>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {cards.map((card) => (
        <div key={card.id} style={{ display: "grid", gridTemplateColumns: narrow ? "minmax(0,1fr)" : "300px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <CreditCardVisual card={card} />
            <LimitCard card={card} />
          </div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "13px 17px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ ...G, fontSize: 13.5, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>Itens da fatura · {card.name}</div>
              <span style={{ ...G, fontSize: 11, color: T.inkLight, whiteSpace: "nowrap", flexShrink: 0 }}>fecha dia {card.closingDay}</span>
            </div>
            {card.items.length
              ? card.items.map((item) => <InvoiceItemRow key={item.id} item={item} />)
              : <div style={{ ...G, padding: 28, textAlign: "center", color: T.inkLight, fontSize: 12.5 }}>Sem itens na fatura atual.</div>}
          </Card>
        </div>
      ))}
    </div>
  );
}
