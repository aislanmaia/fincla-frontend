import React, { useState } from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

/**
 * fincla-frontend#96 (revisão adversarial da PR #96, achado 3): o painel
 * prometia "todas as tags marcadas" (AND entre várias), mas o backend só
 * aceita UM `tag_id` por chamada — o filtro real sempre foi limitado a uma
 * tag. Antes só a primeira selecionada ia pra query, então marcar uma
 * segunda tag ou não mudava nada (superconjunto silencioso) ou, se a
 * primeira não resolvesse, apagava o filtro inteiro. Virou single-select de
 * verdade: clicar numa tag troca a seleção em vez de somar, e a promessa da
 * UI passa a bater com o que a API entrega.
 */
export function TagPanel({ tags, setTags, allTags = [], loading = false, onClose }) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const visible = allTags.filter((tg) => tg.toLowerCase().includes(term));

  return (
    <div>
      <PanelHeader
        title="Tags"
        hint="Filtra transações que tenham esta tag (uma por vez)"
        onClose={onClose}
      />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar tag…"
        aria-label="Buscar tag"
        style={{
          ...G,
          width: "100%",
          padding: "10px 13px",
          borderRadius: 9,
          border: `1px solid ${T.border}`,
          fontSize: 12.5,
          outline: "none",
          color: T.ink,
          marginBottom: 14,
          boxSizing: "border-box",
        }}
      />
      {visible.length === 0 ? (
        <div
          style={{
            ...G,
            padding: 16,
            background: T.bg,
            borderRadius: 10,
            color: T.inkLight,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          {/* Achado 5: "carregando" precisa de mensagem própria — senão o
              catálogo ainda a caminho lê como "você não tem tags nenhuma". */}
          {loading
            ? "Carregando tags…"
            : allTags.length === 0
              ? "Nenhuma tag cadastrada."
              : "Nenhuma tag encontrada."}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {visible.map((tg) => {
            const active = tags.includes(tg);
            return (
              <button
                type="button"
                key={tg}
                // Single-select: marcar uma tag substitui a seleção anterior
                // (nunca soma); clicar na já marcada limpa o filtro.
                onClick={() => setTags(active ? [] : [tg])}
                aria-pressed={active}
                aria-label={`Tag ${tg}`}
                style={{
                  ...G,
                  padding: "6px 11px",
                  borderRadius: 99,
                  border: `1.5px solid ${active ? T.ink : T.border}`,
                  background: active ? T.ink : T.surface,
                  color: active ? "#fff" : T.inkMid,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {active && <Icon name="check" size={10} color="#fff" />}
                #{tg}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
