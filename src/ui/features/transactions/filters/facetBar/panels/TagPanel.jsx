import React, { useState } from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

/**
 * Painel da facet "Tags".
 *
 * Duas coisas que ele ganhou e valem o comentário:
 *
 * 1. **Mesma gramática do painel de Categoria** — linhas de opção com nome,
 *    contagem e caixa de seleção. Antes eram pílulas soltas: dois padrões
 *    diferentes para a mesma tarefa, e a contagem não cabia em nenhum.
 * 2. **OU / E explícito.** Já foi single-select porque o backend aceitava um
 *    `tag_id` só (fincla-frontend#96 achado 3). Agora ele aceita vários, e a
 *    pergunta "qualquer uma ou todas juntas?" tem duas respostas legítimas que
 *    devolvem conjuntos MUITO diferentes — deixar isso implícito faria a lista
 *    parecer errada metade das vezes.
 */
export function TagPanel({
  tags,
  setTags,
  allTags = [],
  loading = false,
  error = false,
  tagMode = "any",
  setTagMode,
  counts,
  onClose,
  compact = false,
}) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const visible = allTags.filter((tg) => tg.toLowerCase().includes(term));

  return (
    <div>
      <PanelHeader
        title="Tags"
        hint="Selecione uma ou mais"
        onClose={onClose}
        compact={compact}
      />

      {/* O modo vem ANTES da lista: ele muda o significado de cada marcação
          abaixo, então escolher depois obrigaria a reler o que já foi marcado. */}
      {setTagMode && (
        <div
          role="group"
          aria-label="Como combinar as tags"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 3,
            padding: 3,
            background: T.grayLight,
            borderRadius: 9,
            marginBottom: 12,
          }}
        >
          {[
            ["any", "Qualquer uma (OU)"],
            ["all", "Todas juntas (E)"],
          ].map(([value, label]) => {
            const on = tagMode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTagMode(value)}
                aria-pressed={on}
                style={{
                  ...G,
                  height: 28,
                  borderRadius: 7,
                  border: "none",
                  background: on ? T.surface : "transparent",
                  boxShadow: on ? "0 1px 2px rgba(0,0,0,.06)" : "none",
                  color: on ? T.ink : T.inkMid,
                  fontSize: 11.5,
                  fontWeight: on ? 700 : 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar tag…"
        aria-label="Buscar tag"
        style={{
          ...G,
          width: "100%",
          padding: "9px 12px",
          borderRadius: 9,
          border: `1px solid ${T.border}`,
          fontSize: 12.5,
          outline: "none",
          color: T.ink,
          marginBottom: 12,
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
          {/* "Carregando" e "erro" precisam de mensagem própria: sem elas, um
              catálogo a caminho ou uma falha de rede liam como "você não tem
              tag nenhuma" (fincla-frontend#96 achado 5). */}
          {loading
            ? "Carregando tags…"
            : error
              ? "Não foi possível carregar suas tags agora. Tente novamente em instantes."
              : allTags.length === 0
                ? "Nenhuma tag cadastrada."
                : "Nenhuma tag encontrada."}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0,1fr))",
            gap: 7,
          }}
        >
          {visible.map((tg) => {
            const active = tags.includes(tg);
            // A facet guarda NOMES; o backend indexa a contagem por id, então a
            // busca aqui é pelo rótulo que ele devolve junto.
            const n = counts?.optionCountByLabel("tag", tg);
            return (
              <button
                type="button"
                key={tg}
                onClick={() =>
                  setTags(active ? tags.filter((x) => x !== tg) : [...tags, tg])
                }
                aria-pressed={active}
                aria-label={`Tag ${tg}`}
                style={{
                  ...G,
                  minHeight: 36,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "0 10px",
                  borderRadius: 9,
                  border: `1px solid ${active ? "#BFD3FA" : T.border}`,
                  background: active ? T.blueLight : T.surface,
                  color: active ? T.blue : T.inkMid,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  // Zero continua clicável, só apagado: avisa antes do clique
                  // que a opção levaria a uma lista vazia.
                  opacity: n === 0 && !active ? 0.45 : 1,
                }}
              >
                <span
                  style={{
                    minWidth: 0,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  #{tg}
                </span>
                {n != null && (
                  <span
                    aria-label={`${n} ${n === 1 ? "transação" : "transações"}`}
                    style={{
                      ...G,
                      fontFamily: "'Geist Mono', ui-monospace, monospace",
                      fontSize: 11,
                      fontWeight: 500,
                      color: active ? T.blue : T.inkGhost,
                      flexShrink: 0,
                    }}
                  >
                    {n}
                  </span>
                )}
                <span
                  aria-hidden="true"
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: 4,
                    flexShrink: 0,
                    border: `1.5px solid ${active ? T.blue : T.border}`,
                    background: active ? T.blue : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {active && <Icon name="check" size={9} color="#fff" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
