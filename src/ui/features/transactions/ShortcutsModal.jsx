import React, { useEffect, useRef } from "react";
import { T } from "../../tokens";
import { G } from "../../typography";

/**
 * O painel de atalhos da tela de Transações.
 *
 * Ele existe porque atalho que ninguém sabe que existe não é recurso, é código
 * morto. As teclas de ação (P, E, D, Delete) são de propósito os MESMOS quatro
 * botões que aparecem no hover da linha, na mesma ordem: o botão ensina o nome,
 * o modal ensina a tecla — duas portas para a mesma ação em vez de dois
 * sistemas para memorizar.
 *
 * Excluir aceita as duas teclas. `Delete` é a que a pessoa procura pelo nome;
 * `Backspace` é a que existe em todo teclado — em notebook Mac o Delete literal
 * só sai com Fn+⌫. Ligar só uma deixa metade dos teclados sem o atalho ou
 * metade das pessoas sem o nome.
 */
export const GRUPOS_DE_ATALHOS = [
  [
    "Navegar",
    [
      [["↑", "↓"], "Anda entre as linhas", "rola para manter a linha visível"],
      [["Enter"], "Abre e fecha a sanfona da linha", ""],
      [["/"], "Foca a busca", ""],
      [["F"], "Abre e fecha os filtros", ""],
    ],
  ],
  [
    "Agir na linha em foco",
    [
      [["P"], "Marcar ou desmarcar como pago", ""],
      [["E"], "Editar", "a sanfona continua aberta"],
      [["D"], "Duplicar", ""],
      [["Delete", "ou", "⌫"], "Excluir", "pede confirmação"],
    ],
  ],
  [
    "Filtros",
    [
      [["Esc"], "Fecha painel, sheet ou sanfona", "na ordem em que estiverem abertos"],
      [["?"], "Abre esta ajuda", ""],
    ],
  ],
];

const teclaStyle = {
  ...G,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 22,
  height: 22,
  padding: "0 6px",
  border: `1px solid ${T.border}`,
  borderBottomWidth: 2,
  borderRadius: 6,
  background: T.bg,
  font: "700 11px/1 ui-monospace, monospace",
  color: T.ink,
};

export function ShortcutsModal({ onClose }) {
  const fecharRef = useRef(null);

  useEffect(() => {
    fecharRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 950, background: "rgba(15,23,42,.34)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Atalhos de teclado"
        onClick={(e) => e.stopPropagation()}
        className="fincla-scroll"
        style={{
          ...G, width: "min(560px, 100%)", maxHeight: "min(80dvh, 640px)", overflowY: "auto",
          background: T.surface, borderRadius: 16,
          boxShadow: "0 24px 64px rgba(15,23,42,.22)",
        }}
      >
        <header
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
            borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0,
            background: T.surface, borderRadius: "16px 16px 0 0",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 15 }}>⌨️</span>
          <h4 style={{ ...G, margin: 0, fontSize: 14.5, fontWeight: 800, flex: 1, color: T.ink }}>
            Atalhos de teclado
          </h4>
          <button
            ref={fecharRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar atalhos"
            style={{ ...teclaStyle, cursor: "pointer" }}
          >
            Esc
          </button>
        </header>

        <div style={{ padding: "6px 16px 16px" }}>
          {GRUPOS_DE_ATALHOS.map(([titulo, linhas]) => (
            <div key={titulo}>
              <div
                style={{
                  ...G, font: "700 10.5px/1 ui-monospace, monospace", letterSpacing: "0.1em",
                  textTransform: "uppercase", color: T.inkLight, margin: "14px 0 6px",
                }}
              >
                {titulo}
              </div>
              {linhas.map(([teclas, desc, obs]) => (
                <div
                  key={desc}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "5px 0",
                    fontSize: 12.5, borderBottom: `1px dashed ${T.border}`,
                  }}
                >
                  <span style={{ display: "flex", gap: 3, flex: "none" }}>
                    {teclas.map((k) =>
                      k === "ou" ? (
                        // Texto discreto, não tecla: "Delete ou ⌫" são
                        // alternativas, e `⌘ Z` logo acima é acorde — os dois
                        // não podem ler igual.
                        <span key={k} style={{ ...G, fontSize: 11, color: T.inkLight, alignSelf: "center" }}>
                          ou
                        </span>
                      ) : (
                        <span key={k} style={teclaStyle}>{k}</span>
                      ),
                    )}
                  </span>
                  <span style={{ ...G, flex: 1, color: T.inkMid }}>
                    {desc}
                    {obs ? (
                      <span style={{ color: T.inkLight, fontSize: 11.5 }}> — {obs}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <p style={{ ...G, margin: "16px 0 0", fontSize: 11.5, color: T.inkLight, lineHeight: 1.5 }}>
            Letra solta só funciona com o foco <b>fora</b> de um campo de texto — dentro da busca,
            um <b>f</b> é só um <b>f</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
