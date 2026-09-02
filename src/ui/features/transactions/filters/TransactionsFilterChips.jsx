import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { T } from "../../../tokens";
import { G } from "../../../typography";

/**
 * Os filtros ATIVOS, dentro da barra de comando.
 *
 * Substituem a faixa permanente de nove cards de faceta: aquela linha custava
 * 57 px de altura o tempo todo para mostrar sobretudo "Todas / Todos /
 * Qualquer" — nove rótulos que só informam quando algum sai do padrão, que é
 * exatamente o que um chip diz por si.
 *
 * Cada chip faz duas coisas distintas, e o alvo de clique separa as duas: o
 * corpo ABRE o painel daquela facet (para ajustar), o "✕" REMOVE só aquele
 * filtro. Um chip que só removesse obrigaria a reabrir o painel pelo caminho
 * longo para trocar um valor.
 *
 * Overflow: a partir de `maxVisible` os excedentes viram um chip de contagem
 * que abre a lista inteira. Uma linha que quebra em três empurraria a lista
 * para baixo — o problema que esta tela existe para resolver.
 */

/* 32, não 28. A barra de comando tem duas famílias de controle — pílulas
   (Visualizações, Filtros, os chips do que está filtrando) e botões de ícone
   (ordenação, recarregar, "⋯") — e elas estavam em alturas diferentes: 28
   contra 32. Numa fileira única de alvos, altura diferente não lê como
   hierarquia, lê como desalinhamento. 32 é a altura dos botões de ícone e um
   alvo mais confortável para o ponteiro. */
const CHIP_H = 32;
/* Teto de chips visíveis. Acima disso o olho varre em vez de ler — e "+5" com
   dois chips informa mais que "+2" com cinco, porque admite que há um painel a
   abrir. */
const TETO_CHIPS = 4;

/* Quantos chips cabem no orçamento, MEDINDO o texto de cada um.
   Uma escada de breakpoints (1440 → 3 chips) erra no dia em que a pessoa filtra
   por "Alimentação fora de casa": ela tem o dobro de "Casa" e a conta feita no
   olho estoura a busca, que é o controle mais usado da barra. */
let medidorChips = null;
export function chipsQueCabem(rotulos, orcamento, { teto = TETO_CHIPS } = {}) {
  if (!Array.isArray(rotulos) || rotulos.length === 0) return 0;
  if (!(orcamento > 0)) return 0;
  const estimativa = (t) => Math.ceil(String(t).length * 6.4);
  let mede = estimativa;
  try {
    if (typeof document !== "undefined") {
      if (!medidorChips) medidorChips = document.createElement("canvas");
      const ctx = medidorChips.getContext && medidorChips.getContext("2d");
      if (ctx) {
        mede = (t) => {
          try {
            ctx.font = "600 11.5px 'Geist', 'DM Sans', system-ui, sans-serif";
            return Math.ceil(ctx.measureText(t).width);
          } catch {
            return estimativa(t);
          }
        };
      }
    }
  } catch {
    mede = estimativa;
  }

  const PAD = 42; // medido no DOM: padding do chip + o alvo de 20px do "✕"
  const GAP = 6;
  const MAIS = 40; // a pílula "+N" quando sobra alguém

  let usado = 0;
  let n = 0;
  const limite = Math.min(teto, rotulos.length);
  for (let i = 0; i < limite; i += 1) {
    const w = Math.min(200, mede(rotulos[i]) + PAD) + (n > 0 ? GAP : 0);
    // Se ainda vai sobrar gente, o "+N" também precisa caber.
    const reserva = i + 1 < rotulos.length ? GAP + MAIS : 0;
    if (usado + w + reserva > orcamento) break;
    usado += w;
    n += 1;
  }
  return n;
}

/** Pílula base da barra. `tone`: 'on' (filtro ativo) | 'ghost' | 'plain'. */
function chipStyle(tone) {
  const base = {
    ...G,
    height: CHIP_H,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 11.5,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
    cursor: "pointer",
    flexShrink: 0,
  };
  if (tone === "on") {
    return { ...base, background: T.blueLight, border: "1px solid #BFD3FA", color: T.blue };
  }
  if (tone === "ghost") {
    return { ...base, background: T.surface, border: `1px dashed ${T.border}`, color: T.inkGhost };
  }
  return { ...base, background: T.surface, border: `1px solid ${T.border}`, color: T.inkMid };
}

/** Contador dentro de um chip (o "+3" do overflow, e o total no "Filtros").
 *
 * Redondo de verdade — `minWidth` igual à altura — e não uma pílula apertada:
 * um dígito solto num retângulo de 5 px de padding lê como texto do botão, não
 * como contagem. Com dois dígitos ele estica, o que é inevitável e continua
 * legível como badge. */
/* Funil: a porta do sistema de filtros. Traço de 2 px como os demais ícones
   da barra, para não destoar do recarregar nem do de ordenação. */
function FunilIcone() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18l-7 8v5l-4 2v-7z" />
    </svg>
  );
}

function CountBadge({ n, prefix = "", flutuante = false }) {
  return (
    <span
      style={{
        ...G,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: T.blue,
        color: "#fff",
        borderRadius: 999,
        lineHeight: 1,
        flexShrink: 0,
        /* FLUTUANTE no modo só-ícone. Ancorado, ele disputa a largura com o
           próprio ícone dentro de um botão de 32 px: sobra menos de 14 px para
           o funil, que deixa de ser reconhecível — o alvo vira dois símbolos
           espremidos em vez de um ícone com um contador.
           Flutuando no canto ele não custa largura nenhuma, e é onde a
           convenção já o coloca (notificação sobre o alvo que ela conta).
           Menor e sem `padding` lateral: 16 px de diâmetro sobre um botão de
           32 é a proporção que ainda lê sem virar um segundo botão. */
        /* Contador sobreposto fica FORA da caixa, mordendo o canto superior
           direito — é assim em toda barra de app, e é o que o mantém legível
           sem tapar o ícone que ele qualifica. Tentei o contrário (encostado
           dentro do botão) para escapar de um recorte, e o resultado foi o
           contador cobrindo o funil: resolver recorte escondendo conteúdo é
           trocar um defeito por outro.
           O recorte foi aberto na origem — a faixa de chips ganhou folga (ver
           `paddingTop/Right` lá embaixo). O anel da cor do fundo separa o
           contador do que estiver atrás dele. */
        ...(flutuante
          ? {
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 15,
              height: 15,
              padding: n > 9 ? "0 3px" : 0,
              fontSize: 9.5,
              fontWeight: 800,
              border: `1.5px solid ${T.surface}`,
              boxSizing: "content-box",
            }
          : { minWidth: 18, height: 18, padding: "0 5px", fontSize: 11, fontWeight: 700 }),
      }}
    >
      {prefix}
      {n}
    </span>
  );
}

export function TransactionsFilterChips({
  facets = [],
  searchActive = false,
  searchLabel = "",
  onOpenFacet,
  /** Leva à aba "Ativos". Presente, o "+N" navega em vez de abrir o popover. */
  onAbrirAtivos = null,
  onClearFacet,
  onClearAll,
  maxVisible = 3,
  /* Abaixo de 1280 o botão vira o FUNIL com contador. Ele é a porta do sistema
     de filtros inteiro, então não pode sumir — mas o rótulo pode, e ali o
     contador deixa de ser redundante: sem chips na barra, ele é a ÚNICA
     resposta a "quantos filtros estão aplicados". */
  filtrosSoIcone = false,
  /* Orçamento medido pela barra. Quando presente, ele MANDA — `maxVisible` fica
     como piso para quem renderiza os chips fora da barra (testes, mocks). */
  chipsBudget = null,
  compact = false,
  /** Abre/fecha o painel de facetas — o chip "＋ Filtros" da proposta. */
  filtersOpen = false,
  onToggleFilters,
  /** Recolhe TODOS os chips no contador do "＋ Filtros" (telas estreitas). */
  collapsed = false,
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef(null);
  const stripRef = useRef(null);
  const [larguraNatural, setLarguraNatural] = useState(null);

  const chips = [
    ...(searchActive
      ? [{ key: "busca", label: "Busca", value: `"${searchLabel}"` }]
      : []),
    ...facets.filter((f) => f.active),
  ];

  /* O contador conta VALORES aplicados, não facetas — `multi` é quantos valores
     a faceta carrega, e é o mesmo número que já produz o rótulo do chip
     ("2 categorias"). Contando facetas, o badge dizia "1" colado num chip
     dizendo "2 categorias", enquanto o painel de Ativos dizia "2 filtros" para
     o mesmo estado: três superfícies, duas respostas.
     Abaixo de 1280 isso deixa de ser inconsistência e vira perda de informação:
     sem chips na barra, este número é a ÚNICA resposta a "quanto está
     filtrando".
     Separado de `chips.length` de propósito: aquele é a lista RENDERIZADA e
     alimenta o cálculo de quantos cabem e o "+N" de estouro. */
  const valoresAplicados = chips.reduce((n, c) => n + (c.multi || 1), 0);

  useEffect(() => {
    if (!overflowOpen) return undefined;
    const onDown = (e) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) setOverflowOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOverflowOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [overflowOpen]);

  /* O TETO manda; o orçamento só BAIXA dele.
     Antes o orçamento substituía o teto, e por isso a barra exibia três chips
     em qualquer largura em que eles coubessem — inclusive espremendo a busca
     para 210 px. Mas só teto também não serve: o chip não tem largura fixa
     (medido: "Tags · 2" custa 64 px e "Categoria · Lazer & Entretenimento",
     214), então um teto de 3 truncaria os longos.
     Os dois juntos: o teto por faixa dá PREVISIBILIDADE (a barra não se
     rearranja sozinha quando se troca uma tag por uma categoria de nome longo),
     e o orçamento garante que nada trunque. */
  const cabem =
    chipsBudget == null
      ? maxVisible
      : Math.min(
          maxVisible,
          chipsQueCabem(chips.map((c) => String(c.value ?? c.label ?? "")), chipsBudget),
        );

  useEffect(() => {
    if (chips.length <= cabem) setOverflowOpen(false);
  }, [chips.length, cabem]);

  /* Mede o conteúdo sem o teto e devolve o teto medido, para a transição ter
     dois valores concretos entre os quais correr. */
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const anterior = el.style.maxWidth;
    el.style.maxWidth = "none";
    const w = el.scrollWidth;
    el.style.maxWidth = anterior;
    setLarguraNatural((prev) => (prev === w ? prev : w));
  });

  // Abaixo de ~1200 px os chips não cabem sem espremer a busca: recolhem para o
  // contador do próprio "＋ Filtros", como já acontece no mobile.
  const shown = collapsed ? [] : chips.slice(0, cabem);
  const hidden = collapsed ? chips : chips.slice(cabem);

  /* O rótulo diz o que o clique FAZ. Um botão que abre e fecha e não muda de
     texto obriga a olhar a tela para descobrir em que estado se está — e no
     desktop o painel abre ancorado, longe do botão. */
  const filtrosChip = (
    <button
      type="button"
      /* Alvo do voo da label "N a pagar": marcado explicitamente porque um
         seletor por `aria-label` casava antes com o grupo que o contém. */
      data-fly-target="filtros"
      onClick={onToggleFilters}
      aria-expanded={filtersOpen}
      /* O `aria-label` SUBSTITUI todo o conteúdo do botão no cálculo do nome
         acessível — com ele fixo, o contador dentro do botão não é anunciado, e
         o ponto do contador (o número decide se vale abrir) sumia para quem usa
         leitor de tela. O gêmeo do mobile já dobra a contagem no nome; aqui
         faltava. */
      aria-label={
        filtersOpen
          ? "Fechar filtros"
          : chips.length > 0
            ? `Abrir filtros — ${valoresAplicados} aplicado${valoresAplicados === 1 ? "" : "s"}`
            : "Abrir filtros"
      }
      title={filtrosSoIcone
        ? (filtersOpen ? "Fechar filtros" : `Filtros${valoresAplicados ? ` — ${valoresAplicados} aplicado${valoresAplicados === 1 ? "" : "s"}` : ""}`)
        : undefined}
      style={{
        ...chipStyle(filtersOpen ? "on" : "ghost"),
        ...(filtersOpen ? {} : { borderStyle: "dashed" }),
        ...(filtrosSoIcone
          ? {
              width: CHIP_H,
              height: CHIP_H,
              padding: 0,
              justifyContent: "center",
              position: "relative",
              /* `overflow: visible` explícito: o contador flutuante mora FORA
                 da caixa do botão (canto superior direito), e qualquer recorte
                 no caminho o come pela metade — foi o que aconteceu. */
              overflow: "visible",
            }
          : null),
      }}
    >
      {/* O FUNIL fica, aberto ou fechado. Trocar por "✕" no modo ícone
          quebrava a permanência do alvo: o mesmo botão passava a ter dois
          símbolos, e um "✕" com um contador azul em cima lê como "fechar o
          quê?". O estado já é dito pelo destaque do botão e pelo `aria-label`
          — o ícone é a IDENTIDADE do controle, não o estado dele.
          Com rótulo há espaço para a frase inteira, e aí "✕ Fechar filtros"
          continua sendo a leitura mais direta. */}
      {filtrosSoIcone
        ? <FunilIcone />
        : (filtersOpen ? "✕ Fechar filtros" : "＋ Filtros")}
      {/* O contador aparece SEMPRE que há filtro, não só quando os chips
          recolhem: o destaque do botão diz *que* há filtro, o número diz
          *quantos* — e a segunda é a pergunta que decide se vale abrir. */}
      {chips.length > 0 && <CountBadge n={valoresAplicados} flutuante={filtrosSoIcone} />}
    </button>
  );

  if (chips.length === 0) return filtrosChip;

  return (
    <div
      role="group"
      aria-label="Filtros aplicados"
      /* `overflow: hidden` é rede de segurança, não o mecanismo: o `+N` é quem
         controla quantos chips aparecem. Medido em 1280 com a busca no piso, os
         chips têm ~490 px disponíveis contra um teto aritmético de ~446 — 44 px
         de margem. Fina o bastante para que, sem a guarda, um chip a mais
         pintasse POR CIMA da ordenação em vez de ser cortado. */
      ref={stripRef}
      /* A faixa de chips cresce com transição, e é ela que empurra a busca.
         O `max-width` precisa ser a largura MEDIDA do conteúdo: com um valor
         constante (900) ele nunca restringe, e uma propriedade que não muda não
         anima — a declaração ficava lá sem efeito nenhum, e os 96 px continuavam
         sumindo num quadro só. Animar a busca diretamente não funciona: a
         largura dela vem de distribuição de espaço livre, que não é animável. */
      style={{
        display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden",
        transition: "max-width .34s cubic-bezier(.4,0,.2,1)",
        maxWidth: larguraNatural == null ? "none" : larguraNatural,
        /* FOLGA para o contador sobreposto do botão de filtros.
           `overflow: hidden` aqui é obrigatório — é ele que faz a animação de
           largura recortar os chips que saem —, e ele corta na borda da caixa
           de PADDING. Dando padding no topo e à direita, o badge (que mora em
           `top:-5; right:-5` do botão) passa a cair dentro dessa caixa e para
           de ser comido; a margem negativa devolve o espaço, então nada se
           move na barra. */
        paddingTop: 6,
        paddingRight: 6,
        marginTop: -6,
        marginRight: -6,
      }}
    >
      {shown.map((f) => (
        <Chip key={f.key} facet={f} compact={compact} onOpen={onOpenFacet} onClear={onClearFacet} />
      ))}

      {!collapsed && hidden.length > 0 && (
        <div ref={overflowRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            /* Com um lugar para ir, o "+N" LEVA em vez de listar. O popover
               mostrava os chips escondidos e parava aí: para remover vários era
               um clique por chip, num painel flutuante de 200 px. A aba
               "Ativos" já existe, já lista tudo com um "remover" ao lado de
               cada um, e é onde a pessoa vai acabar indo de qualquer forma. */
            onClick={() => (onAbrirAtivos ? onAbrirAtivos() : setOverflowOpen((v) => !v))}
            aria-expanded={onAbrirAtivos ? undefined : overflowOpen}
            aria-label={
              onAbrirAtivos
                /* Só o que está ESCONDIDO. Contar os visíveis junto prometia um
                   número que o painel não repete — ele divide facetas de vários
                   valores em uma linha cada, então os dois nunca bateriam. O que
                   o "+N" tem a dizer é quantos não couberam. */
                ? `Ver mais ${hidden.length} ${hidden.length === 1 ? "filtro" : "filtros"}`
                : `Mais ${hidden.length} ${hidden.length === 1 ? "filtro" : "filtros"}`
            }
            title={onAbrirAtivos ? "Ver todos os filtros ativos" : undefined}
            style={chipStyle("on")}
          >
            <CountBadge n={hidden.length} prefix="+" />
          </button>
          {overflowOpen && !onAbrirAtivos && (
            <div
              className="fincla-scroll"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                zIndex: 40,
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                boxShadow: "0 12px 32px rgba(15,25,40,.14)",
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minWidth: 200,
                maxHeight: "min(50dvh, 320px)",
                overflowY: "auto",
              }}
            >
              {hidden.map((f) => (
                <Chip
                  key={f.key}
                  facet={f}
                  compact={compact}
                  /* `noMedir`: estes chips vivem no popover do "+N", que é
                     absoluto. Eles não ocupam lugar no fluxo, mas eram contados
                     pela barra como se ocupassem — abrir o "+N" inflava o
                     orçamento em centenas de px, liberava mais chips, o popover
                     re-renderizava com menos, e o par oscilava até estourar a
                     profundidade de atualização do React. */
                  noMedir
                  block
                  onOpen={(key) => {
                    setOverflowOpen(false);
                    onOpenFacet?.(key);
                  }}
                  onClear={onClearFacet}
                />
              ))}
              <button
                type="button"
                onClick={() => {
                  setOverflowOpen(false);
                  onClearAll?.();
                }}
                style={{
                  ...G,
                  marginTop: 2,
                  padding: "5px 8px",
                  borderRadius: 8,
                  border: "none",
                  background: "none",
                  color: T.inkLight,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Limpar tudo
              </button>
            </div>
          )}
        </div>
      )}

      {filtrosChip}
    </div>
  );
}

function Chip({ facet, onOpen, onClear, compact, block = false, noMedir = false }) {
  return (
    <span
      /* Marca o que é CHIP de verdade. A barra soma a largura destes para saber
         quanto espaço os chips podem devolver à busca — somar o slot inteiro
         incluía o botão "Filtros", que não é descartável, e inflava o orçamento
         em ~95 px. */
      data-chip={noMedir ? undefined : "1"}
      style={{
        ...chipStyle("on"),
        paddingRight: 4,
        cursor: "default",
        maxWidth: block ? "none" : compact ? 140 : 200,
        width: block ? "100%" : undefined,
      }}
    >
      <button
        type="button"
        onClick={() => onOpen?.(facet.key)}
        // Nome DISTINTO do card da FacetBar, que se chama "Tipo: Despesa".
        // Dois controles com o mesmo nome fazendo coisas diferentes são
        // indistinguíveis para quem navega por leitor de tela.
        aria-label={`Filtro aplicado — ${facet.label}, ${facet.value}. Ajustar.`}
        style={{
          ...G,
          display: "inline-flex",
          alignItems: "center",
          minWidth: 0,
          flex: block ? 1 : undefined,
          border: "none",
          background: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 11.5,
          fontWeight: 600,
          color: "inherit",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {facet.value}
      </button>
      <button
        type="button"
        onClick={() => onClear?.(facet.key)}
        aria-label={`Remover filtro ${facet.label}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          // 20px é o alvo mínimo que ainda cabe num chip de 28px de altura;
          // menor que isso o "✕" vira uma armadilha de precisão no toque.
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: "none",
          background: "none",
          color: "inherit",
          opacity: 0.6,
          cursor: "pointer",
          flexShrink: 0,
          padding: 0,
          fontSize: 11,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </span>
  );
}
