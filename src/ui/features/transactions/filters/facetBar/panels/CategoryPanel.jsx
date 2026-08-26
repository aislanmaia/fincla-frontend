import React, { useState } from "react";
import { T } from "../../../../../tokens";
import { G } from "../../../../../typography";
import { Icon } from "../../shared/Icon.jsx";
import { FacetCount } from "../../shared/FacetCount.jsx";
import { PanelHeader } from "./PanelHeader.jsx";

/**
 * `categories`: lista de `{ id, label, color, icon }` injetada via props.
 * Substitui o `window.CATS` do protótipo — origem: `useCategoryTagsData`.
 */
export function CategoryPanel({
  cats,
  setCats,
  categories = [],
  counts,
  onClose,
  compact = false,
}) {
  const [search, setSearch] = useState("");
  const filtered = categories.filter((c) =>
    c.label.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div>
      <PanelHeader
        title="Categoria"
        hint="Selecione uma ou mais para combinar com OU"
        onClose={onClose}
        compact={compact}
      />
      {/* Quebra em duas linhas quando estreito: no painel ancorado o pane tem
          ~250 px, e busca + Limpar + Todas lado a lado cortavam o texto dos
          botões. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14,
        flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar categoria…"
          aria-label="Buscar categoria"
          style={{
            ...G,
            flex: "1 1 140px",
            minWidth: 0,
            padding: "9px 12px",
            borderRadius: 9,
            border: `1px solid ${T.border}`,
            fontSize: 12.5,
            outline: "none",
            color: T.ink,
          }}
        />
        <button
          type="button"
          onClick={() => setCats([])}
          style={textBtnStyle(T.inkLight)}
        >
          Limpar
        </button>
        {/* fincla-frontend#96 (revisão adversarial da PR #96, prioridade 1):
            "Todas" chamava `setCats(categories.map(c => c.id))` — array CHEIO,
            não vazio. Duas consequências ruins: (1) com a exclusão mútua
            Categoria/Tags, um array não-vazio apaga qualquer tag ativa (o
            usuário perdia o filtro de tag ao clicar num botão que lê como
            "não filtrar por categoria"); (2) `mapCatsToLegacy` já traduz
            "todas selecionadas" de volta para "todas" (sem filtro) — ou seja,
            o resultado da query sempre foi idêntico ao de `setCats([])`. Só
            que o chip da facet mostrava "N categorias" (parece filtro ativo)
            em vez de "Todas". `setCats([])` entrega o mesmo resultado sem
            nenhum dos dois efeitos colaterais. */}
        <button
          type="button"
          onClick={() => setCats([])}
          style={{ ...textBtnStyle(T.ink), fontWeight: 700 }}
        >
          Todas
        </button>
      </div>
      {categories.length === 0 ? (
        <div
          style={{
            ...G,
            padding: 18,
            background: T.bg,
            borderRadius: 10,
            color: T.inkLight,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Nenhuma categoria disponível.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            /* `minmax(0, 1fr)`, nunca `1fr` puro. O padrão de `1fr` é
               `minmax(auto, 1fr)`, e `auto` NÃO encolhe abaixo do conteúdo:
               um nome longo ("Financiamentos e empréstimos") empurrava a
               trilha e a grade inteira transbordava na horizontal — o painel
               ganhava barra lateral, que o shell proíbe. O rótulo já sabe
               truncar; faltava deixá-lo poder. */
            gridTemplateColumns: compact ? "minmax(0, 1fr)" : "repeat(3, minmax(0, 1fr))",
            gap: compact ? 6 : 8,
          }}
        >
          {filtered.map((c) => {
            const active = cats.includes(c.id);
            // As categorias da UI são tags (id = UUID), então quem conta é a
            // facet `tag` do backend — a facet `category` conta a coluna de
            // texto legada, que não é o que estes botões filtram.
            const n = counts?.optionCount("tag", c.id);
            return (
              <button
                type="button"
                key={c.id}
                onClick={() =>
                  setCats(active ? cats.filter((x) => x !== c.id) : [...cats, c.id])
                }
                aria-pressed={active}
                aria-label={c.label}
                style={{
                  ...G,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1.5px solid ${active ? c.color : T.border}`,
                  background: active ? `${c.color}10` : T.surface,
                  cursor: "pointer",
                  textAlign: "left",
                  /* O card também precisa poder encolher: item de grade tem
                     `min-width: auto`, e sem isto a trilha `minmax(0,1fr)`
                     ainda seria esticada pelo conteúdo dele. */
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: `${c.color}1f`,
                    color: c.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {c.icon || "●"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      ...G,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: T.ink,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.label}
                  </div>
                </div>
                <FacetCount n={n} active={active} />
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `1.5px solid ${active ? c.color : T.border}`,
                    background: active ? c.color : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {active && <Icon name="check" size={10} color="#fff" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function textBtnStyle(color) {
  return {
    ...G,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 11.5,
    color,
    fontWeight: 600,
  };
}
