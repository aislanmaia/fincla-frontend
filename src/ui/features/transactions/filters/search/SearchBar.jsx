import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  /* Quanto de largura sobra para os chips depois de a busca ficar com o piso
     dela. Quem sabe disso é ESTA barra — ela é a única que enxerga ao mesmo
     tempo a largura total, a busca e os outros controles. Os chips recebem o
     número pronto e decidem quantos cabem. */
  onChipsBudget = null,
  /* A tecla "/" precisa alcançar o campo, e o campo mora aqui dentro. */
  inputRef = null,
  /* O "?" da ajuda: recurso da TELA, não de uma linha nem de um filtro, então
     mora no fim da faixa de controles da tela. Redondo porque todo o resto da
     barra é retangular — a forma diz "isto não recorta a lista" sem rótulo. */
  onHelp = null,
}) {
  const barRef = useRef(null);
  const buscaRef = useRef(null);

  /* O anel ACENDE E APAGA — ele não é `:focus` estático.
     Quando o foco chega pelo mouse a pessoa já sabe onde ele está: ela acabou
     de clicar ali. Quando chega pela tecla `/` não há nada: o cursor aparece
     num campo que continua igual, e o atalho fica indistinguível de não ter
     funcionado. O que falta não é o ESTADO "estou aqui" (o cursor piscando já
     diz isso) — é o EVENTO "o foco acabou de chegar". Evento tem começo e fim,
     então o anel também tem. */
  const [anelAceso, setAnelAceso] = useState(false);
  const anelTimerRef = useRef(null);
  const acenderAnel = useCallback((e) => {
    /* `:focus-visible` é exatamente a pergunta certa — o navegador já distingue
       foco por teclado de foco por clique, e replicar essa heurística à mão dá
       errado em teclado virtual, leitor de tela e caneta. */
    const alvo = e?.currentTarget;
    if (alvo && typeof alvo.matches === "function") {
      try { if (!alvo.matches(":focus-visible")) return; } catch { /* jsdom antigo */ }
    }
    setAnelAceso(false);
    clearTimeout(anelTimerRef.current);
    /* Dois quadros: remover e recolocar a classe no MESMO quadro não reinicia a
       animação, e um segundo `/` seguido não acenderia nada. */
    requestAnimationFrame(() => requestAnimationFrame(() => setAnelAceso(true)));
    anelTimerRef.current = setTimeout(() => setAnelAceso(false), 620);
  }, []);
  useEffect(() => () => clearTimeout(anelTimerRef.current), []);
  const chipsRef = useRef(null);
  const vaoRef = useRef(null);

  /* O orçamento dos chips = largura da barra − os outros controles − o PISO da
     busca. O piso é o maior entre 280 px absolutos e 40% da barra: o mínimo
     protege telas pequenas, e a cota é o que faz sobrar mais espaço para chips
     conforme a tela cresce, sem tabela de breakpoints.
     Uma escada de breakpoints erra sempre que um nome é longo — "Alimentação
     fora de casa" tem o dobro de "Casa" — e erra estourando a busca, que é o
     controle mais usado da barra. */
  const medeOrcamento = useCallback(() => {
    const bar = barRef.current;
    const busca = buscaRef.current;
    if (!bar || !busca || typeof onChipsBudget !== "function") return;
    const total = bar.clientWidth;
    if (total <= 0) return;
    /* Largura dos CHIPS agora — só o que é descartável.
       Somar o slot inteiro incluía o botão "Filtros" e o "+N", que ficam de
       qualquer jeito, e inflava o orçamento em ~95 px: a conta liberava dois
       chips onde cabia um, e a busca terminava abaixo do próprio piso. */
    const bar2 = barRef.current;
    let chipsAgora = 0;
    const marcados = bar2 ? bar2.querySelectorAll("[data-chip]") : [];
    marcados.forEach((el) => { chipsAgora += el.getBoundingClientRect().width + 6; });
    /* O VÃO também é orçamento. Sem contá-lo, a barra tratava o espaço vazio
       como controle imóvel: em 1920 a busca já estava no teto de 720 px, sobrava
       um vão de ~600 px e a conta liberava ZERO chips — menos que em 1440. */
    const vao = vaoRef.current ? vaoRef.current.getBoundingClientRect().width : 0;
    const outros = Math.max(0, total - busca.offsetWidth - chipsAgora - vao);
    const piso = Math.max(280, Math.round(total * 0.4));
    onChipsBudget(Math.max(0, total - outros - piso));
  }, [onChipsBudget]);

  useLayoutEffect(medeOrcamento);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !barRef.current) return undefined;
    const ro = new ResizeObserver(medeOrcamento);
    ro.observe(barRef.current);
    return () => ro.disconnect();
  }, [medeOrcamento]);

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
      ref={barRef}
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
        ref={buscaRef}
        className={anelAceso ? "fincla-focus-ring" : undefined}
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
             ser usável — é ela que cede espaço por último, não primeiro.

             E NÃO há teto. Havia um `maxWidth: 720`, e ele fazia a barra de
             comando terminar num vão morto: num monitor de 2560 a busca parava
             na metade e o resto da linha ficava vazio. O `flex: 100` acima foi
             escrito justamente para ela levar quase toda a sobra — o teto
             desfazia isso silenciosamente a partir de ~1500 px. Caixa de
             comando ocupa a linha que tem. */
          minWidth: 180,
          height: 32,
          /* NÃO há transição aqui, e não é esquecimento: a largura da busca vem
             de distribuição de espaço livre do flex, que não é uma propriedade
             animável. Quem anima é a faixa de chips (o `max-width` medido em
             `TransactionsFilterChips`) — ela é que empurra, e animar quem empurra
             produz o mesmo movimento. Declarar `transition` neste elemento seria
             CSS morto, do tipo que engana quem lê o código depois. */
          border: `1px solid ${T.border}`,
          borderRadius: 9,
          background: T.bg,
          padding: "0 10px",
        }}
      >
        <Icon name="search" size={14} color={T.inkLight} />
        <input
          ref={inputRef}
          value={search}
          onFocus={acenderAnel}
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
      <span ref={vaoRef} style={{ flex: 1, minWidth: 0 }} />
      <span ref={chipsRef} style={{ display: "contents" }}>{chips}</span>
      <Sep />
      <SortButton sort={sort} setSort={setSort} />
      {trailing}
      {onHelp && (
        <button
          type="button"
          onClick={onHelp}
          aria-label="Atalhos de teclado"
          title="Atalhos de teclado (?)"
          style={{
            ...G, width: 28, height: 28, borderRadius: 999, flex: "none",
            border: `1px solid ${T.border}`, background: T.surface, color: T.inkMid,
            fontWeight: 800, fontSize: 13, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ?
        </button>
      )}
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
