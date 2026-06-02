/* eslint-disable no-undef */
// Conteúdo de cada panel de facet (Period, Type, Category, Tag, Card, Value, Rec).
// Extraído para arquivo separado para manter variation-c.jsx focado em layout/modos.

function PanelHeader({ title, hint, onClose }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div>
        <div style={{ ...G, fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: "-0.01em" }}>{title}</div>
        {hint && <div style={{ ...G, fontSize: 11.5, color: T.inkLight, marginTop: 2 }}>{hint}</div>}
      </div>
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex" }}
      >
        <Icon name="x" size={14} color={T.inkMid} />
      </button>
    </div>
  );
}

function PeriodPanel({ period, setPeriod, onClose, compact = false }) {
  const opts = [
    { v: "tudo", l: "Todo período" },
    { v: "hoje", l: "Hoje" },
    { v: "semana", l: "Esta semana" },
    { v: "mes", l: "Este mês" },
    { v: "mes-ant", l: "Mês anterior" },
    { v: "3m", l: "Últimos 3m" },
    { v: "ano", l: "Este ano" },
  ];
  return (
    <div>
      <PanelHeader title="Período" hint="Escolha um intervalo rápido ou personalize as datas" onClose={onClose} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {opts.map((o) => {
          const active = period === o.v;
          return (
            <button
              key={o.v}
              onClick={() => setPeriod(o.v)}
              style={{
                ...G,
                padding: "8px 14px",
                borderRadius: 99,
                border: `1.5px solid ${active ? T.ink : T.border}`,
                background: active ? T.ink : T.surface,
                color: active ? "#fff" : T.inkMid,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {active && <Icon name="check" size={11} color="#fff" />}
              {o.l}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr 1fr" : "1fr 1fr 1fr",
          gap: 14,
          alignItems: "flex-start",
          borderTop: `1px solid ${T.border}`,
          paddingTop: 14,
        }}
      >
        <div>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            De
          </div>
          <input
            type="text"
            defaultValue="01/05/2026"
            style={{
              ...G, ...MONO,
              width: "100%", padding: "9px 11px", borderRadius: 9,
              border: `1px solid ${T.border}`, fontSize: 13, outline: "none", color: T.ink,
            }}
          />
        </div>
        <div>
          <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Até
          </div>
          <input
            type="text"
            defaultValue="22/05/2026"
            style={{
              ...G, ...MONO,
              width: "100%", padding: "9px 11px", borderRadius: 9,
              border: `1px solid ${T.border}`, fontSize: 13, outline: "none", color: T.ink,
            }}
          />
        </div>
        {!compact && (
          <div>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Intervalo
            </div>
            <div
              style={{
                ...G, ...MONO,
                padding: "9px 11px", borderRadius: 9, background: T.bg,
                border: `1px solid ${T.border}`, fontSize: 13, color: T.inkMid,
              }}
            >
              22 dias
            </div>
          </div>
        )}
      </div>

      {!compact && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: T.bg, borderRadius: 10, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ ...G, fontSize: 10.5, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Distribuição diária
            </div>
            <div style={{ ...G, fontSize: 11, color: T.inkLight }}>14 transações</div>
          </div>
          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 36 }}>
            {[8, 4, 12, 6, 14, 3, 9, 11, 2, 7, 13, 5, 10, 15, 4, 8, 11, 7, 9, 6, 12, 5].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h * 5}%`, background: i > 7 && i < 18 ? T.ink : T.borderHov, borderRadius: 2, minHeight: 4 }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TypePanel({ type, setType, onClose, compact = false }) {
  return (
    <div>
      <PanelHeader title="Tipo" onClose={onClose} />
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
        {[
          { v: "todos", l: "Todos", hint: "Receitas e despesas", icon: "filter", color: T.ink },
          { v: "receita", l: "Receita", hint: "Entradas no caixa", icon: "trending", color: T.green },
          { v: "despesa", l: "Despesa", hint: "Saídas e gastos", icon: "trending-down", color: T.red },
        ].map((o) => {
          const active = type === o.v;
          return (
            <button
              key={o.v}
              onClick={() => setType(o.v)}
              style={{
                ...G,
                display: "flex",
                flexDirection: compact ? "row" : "column",
                alignItems: compact ? "center" : "flex-start",
                gap: compact ? 10 : 8,
                padding: compact ? "10px 12px" : "16px 16px",
                borderRadius: 12,
                border: `1.5px solid ${active ? o.color : T.border}`,
                background: active ? `${o.color}08` : T.surface,
                cursor: "pointer",
                textAlign: "left",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: compact ? 26 : 30,
                  height: compact ? 26 : 30,
                  borderRadius: 8,
                  background: active ? o.color : `${o.color}15`,
                  color: active ? "#fff" : o.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={o.icon} size={compact ? 13 : 15} color={active ? "#fff" : o.color} />
              </div>
              <div style={{ flex: compact ? 1 : "initial" }}>
                <div style={{ ...G, fontSize: 14, fontWeight: 700, color: T.ink }}>{o.l}</div>
                <div style={{ ...G, fontSize: 11.5, color: T.inkLight, marginTop: 2 }}>{o.hint}</div>
              </div>
              {active && (
                <div
                  style={{
                    ...(compact
                      ? { marginLeft: "auto" }
                      : { position: "absolute", top: 12, right: 12 }),
                    width: 18, height: 18, borderRadius: "50%",
                    background: o.color, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="check" size={10} color="#fff" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryPanel({ cats, setCats, onClose, compact = false }) {
  return (
    <div>
      <PanelHeader title="Categoria" hint="Selecione uma ou mais para combinar com OU" onClose={onClose} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <input
          placeholder="Buscar categoria…"
          style={{
            ...G, flex: 1, padding: "9px 12px", borderRadius: 9,
            border: `1px solid ${T.border}`, fontSize: 12.5, outline: "none", color: T.ink,
          }}
        />
        <button
          onClick={() => setCats([])}
          style={{ ...G, background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: T.inkLight, fontWeight: 600 }}
        >
          Limpar
        </button>
        <button
          onClick={() => setCats(window.CATS.map((c) => c.id))}
          style={{ ...G, background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: T.ink, fontWeight: 700 }}
        >
          Todas
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "repeat(3, 1fr)", gap: 8 }}>
        {window.CATS.map((c) => {
          const active = cats.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => setCats(active ? cats.filter((x) => x !== c.id) : [...cats, c.id])}
              style={{
                ...G,
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10,
                border: `1.5px solid ${active ? c.color : T.border}`,
                background: active ? `${c.color}10` : T.surface,
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: `${c.color}1f`, color: c.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, flexShrink: 0,
                }}
              >
                {c.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...G, fontSize: 12.5, fontWeight: 700, color: T.ink }}>{c.label}</div>
                <div style={{ ...G, fontSize: 10.5, color: T.inkLight }}>{Math.floor(Math.random() * 30 + 3)} transações</div>
              </div>
              <div
                style={{
                  width: 16, height: 16, borderRadius: 4,
                  border: `1.5px solid ${active ? c.color : T.border}`,
                  background: active ? c.color : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {active && <Icon name="check" size={10} color="#fff" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TagPanel({ tags, setTags, onClose }) {
  return (
    <div>
      <PanelHeader title="Tags" hint="Filtra transações que tenham todas as tags marcadas" onClose={onClose} />
      <input
        placeholder="Buscar ou criar tag…"
        style={{
          ...G, width: "100%", padding: "10px 13px", borderRadius: 9,
          border: `1px solid ${T.border}`, fontSize: 12.5, outline: "none", color: T.ink, marginBottom: 14,
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {window.TAGS.map((tg) => {
          const active = tags.includes(tg);
          return (
            <button
              key={tg}
              onClick={() => setTags(active ? tags.filter((x) => x !== tg) : [...tags, tg])}
              style={{
                ...G, padding: "6px 11px", borderRadius: 99,
                border: `1.5px solid ${active ? T.ink : T.border}`,
                background: active ? T.ink : T.surface,
                color: active ? "#fff" : T.inkMid,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              {active && <Icon name="check" size={10} color="#fff" />}
              #{tg}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CardPanel({ cardSel, setCardSel, onClose, compact = false }) {
  return (
    <div>
      <PanelHeader title="Cartão" hint="Filtre por um ou mais cartões cadastrados" onClose={onClose} />
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
        {window.CARDS.map((c) => {
          const active = cardSel.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => setCardSel(active ? cardSel.filter((x) => x !== c.id) : [...cardSel, c.id])}
              style={{
                ...G, position: "relative",
                display: "flex", flexDirection: "column", gap: 16,
                padding: "14px 16px", borderRadius: 12,
                border: `1.5px solid ${active ? T.ink : T.border}`,
                background: active ? T.bg : T.surface,
                cursor: "pointer", textAlign: "left", overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 56, height: 36, borderRadius: 6,
                  background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)`,
                  position: "relative",
                  boxShadow: "inset 0 -8px 12px rgba(0,0,0,0.12)",
                }}
              >
                <div style={{ position: "absolute", bottom: 4, right: 6, color: "#fff", ...MONO, fontSize: 9, fontWeight: 700, opacity: 0.95 }}>
                  ●●{c.last4}
                </div>
              </div>
              <div>
                <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>{c.label}</div>
                <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>
                  Fatura abre dia {[5, 10, 18][window.CARDS.indexOf(c) % 3]}
                </div>
              </div>
              {active && (
                <div
                  style={{
                    position: "absolute", top: 12, right: 12,
                    width: 20, height: 20, borderRadius: "50%",
                    background: T.ink, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Icon name="check" size={11} color="#fff" />
                </div>
              )}
            </button>
          );
        })}
        <button
          style={{
            ...G,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 6,
            padding: "14px 16px", borderRadius: 12,
            border: `1.5px dashed ${T.border}`,
            background: "transparent", cursor: "pointer",
            color: T.inkLight, fontSize: 11.5, fontWeight: 600,
          }}
        >
          <Icon name="plus" size={14} />
          Adicionar cartão
        </button>
      </div>
    </div>
  );
}

function ValuePanel({ onClose }) {
  return (
    <div>
      <PanelHeader title="Faixa de valor" hint="Filtre por valor absoluto da transação" onClose={onClose} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        {[
          { lbl: "Mínimo", val: "200,00" },
          { lbl: "Máximo", ph: "sem limite" },
        ].map((f) => (
          <div key={f.lbl}>
            <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              {f.lbl}
            </div>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 12px", borderRadius: 9,
                border: `1px solid ${T.border}`, background: T.surface,
              }}
            >
              <span style={{ ...G, fontSize: 12, color: T.inkLight, fontWeight: 600 }}>R$</span>
              <input
                defaultValue={f.val}
                placeholder={f.ph}
                style={{
                  ...G, ...MONO, flex: 1,
                  border: "none", outline: "none", background: "transparent",
                  fontSize: 14, color: T.ink, fontWeight: 600,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 14px", background: T.bg, borderRadius: 10, border: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ ...G, fontSize: 10.5, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Distribuição
          </div>
          <div style={{ ...MONO, fontSize: 11, color: T.inkLight }}>R$0 — R$3.400</div>
        </div>
        <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 40 }}>
          {[6, 12, 18, 24, 22, 18, 14, 9, 7, 5, 3, 2, 2, 1, 1, 0, 0, 1, 0, 0, 0, 1].map((h, i) => (
            <div key={i} style={{ flex: 1, height: `${Math.max(6, h * 4)}%`, background: i >= 4 ? T.ink : T.borderHov, borderRadius: 2 }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, ...G, fontSize: 10, color: T.inkLight }}>
          <span>R$0</span>
          <span style={{ color: T.ink, fontWeight: 700 }}>R$200 (mínimo)</span>
          <span>R$3,4k</span>
        </div>
      </div>
    </div>
  );
}

function RecPanel({ rec, setRec, onClose, compact = false }) {
  return (
    <div>
      <PanelHeader title="Recorrência" hint="Lançamentos que se repetem (assinaturas, salário, aluguel…)" onClose={onClose} />
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
        {[
          { v: "any", l: "Todas", hint: "Sem filtro", icon: "filter" },
          { v: "yes", l: "Apenas recorrentes", hint: "Repetem todo período", icon: "repeat", color: T.blue },
          { v: "no", l: "Apenas únicas", hint: "Lançamento isolado", icon: "circle" },
        ].map((o) => {
          const active = rec === o.v;
          const col = o.color || T.ink;
          return (
            <button
              key={o.v}
              onClick={() => setRec(o.v)}
              style={{
                ...G,
                display: "flex",
                flexDirection: compact ? "row" : "column",
                alignItems: compact ? "center" : "flex-start",
                gap: compact ? 10 : 8,
                padding: "14px 14px", borderRadius: 12,
                border: `1.5px solid ${active ? col : T.border}`,
                background: active ? `${col}08` : T.surface,
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: active ? col : `${col}15`,
                  color: active ? "#fff" : col,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon name={o.icon} size={13} color={active ? "#fff" : col} />
              </div>
              <div>
                <div style={{ ...G, fontSize: 13, fontWeight: 700, color: T.ink }}>{o.l}</div>
                <div style={{ ...G, fontSize: 11, color: T.inkLight, marginTop: 2 }}>{o.hint}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, {
  PanelHeader, PeriodPanel, TypePanel, CategoryPanel,
  TagPanel, CardPanel, ValuePanel, RecPanel,
});
