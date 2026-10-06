import React, { memo } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { T } from "../../../tokens";
import { G } from "../../../typography";
import { Tip } from "../../../components/Tip.jsx";
import { SWIPE_WIDTH } from "../useSwipeActions.js";
import { catBg, catColor, fmtBRL, fmtValorDaLinha } from "./transactionFormat.js";

/* O corpo dos micro-rótulos da linha (pílula de categoria, chips de tag,
   metadado). Constante e não literal porque ele aparece em DOIS lugares que
   precisam concordar: o estilo que desenha e a string de fonte do canvas que
   mede a largura da coluna. Divergir aqui não quebra nada visível — só
   desalinha as colunas por alguns pixels, que é o tipo de defeito que ninguém
   consegue atribuir depois.

   11 e não 10: é o piso WCAG que `__tests__/fontSize.test.js` guarda. */
export const MICRO_PX = 11;

/* Referência estável para o default de props de lista: `[]` inline cria um
   array novo a cada render e quebra qualquer memo que dependa dele. */
const EMPTY_ARRAY = [];

/* Duas tags visíveis e o resto no "+N". O teto por chip existe para uma tag
   comprida não decidir a largura da coluna para a página inteira. */
export const TAGS_VISIVEIS = 2;
export const TAG_MAX_PX = 78;

/**
 * Texto que existe para o leitor de tela mas não ocupa espaço.
 *
 * Abaixo de 1600 px a situação e a marca de âncora viram só um ícone — o
 * artefato reserva o rótulo para quando há largura. Sem isto, quem usa leitor
 * de tela ouviria uma linha que não diz que o lançamento está a pagar, e um
 * ícone `aria-hidden` não diz nada por definição.
 */
export const SR_ONLY = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/**
 * Ação rápida da linha. O ícone abre num botão com rótulo ao receber o cursor.
 *
 * O rótulo cresce por `max-width` (0 → 96 px) e não por `display`, porque só
 * uma propriedade animável dá a transição; com `display` o botão saltaria de
 * um tamanho para o outro. Ele cresce para a ESQUERDA porque o contêiner das
 * ações está ancorado à borda esquerda do valor — ou seja, para dentro do vão.
 *
 * Ícone sozinho obriga a decorar, e "editar" e "duplicar" são justamente os
 * dois que se confundem. O `aria-label` continua sendo a frase inteira, com a
 * descrição da transação: quem usa leitor de tela precisa saber *qual* linha
 * está prestes a excluir.
 */
const QuickAction = ({ label, text, tone, onClick, showText = true, children }) => (
  <button
    type="button"
    className={showText ? "fincla-qa" : "fincla-qa fincla-qa-mute"}
    onClick={onClick}
    aria-label={label}
    title={label}
    data-tone={tone || "neutral"}
    style={{ ...G, height:28, borderRadius:8, cursor:"pointer",
      display:"flex", alignItems:"center", justifyContent:"center", gap:0,
      fontSize:12, fontWeight:600, padding:"0 7px", background:T.surface,
      border:`1px solid ${tone === "green" ? "#B7E4CE" : tone === "red" ? "#F5C9C9" : T.border}`,
      color: tone === "green" ? T.green : tone === "red" ? T.red : T.inkMid }}>
    <span aria-hidden="true" style={{ display:"flex", flex:"none" }}>{children}</span>
    {text && <span className="lb" aria-hidden="true">{text}</span>}
  </button>
);

/**
 * Uma linha da lista, na grade do artefato.
 *
 * Colunas (desktop): data · ícone · descrição/método · categoria · [conta] ·
 * [vão] · valor · situação · chevron.
 *
 * Duas decisões da proposta que a versão anterior não tinha e que mudam a
 * leitura da tela:
 *
 * 1. A categoria sai da linha de metadados e vira uma PÍLULA em coluna
 *    própria. Empilhada como "Alimentação · Pix" ela competia com a descrição
 *    pelo mesmo eixo; numa coluna, o olho varre categorias verticalmente sem
 *    reler a descrição de cada linha.
 * 2. As ações rápidas ocupam ESSA coluna no hover, não uma coluna extra. É o
 *    único bloco da linha que pode desaparecer sem perda: data, descrição,
 *    valor e situação continuam à vista enquanto se decide o que fazer.
 */
/* `memo` porque a lista é grande e a página inteira re-renderiza a cada estado
   dela — abrir a dock, mudar de faceta, uma torrada aparecer. Medido em 1600 px
   com 34 linhas: o clique que abre a dock custava um quadro de 183 ms, e ele
   não era a montagem do painel (mantê-lo montado não mudou nada) — era esta
   lista sendo reconstruída por um estado que não diz respeito a nenhuma linha.
   O engasgo acontecia no quadro 5, antes de a transição começar: a animação
   sempre foi suave, o que travava era o que vinha antes dela.

   As props aguentam a comparação rasa: os callbacks são `useCallback`,
   `quickActions` é `useMemo`, e `anchorCovering` devolve a âncora existente ou
   `null`, nunca um objeto novo. */
export const TxRow = memo(({ tx, isMobile, isSelected, onSelect, coveringAnchor,
  rowHeight = 48, showDate = true, dateLabel = "", quickActions = null,
  readOnly = false, displayValue = null,
  onFilterByCategory = null, onFilterByTag = null, wide = false, xwide = false,
  /* Largura da coluna de tags, em px, IGUAL para todas as linhas da página.
     Zero = ninguém tem tag e a coluna não existe. */
  tagsColPx = 0,
  /* Largura da coluna de categoria, igual para toda a página. Zero = cai no
     `auto` de antes (mocks, testes). */
  catColPx = 0,
  /* Desktop ESTREITO: a pílula de categoria desce para a linha de metadados, ao
     lado do método, e a coluna própria some. A coluna era fixa em 141 px e a
     descrição é a única da grade que encolhe até zero — abaixo de 1280 os dois
     não cabem, e quem estava sumindo era a descrição. Descer em vez de esconder
     preserva o clique-para-filtrar, que é o gesto mais curto entre "vi algo" e
     "quero ver só isso". */
  catNaLinhaDeMeta = false,
  /* Quais tags já estão no filtro. O clique ALTERNA, então o rótulo precisa
     dizer qual das duas coisas ele vai fazer — dizer "Adicionar" enquanto
     remove é pior que não dizer nada. */
  tagsAtivas = EMPTY_ARRAY,
  /* Esta linha é o ponto de parada do Tab da lista. */
  isRovingStop = false,
  /* O rótulo no hover da ação cresce para DENTRO do vão. Acima de ~1200 px o vão
     comporta; abaixo, o botão volta a ser só o ícone em vez de invadir a
     descrição. Vem como prop própria e não de `wide` (≥1600): amarrá-lo a `wide`
     deixava 1500 px — onde há vão de sobra — sem rótulo nenhum. */
  showActionLabels = false,
  swipe = null, flash = false,
  /* A linha está saindo: a COR da saída mora aqui, e o colapso de altura no
     wrapper. Separados porque cada um precisa de um elemento diferente. */
  leaving = false,
  /* §28: esta linha está esperando o servidor terminar uma ação dela. */
  busy = false,
  born = false }) => {
  const isRefund   = tx.type === "refund";
  const isReceita  = tx.type === "income" || isRefund;
  const hasParcela = !!tx.parcela && !isRefund;
  const isCredito  = tx.paymentMethodKey === "credito" || tx.method === "Crédito";
  const hasRefundsLinked = tx.refundsSummary && tx.refundsSummary.count > 0;
  const tags       = tx.tags || [];
  const avatarBg   = isRefund ? T.greenLight : catBg(tx.cat);
  const catCol     = catColor(tx.cat);
  const dense      = rowHeight <= 40;

  // Método é o único metadado que sobra sob a descrição. Para crédito ele
  // carrega os 4 dígitos, que só fazem sentido colados nele.
  const methodLine = isCredito
    ? `Crédito${tx.parcela?.cartao ? " ●● " + (tx.parcela.cartao.split("••")[1] || "").trim() : ""}`
    : tx.method;

  const iconPx = dense ? 22 : rowHeight <= 50 ? 28 : 30;
  const accountLabel = tx.accountLabel || tx.contaLabel || "";


  /* A grade nasce das medições do artefato. As colunas de conta e de rótulo da
     situação só existem acima de 1600 px: abaixo disso a descrição precisa da
     largura, e uma coluna de conta espremida em 60 px não informa nada. */
  const columns = [
    showDate ? (isMobile ? "44px" : "54px") : null,
    `${iconPx}px`,
    // A descrição tem TETO, e o vão vem depois da categoria. Com ela flexível
    // até o fim, a pílula era empurrada para o meio da tela e o olho perdia o
    // par descrição↔categoria, que é o que se lê junto. A conta saiu da grade
    // e voltou para a linha de metadados, ao lado do método: uma coluna
    // inteira repetindo "Conta principal" informava menos do que custava.
    /* A descrição ganha TETO sempre que existe coluna de tags, não só acima de
       1600. Sem isso a premissa do §16 se quebra: descrição e vão são dois
       tracks `1fr`, então uma coluna de tags de 190 px sai METADE do vão e
       METADE da descrição — em 1500 a descrição perdia ~95 px, exatamente o
       custo que o desenho dizia não existir. Com teto, o que sobra vai todo
       para o vão, e é o vão que paga. */
    xwide ? "minmax(0,520px)" : wide ? "minmax(0,420px)"
      : tagsColPx > 0 ? "minmax(0,380px)" : "minmax(0,1fr)",
    catNaLinhaDeMeta ? null : catColPx > 0 ? `${catColPx}px` : "auto",
    /* TAGS colada na categoria — não no fim da linha. O vão já existe e está
       vazio (336 px em 1500, 613 em 1920), então a coluna cabe ali sem tirar um
       pixel da descrição; e ficando ao lado da categoria, as duas leem como uma
       hierarquia só em vez de dois campos soltos.
       A largura é a MESMA em todas as linhas (medida na página, não por linha):
       cada `.fincla-row` é uma grade independente, então `max-content` daria uma
       largura por linha e as tags desalinhariam de cima a baixo — o mesmo defeito
       que já tinha desalinhado as categorias.
       Zero quando ninguém na página tem tag: espaço permanente para mostrar o
       vazio é o pior negócio da tela, e tag é opt-in. */
    tagsColPx > 0 ? `${tagsColPx}px` : null,
    /* O vão tem PISO quando há ações rápidas. Elas são absolutas e ancoradas à
       borda direita dele, então um vão menor que o grupo (~146 px só de ícones)
       faz o grupo transbordar para a ESQUERDA, por cima da coluna de tags — e
       os chips de tag são botões, então o alvo de "filtrar por tag" some sob o
       de "Editar". Medido: em 1280, com a coluna de tags presente, o clique na
       tag era interceptado pela ação. */
    /* O piso CEDE quando a linha aperta — é o último degrau da ordem de
       sacrifício. Ele existe para as ações (absolutas, ancoradas ao vão) não
       transbordarem por cima da COLUNA DE TAGS, cujos chips são botões: o alvo
       de "filtrar por tag" sumia sob o de "Editar". Quando a linha aperta essa
       coluna já não existe (`tagsColPx` zera abaixo de 1000 px de lista), então
       o motivo do piso também não. Sem ele, as ações passam a crescer por cima
       da DESCRIÇÃO no hover — que não é alvo de clique próprio (a linha inteira
       é), e só enquanto o cursor está ali. */
    quickActions ? (catNaLinhaDeMeta ? "0px" : "minmax(156px, 1fr)") : "1fr",
    dense ? "88px" : "100px",
    // Situação: com largura, o anel ganha o rótulo. Só o anel obriga a decorar
    // o que ele significa — e há espaço de sobra aqui.
    readOnly ? null : wide ? "76px" : "18px",
    // Não há mais coluna de ações. Elas eram uma coluna DEPOIS do valor —
    // reservada mesmo vazia, para nada se mover no hover —, mas isso punha o
    // valor no meio de quatro botões quando o valor é o que fecha a linha na
    // leitura da esquerda para a direita.
    //
    // Agora elas são ABSOLUTAS, ancoradas ao `right: 100%` da célula do valor:
    // entram e saem dentro do vão que já existe, sem deslocar um pixel, e o
    // botão pode crescer para a ESQUERDA ao abrir o rótulo porque cresce para
    // dentro do vazio. Pôr as ações no fluxo antes do valor empurraria a linha
    // inteira sob o cursor — pior ainda com o rótulo expandindo.
    readOnly ? null : "14px",
  ].filter(Boolean).join(" ");

  const statusRing = !readOnly && tx.settleable && !tx.settled;
  const shownValue = readOnly ? (displayValue ?? "—") : fmtValorDaLinha(tx.val, tx.currency);
  const valuePrefix = readOnly ? (isRefund ? "− " : "") : (isReceita ? "+" : "−");

  /* MOBILE tem grade própria: três colunas (ícone · descrição sobre
     data·categoria·método · valor). A grade do desktop tem nove — em 390 px
     elas colapsam, a descrição fica sem largura nenhuma e a pílula de
     categoria acaba desenhada por cima do valor. Aqui a data e a categoria
     entram na linha de metadados, e não há coluna de ações nem chevron: a
     linha inteira abre a sanfona, e no toque as ações vivem dentro dela. */
  if (isMobile) {
    const swipeOpen = swipe?.isOpen(tx.id);
    return (
      /* Envelope só para o gesto: as ações ficam ESTACIONADAS fora da tela à
         direita e a linha desliza por cima delas. Renderizá-las só quando
         aberto faria a primeira fração do arrasto mostrar um vão branco. */
      <div style={{ position:"relative", overflow:"hidden" }}>
        {swipe && (
          <div aria-hidden={!swipeOpen} style={{ position:"absolute", right:0, top:0, bottom:0,
            width:SWIPE_WIDTH, display:"flex" }}>
            {tx.settleable && (
              <button type="button"
                tabIndex={swipeOpen ? 0 : -1}
                onClick={(e) => { e.stopPropagation(); swipe.close(); quickActions?.onSettle(tx); }}
                aria-label={tx.settled ? `Desfazer pagamento de ${tx.desc}` : `Marcar ${tx.desc} como pago`}
                style={{ ...G, flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", gap:3, border:"none", background:T.green, color:"#fff",
                  fontSize:11, fontWeight:700, cursor:"pointer" }}>
                <b style={{ fontSize:14 }}>{tx.settled ? "↺" : "✓"}</b>
                {tx.settled ? "desfazer" : "pagar"}
              </button>
            )}
            <button type="button"
              tabIndex={swipeOpen ? 0 : -1}
              onClick={(e) => { e.stopPropagation(); swipe.close(); quickActions?.onDelete(tx); }}
              aria-label={`Excluir ${tx.desc}`}
              style={{ ...G, flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", gap:3, border:"none", background:T.red, color:"#fff",
                fontSize:11, fontWeight:700, cursor:"pointer" }}>
              <b style={{ fontSize:14 }}>🗑</b>
              excluir
            </button>
          </div>
        )}
      <div
        {...(swipe ? swipe.handlers(tx.id) : {})}
        /* O pulso vive AQUI, não no elemento de fora: a linha do mobile tem
           fundo opaco para cobrir o painel de swipe, e um fundo sólido pinta
           por cima de qualquer animação do pai — o "marcar como pago" não
           mostrava efeito nenhum. */
        className={[
          "fincla-row",
          /* A COR vive aqui, na linha, porque é ela que tem o `background`
             inline — e declaração inline vence regra de classe. Por isso a
             varredura e o vermelho da saída são pintados dentro dos keyframes:
             a origem "animação" vence o inline, a origem "autor" não. */
          flash ? "fincla-tx-settled" : "",
          leaving ? "fincla-tx-leaving-cor" : "",
          born ? "fincla-tx-born-cor" : "",
        ].filter(Boolean).join(" ")}
        onClick={readOnly ? undefined : () => (swipeOpen ? swipe.close() : onSelect(tx))}
        onKeyDown={readOnly ? undefined : (e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(tx);
          }
        }}
        role={readOnly ? "listitem" : "button"}
        tabIndex={readOnly ? undefined : 0}
        /* Mesma marca da linha do desktop: é por ela que o foco volta depois de
           editar. Sem isso o `querySelector` não achava nada no toque e o foco
           ficava no `body` — o defeito só não aparecia porque ninguém o via. */
        data-tx-row={tx.id}
        aria-busy={busy || undefined}
        aria-expanded={readOnly ? undefined : isSelected}
        aria-label={readOnly ? `${tx.desc}, ${isRefund ? "estorno" : "compra"} de ${shownValue} em ${tx.date}` : `${tx.desc}, ${isReceita ? "receita" : "despesa"} de ${shownValue} em ${tx.date}`}
        style={{ display:"grid", gridTemplateColumns:"28px minmax(0,1fr) auto",
          alignItems:"center", gap:10,
          /* `minHeight` e não `height`: com a terceira linha a altura cresce e um
             `height` fixo cortaria as tags em vez de acomodá-las.
             Na densidade PADRÃO (56 px) ela custa zero — descrição 16 + metadado
             13,5 + tags 13,5 cabem nos 44 px de caixa. Na COMPACTA (48 px) a
             caixa é 36 e não cabe: as linhas com tag cresceriam e as sem tag
             não, deixando a lista visivelmente irregular. Por isso lá a terceira
             linha não entra — quem escolheu compacto pediu ritmo, e as tags
             continuam na sanfona. */
          minHeight: rowHeight, padding: dense ? "4px 12px" : "6px 12px",
          /* A linha PRECISA ser opaca: as ações de arrasto ficam estacionadas
             embaixo dela e só devem aparecer quando ela desliza. O antigo
             `background: catCol + "08"` tem 3% de alfa — a linha selecionada
             virava vidro e revelava os botões verde/vermelho sem gesto nenhum.
             Por isso o tom da categoria entra como CAMADA (background-image)
             sobre uma cor de fundo sólida, em vez de substituí-la. */
          backgroundColor: T.surface,
          backgroundImage: isSelected
            ? `linear-gradient(${catCol}08, ${catCol}08)`
            : "none",
          borderLeft: isSelected ? `3px solid ${catCol}` : "3px solid transparent",
          cursor:readOnly ? "default" : "pointer", position:"relative",
          transform: swipeOpen ? `translateX(-${SWIPE_WIDTH}px)` : "translateX(0)",
          transition:"transform 0.22s cubic-bezier(0.32,0.72,0,1)" }}>
        <div style={{ width:28, height:28, borderRadius:8, background:avatarBg,
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>
          {tx.icon}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ ...G, fontSize:12.5, fontWeight:600, color:T.ink, lineHeight:1.3,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {tx.desc}
          </div>
          <div style={{ ...G, fontSize:MICRO_PX, color:T.inkGhost, lineHeight:1.35,
            display:"flex", gap:5, overflow:"hidden", whiteSpace:"nowrap" }}>
            {showDate && (
              <span style={{ fontFamily:"'Geist Mono',monospace", color:T.inkLight,
                flex:"none" }}>{dateLabel.top}</span>
            )}
            <span style={{ fontWeight:600, color:catCol, flex:"none" }}>{tx.cat}</span>
            <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>
              {methodLine}
              {accountLabel ? ` · ${accountLabel}` : ""}
            </span>
          </div>
          {/* TAGS em linha própria, por vírgula, SEM chip e SEM clique.
              Sem chip porque numa lista mista — parte com tag, parte sem — um
              chip no lugar do método faria a mesma posição carregar dois
              significados: a pessoa lê "Pix" numa linha e "mercado" na
              seguinte, no mesmo lugar, e não tem como saber o que está lendo.
              Sem clique porque no toque um alvo pequeno colado ao alvo
              principal da linha vira toque errado — e filtrar por tag já existe
              no sheet, com OU/E e contagem.
              A altura VARIA: reservar a linha em todas cobraria a mesma linha da
              dobra também nos lançamentos sem tag nenhuma, e tag é opt-in. */}
          {tags.length > 0 && !dense && (
            <div style={{ ...G, fontSize:MICRO_PX, color:T.inkLight, lineHeight:1.35,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {tags.join(", ")}
            </div>
          )}
        </div>
        <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:12.5, fontWeight:700,
          whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5,
          color: isRefund ? T.green : (isReceita ? T.green : T.ink) }}>
          {/* §28: o indicador ocupa o LUGAR DO VALOR porque é justamente o
              número que a ação vai mudar. A linha não apaga nem se move — ela é
              a única coisa na tela que ainda vale olhar. */}
          {busy && <span className="fincla-spin" aria-hidden="true" />}
          {!busy && valuePrefix}{!busy && shownValue}
          {!busy && statusRing && (
            <span style={{ color:T.amber, display:"inline-flex", alignItems:"center" }}>
              <i aria-hidden="true" style={{ display:"inline-block", width:8, height:8,
                border:"1.75px solid currentColor", borderRadius:"50%", boxSizing:"border-box" }}/>
              <span style={SR_ONLY}>A pagar</span>
            </span>
          )}
        </div>
      </div>
      </div>
    );
  }


  return (
    <div
      onClick={readOnly ? undefined : () => onSelect(tx)}
      onKeyDown={readOnly ? undefined : (e) => {
        // Só a própria linha. Os botões de ação rápida são descendentes: sem
        // esta guarda, o `preventDefault` cancelava o clique sintetizado deles e
        // Enter numa ação abria a sanfona em vez de executar a ação.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(tx);
        }
      }}
      className={[
        "fincla-row",
        /* A COR das animações vive na LINHA, não no wrapper: a linha tem
           `background` opaco e pinta por cima de qualquer fundo do pai — foi
           por isso que a varredura e o vermelho da saída ficaram invisíveis.
           E vive nas DUAS linhas, desktop e mobile: pôr só numa fazia a
           animação existir em metade do app. */
        flash ? "fincla-tx-settled" : "",
        leaving ? "fincla-tx-leaving-cor" : "",
        born ? "fincla-tx-born-cor" : "",
      ].filter(Boolean).join(" ")}
      /* A linha era um `div` com onClick: invisível para teclado e para leitor
         de tela. Um único ponto de parada no Tab (a lista inteira seriam 15
         paradas × 3 ações) e Enter/Espaço abrem o detalhe. */
      role={readOnly ? "listitem" : "button"}
      data-tx-row={tx.id}
      /* `roving tabindex`: UMA parada no Tab para a lista inteira, e ↑↓ andam
         entre as linhas. Com `tabIndex=0` em todas, 20 linhas × 4 ações rápidas
         viravam ~100 paradas entre a busca e o rodapé. */
      tabIndex={readOnly ? undefined : isRovingStop ? 0 : -1}
      aria-busy={busy || undefined}
      aria-expanded={readOnly ? undefined : isSelected}
      aria-label={readOnly ? `${tx.desc}, ${isRefund ? "estorno" : "compra"} de ${shownValue} em ${tx.date}` : `${tx.desc}, ${isReceita ? "receita" : "despesa"} de ${shownValue} em ${tx.date}`}
      style={{ display:"grid", gridTemplateColumns: columns,
        alignItems:"center", gap: dense ? 9 : 11,
        height: rowHeight,
        padding:"0 14px",
        background: isSelected ? `${catCol}08` : "transparent",
        borderLeft: isSelected ? `3px solid ${catCol}` : "3px solid transparent",
        cursor:readOnly ? "default" : "pointer", transition:"background 0.12s, border-color 0.12s" }}>

      {/* Data em coluna. Ela sai do cabeçalho de grupo porque, com um lançamento
          por dia — o caso normal —, o cabeçalho custava 48 px por transação só
          para repetir a data. No modo agrupado o cabeçalho já a carrega e a
          coluna some. */}
      {showDate && (
        <div style={{ ...G, fontFamily:"'Geist Mono',monospace",
          fontSize: MICRO_PX, color:T.inkLight, lineHeight:1.15 }}>
          <b style={{ display:"block", fontSize: dense ? 11.5 : 12.5, color:T.ink,
            fontWeight:700 }}>{dateLabel.top}</b>
          {dateLabel.sub}
        </div>
      )}

      <div style={{ width:iconPx, height:iconPx, borderRadius: dense ? 7 : 9,
        background:avatarBg, display:"flex", alignItems:"center", justifyContent:"center",
        fontSize: dense ? 11 : 14, color: isRefund ? T.green : undefined,
        fontWeight: isRefund ? 700 : undefined }}>
        {tx.icon}
      </div>

      {/* Descrição em cima, método embaixo — a hierarquia da proposta. A
          categoria NÃO mora aqui: ela tem coluna própria à direita. */}
      <div data-fincla-cell="descricao" style={{ minWidth:0 }}>
        <div style={{ ...G, fontSize: dense ? 12 : 12.5, fontWeight:600, color:T.ink,
          lineHeight:1.25, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          display:"flex", alignItems:"center", gap:6 }}>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {tx.desc}
          </span>
          {hasRefundsLinked && !isRefund && (
            <Tip label={`${tx.refundsSummary.count} estorno${tx.refundsSummary.count !== 1 ? "s" : ""} relacionado${tx.refundsSummary.count !== 1 ? "s" : ""} · ${fmtBRL(tx.refundsSummary.totalValue)} abatido${tx.refundsSummary.totalValue !== 1 ? "s" : ""}`}>
              <span style={{ ...G, fontSize:11, color:T.green, background:T.greenLight,
                borderRadius:99, padding:"1px 6px", fontWeight:700, cursor:"default",
                whiteSpace:"nowrap" }}>↺</span>
            </Tip>
          )}
        </div>
        <div style={{ ...G, fontSize: MICRO_PX, color:T.inkGhost,
          lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          display:"flex", alignItems:"center", gap:5 }}>
          {/* No estreito a categoria abre a linha de metadados, ANTES do
              método: ela é o metadado mais consultado e não pode ser o que
              trunca. O botão é o mesmo da coluna — mesmo rótulo acessível,
              mesmo clique-para-filtrar —, só menor e sem a moldura de hover,
              que a esta altura já disputaria espaço com o próprio texto. */}
          {catNaLinhaDeMeta && (
            onFilterByCategory ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onFilterByCategory(tx, e); }}
                aria-label={`Filtrar por categoria ${tx.cat}`}
                style={{ ...G, fontFamily:"inherit", fontSize:MICRO_PX, fontWeight:600,
                  color:catCol, background:`${catCol}18`, border:"none", borderRadius:99,
                  padding:"1px 6px", cursor:"pointer", flexShrink:0, maxWidth:"55%",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  lineHeight:1.4 }}
              >{tx.cat}</button>
            ) : (
              <span style={{ ...G, fontSize:MICRO_PX, fontWeight:600, color:catCol,
                background:`${catCol}18`, borderRadius:99, padding:"1px 6px",
                flexShrink:0, maxWidth:"55%", overflow:"hidden",
                textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.4 }}>{tx.cat}</span>
            )
          )}
          <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>
            {methodLine}
            {accountLabel ? ` · ${accountLabel}` : ""}
          </span>
          {hasParcela && (
            <Tip label={`${tx.parcela.atual}ª de ${tx.parcela.total} parcelas · ${readOnly ? shownValue : fmtBRL(tx.parcela.valParcela)}/mês`}>
              <span style={{ ...G, fontFamily:"'Geist Mono',monospace", color:T.blue,
                fontWeight:600, whiteSpace:"nowrap" }}>
                {tx.parcela.atual}/{tx.parcela.total}×
              </span>
            </Tip>
          )}
          {tx.rec && (
            <Tip label="Transação recorrente — repete todo período">
              <span style={{ color:T.blue, fontWeight:700 }}>↻</span>
            </Tip>
          )}
          {coveringAnchor && (
            <Tip
              label={
                coveringAnchor.kind === "opening"
                  ? `Esta conta foi cadastrada com saldo de abertura em ${coveringAnchor.ymd.split("-").reverse().join("/")}. Este lançamento é anterior a essa data, então já está contemplado no saldo informado e não o altera.`
                  : `Você acertou o saldo desta conta em ${coveringAnchor.ymd.split("-").reverse().join("/")}. O acerto cobre esse dia inteiro, então este lançamento já está contemplado nele e não altera o saldo.`
              }
            >
              <span style={{ whiteSpace:"nowrap" }}>
                ⚓
                <span style={SR_ONLY}>
                  {coveringAnchor.kind === "opening" ? "Antes da abertura" : "Já no acerto"}
                </span>
              </span>
            </Tip>
          )}
        </div>
      </div>

      {/* Categoria: pílula CLICÁVEL, encostada à ESQUERDA da própria coluna —
          logo depois da descrição, que é o que se lê junto com ela.
          Filtrar por ela é o gesto mais curto entre "vi algo" e "quero ver só
          isso" — por isso as ações rápidas não moram mais aqui em cima.
          No desktop estreito a coluna some e a pílula desce para a linha de
          metadados, acima. */}
      {!catNaLinhaDeMeta && (
      <div style={{ minWidth:0, display:"flex", justifyContent:"flex-start" }}>
        {onFilterByCategory ? (
          <Tip label={`Filtrar por ${tx.cat}`}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFilterByCategory(tx, e); }}
              aria-label={`Filtrar por categoria ${tx.cat}`}
              // NUNCA `font:"inherit"` aqui: `font` é atalho e reseta
              // `fontSize`/`fontWeight` declarados antes dele no mesmo objeto.
              // Foi assim que a categoria virou 16px peso 400 — maior que a
              // própria descrição, invertendo a hierarquia da linha.
              style={{ ...G, fontFamily:"inherit", fontSize:MICRO_PX, fontWeight:600,
                color:catCol, background:`${catCol}18`,
                border:"1px solid transparent", borderRadius:99,
                padding:"3px 7px", cursor:"pointer", maxWidth:"100%",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                lineHeight:1.4 }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = catCol; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
            >{tx.cat}</button>
          </Tip>
        ) : (
          <span style={{ ...G, fontSize:MICRO_PX, fontWeight:600, color:catCol,
            background:`${catCol}18`, borderRadius:99, padding:"3px 7px",
            maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis",
            whiteSpace:"nowrap", lineHeight:1.4 }}>{tx.cat}</span>
        )}
      </div>
      )}

      {tagsColPx > 0 && (
        <div style={{ display:"flex", gap:5, minWidth:0, overflow:"hidden", alignItems:"center" }}>
          {tags.slice(0, TAGS_VISIVEIS).map((tag) =>
            onFilterByTag ? (
              // `title` é o rótulo CRU: ele existe para deixar legível um nome
              // truncado ("mensal (a1b2c3d4)"). A ação mora no `aria-label`.
              <button key={tag} type="button" title={tag}
                onClick={(e) => { e.stopPropagation(); onFilterByTag(tag, e); }}
                /* SOMAR, não trocar — e o rótulo precisa dizer isso. Categoria é
                   uma por transação, então clicar substitui; tag é várias, e
                   substituir faria o segundo clique desfazer o primeiro, que é o
                   oposto do que se quer ao clicar em duas tags seguidas. */
                aria-pressed={tagsAtivas.includes(tag)}
                aria-label={
                  tagsAtivas.includes(tag)
                    ? `Remover a tag ${tag} do filtro`
                    : `Adicionar a tag ${tag} ao filtro`
                }
                /* Borda TRANSPARENTE em repouso, não `none`: é ela que acende
                   no hover sem mudar a caixa. Com `border: none`, acender no
                   hover acrescentaria 2 px e o chip pularia — e era por isso
                   que a tag não tinha a afordância que a categoria tem, embora
                   as duas façam a mesma coisa ao clique. */
                style={{ ...G, fontSize:MICRO_PX, fontWeight:600, color:T.inkMid,
                  background:T.grayLight, border:"1px solid transparent", borderRadius:6,
                  padding:"1px 6px", cursor:"pointer", maxWidth:TAG_MAX_PX,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  transition:"border-color var(--mo-fast, 120ms) var(--mo-fast-ease, ease-out)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.inkLight; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}>
                {tag}
              </button>
            ) : (
              <span key={tag} title={tag} style={{ ...G, fontSize:MICRO_PX, fontWeight:600,
                color:T.inkMid, background:T.grayLight, borderRadius:6, padding:"2px 7px",
                maxWidth:TAG_MAX_PX, overflow:"hidden", textOverflow:"ellipsis",
                whiteSpace:"nowrap" }}>{tag}</span>
            ),
          )}
          {/* O "+N" não é enfeite: ele avisa que há mais, e a sanfona mostra
              todas. Sem teto, uma transação com cinco tags decidiria a largura
              da coluna para as outras cem. */}
          {tags.length > TAGS_VISIVEIS && (
            <span title={tags.join(", ")} style={{ ...G, fontSize:MICRO_PX, fontWeight:700,
              color:T.inkGhost, whiteSpace:"nowrap" }}>+{tags.length - TAGS_VISIVEIS}</span>
          )}
        </div>
      )}

      {/* O VÃO — e o dono das ações rápidas.
          Elas moravam ancoradas ao `right: 100%` da célula do valor, o que
          funcionava até 2100 px. Acima disso entra a coluna de tags ENTRE o vão
          e o valor, e o grupo (~146 px só de ícones) passava por cima dela —
          cobrindo justamente os chips clicáveis de filtrar por tag, na largura
          em que as tags foram introduzidas.
          Ancorando na borda direita do próprio vão, elas ficam sempre no vazio:
          à esquerda das tags quando elas existem, à esquerda do valor quando
          não. */}
      <span style={{ position:"relative" }}>
        {quickActions && (
          <div className="fincla-quick">
            {tx.settleable && (
              <QuickAction
                label={tx.settled ? `Desfazer pagamento de ${tx.desc}` : `Marcar ${tx.desc} como pago`}
                text={tx.settled ? "Desfazer" : "Pagar"}
                tone="green"
                showText={showActionLabels}
                onClick={(e) => { e.stopPropagation(); quickActions.onSettle(tx); }}
              >
                {tx.settled ? "↺" : "✓"}
              </QuickAction>
            )}
            <QuickAction
              label={`Editar ${tx.desc}`}
              text="Editar"
              showText={showActionLabels}
              onClick={(e) => { e.stopPropagation(); quickActions.onEdit(tx); }}
            >
              ✎
            </QuickAction>
            {quickActions.onDuplicate && (
              <QuickAction
                label={`Duplicar ${tx.desc}`}
                text="Duplicar"
                showText={showActionLabels}
                onClick={(e) => { e.stopPropagation(); quickActions.onDuplicate(tx); }}
              >
                ⧉
              </QuickAction>
            )}
            <QuickAction
              label={`Excluir ${tx.desc}`}
              text="Excluir"
              tone="red"
              showText={showActionLabels}
              onClick={(e) => { e.stopPropagation(); quickActions.onDelete(tx); }}
            >
              🗑
            </QuickAction>
          </div>
        )}
      </span>

      {/* Tags — só acima de 2100 px. Abaixo disso elas competiriam com a
          descrição por largura, e o artefato as reserva para quando a folga
          existe de verdade. */}
      {/* O valor é a âncora das ações: `position: relative` aqui é o que
          permite ancorá-las em `right: 100%` — a borda esquerda do valor —,
          seja qual for a largura das colunas. */}
      <div style={{ ...G, fontFamily:"'Geist Mono',monospace",
        fontSize: dense ? 12 : 13.5, fontWeight:700, textAlign:"right",
        color: isRefund ? T.green : (isReceita ? T.green : T.ink) }}>
        {/* §28: mesmo lugar que a linha do toque usa — o valor é o número que
            a ação vai mudar, então é nele que o "aguarde" pertence. */}
        {busy
          ? <span className="fincla-spin" aria-hidden="true" />
          : <>{valuePrefix}{shownValue}</>}
      </div>

      {/* Situação: anel vazado, não ampulheta. O lançamento não está
          "processando" — ele existe e só ainda não entrou no saldo. */}
      {!readOnly && (statusRing ? (
        <Tip label="Ainda não entrou no saldo da conta">
          <span style={{ ...G, color:T.amber, display:"flex", alignItems:"center",
            gap:5, fontSize:MICRO_PX, fontWeight:700, whiteSpace:"nowrap",
            justifyContent: wide ? "flex-end" : "center" }}>
            <i aria-hidden="true" style={{ display:"inline-block", width:8, height:8,
              border:"1.75px solid currentColor", borderRadius:"50%", boxSizing:"border-box" }}/>
            <span style={wide ? undefined : SR_ONLY}>A pagar</span>
          </span>
        </Tip>
      ) : <span />)}

      {!readOnly && <span style={{ display:"flex", justifyContent:"center", color: isSelected ? catCol : T.inkGhost,
        transition:"color 0.12s" }}>
        {isSelected
          ? <ChevronDown size={12} color={catCol}/>
          : <ChevronRight size={12} color={T.inkGhost}/>}
      </span>}
    </div>
  );
});
TxRow.displayName = "TxRow";
