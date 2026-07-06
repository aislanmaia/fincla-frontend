import React from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import {
  getPaymentMethodOptions,
  isPaymentMethodAllowedForType,
} from "../../paymentMethodOptions.js";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

const TYPE_HINT = {
  todos: "Mostrando todas as formas. Ao escolher um tipo, a lista se ajusta.",
  receita: "Opções compatíveis com receitas.",
  despesa: "Opções compatíveis com despesas.",
};

export function PaymentMethodPanel({
  type = "todos",
  method = [],
  setMethod,
  onClose,
  compact = false,
}) {
  const options = getPaymentMethodOptions(type);

  const select = (value) => {
    const next = method.includes(value)
      ? method.filter((item) => item !== value)
      : [...method, value];
    if (typeof setMethod === "function") setMethod(next);
  };

  const selectAll = () => {
    if (typeof setMethod === "function") setMethod([]);
  };

  return (
    <div>
      <PanelHeader
        title="Forma de pagamento"
        hint={TYPE_HINT[type] || TYPE_HINT.todos}
        onClose={onClose}
        compact={compact}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr" : "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={selectAll}
          aria-pressed={method.length === 0}
          aria-label="Todas as formas"
          style={optionStyle(method.length === 0, compact)}
        >
          <OptionIcon active={method.length === 0} compact={compact} />
          <div>
            <div style={titleStyle}>Todas</div>
            <div style={hintStyle}>Sem filtro por forma</div>
          </div>
        </button>
        {options.map(([value, label]) => {
          const active = method.includes(value);
          const allowed = isPaymentMethodAllowedForType(value, type);
          return (
            <button
              type="button"
              key={value}
              onClick={() => select(value)}
              aria-pressed={active}
              aria-label={label}
              disabled={!allowed}
              style={optionStyle(active, compact)}
            >
              <OptionIcon active={active} compact={compact} />
              <div>
                <div style={titleStyle}>{label}</div>
                <div style={hintStyle}>{type === "receita" ? "Entrada" : type === "despesa" ? "Saída" : "Receita ou despesa"}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function optionStyle(active, compact) {
  return {
    ...G,
    display: "flex",
    alignItems: "center",
    gap: compact ? 10 : 12,
    padding: compact ? "10px 12px" : "14px 14px",
    borderRadius: 12,
    border: `1.5px solid ${active ? T.ink : T.border}`,
    background: active ? T.bg : T.surface,
    cursor: "pointer",
    textAlign: "left",
  };
}

function OptionIcon({ active, compact }) {
  return (
    <div
      style={{
        width: compact ? 26 : 28,
        height: compact ? 26 : 28,
        borderRadius: 8,
        background: active ? T.ink : `${T.ink}12`,
        color: active ? "#fff" : T.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon name={active ? "check" : "wallet"} size={compact ? 12 : 13} color={active ? "#fff" : T.ink} />
    </div>
  );
}

const titleStyle = { ...G, fontSize: 13, fontWeight: 700, color: T.ink };
const hintStyle = { ...G, fontSize: 11, color: T.inkLight, marginTop: 2 };
