import React, { useState } from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

/**
 * Painel da facet "Tags".
 *
 * Já foi single-select: o backend aceitava um `tag_id` só, então marcar uma
 * segunda tag ou não mudava nada (superconjunto silencioso) ou apagava o
 * filtro inteiro (fincla-frontend#96 achado 3). Agora `tag_id` é repetível e
 * casa com qualquer uma das marcadas, então a promessa de multi-seleção da UI
 * volta a bater com o que a API entrega.
 */
export function TagPanel({
  tags,
  setTags,
  allTags = [],
  loading = false,
  error = false,
  counts,
  onClose,
}) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const visible = allTags.filter((tg) => tg.toLowerCase().includes(term));

  return (
    <div>
      <PanelHeader
        title="Tags"
        hint="Selecione uma ou mais — a lista traz as que tiverem qualquer uma delas"
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
              catálogo ainda a caminho lê como "você não tem tags nenhuma".
              Prioridade 3: erro TAMBÉM precisa de mensagem própria — em erro
              o chamador manda `allTags=[]` de propósito (não oferece opções
              que sempre travariam a página ao serem clicadas), então sem este
              ramo cairíamos em "Nenhuma tag cadastrada." de novo — o mesmo
              falso "você não tem tags" que o achado 5 corrigiu. */}
          {loading
            ? "Carregando tags…"
            : error
              ? "Não foi possível carregar suas tags agora. Tente novamente em instantes."
              : allTags.length === 0
                ? "Nenhuma tag cadastrada."
                : "Nenhuma tag encontrada."}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {visible.map((tg) => {
            const active = tags.includes(tg);
            // A facet guarda NOMES; o backend indexa a contagem por id, então a
            // busca aqui é pelo rótulo que ele devolve junto.
            const n = counts?.optionCountByLabel("tag", tg);
            return (
              <button
                type="button"
                key={tg}
                // Multi-seleção: `tag_id` é repetível e casa com qualquer
                // uma das tags marcadas.
                onClick={() =>
                  setTags(active ? tags.filter((x) => x !== tg) : [...tags, tg])
                }
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
                {n != null && (
                  <span
                    style={{
                      fontFamily: "'Geist Mono', ui-monospace, monospace",
                      fontSize: 11,
                      fontWeight: 600,
                      opacity: active ? 0.75 : 0.6,
                    }}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
