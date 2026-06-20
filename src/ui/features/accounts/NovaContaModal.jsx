import React, { useState } from "react";
import { T } from "../../tokens";
import { G } from "../../typography";
import { Btn } from "../../components/primitives";
import { ModalShell } from "./ModalShell.jsx";
import { ACCOUNT_TYPES, ACCOUNT_COLORS, ACCOUNT_ICONS, parseBRL } from "./accountMeta.js";

const inputStyle = {
  ...G,
  width: "100%",
  fontSize: 14,
  color: T.ink,
  background: T.surface,
  border: `1.5px solid ${T.border}`,
  borderRadius: 10,
  padding: "11px 12px",
  outline: "none",
  boxSizing: "border-box",
};
const labelStyle = { ...G, fontSize: 12, fontWeight: 600, color: T.inkMid, marginBottom: 6, display: "block" };

/** Modal de criar/editar conta. `account` preenchido => modo edição (sem saldo inicial). */
export function NovaContaModal({ account, onClose, onSubmit, isSaving, error }) {
  const editing = !!account;
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState(account?.type || "checking");
  const [initial, setInitial] = useState("");
  const [institution, setInstitution] = useState(account?.institution || "");
  const [color, setColor] = useState(account?.color || ACCOUNT_COLORS[0]);
  const [iconKey, setIconKey] = useState(account?.icon_key || ACCOUNT_ICONS[0]);
  const [includeInTotal, setIncludeInTotal] = useState(account?.include_in_total ?? true);

  const canSave = name.trim().length > 0 && !isSaving;

  function handleSubmit() {
    if (!canSave) return;
    const base = {
      name: name.trim(),
      type,
      institution: institution.trim() || null,
      color,
      icon_key: iconKey,
      include_in_total: includeInTotal,
    };
    onSubmit(editing ? base : { ...base, initial_balance: parseBRL(initial) });
  }

  return (
    <ModalShell
      titleSans={editing ? "Editar" : "Nova"}
      titleSerif="conta"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outGray" onClick={onClose}>Cancelar</Btn>
          <Btn variant="dark" onClick={handleSubmit}>{isSaving ? "Salvando…" : "Salvar conta"}</Btn>
        </>
      }
    >
      {error ? (
        <div style={{ ...G, fontSize: 12, color: T.red, background: T.redLight, borderRadius: 9, padding: "8px 10px", marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 8 }}>
        <label style={labelStyle}>Nome</label>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Conta corrente" autoFocus />
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelStyle}>Tipo</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, background: T.grayLight, borderRadius: 11, padding: 5 }}>
          {ACCOUNT_TYPES.map((t) => {
            const active = type === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                style={{
                  ...G,
                  textAlign: "center",
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "9px 6px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: active ? T.surface : "transparent",
                  color: active ? T.ink : T.inkLight,
                  boxShadow: active ? T.sm : "none",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {!editing ? (
        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Saldo inicial</label>
          <input style={{ ...inputStyle, fontVariantNumeric: "tabular-nums" }} value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="R$ 0,00" inputMode="decimal" />
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <label style={labelStyle}>
          Instituição <span style={{ color: T.inkGhost, fontWeight: 500 }}>(opcional)</span>
        </label>
        <input style={inputStyle} value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ex.: Nubank, Itaú…" />
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelStyle}>Cor &amp; ícone</label>
        <div style={{ display: "flex", gap: 9, marginBottom: 10, flexWrap: "wrap" }}>
          {ACCOUNT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`cor ${c}`}
              style={{
                width: 26,
                height: 26,
                borderRadius: 9999,
                background: c,
                border: "none",
                cursor: "pointer",
                boxShadow: color === c ? `0 0 0 2px ${T.surface}, 0 0 0 4px ${T.ink}` : "none",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ACCOUNT_ICONS.map((ic) => (
            <button
              key={ic}
              onClick={() => setIconKey(ic)}
              style={{ width: 32, height: 32, borderRadius: 9, border: `1.5px solid ${iconKey === ic ? T.ink : T.border}`, background: T.surface, cursor: "pointer", fontSize: 16 }}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...G, fontSize: 12, fontWeight: 600, color: T.inkMid }}>Incluir no saldo disponível</div>
          <div style={{ ...G, fontSize: 11, color: T.inkGhost, marginTop: 3 }}>Investimentos normalmente ficam fora.</div>
        </div>
        <button
          onClick={() => setIncludeInTotal((v) => !v)}
          aria-pressed={includeInTotal}
          aria-label="Incluir no saldo disponível"
          style={{ width: 42, height: 24, borderRadius: 9999, background: includeInTotal ? T.green : T.border, position: "relative", border: "none", cursor: "pointer", flex: "0 0 42px" }}
        >
          <span style={{ position: "absolute", top: 2, left: includeInTotal ? 20 : 2, width: 20, height: 20, borderRadius: 9999, background: "#fff", boxShadow: T.sm, transition: "left .15s" }} />
        </button>
      </div>
    </ModalShell>
  );
}
