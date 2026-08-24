import React from "react";
import { T } from "../../../../tokens";
import { G } from "../../../../typography";
import { Icon } from "../shared/Icon.jsx";
import { SortButton } from "./SortButton.jsx";

/**
 * Barra de comando da tela de Transações.
 *
 * No desktop é UMA linha, na ordem do artefato: visualização salva · busca ·
 * chips do que está filtrando · ＋ Filtros · ordenação · densidade. Ela
 * substituiu a faixa permanente de nove cards de faceta, que custava 57 px de
 * altura o tempo todo para mostrar sobretudo "Todas / Todos / Qualquer".
 *
 * A busca é ELÁSTICA e o espaçador vem ANTES dos chips. Antes era o contrário:
 * a busca tinha 460 px fixos e o espaçador ficava depois dos chips, deixando um
 * vão morto no meio da barra — 400 px em 1500, 782 px em 1920 — enquanto o
 * controle que mais se beneficia de largura ficava travado. Trocar a ordem faz o
 * vão virar campo de busca e cola chips · Filtros · ordenação num bloco só à
 * direita; antes "Filtros" ficava à esquerda e "Ordenar" na outra ponta, dois
 * controles do mesmo assunto separados pelo vão.
 *
 * O teto continua existindo, só que muito mais alto: sem NENHUM teto a busca
 * esticava por ~2000 px num monitor de 3440.
 *
 * Modo `compact`: input em uma linha, SortButton em linha separada abaixo
 * (cada um ocupa 100% da largura). Look and feel de app nativo mobile.
 */
export function SearchBar({
  search,
  setSearch,
  sort,
  setSort,
  placeholder = "Buscar por descrição, valor, tag…",
  compact = false,
  hideSearchField = false,
  leading = null,
  chips = null,
  trailing = null,
}) {
  if (compact) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!hideSearchField && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              padding: "12px 14px",
              boxShadow: T.sm,
            }}
          >
            <Icon name="search" size={16} color={T.inkLight} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              aria-label="Buscar transações"
              style={{
                ...G,
                flex: 1,
                minWidth: 0,
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 15,
                color: T.ink,
              }}
            />
          </div>
        )}
        <SortButton sort={sort} setSort={setSort} compact />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 52,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 13,
        padding: "0 12px",
        boxShadow: T.sm,
      }}
    >
      {leading}
      {leading && <Sep />}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          /* `flex: 100` contra o `flex: 1` do espaçador: os dois crescem, mas a
             sobra vai quase toda para a busca ATÉ ela bater no teto — só então o
             espaçador recebe o resto e empurra o recorte para a direita. Com
             `flex: 1` nos dois eles dividiam a sobra meio a meio e a busca
             empacava em 422 px num monitor de 1500. */
          flex: 100,
          /* 180 px é o piso: abaixo disso o placeholder some e a busca deixa de
             ser usável — é ela que cede espaço por último, não primeiro. */
          minWidth: 180,
          maxWidth: 720,
          height: 32,
          border: `1px solid ${T.border}`,
          borderRadius: 9,
          background: T.bg,
          padding: "0 10px",
        }}
      >
        <Icon name="search" size={14} color={T.inkLight} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          aria-label="Buscar transações"
          style={{
            ...G,
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 12.5,
            color: T.ink,
          }}
        />
      </div>
      {/* O vão fica AQUI, entre a busca e o recorte: é o que empurra chips,
          Filtros e ordenação para a direita como um bloco só. */}
      <span style={{ flex: 1, minWidth: 0 }} />
      {chips}
      <Sep />
      <SortButton sort={sort} setSort={setSort} />
      {trailing}
    </div>
  );
}

/** Fio vertical que separa os grupos da barra. */
function Sep() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 1, height: 22, background: T.border, flex: "none" }}
    />
  );
}
