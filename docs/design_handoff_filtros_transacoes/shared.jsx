/* eslint-disable no-undef */
// Tokens espelhando design system do Fincla
const T = {
  bg: "#F8F7F5",
  surface: "#FFFFFF",
  surfaceHov: "#F9FAFB",
  border: "#E2E5EA",
  borderHov: "#D1D5DB",
  ink: "#0F0F0D",
  inkMid: "#374151",
  inkLight: "#4B5563",
  inkGhost: "#9CA3AF",
  blue: "#2563EB",
  blueLight: "#EFF6FF",
  red: "#DC2626",
  redLight: "#FEF2F2",
  green: "#059669",
  greenLight: "#ECFDF5",
  amber: "#D97706",
  amberLight: "#FFFBEB",
  purple: "#7C3AED",
  purpleLight: "#F5F3FF",
  grayLight: "#F3F4F6",
  sm: "0 1px 2px rgba(0,0,0,0.05)",
  md: "0 4px 12px rgba(0,0,0,0.07)",
  lg: "0 8px 28px rgba(0,0,0,0.10)",
  xl: "0 16px 48px rgba(0,0,0,0.14)",
};
const G = { fontFamily: "'Geist', 'DM Sans', system-ui, sans-serif" };
const S = { fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: "italic" };
const MONO = { fontFamily: "'Geist Mono', ui-monospace, monospace" };

const fmtBRL = (v) =>
  "R$\u00a0" + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

// Categorias com cor (do app)
const CATS = [
  { id: "alim", label: "Alimentação", color: "#059669", icon: "🍽" },
  { id: "trans", label: "Transporte", color: "#2563EB", icon: "🚗" },
  { id: "moradia", label: "Moradia", color: "#6B7280", icon: "🏠" },
  { id: "saude", label: "Saúde", color: "#DC2626", icon: "❤" },
  { id: "ass", label: "Assinaturas", color: "#7C3AED", icon: "↻" },
  { id: "lazer", label: "Lazer", color: "#D97706", icon: "🎬" },
  { id: "compras", label: "Compras", color: "#0891B2", icon: "🛍" },
  { id: "edu", label: "Educação", color: "#7C3AED", icon: "📚" },
  { id: "receita", label: "Receita", color: "#059669", icon: "💸" },
];
const CAT_BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));

const CARDS = [
  { id: "nub-1177", label: "Nubank", last4: "1177", color: "#7C3AED" },
  { id: "itau-4421", label: "Itaú Click", last4: "4421", color: "#FF7A00" },
  { id: "inter-8809", label: "Inter Gold", last4: "8809", color: "#FF6E2C" },
];

const TAGS = [
  "trabalho", "casa", "casal", "filhos", "viagem", "presente",
  "emergência", "reembolsável", "investimento", "imposto", "férias", "saúde-pet",
];

const METHODS = ["Crédito", "Débito", "Pix", "Dinheiro", "Boleto", "Transferência"];

// Dataset mock
const TX = [
  { id: 1, date: "22/05", desc: "Salário Pegasus", cat: "receita", val: 12500, method: "Transferência", rec: true, tags: ["trabalho"] },
  { id: 2, date: "21/05", desc: "iFood — Marmita Saudável", cat: "alim", val: -54.9, method: "Crédito", card: "nub-1177", tags: [] },
  { id: 3, date: "21/05", desc: "Uber para o aeroporto", cat: "trans", val: -82.4, method: "Crédito", card: "nub-1177", tags: ["viagem", "trabalho"] },
  { id: 4, date: "20/05", desc: "Spotify Família", cat: "ass", val: -34.9, method: "Crédito", card: "nub-1177", rec: true, tags: ["casa"] },
  { id: 5, date: "20/05", desc: "Mercado Pão de Açúcar", cat: "alim", val: -487.6, method: "Débito", tags: ["casa"] },
  { id: 6, date: "19/05", desc: "Farmácia Pague Menos", cat: "saude", val: -128.3, method: "Pix", tags: ["saúde-pet"] },
  { id: 7, date: "18/05", desc: "Cinema Iguatemi", cat: "lazer", val: -94, method: "Crédito", card: "itau-4421", tags: ["casal"] },
  { id: 8, date: "17/05", desc: "Aluguel — Apto Vila Mariana", cat: "moradia", val: -3400, method: "Boleto", rec: true, tags: ["casa"] },
  { id: 9, date: "16/05", desc: "Curso Frontend Masters", cat: "edu", val: -89.9, method: "Crédito", card: "nub-1177", rec: true, parcela: { atual: 2, total: 12 }, tags: ["trabalho"] },
  { id: 10, date: "15/05", desc: "Posto Shell", cat: "trans", val: -312, method: "Crédito", card: "itau-4421", tags: [] },
  { id: 11, date: "14/05", desc: "Zara — Camiseta linho", cat: "compras", val: -189, method: "Crédito", card: "nub-1177", parcela: { atual: 1, total: 3 }, tags: ["presente"] },
  { id: 12, date: "13/05", desc: "Restaurante Mocotó", cat: "alim", val: -267, method: "Crédito", card: "inter-8809", tags: ["casal"] },
  { id: 13, date: "12/05", desc: "Netflix", cat: "ass", val: -55.9, method: "Crédito", card: "nub-1177", rec: true, tags: [] },
  { id: 14, date: "11/05", desc: "Reembolso Latam", cat: "receita", val: 412, method: "Pix", tags: ["viagem"] },
];

// Saved views default
const SAVED_VIEWS = [
  { id: "v1", label: "Despesas do mês", icon: "📅", color: T.ink },
  { id: "v2", label: "Cartão Nubank", icon: "💳", color: "#7C3AED" },
  { id: "v3", label: "Acima de R$200", icon: "↕", color: T.amber },
  { id: "v4", label: "Recorrentes", icon: "↻", color: T.blue },
];

// ─────────────────────────────────────────────────────────
// Lista de transações compartilhada (versão hi-fi)
// ─────────────────────────────────────────────────────────
function TxList({ items, dense = false }) {
  const groups = {};
  items.forEach((t) => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });
  const ordered = Object.entries(groups);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ordered.map(([date, txs]) => {
        const sum = txs.reduce((s, t) => s + t.val, 0);
        return (
          <div key={date}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px 6px" }}>
              <div style={{ ...G, fontSize: 11, fontWeight: 700, color: T.inkMid, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {date}
              </div>
              <div style={{ flex: 1, height: 1, background: T.border }} />
              <div style={{ ...MONO, fontSize: 11, fontWeight: 700, color: sum >= 0 ? T.green : T.inkLight }}>
                {sum >= 0 ? "+" : "−"}
                {fmtBRL(sum)}
              </div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              {txs.map((tx, i) => (
                <TxRow key={tx.id} tx={tx} last={i === txs.length - 1} dense={dense} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TxRow({ tx, last, dense }) {
  const cat = CAT_BY_ID[tx.cat];
  const isReceita = tx.val > 0;
  const card = tx.card ? CARDS.find((c) => c.id === tx.card) : null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: dense ? "10px 14px" : "13px 16px",
        borderBottom: last ? "none" : `1px solid ${T.border}`,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: `${cat.color}15`,
          color: cat.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          flexShrink: 0,
        }}
      >
        {cat.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...G, fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>
          {tx.desc}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ ...G, fontSize: 11, color: cat.color, fontWeight: 600 }}>{cat.label}</span>
          <span style={{ ...G, fontSize: 11, color: T.inkGhost }}>·</span>
          <span style={{ ...G, fontSize: 11, color: T.inkMid }}>{tx.method}</span>
          {card && (
            <>
              <span style={{ ...G, fontSize: 11, color: T.inkGhost }}>·</span>
              <span style={{ ...G, ...MONO, fontSize: 10.5, color: T.inkMid, letterSpacing: "0.02em" }}>
                ●● {card.last4}
              </span>
            </>
          )}
          {tx.parcela && (
            <>
              <span style={{ ...G, fontSize: 11, color: T.inkGhost }}>·</span>
              <span style={{ ...MONO, fontSize: 11, color: T.blue, fontWeight: 600 }}>
                {tx.parcela.atual}/{tx.parcela.total}×
              </span>
            </>
          )}
          {tx.rec && (
            <span
              style={{
                ...G,
                fontSize: 10,
                color: T.blue,
                background: T.blueLight,
                borderRadius: 99,
                padding: "1px 6px",
                fontWeight: 700,
              }}
            >
              ↻
            </span>
          )}
          {(tx.tags || []).map((tg) => (
            <span
              key={tg}
              style={{
                ...G,
                fontSize: 10,
                color: T.inkMid,
                background: T.grayLight,
                borderRadius: 99,
                padding: "1px 7px",
                fontWeight: 500,
              }}
            >
              #{tg}
            </span>
          ))}
        </div>
      </div>
      <div style={{ ...MONO, fontSize: 13.5, fontWeight: 700, color: isReceita ? T.green : T.ink, flexShrink: 0 }}>
        {isReceita ? "+" : "−"}
        {fmtBRL(tx.val)}
      </div>
    </div>
  );
}

// KPI strip compartilhado
function KpiStrip({ items }) {
  const totReceita = items.filter((t) => t.val > 0).reduce((s, t) => s + t.val, 0);
  const totDespesa = items.filter((t) => t.val < 0).reduce((s, t) => s + Math.abs(t.val), 0);
  const saldo = totReceita - totDespesa;
  const data = [
    { label: "Receitas", val: totReceita, color: T.green, bg: T.greenLight, sign: "+" },
    { label: "Despesas", val: totDespesa, color: T.red, bg: T.redLight, sign: "−" },
    { label: "Saldo", val: saldo, color: saldo >= 0 ? T.green : T.red, bg: saldo >= 0 ? T.greenLight : T.redLight, sign: saldo >= 0 ? "+" : "−" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
      {data.map((k) => (
        <div
          key={k.label}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: "14px 18px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 3,
              height: "100%",
              background: k.color,
            }}
          />
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            {k.label}
          </div>
          <div style={{ ...MONO, fontSize: 18, fontWeight: 800, color: k.color, letterSpacing: "-0.01em" }}>
            {k.sign}
            {fmtBRL(k.val)}
          </div>
          <div style={{ ...G, fontSize: 10.5, color: T.inkLight, marginTop: 4 }}>
            {items.length} transaç{items.length !== 1 ? "ões" : "ão"}
          </div>
        </div>
      ))}
    </div>
  );
}

// Title compartilhado
function PageHeader() {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
      <h1 style={{ margin: 0, lineHeight: 1.05, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ ...G, fontSize: 28, fontWeight: 800, color: T.ink, letterSpacing: "-0.025em" }}>Minhas</span>
        <span style={{ ...S, fontSize: 30, color: T.ink }}>Transações</span>
      </h1>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          style={{
            ...G,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 13px",
            borderRadius: 9,
            border: `1px solid ${T.border}`,
            background: T.surface,
            fontSize: 12,
            fontWeight: 600,
            color: T.inkMid,
            cursor: "pointer",
          }}
        >
          <Icon name="download" size={13} /> CSV
        </button>
        <button
          style={{
            ...G,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 13px",
            borderRadius: 9,
            border: `1px solid ${T.ink}`,
            background: T.ink,
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          + Nova transação
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Mini-icones SVG (sem libs externas)
// ─────────────────────────────────────────────────────────
function Icon({ name, size = 14, color = "currentColor", strokeWidth = 1.8 }) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  switch (name) {
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
      );
    case "x":
      return (
        <svg {...props}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...props}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "filter":
      return (
        <svg {...props}>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...props}>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      );
    case "download":
      return (
        <svg {...props}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case "save":
      return (
        <svg {...props}>
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...props}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "star":
      return (
        <svg {...props}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "more":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
        </svg>
      );
    case "tag":
      return (
        <svg {...props}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case "card":
      return (
        <svg {...props}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case "repeat":
      return (
        <svg {...props}>
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case "arrow-up-down":
      return (
        <svg {...props}>
          <path d="M11 5L8 2 5 5" />
          <path d="M8 2v20" />
          <path d="M13 19l3 3 3-3" />
          <path d="M16 22V2" />
        </svg>
      );
    case "command":
      return (
        <svg {...props}>
          <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
        </svg>
      );
    case "trending":
      return (
        <svg {...props}>
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case "trending-down":
      return (
        <svg {...props}>
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
          <polyline points="17 18 23 18 23 12" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...props}>
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
        </svg>
      );
    case "kbd-up":
      return (
        <svg {...props}>
          <polyline points="6 15 12 9 18 15" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...props}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
    case "circle":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "history":
      return (
        <svg {...props}>
          <path d="M1 4v6h6" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          <polyline points="12 7 12 12 16 14" />
        </svg>
      );
    default:
      return null;
  }
}

// Context para tweaks — criado aqui (no script que carrega primeiro) para ser
// compartilhado por TweaksHost (HTML inline) e as variations.
const TweaksContext = React.createContext({
  savedViews: "cards",
  facetPanel: "popover",
  facetBar: "cards",
});

Object.assign(window, {
  T, G, S, MONO, fmtBRL,
  CATS, CAT_BY_ID, CARDS, TAGS, METHODS, TX, SAVED_VIEWS,
  TxList, KpiStrip, PageHeader, Icon,
  TweaksContext,
});
