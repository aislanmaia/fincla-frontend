import { T } from "./tokens";

/** CSS global de keyframes e utilitários — injetado uma vez (espelho do protótipo de referência em docs/) */
export const ANIM_CSS = `
  /* ── TOKENS DE MOVIMENTO ────────────────────────────────────────────
     Regra da UI da Fincla, não decoração de uma tela: toda mudança de estado
     que a pessoa provocou deve ser visível NO CAMINHO, não só no destino. Uma
     linha que some, um painel que aparece, um número que muda — se o passo do
     meio não é mostrado, ela precisa reconstruir sozinha o que aconteceu, e é
     aí que a interface parece "dura".
     A contrapartida é disciplina: nada acima de 550 ms, UM floreio por
     interação, e nunca bloquear a entrada. */
  :root {
    /* Resposta imediata: hover, foco, troca de pílula, crossfade de estado. */
    --mo-fast: 120ms;
    --mo-fast-ease: ease-out;
    /* Padrão da casa. Colapso de linha, sanfona, entrada de chip.
       Sai rápido, assenta devagar. */
    --mo-base: 220ms;
    --mo-base-ease: cubic-bezier(.32,.72,0,1);
    /* Superfícies que ocupam área: painel de filtros, bottom sheet, drawer. */
    --mo-panel: 300ms;
    --mo-panel-ease: cubic-bezier(.32,.72,0,1);
    /* O floreio raro, um por interação: a varredura de "marcado como pago". */
    --mo-accent: 500ms;
    --mo-accent-ease: cubic-bezier(.4,0,.2,1);
    /* Saída acelerada: o que vai embora não merece a mesma cerimônia da
       entrada. */
    --mo-exit: 180ms;
    --mo-exit-ease: cubic-bezier(.4,0,1,1);
  }
  /* Degrada para crossfade — a regra vale para o app inteiro, não por tela. */
  @media (prefers-reduced-motion: reduce) {
    :root {
      --mo-fast: 120ms; --mo-base: 120ms; --mo-panel: 120ms;
      --mo-accent: 120ms; --mo-exit: 120ms;
    }
  }

  /* Esqueleto da lista: opacidade, nunca posicao. Um shimmer que desliza
     custa repaint em cada linha; o pulso e uma propriedade composta e roda
     na GPU mesmo com trinta linhas na tela. */
  @keyframes finclaSkelPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-testid="transactions-skeleton"] > div { animation: none !important; opacity: 0.7; }
  }
  @keyframes fadeSlideUp {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0);   }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes fadeInDown {
    from { opacity:0; transform:translateY(-6px); }
    to   { opacity:1; transform:translateY(0);    }
  }
  @keyframes slideInRight {
    from { opacity:0; transform:translateX(18px); }
    to   { opacity:1; transform:translateX(0);    }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
  @keyframes countUp {
    from { opacity:0; transform:translateY(4px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)   scale(1);    }
  }
  @keyframes progressFill {
    from { width: 0% !important; }
  }
  @keyframes pulseOnce {
    0%   { box-shadow: 0 0 0 0 rgba(37,99,235,0.25); }
    70%  { box-shadow: 0 0 0 8px rgba(37,99,235,0);  }
    100% { box-shadow: 0 0 0 0 rgba(37,99,235,0);    }
  }
  /* §29 — o anel que responde "o foco chegou agora".
     ACENDE E APAGA: um anel que fica seria estado ("aqui"), e o cursor piscando
     ja diz isso. O que faltava era o EVENTO, principalmente quando o foco vem
     da tecla "/" e nada na tela muda. */
  @keyframes finclaFocusRing {
    0%   { box-shadow: 0 0 0 0 rgba(37,99,235,0.55); }
    45%  { box-shadow: 0 0 0 4px rgba(37,99,235,0.26); }
    100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
  }
  .fincla-focus-ring {
    animation: finclaFocusRing var(--mo-accent, 500ms) var(--mo-accent-ease, ease-out);
  }
  @media (prefers-reduced-motion: reduce) {
    /* Sem pulso, mas o sinal NAO some: quem pediu menos movimento continua
       precisando saber para onde o foco foi. */
    .fincla-focus-ring { animation: none; outline: 2px solid #2563EB; outline-offset: 1px; }
  }

  /* §28 — carregamento da lista. Indeterminada: a API nao diz progresso, e uma
     barra que finge saber a porcentagem mente. O gradiente varre da esquerda
     para a direita, que e a direcao em que o conteudo novo chega. */
  @keyframes finclaLoadbar {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%);  }
  }
  .fincla-loadbar { overflow: hidden; background: rgba(37,99,235,0.12); }
  .fincla-loadbar::after {
    content: ""; display: block; height: 100%; width: 45%;
    background: linear-gradient(90deg, rgba(37,99,235,0), #2563EB, rgba(37,99,235,0));
    animation: finclaLoadbar 1.05s cubic-bezier(.65,0,.35,1) infinite;
  }
  /* Indicador de acao numa LINHA (pagar / excluir): ocupa o lugar do valor,
     que e exatamente o numero que a acao vai mudar. */
  @keyframes finclaSpin { to { transform: rotate(360deg); } }
  .fincla-spin {
    display: inline-block; width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(55,65,81,0.18); border-top-color: #374151;
    animation: finclaSpin 0.62s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .fincla-loadbar::after { animation-duration: 2.4s; }
    .fincla-spin { animation-duration: 1.6s; }
  }
  .fincla-row { transition: background 0.11s; }
  .fincla-row:hover { background: #F0EFEB !important; }
  /* Ações rápidas: aparecem no hover ANCORADAS À ESQUERDA DO VALOR, flutuando
     dentro do vão que a linha já tem. Absolutas de propósito — no fluxo elas
     empurrariam o valor ao aparecer e a linha inteira saltaria sob o cursor,
     pior ainda com o rótulo expandindo. O grupo é ancorado à borda DIREITA do
     próprio vão — a coluna 1fr —, então cresce para a esquerda, para dentro do
     vazio, e nunca cobre o que vem depois: nem o valor, nem a coluna de tags
     que entra entre os dois acima de 2100 px.

     No toque não há hover: elas ficam sempre visíveis — a alternativa seria um
     alvo de 24 px numa linha de 56, onde o erro abre a transação vizinha. */
  /* visibility, NAO display. Trocar "none" por "flex" no hover e uma mudanca de
     LAYOUT: o grupo entra e sai do fluxo de posicionamento, e com ele o
     navegador refaz style + layout + paint daquela linha.

     Em repouso isso passa despercebido — acontece uma vez por linha, quando o
     cursor chega. Mas quando a lista MUDA DE LARGURA (abrir e fechar a dock) as
     linhas deslizam por baixo de um cursor parado: a cada quadro o hover cai
     numa linha diferente, e cada troca custava um ciclo de layout. Medido em
     1600 px com 34 linhas: HitTest 139 ms e handleMouseMoveEvent 144 ms num
     gesto de 300 ms — era isso a "animacao lagada", e e por isso que ela
     melhorava com menos itens na lista.

     Com visibility o grupo ja esta posicionado o tempo todo; mostrar e esconder
     vira trabalho de composicao, sem layout nenhum. */
  .fincla-quick {
    display: flex; visibility: hidden; align-items: center; gap: 4px;
    position: absolute; right: 0; top: 50%; transform: translateY(-50%);
    margin-right: 10px; white-space: nowrap;
  }
  .fincla-row:hover .fincla-quick,
  .fincla-row:focus-within .fincla-quick { visibility: visible; }
  /* "hover: none" sozinho pegava TABLET: "isMobile" é largura (< 768 px), então
     um iPad em paisagem renderiza a linha do DESKTOP — e a regra deixava o grupo
     permanentemente visível. Antes isso era inofensivo (ele tinha coluna
     própria); agora ele é absoluto e flutuaria sobre o vão da linha, que é
     justamente onde o dedo toca para abrir a sanfona, com o 🗑 entre os alvos.
     Casando os dois critérios, a regra só vale onde a linha é mesmo a mobile. */
  @media (hover: none) and (max-width: 767px) {
    .fincla-quick { visibility: visible; }
  }

  /* O rótulo abre por max-width, não por display: só uma propriedade animável
     dá transição — com display o botão saltaria de um tamanho ao outro. */
  .fincla-qa { transition: border-color .13s, background .13s, color .13s; }
  .fincla-qa .lb {
    max-width: 0; overflow: hidden; margin-left: 0;
    transition: max-width .16s ease, margin-left .16s ease;
  }
  .fincla-qa:hover .lb,
  .fincla-qa:focus-visible .lb { max-width: 96px; margin-left: 6px; }
  /* Abaixo de ~1200 px o vão não tem para onde crescer: o rótulo fica fora e o
     botão volta a ser só o ícone. */
  .fincla-qa-mute .lb { display: none; }
  /* "!important" porque "QuickAction" declara background/border/color INLINE, e
     declaração inline vence qualquer regra de autor sem ele. Sem isto o botão
     não mudava de cor nenhuma no hover e o "transition" acima animava o vazio —
     o mesmo motivo do "!important" do ".fincla-row:hover" logo acima. */
  .fincla-qa[data-tone="neutral"]:hover {
    border-color: #BFD3FA !important; background: #EFF6FF !important; color: #2563EB !important;
  }
  .fincla-qa[data-tone="green"]:hover { background: #ECFDF5 !important; }
  .fincla-qa[data-tone="red"]:hover { background: #FEF2F2 !important; }
  @media (prefers-reduced-motion: reduce) {
    .fincla-qa .lb { transition: none; }
  }
  .fincla-card-lift { transition: box-shadow 0.18s ease, transform 0.18s ease; }
  .fincla-card-lift:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important; transform: translateY(-1px); }
  .fincla-btn { transition: opacity 0.13s, transform 0.13s; }
  .fincla-btn:active { transform: scale(0.97) !important; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes popIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes sheetUp {
    from { transform: translateY(100%); opacity: 0;   }
    to   { transform: translateY(0);    opacity: 1;   }
  }
  @keyframes sheetDown {
    from { transform: translateY(0);    opacity: 1;   }
    to   { transform: translateY(100%); opacity: 0;   }
  }
  @keyframes backdropIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes backdropOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  /* Drawer lateral (AiDrawer da referência cons-copiloto.jsx).
     slideInRight desloca só 18px — suficiente para um card, não para um
     painel de 440px, que precisa entrar da borda da viewport. */
  @keyframes slideInPanel {
    from { transform: translateX(100%); }
    to   { transform: translateX(0);    }
  }
  /* ── Movimento da lista de Transações ────────────────────────────────
     Sair da lista é um COLAPSO DE ALTURA, não só um fade: sem ele as linhas
     de baixo pulam de uma vez para o lugar da que saiu, e o olho perde onde
     estava. O max-height grande o bastante para qualquer densidade (a linha
     mais alta é 64 px, mais a sanfona aberta) faz a interpolação acontecer;
     height:0 não anima a partir de auto. */
  /* ── SAÍDA DE UMA LINHA — 340 ms do clique ao fim ───────────────────
     Duas fases SOBREPOSTAS, e é a sobreposição que faz parecer uma coisa só:
     0–180 ms a linha desliza para a DIREITA e apaga; 120–340 ms a altura, o
     padding e a borda vão a zero, e as de baixo sobem no mesmo movimento em
     vez de saltar depois.
     Direita, não esquerda: é o sentido do swipe-to-delete do mobile — o gesto
     que a pessoa já conhece, executado pela interface. O fundo passa por um
     vermelho suave no caminho, dizendo o que a saída significa. */
  /* O WRAPPER faz o que mexe em altura e posição — é ele que ocupa lugar na
     lista e empurra as vizinhas. */
  @keyframes txRowLeave {
    0%   { opacity: 1;  transform: translateX(0);    max-height: 240px; }
    20%  { opacity: .9; transform: translateX(8px);  max-height: 240px; }
    53%  { opacity: 0;  transform: translateX(46px); max-height: 240px; }
    100% { opacity: 0;  transform: translateX(46px); max-height: 0;
           padding-top: 0; padding-bottom: 0; border-width: 0; }
  }
  /* A COR vai na LINHA, pelo mesmo motivo da varredura: o filho opaco pinta por
     cima de qualquer fundo do pai. */
  @keyframes txRowLeaveCor {
    0%   { background: rgba(254,242,242,0); }
    25%  { background: rgba(254,226,226,1); }
    100% { background: rgba(254,226,226,1); }
  }
  .fincla-tx-leaving-cor { animation: txRowLeaveCor 180ms cubic-bezier(.4,0,1,1) both; }

  /* ── PAGAMENTO CONFIRMADO — 500 ms, e é um momento feliz ─────────────
     Diferente do excluir: aqui nada desaparece, algo se CONFIRMA. O movimento
     é de preenchimento, não de saída — uma varredura verde atravessa a linha
     da esquerda para a direita, uma vez só. É o único floreio da tela, e vale
     porque marca o instante em que o dinheiro entrou no saldo. */
  @keyframes txRowSettled {
    0% {
      background-image: linear-gradient(100deg,
        rgba(5,150,105,0) 0%, rgba(5,150,105,.30) 45%,
        rgba(5,150,105,.30) 55%, rgba(5,150,105,0) 100%);
      background-size: 70% 100%; background-repeat: no-repeat;
      background-position: -140% 0;
    }
    100% {
      background-image: linear-gradient(100deg,
        rgba(5,150,105,0) 0%, rgba(5,150,105,.30) 45%,
        rgba(5,150,105,.30) 55%, rgba(5,150,105,0) 100%);
      background-size: 70% 100%; background-repeat: no-repeat;
      background-position: 140% 0;
    }
  }
  @keyframes txRowSettledRest {
    0%   { box-shadow: inset 0 0 0 999px rgba(5,150,105,.09); }
    70%  { box-shadow: inset 0 0 0 999px rgba(5,150,105,.09); }
    100% { box-shadow: inset 0 0 0 999px rgba(5,150,105,0); }
  }

  /* ── NASCIMENTO — 550 ms ────────────────────────────────────────────
     Serve ao item duplicado, ao desfazer de uma exclusão e à transação
     recém-criada pela modal: os três são "isto acabou de aparecer, e é seu".
     A altura abre empurrando as de baixo suavemente, e o destaque azul esvai
     para o branco em vez de sumir de uma vez. */
  @keyframes txRowBorn {
    0%   { max-height: 0; opacity: 0; transform: translateY(-6px);
           padding-top: 0; padding-bottom: 0; }
    55%  { max-height: 240px; opacity: 1; transform: translateY(0); }
    100% { max-height: 240px; opacity: 1; transform: translateY(0); }
  }
  /* O destaque azul do nascimento, na linha.

     O fim e a cor da SUPERFICIE — interpolada do token, nao um hex repetido:
     sem fill-mode, o ultimo quadro tem de casar EXATAMENTE com o
     backgroundColor T.surface que a linha pinta, senao ela salta de cor aos
     550 ms. Duplicar o valor faria o piscar voltar em silencio no dia em que o
     token mudar (modo escuro, fundo de lista tingido). Nao transparente — e a diferenca
     nao e cosmetica. A origem "animacao" vence a declaracao inline, entao
     enquanto esta classe existe e ela quem manda no fundo: terminar em
     rgba(...,0) deixava a linha REALMENTE transparente, e as acoes do arrasto
     ficam estacionadas embaixo dela. Medido na primeira carga em 390 px:
     19 linhas transparentes por ~100 ms, e o verde/vermelho dos botoes
     aparecendo por baixo. Era esse o piscar.

     E sem fill-mode (o "both" saiu): ao terminar, o fundo volta a ser o inline —
     que ja e a mesma cor, entao o corte e invisivel, e uma linha selecionada
     recupera o tom da categoria em vez de ficar branca ate a classe sair. */
  @keyframes txRowBornCor {
    0%   { background: rgba(219,234,254,1); }
    55%  { background: rgba(219,234,254,1); }
    100% { background: ${T.surface}; }
  }
  .fincla-tx-born-cor { animation: txRowBornCor 550ms cubic-bezier(.32,.72,0,1); }
  @keyframes toastIn {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  .fincla-tx-leave {
    animation: txRowLeave 260ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
    overflow: hidden;
    pointer-events: none;
  }
  /* A varredura é um GRADIENTE que atravessa, não um fundo que pisca: piscar
     diz "algo aconteceu", atravessar diz "de onde para onde". */
  /* O gradiente é declarado DENTRO dos keyframes, não na classe: a linha tem
     "background" inline, e declaração inline vence regra de autor — a classe
     era simplesmente ignorada e a varredura nunca aparecia. A origem
     "animação" vence o inline; é a única forma que funciona aqui. */
  .fincla-tx-settled {
    animation:
      txRowSettled 500ms cubic-bezier(.4,0,.2,1) 1,
      txRowSettledRest 1200ms ease-out 1;
  }
  .fincla-tx-born {
    overflow: hidden;
    animation: txRowBorn 550ms cubic-bezier(.32,.72,0,1) both;
  }
  .fincla-toast { animation: toastIn 180ms cubic-bezier(0.2, 0, 0, 1); }
  /* Quem pediu menos movimento recebe o resultado, não a viagem: a linha some
     na hora em vez de deslizar, e o pulso não pisca. */
  @media (prefers-reduced-motion: reduce) {
    .fincla-tx-leave { animation-duration: 1ms; }
    /* "prefers-reduced-motion" corta o deslize e a varredura: sobra o
       crossfade e o colapso instantâneo. */
    .fincla-tx-settled { animation: none; background-image: none; }
    .fincla-tx-born { animation-duration: 120ms; }
    .fincla-toast { animation: none; }
  }
  .ai-spin { animation: spin 0.7s linear infinite; }
  .ai-shimmer {
    background: linear-gradient(90deg, #F3F4F6, #E9EBEF, #F3F4F6);
    background-size: 200% 100%;
    animation: shimmer 1.2s linear infinite;
  }
  /* DragScrollTabs — mantém o arrasto por toque; a barra já é oculta pelo
     padrão global de app-shell.css. */
  .dstabs-scroll { -webkit-overflow-scrolling: touch; }
  /* .fincla-scroll-y foi absorvida por .fincla-scroll (app-shell.css):
     uma convenção só para região rolável em todo o app. */
`;

export function AnimStyles() {
  const id = "fincla-anim-styles";
  if (typeof document !== "undefined" && !document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = ANIM_CSS;
    document.head.appendChild(s);
  }
  return null;
}
