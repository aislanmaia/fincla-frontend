import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useRouterState, useSearch } from "@tanstack/react-router";
import { FC } from "../routing/searchContract.js";
import {
  Search,
  ChevronRight,
  ChevronDown,
  X,
  Pencil,
  Trash2,
  Download,
  SlidersHorizontal,
} from "lucide-react";
import { T } from "../tokens";
import { G } from "../typography";
import { PageTitle } from "../components/primitives";
import { TRANSACTIONS } from "../data/mockFinance";
import { downloadTransactionsCsvForUi } from "../data/transactionsAdapter.js";
import { useCategoryTagsData } from "../features/tags/useCategoryTagsData.js";
import { useTransactionsTagCatalog } from "../features/transactions/filters/useTransactionsTagCatalog.js";
import {
  buildTagOptions,
  isTagFilterBlocked,
  resolveTagFilterStatuses,
  tagFilterStatusMessage,
  tagOptionsToDisplayMap,
} from "../features/transactions/filters/tagCatalogResolution.js";
import { useTransactionsData } from "../features/transactions/useTransactionsData.js";
import { useTransactionsFacetCounts } from "../features/transactions/useTransactionsFacetCounts.js";
import { useNarrowestFilter } from "../features/transactions/useNarrowestFilter.js";
import { resolveLocalData, shouldUseRealData as shouldUseRealDataForMode } from "../dataMode.js";
import { TransactionsEmptyState } from "../features/transactions/TransactionsEmptyState.jsx";
import { TransactionsSkeleton } from "../features/transactions/TransactionsSkeleton.jsx";
import { ConfirmActionModal } from "../features/transactions/ConfirmAction.jsx";
import { ShortcutsModal } from "../features/transactions/ShortcutsModal.jsx";
import { useTransactionsKeyboard } from "../features/transactions/useTransactionsKeyboard.js";
import { useFocusTrap } from "../features/transactions/useFocusTrap.js";
import { flyToChip } from "../features/transactions/flyToChip.js";
import { TransactionsStats } from "../features/transactions/TransactionsStats.jsx";
import { TransactionsSummarySheet } from "../features/transactions/TransactionsSummarySheet.jsx";
import { useSwipeActions, SWIPE_WIDTH } from "../features/transactions/useSwipeActions.js";
import { UndoToast } from "../features/transactions/UndoToast.jsx";
import { TransactionsFilterChips } from "../features/transactions/filters/TransactionsFilterChips.jsx";
import { TransactionsFilterPanel } from "../features/transactions/filters/TransactionsFilterPanel.jsx";
import { SavedViewsChip } from "../features/transactions/filters/savedViews/SavedViewsChip.jsx";
import { useFilterHistory } from "../features/transactions/filters/useFilterHistory.js";
import {
  TransactionsListHeader,
  LIST_HEADER_HEIGHT,
  LIST_HEADER_HEIGHT_COMPACT,
} from "../features/transactions/TransactionsListHeader.jsx";
import {
  DAY_HEADER_HEIGHT,
  DENSITIES,
  densityRowHeight,
  groupingAllowed,
  readListPrefs,
  rowCost,
  writeListPrefs,
} from "../features/transactions/listPrefs.js";
import { CardEmptyWithCta } from "../features/shellExtras.jsx";
import {
  getTransactionsPeriodBootstrap,
  writeTransactionsPeriodToStorage,
} from "../features/transactions/transactionsPeriodStorage.js";
import {
  TransactionsFilterBar,
  useTransactionsFilterState,
  useSavedViews,
  describeView,
  countActiveFiltersInSnapshot,
  DEFAULT_SORT,
  DEFAULT_FILTER_STATE,
} from "../features/transactions/filters/index.js";
import { SavedViewsCards } from "../features/transactions/filters/savedViews/SavedViewsCards.jsx";
import { shouldShowSavedViewsSection, viewSnapshotsEqual } from "../features/transactions/filters/savedViews/savedViewsModel.js";
import { listAccounts } from "../../api/accounts";
import { listOrgBalanceAdjustments } from "../../api/balanceAdjustments";
import { anchorCovering, latestAnchorByAccount } from "../features/accounts/balanceAnchors.js";
import {
  filtersToLegacyParams,
  filtersToCsvOptions,
  matchesValueRange,
} from "../features/transactions/filters/filtersToLegacyParams.js";

const TRANSACTIONS_SEARCH_DEBOUNCE_MS = 1500;

/** Snapshot restaurado ao desaplicar uma view criada sem ativação prévia. */
const DEFAULT_RESTORE_SNAPSHOT = Object.freeze({
  ...DEFAULT_FILTER_STATE,
  sort: DEFAULT_SORT,
  searchInput: "",
  debouncedSearch: "",
});

/** Altura de um lançamento na lista de hoje: 28 px de cabeçalho do dia + 53 da
 *  linha + 20 de respiro. Com um lançamento por dia — o caso normal — quase toda
 *  linha carrega o próprio cabeçalho, então é este o custo real por transação. */
export const TX_ROW_HEIGHT = 101;

/** Duração do colapso de saída — casa com `@keyframes txRowLeave` em
 *  `animations.jsx`. Se os dois divergirem, ou a lista pisca antes de a linha
 *  terminar de sair, ou fica com um buraco depois que ela já saiu. */
export const ROW_LEAVE_MS = 260;

/** Largura da barra lateral do app — descontada para saber quanto de conteúdo
 *  sobra de verdade ao dimensionar o painel ancorado. */
const SIDEBAR_WIDTH = 195;

/**
 * Texto que existe para o leitor de tela mas não ocupa espaço.
 *
 * Abaixo de 1600 px a situação e a marca de âncora viram só um ícone — o
 * artefato reserva o rótulo para quando há largura. Sem isto, quem usa leitor
 * de tela ouviria uma linha que não diz que o lançamento está a pagar, e um
 * ícone `aria-hidden` não diz nada por definição.
 */
const SR_ONLY = {
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

/** Piso e teto da primeira página. O teto é o `limit` máximo que
 *  `GET /v1/transactions` aceita; o piso evita pedir pouco demais numa janela
 *  minúscula e ficar disparando "carregar mais" logo de cara. */
export const TX_PAGE_MIN = 20;
export const TX_PAGE_MAX = 100;

/**
 * Tamanho da primeira página, dimensionado pela altura disponível.
 *
 * O valor fixo de 10 fazia sentido quando cabiam duas transações na tela. Numa
 * janela alta cabem dezenas, e aí a pessoa chega ao fim da primeira página
 * ANTES de a tela encher — vê a rolagem infinita disparar duas ou três vezes só
 * para preencher o que já deveria estar à vista. A sensação é de tela lenta,
 * não de lista longa.
 *
 * @param {number} availableHeight Altura útil para a lista, em px.
 * @param {number} rowHeight Custo por transação, em px.
 * @returns {number} Itens da primeira página, entre TX_PAGE_MIN e TX_PAGE_MAX.
 */
export function computePageSize(availableHeight, rowHeight = TX_ROW_HEIGHT) {
  const height = Number(availableHeight);
  const row = Number(rowHeight);
  if (!Number.isFinite(height) || !Number.isFinite(row) || row <= 0 || height <= 0) {
    return TX_PAGE_MIN;
  }
  // +5 de folga: a primeira rolagem já encontra conteúdo em vez de um sentinel.
  const fits = Math.ceil(height / row) + 5;
  return Math.min(TX_PAGE_MAX, Math.max(TX_PAGE_MIN, fits));
}

/** Viewport ≥ breakpoint: filtros desktop sempre visíveis. Abaixo: colapsados por padrão. */
const DESKTOP_FILTERS_EXPAND_BREAKPOINT = 1280;

/** Altura mínima para a barra de filtros completa (9 facetas em duas linhas, 230 px).
 *
 *  A decisão era só de largura, e isso invertia o resultado: em 1366×768 a janela
 *  passa do corte de largura e recebe a barra completa, sobrando 232 px de lista
 *  (2 transações); em 1152×700 — mais estreita E mais baixa — ela recebe a barra
 *  compacta e sobra 343 px (3 transações). A restrição real num laptop é vertical,
 *  então a altura precisa entrar na conta.
 *
 *  820 = 768 (a tela mais comum do Brasil) com folga, para 800 e 768 caírem no
 *  modo compacto e um 1080p continuar com a barra completa. */
const DESKTOP_FILTERS_EXPAND_MIN_HEIGHT = 820;

/* ── Helpers puros e componentes de linha ──────────────────────────────────
   Estes três blocos moravam DENTRO do corpo de `TransacoesPageBody`. Como o
   corpo roda a cada render, `Tip` e `TxRow` viravam TIPOS novos toda vez — e o
   React, ao ver um tipo diferente na mesma posição, descarta a subárvore e
   monta outra em vez de atualizar a existente.

   O efeito: a cada mudança de estado da página (selecionar uma linha, abrir um
   filtro), TODA linha da lista era desmontada e remontada, com nós de DOM novos.
   Isso queima CPU numa lista parada e é o que impedia um clique automatizado de
   considerar a linha "stable" — a caixa medida num frame pertence a um nó que
   já não existe no seguinte (fincla-frontend#66).

   Içar para o escopo do módulo é mudança estrutural pura: mesmo markup, mesmos
   estilos, mesma saída visual. */

const CAT_COLORS = {
  Alimentação: "#059669",
  Transporte: "#2563EB",
  Moradia: "#6B7280",
  Saúde: "#DC2626",
  Receita: "#059669",
  Assinaturas: "#7C3AED",
  "Assinaturas & Software": "#0891B2",
  Streaming: "#7C3AED",
  Lazer: "#D97706",
  "Lazer & Entretenimento": "#D97706",
  Compras: "#0891B2",
  "Compras Pessoais": "#DC2626",
  Educação: "#7C3AED",
  Outros: "#374151",
  Serviços: "#6B7280",
  "Impostos & Taxas": "#D97706",
  Vestuário: "#BE185D",
};
const catColor = (label) => CAT_COLORS[label] || T.inkMid;

/** "20/08/2026" -> { top: "20 ago", sub: "qua" }. Duas linhas curtas cabem numa
 *  coluna de 54 px sem quebrar; a data por extenso não cabia. */
const MONTHS_SHORT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const WEEKDAYS_SHORT = ["dom","seg","ter","qua","qui","sex","sáb"];
export function shortDateLabel(raw, today = new Date()) {
  if (!raw) return { top: "—", sub: "" };
  const parts = String(raw).split("/");
  if (parts.length < 2) return { top: String(raw).slice(0, 6), sub: "" };
  const day = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const year = parts.length === 3 ? Number(parts[2]) : today.getFullYear();
  if (!Number.isFinite(day) || !Number.isFinite(month) || month < 0 || month > 11) {
    return { top: String(raw).slice(0, 6), sub: "" };
  }
  const d = new Date(year, month, day);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const top = `${String(day).padStart(2, "0")} ${MONTHS_SHORT[month]}`;
  if (sameDay(d, today)) return { top, sub: "hoje" };
  if (sameDay(d, yesterday)) return { top, sub: "ontem" };
  return { top, sub: WEEKDAYS_SHORT[d.getDay()] || "" };
}
const catBg = (label) => `${catColor(label)}18`;

const fmtBRL = v => "R$\u00a0" + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2});

// fincla-frontend#105 — evento global mínimo pra garantir UM tooltip aberto
// por vez sem precisar de Context: cada `Tip` aberto ouve o `show()` de
// qualquer OUTRO e fecha a si mesmo.
const TIP_OPEN_EVENT = "fincla:tip-open";

// Exportado só pra teste unitário isolado (fincla-frontend#105) — o
// comportamento de fechar não depende de nada da página, e testar via
// `<TransacoesPage>` inteira exigiria montar uma transação com refund/parcela
// só pra alcançar um `<Tip>`.
export const Tip = ({ label, children, pos = "top" }) => {
  const [rect, setRect] = useState(null);
  const ref = useRef(null);
  const id = useId();

  const show = (e) => {
    if (!ref.current) return;
    setRect(ref.current.getBoundingClientRect());
    window.dispatchEvent(new CustomEvent(TIP_OPEN_EVENT, { detail: { id } }));
  };
  const hide = () => setRect(null);

  // fincla-frontend#109 rodada 2, achado 5: com o early return agora DEPOIS
  // dos hooks (achado 1, crítico), a instância sobrevive ao intervalo em que
  // `label` fica vazio — mas `rect` (medido enquanto o label ANTERIOR estava
  // visível) não era limpo nesse intervalo. Quando o label volta (ex.: linha
  // 390, `hasParcela ? … : isRefund ? … : ""` alternando por causa de uma
  // atualização in-place), o tooltip REAPARECIA sozinho na posição antiga,
  // sem nenhum toque/hover novo. `label` vazio precisa fechar o tooltip.
  useEffect(() => {
    if (!label) setRect(null);
  }, [label]);

  // Fecha em QUALQUER interação seguinte enquanto está aberto: toque/clique
  // fora do próprio gatilho — inclusive o que abre o bottom sheet de
  // Detalhes, que antes deixava o tooltip flutuando por cima dele (prints do
  // Owner) —, rolagem de qualquer região (captura no `window` pega o scroll
  // de containers `.fincla-scroll` aninhados, que não sobe por bubbling
  // comum), Escape, e a abertura de outro tooltip. O `pointerdown` só fecha
  // quando o alvo está FORA do próprio gatilho — de propósito: um 2º toque no
  // MESMO gatilho é o toggle local (`onTouchStart` abaixo) que decide, e como
  // o `pointerdown` do toque precede o `touchstart`, fechar por fora aqui
  // reabriria no mesmo gesto (o toggle local leria `rect` já nulo). jsdom não
  // tem layout nem toque de verdade, então os testes cobrem o COMPORTAMENTO
  // observável (o tooltip sai do DOM ao disparar cada evento), nunca
  // `getComputedStyle`.
  useEffect(() => {
    if (rect === null) return undefined;
    const onPointerDown = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      hide();
    };
    const onScroll = () => hide();
    const onKeyDown = (e) => {
      if (e.key === "Escape") hide();
    };
    const onOtherTipOpen = (e) => {
      if (e.detail?.id !== id) hide();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener(TIP_OPEN_EVENT, onOtherTipOpen);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener(TIP_OPEN_EVENT, onOtherTipOpen);
    };
  }, [rect, id]);

  // fincla-frontend#109 achado 1 (crítico): este early return morava ANTES
  // dos hooks acima. `TxRow` chaveia linhas por `tx.id`, então a MESMA
  // instância de `<Tip>` sobrevive a uma atualização in-place (ex.: marcar
  // como estorno no drawer troca `label` de "" pra um texto, ou
  // `setTransactionSettled` zera `parcela` e troca `hasParcela` de true pra
  // false) — o número de hooks chamados variava conforme `label` estar vazio
  // ou não, e o React derruba a árvore inteira ("Rendered more/fewer hooks
  // than during the previous render"), sem error boundary = tela branca.
  // TODOS os hooks (`useState`/`useRef`/`useId`/`useEffect`) agora rodam
  // incondicionalmente; só a SAÍDA (early return) depende de `label`.
  if (!label) return <>{children}</>;

  // Compute fixed position from measured rect
  const tipStyle = rect ? (pos === "top"
    ? { top: rect.top - 6, left: rect.left + rect.width / 2,
        transform: "translate(-50%, -100%)" }
    : { top: rect.bottom + 6, left: rect.left + rect.width / 2,
        transform: "translateX(-50%)" }
  ) : null;

  return (
    <span ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center" }}
      onMouseEnter={show} onMouseLeave={hide}
      onTouchStart={e => { e.stopPropagation(); rect ? hide() : show(e); }}>
      {children}
      {rect && tipStyle && (
        <span style={{
          position:"fixed",
          top: tipStyle.top, left: tipStyle.left,
          transform: tipStyle.transform,
          background:"#1A1A2E", color:"#fff",
          fontSize:11, fontWeight:600, borderRadius:7, padding:"5px 9px",
          whiteSpace:"nowrap", zIndex:90, pointerEvents:"none",
          boxShadow:"0 4px 14px rgba(0,0,0,0.28)", lineHeight:1.4,
        }}>
          {label}
        </span>
      )}
    </span>
  );
};

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
const TxRow = ({ tx, isMobile, isSelected, onSelect, coveringAnchor,
  rowHeight = 48, showDate = true, dateLabel = "", quickActions = null,
  onFilterByCategory = null, onFilterByTag = null, wide = false, xwide = false,
  /* Largura da coluna de tags, em px, IGUAL para todas as linhas da página.
     Zero = ninguém tem tag e a coluna não existe. */
  tagsColPx = 0,
  /* Largura da coluna de categoria, igual para toda a página. Zero = cai no
     `auto` de antes (mocks, testes). */
  catColPx = 0,
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
  swipe = null, flash = false }) => {
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
    catColPx > 0 ? `${catColPx}px` : "auto",
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
    quickActions ? "minmax(156px, 1fr)" : "1fr",
    dense ? "88px" : "100px",
    // Situação: com largura, o anel ganha o rótulo. Só o anel obriga a decorar
    // o que ele significa — e há espaço de sobra aqui.
    wide ? "76px" : "18px",
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
    "14px",
  ].filter(Boolean).join(" ");

  const statusRing = tx.settleable && !tx.settled;

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
        className={`fincla-row${flash ? " fincla-tx-settled" : ""}`}
        onClick={() => (swipeOpen ? swipe.close() : onSelect(tx))}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(tx);
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isSelected}
        aria-label={`${tx.desc}, ${isReceita ? "receita" : "despesa"} de ${fmtBRL(tx.val)} em ${tx.date}`}
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
          background: isSelected ? `${catCol}08` : T.surface,
          borderLeft: isSelected ? `3px solid ${catCol}` : "3px solid transparent",
          cursor:"pointer", position:"relative",
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
          <div style={{ ...G, fontSize:10, color:T.inkGhost, lineHeight:1.35,
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
            <div style={{ ...G, fontSize:10, color:T.inkLight, lineHeight:1.35,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {tags.join(", ")}
            </div>
          )}
        </div>
        <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:12.5, fontWeight:700,
          whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5,
          color: isRefund ? T.green : (isReceita ? T.green : T.ink) }}>
          {isReceita ? "+" : "−"}{fmtBRL(tx.val)}
          {statusRing && (
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
      onClick={() => onSelect(tx)}
      onKeyDown={(e) => {
        // Só a própria linha. Os botões de ação rápida são descendentes: sem
        // esta guarda, o `preventDefault` cancelava o clique sintetizado deles e
        // Enter numa ação abria a sanfona em vez de executar a ação.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(tx);
        }
      }}
      className="fincla-row"
      /* A linha era um `div` com onClick: invisível para teclado e para leitor
         de tela. Um único ponto de parada no Tab (a lista inteira seriam 15
         paradas × 3 ações) e Enter/Espaço abrem o detalhe. */
      role="button"
      data-tx-row={tx.id}
      /* `roving tabindex`: UMA parada no Tab para a lista inteira, e ↑↓ andam
         entre as linhas. Com `tabIndex=0` em todas, 20 linhas × 4 ações rápidas
         viravam ~100 paradas entre a busca e o rodapé. */
      tabIndex={isRovingStop ? 0 : -1}
      aria-expanded={isSelected}
      aria-label={`${tx.desc}, ${isReceita ? "receita" : "despesa"} de ${fmtBRL(tx.val)} em ${tx.date}`}
      style={{ display:"grid", gridTemplateColumns: columns,
        alignItems:"center", gap: dense ? 9 : 11,
        height: rowHeight,
        padding:"0 14px",
        background: isSelected ? `${catCol}08` : "transparent",
        borderLeft: isSelected ? `3px solid ${catCol}` : "3px solid transparent",
        cursor:"pointer", transition:"background 0.12s, border-color 0.12s" }}>

      {/* Data em coluna. Ela sai do cabeçalho de grupo porque, com um lançamento
          por dia — o caso normal —, o cabeçalho custava 48 px por transação só
          para repetir a data. No modo agrupado o cabeçalho já a carrega e a
          coluna some. */}
      {showDate && (
        <div style={{ ...G, fontFamily:"'Geist Mono',monospace",
          fontSize: dense ? 10 : 11, color:T.inkLight, lineHeight:1.15 }}>
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
      <div style={{ minWidth:0 }}>
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
        <div style={{ ...G, fontSize: dense ? 9.5 : 10.5, color:T.inkGhost,
          lineHeight:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>
            {methodLine}
            {accountLabel ? ` · ${accountLabel}` : ""}
          </span>
          {hasParcela && (
            <Tip label={`${tx.parcela.atual}ª de ${tx.parcela.total} parcelas · ${fmtBRL(tx.parcela.valParcela)}/mês`}>
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
          isso" — por isso as ações rápidas não moram mais aqui em cima. */}
      <div style={{ minWidth:0, display:"flex", justifyContent:"flex-start" }}>
        {onFilterByCategory ? (
          <Tip label={`Filtrar por ${tx.cat}`}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onFilterByCategory(tx); }}
              aria-label={`Filtrar por categoria ${tx.cat}`}
              // NUNCA `font:"inherit"` aqui: `font` é atalho e reseta
              // `fontSize`/`fontWeight` declarados antes dele no mesmo objeto.
              // Foi assim que a categoria virou 16px peso 400 — maior que a
              // própria descrição, invertendo a hierarquia da linha.
              style={{ ...G, fontFamily:"inherit", fontSize:10, fontWeight:600,
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
          <span style={{ ...G, fontSize:10, fontWeight:600, color:catCol,
            background:`${catCol}18`, borderRadius:99, padding:"3px 7px",
            maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis",
            whiteSpace:"nowrap", lineHeight:1.4 }}>{tx.cat}</span>
        )}
      </div>

      {tagsColPx > 0 && (
        <div style={{ display:"flex", gap:5, minWidth:0, overflow:"hidden", alignItems:"center" }}>
          {tags.slice(0, TAGS_VISIVEIS).map((tag) =>
            onFilterByTag ? (
              // `title` é o rótulo CRU: ele existe para deixar legível um nome
              // truncado ("mensal (a1b2c3d4)"). A ação mora no `aria-label`.
              <button key={tag} type="button" title={tag}
                onClick={(e) => { e.stopPropagation(); onFilterByTag(tag); }}
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
                style={{ ...G, fontSize:10, fontWeight:600, color:T.inkMid,
                  background:T.grayLight, border:"none", borderRadius:6,
                  padding:"2px 7px", cursor:"pointer", maxWidth:TAG_MAX_PX,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {tag}
              </button>
            ) : (
              <span key={tag} title={tag} style={{ ...G, fontSize:10, fontWeight:600,
                color:T.inkMid, background:T.grayLight, borderRadius:6, padding:"2px 7px",
                maxWidth:TAG_MAX_PX, overflow:"hidden", textOverflow:"ellipsis",
                whiteSpace:"nowrap" }}>{tag}</span>
            ),
          )}
          {/* O "+N" não é enfeite: ele avisa que há mais, e a sanfona mostra
              todas. Sem teto, uma transação com cinco tags decidiria a largura
              da coluna para as outras cem. */}
          {tags.length > TAGS_VISIVEIS && (
            <span title={tags.join(", ")} style={{ ...G, fontSize:10, fontWeight:700,
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
        {isReceita ? "+" : "−"}{fmtBRL(tx.val)}
      </div>

      {/* Situação: anel vazado, não ampulheta. O lançamento não está
          "processando" — ele existe e só ainda não entrou no saldo. */}
      {statusRing ? (
        <Tip label="Ainda não entrou no saldo da conta">
          <span style={{ ...G, color:T.amber, display:"flex", alignItems:"center",
            gap:5, fontSize:10.5, fontWeight:700, whiteSpace:"nowrap",
            justifyContent: wide ? "flex-end" : "center" }}>
            <i aria-hidden="true" style={{ display:"inline-block", width:8, height:8,
              border:"1.75px solid currentColor", borderRadius:"50%", boxSizing:"border-box" }}/>
            <span style={wide ? undefined : SR_ONLY}>A pagar</span>
          </span>
        </Tip>
      ) : <span />}

      <span style={{ display:"flex", justifyContent:"center", color: isSelected ? catCol : T.inkGhost,
        transition:"color 0.12s" }}>
        {isSelected
          ? <ChevronDown size={12} color={catCol}/>
          : <ChevronRight size={12} color={T.inkGhost}/>}
      </span>
    </div>
  );
};

/** Botão de 30 px da sanfona. Todos do mesmo tamanho: são ações do mesmo
 *  nível, e pesos visuais diferentes sugeririam uma hierarquia que não existe. */
const AccButton = ({ tone = "plain", disabled = false, onClick, children }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    style={{ ...G, height:30, padding:"0 12px", borderRadius:8, fontSize:11.5,
      fontWeight:700, display:"inline-flex", alignItems:"center", gap:6,
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1,
      whiteSpace:"nowrap",
      ...(tone === "dark"
        ? { background:T.ink, color:"#fff", border:`1px solid ${T.ink}` }
        : tone === "green"
        ? { background:T.green, color:"#fff", border:`1px solid ${T.green}` }
        : tone === "red"
        ? { background:T.surface, color:T.red, border:`1px solid ${T.red}44` }
        : { background:T.surface, color:T.inkMid, border:`1px solid ${T.border}` }) }}>
    {children}
  </button>
);

/* Referência estável para o default de props de lista: `[]` inline cria um
   array novo a cada render e quebra qualquer memo que dependa dele. */
const EMPTY_ARRAY = [];

/* Duas tags visíveis e o resto no "+N". O teto por chip existe para uma tag
   comprida não decidir a largura da coluna para a página inteira. */
const TAGS_VISIVEIS = 2;
const TAG_MAX_PX = 78;

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

/* A largura da coluna de tags, calculada UMA vez para a página.
   Cada `.fincla-row` é uma grade independente — `max-content` daria uma largura
   por linha e as tags desalinhariam verticalmente, o mesmo defeito que já tinha
   desalinhado as categorias. Medir o texto de verdade (canvas) em vez de
   estimar por número de caracteres: a fonte é proporcional, e "ii" e "MM" têm
   contagens iguais e larguras muito diferentes. */
let medidorCanvas = null;
/* Medidor de texto com degradação HONESTA.
   `getContext("2d")` devolve `null` em jsdom e em navegadores com canvas
   desligado. Voltar 0 dali escondia a coluna INTEIRA — um recurso sumindo em
   silêncio por causa de uma API de medição. O fallback estima por caractere:
   erra alguns pixels numa fonte proporcional, e o teto corta o excesso. */
function medidor(fonte, pxPorChar) {
  const estimativa = (t) => Math.ceil(String(t).length * pxPorChar);
  if (typeof document === "undefined") return estimativa;
  try {
    if (!medidorCanvas) medidorCanvas = document.createElement("canvas");
    const ctx = medidorCanvas.getContext && medidorCanvas.getContext("2d");
    if (!ctx) return estimativa;
    return (t) => {
      try {
        /* A fonte é setada A CADA medição, não uma vez na criação: o canvas é
           de módulo e os dois medidores dividem o mesmo contexto — segurar um
           medidor de categoria por cima de uma chamada de tags mediria tudo na
           última fonte configurada. */
        ctx.font = fonte;
        return Math.ceil(ctx.measureText(t).width);
      } catch {
        return estimativa(t);
      }
    };
  } catch {
    /* Navegadores e extensões anti-fingerprinting (Tor, canvas-blockers) fazem
       `getContext` LANÇAR em vez de devolver null. Isto roda dentro de um
       `useMemo`, durante o render: sem o try a exceção derrubava a tela inteira
       de Transações em vez de cair na estimativa. */
    return estimativa;
  }
}

/* A largura da coluna de CATEGORIA, também compartilhada pela página.
   Ela era `auto`, e `auto` numa grade por linha significa "cada linha decide a
   sua" — as pílulas começavam alinhadas à esquerda mas terminavam em onze
   posições diferentes, e a coluna seguinte (as tags) herdava a bagunça. Fixar
   as duas é o que dá a sensação de coluna, que é o ponto de existir uma. */
export function larguraColunaCategoria(txs, { teto = 168 } = {}) {
  if (!Array.isArray(txs) || txs.length === 0) return 0;
  const mede = medidor("600 10px 'Geist', 'DM Sans', system-ui, sans-serif", 5.6);
  const PAD = 16; // padding 7+7 + borda 1+1 da pílula, medidos no componente
  let maior = 0;
  for (const tx of txs) {
    if (!tx.cat) continue;
    const w = mede(tx.cat) + PAD;
    if (w > maior) maior = w;
  }
  return maior === 0 ? 0 : Math.min(teto, maior);
}

export function larguraColunaTags(txs, { visiveis = TAGS_VISIVEIS, tetoChip = TAG_MAX_PX, teto = 190 } = {}) {
  if (!Array.isArray(txs) || txs.length === 0) return 0;
  const mede = medidor("600 10px 'Geist', 'DM Sans', system-ui, sans-serif", 5.6);

  const PAD = 14; // padding 7px de cada lado do chip
  const GAP = 5;
  let maior = 0;
  for (const tx of txs) {
    const tags = tx.tags || [];
    if (tags.length === 0) continue;
    const mostradas = tags.slice(0, visiveis);
    let w = mostradas.reduce(
      (acc, tag) => acc + Math.min(tetoChip, mede(tag) + PAD),
      0,
    );
    w += GAP * Math.max(0, mostradas.length - 1);
    if (tags.length > visiveis) w += GAP + mede(`+${tags.length - visiveis}`);
    if (w > maior) maior = w;
  }
  return maior === 0 ? 0 : Math.min(teto, maior);
}

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

/* Mesmo motivo do `TxRow` acima (fincla-frontend#66): definido dentro do corpo,
   o drawer inteiro era desmontado e remontado a cada render da página — inclusive
   a cada transição de `settlingId`, disparada pelo próprio botão de liquidar. */
const DetailPanel = ({
  inline = false,
  tx,
  onClose,
  onEditTx,
  /* Avisa a página de que a edição começou nesta linha, para o foco voltar
     para ela quando o modal fechar. */
  onEditRequested,
  setSelected,
  shouldUseRealData,
  transactionsData,
  setMockTxList,
  onTransactionsInvalidate,
  deletingId,
  onRowLeave,
  onDuplicateTx,
  onFilterByCategory,
  isMobileDetail = false,
  onSettled,
  setDeletingId,
  settlingId,
  setSettlingId,
  settleError,
  setSettleError,
}) => {
  if (!tx) return null;
  const isReceita = tx.val > 0;
  return (
    <div style={ inline
      ? { display:"flex", flexDirection:"column" }
      : { display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
      {/* Header */}
      {/* No modo sanfona o cabeçalho "Detalhes" some: a linha logo acima já diz
          de qual transação se trata, e repetir isso custaria altura. */}
      {!inline && (
      <div style={{ padding:"18px 20px", borderBottom:`1px solid ${T.border}`,
        display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ ...G, fontSize:14, fontWeight:800, color:T.ink }}>Detalhes</div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer",
          padding:6, borderRadius:7, display:"flex" }}
          onMouseEnter={e=>e.currentTarget.style.background=T.bg}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <X size={15} color={T.inkMid}/>
        </button>
      </div>
      )}
      {/* Amount hero — só no painel; na sanfona o valor já está na linha. */}
      {!inline && (
      <div style={{ padding:"24px 20px 16px", background: isReceita ? T.greenLight : T.redLight,
        borderBottom:`1px solid ${T.border}`, textAlign:"center" }}>
        <div style={{ fontSize:32, marginBottom:6 }}>{tx.icon}</div>
        <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:26, fontWeight:800,
          color: isReceita ? T.green : T.red, letterSpacing:"-0.02em" }}>
          {isReceita ? "+" : "−"}{fmtBRL(tx.val)}
        </div>
        <div style={{ ...G, fontSize:13, color:T.inkMid, marginTop:4 }}>{tx.desc}</div>
      </div>
      )}
      {/* Fields — em grade quando inline, para aproveitar a largura toda em vez
          de empilhar oito linhas numa coluna de 320 px. */}
      <div style={ inline
        ? (isMobileDetail
            /* No mobile a sanfona não tem o recuo de 107 px (não há coluna de
               data) e as duas colunas fixas cabem melhor que `auto-fit`, que
               em 390 px colapsa para uma só e dobra a altura do painel. */
            ? { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 12px",
                padding:"10px 12px 0" }
            : { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",
                gap:"10px 18px", padding:"4px 14px 0 107px" })
        : { flex:1, overflowY:"auto", overflowX:"hidden", padding:"16px 20px", display:"flex", flexDirection:"column", gap:0, minHeight:0 }}>
        {[
          { label:"Categoria", val: onFilterByCategory ? (
              /* Clicável: é o gesto mais curto entre "vi algo" e "quero ver só
                 isso". Na linha a pílula não pode ser botão (o hover a troca
                 pelas ações rápidas), então ele mora aqui — onde a sanfona já
                 mostra a categoria de qualquer forma. */
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onFilterByCategory(tx); }}
                aria-label={`Filtrar por categoria ${tx.cat}`}
                title={`Filtrar por ${tx.cat}`}
                style={{ ...G, fontFamily:"inherit", display:"flex", alignItems:"center",
                  gap:6, background:"none", border:"none", padding:0, cursor:"pointer",
                  fontSize:12, fontWeight:600, color:T.ink, textAlign:"left" }}>
                <span style={{ width:8, height:8, borderRadius:"50%",
                  background:catColor(tx.cat), flexShrink:0 }}/>
                {tx.cat}
              </button>
            ) : (
              <span style={{ ...G, display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:catColor(tx.cat), flexShrink:0 }}/>
                {tx.cat}
              </span>
            )},
          { label:"Data",      val: tx.date },
          { label:"Método",    val: tx.method + (tx.parcela?.cartao ? ` · ${tx.parcela.cartao}` : "") },
          { label:"Status",    val: <span style={{ ...G, fontSize:12, fontWeight:700, padding:"2px 8px", borderRadius:99,
              background: tx.status==="confirmado" ? T.greenLight : T.amberLight,
              color:       tx.status==="confirmado" ? T.green       : T.amber }}>
              {tx.status === "confirmado" ? "✓ Confirmado" : "⏳ Pendente"}
            </span>},
          { label:"Recorrente",val: tx.rec ? "Sim" : "Não" },
          ...(tx.parcela ? [
            { label:"Parcela",      val: `${tx.parcela.atual}ª de ${tx.parcela.total}` },
            { label:"Vencimento",   val: tx.parcela.vencimento },
            { label:"Valor parcela",val: <span style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:13, fontWeight:700, color:T.blue }}>{fmtBRL(tx.parcela.valParcela)}/mês</span> },
            { label:"Valor total",  val: <span style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:13, fontWeight:600 }}>{fmtBRL(tx.parcela.valorTotal)}</span> },
            { label:"Já pago",      val: <span style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:13, fontWeight:600, color:T.green }}>{fmtBRL(tx.parcela.valorPago)}</span> },
            { label:"Valor residual",val: <span style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:13, fontWeight:700, color:T.red }}>{fmtBRL(tx.parcela.valorResidual)}</span> },
          ] : []),
        ].map(({label,val})=>(
          /* Na sanfona: rótulo EM CIMA do valor, como no artefato. Lado a lado
             com `space-between`, um campo curto ("Não") ficava colado na borda
             direita a 300 px do próprio rótulo, e o olho tinha que atravessar
             a linha para juntar os dois. */
          inline ? (
            <div key={label} style={{ minWidth:0 }}>
              <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:9.5,
                letterSpacing:"0.07em", textTransform:"uppercase", color:T.inkGhost }}>{label}</div>
              <div style={{ ...G, fontSize:12, fontWeight:600, color:T.ink, marginTop:2,
                overflow:"hidden", textOverflow:"ellipsis" }}>{val}</div>
            </div>
          ) : (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"11px 0", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ ...G, fontSize:12, color:T.inkMid }}>{label}</div>
              <div style={{ ...G, fontSize:13, color:T.ink, fontWeight:500 }}>{val}</div>
            </div>
          )
        ))}
        {tx.parcela && (
          <div style={{ padding:"11px 0", borderBottom:`1px solid ${T.border}` }}>
            <div style={{ ...G, fontSize:12, color:T.inkMid, marginBottom:8 }}>Progresso das parcelas</div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ ...G, fontSize:11, color:T.green, fontWeight:600 }}>{fmtBRL(tx.parcela.valorPago)} pago</span>
              <span style={{ ...G, fontSize:11, color:T.red, fontWeight:600 }}>{fmtBRL(tx.parcela.valorResidual)} restante</span>
            </div>
            <div style={{ height:6, background:T.grayLight, borderRadius:99, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${Math.round(tx.parcela.valorPago/tx.parcela.valorTotal*100)}%`,
                background:`linear-gradient(to right, ${T.green}, ${T.blue})`, borderRadius:99,
                animation:"progressFill 0.8s cubic-bezier(0.16,1,0.3,1) both" }}/>
            </div>
            <div style={{ ...G, fontSize:11, color:T.inkMid, textAlign:"center", marginTop:5 }}>
              {Math.round(tx.parcela.valorPago/tx.parcela.valorTotal*100)}% pago · {tx.parcela.total - tx.parcela.atual} parcelas restantes
            </div>
          </div>
        )}
        {(tx.tags||[]).length > 0 && (
          <div style={{ padding:"11px 0" }}>
            <div style={{ ...G, fontSize:12, color:T.inkMid, marginBottom:8 }}>Tags</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
              {tx.tags.map(tag => (
                // `title` mostra o texto completo no hover — a desambiguação
                // por prefixo curto e estável do id (achados 3/4, rodada 5
                // de review #100 — ver `disambiguateTagLabelEntries` em
                // transactionsAdapter.js) pode produzir um rótulo longo
                // ("mensal (a1b2c3d4)"); o pill não tem largura garantida
                // na linha, então trunca com reticências em vez de
                // estourar o layout.
                <span key={tag} title={tag} style={{ ...G, fontSize:11, background:T.grayLight,
                  color:T.inkMid, padding:"3px 9px", borderRadius:99, maxWidth:180,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  display:"inline-block" }}>#{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      {tx.settleable && settleError && (
        <div style={{ ...G, margin: inline ? "8px 14px 0 107px" : "8px 20px 0",
          fontSize:11.5, color:T.red, background:T.redLight, borderRadius:9,
          padding:"7px 10px" }}>
          {settleError}
        </div>
      )}

      {/* Ações — UMA linha de botões do mesmo tamanho, como no artefato.
          Antes: "Marcar como pago" numa faixa própria com texto explicativo,
          "Editar" preto ocupando a largura inteira e a lixeira solta na ponta.
          Três pesos visuais diferentes para três ações do mesmo nível, e a
          altura de duas faixas onde cabe uma. */}
      <div style={ inline && isMobileDetail
        /* Botões em 2×2 no mobile: em linha, quatro deles de 30 px ficam com
           ~85 px cada num aparelho de 390 — alvo de toque menor que o mínimo
           confortável, e os rótulos truncam. */
        ? { display:"grid", gridTemplateColumns:"1fr 1fr", gap:7, padding:"10px 12px 12px" }
        : { display:"flex", gap:8, alignItems:"center", flexWrap:"wrap",
            padding: inline ? "12px 14px 14px 107px" : "14px 20px",
            borderTop: inline ? "none" : `1px solid ${T.border}` }}>
        {/* Cartão fica de fora: ele liquida quando a FATURA é paga, não por
            lançamento, então a ação aqui mentiria sobre o que o usuário controla. */}
        {tx.settleable && (
          <AccButton
            tone={tx.settled ? "plain" : "green"}
            disabled={settlingId === tx.id}
            onClick={async (e) => {
              e.stopPropagation();
              const next = !tx.settled;
              // Demo/mock não tem backend: sem este ramo o botão fica clicável e
              // não faz nada, que é pior que não existir.
              if (!shouldUseRealData) {
                setMockTxList((prev) =>
                  prev.map((item) => (item.id === tx.id ? { ...item, settled: next } : item)),
                );
                setSelected((cur) => (cur && cur.id === tx.id ? { ...cur, settled: next } : cur));
                onSettled?.(tx.id, next);
                return;
              }
              setSettlingId(tx.id);
              setSettleError("");
              try {
                const updated = await transactionsData.setTransactionSettled(tx.id, next);
                // O painel renderiza a partir de `selected`, que é um snapshot — sem
                // isto ele continuaria mostrando o estado antigo até fechar.
                if (updated) setSelected((cur) => (cur && cur.id === tx.id ? { ...cur, ...updated } : cur));
                // O pulso verde estava só na ação rápida da linha. No mobile
                // ela não existe (o caminho é swipe ou sanfona), então marcar
                // como pago não mostrava efeito NENHUM — a linha só mudava de
                // cor num canto.
                onSettled?.(tx.id, next);
                // A linha já foi trocada em memória, mas o summary e o recorte do
                // filtro continuariam velhos: com Situação = "A pagar", a linha
                // recém-paga ficaria visível sob um filtro que a exclui.
                onTransactionsInvalidate?.();
              } catch (err) {
                // Mensagem local, ao lado da ação: `transactionsData.error` renderiza
                // no topo da página, e no mobile a faixa fica coberta pelo sheet.
                setSettleError(err?.message || "Não foi possível atualizar o pagamento.");
              } finally {
                setSettlingId(null);
              }
            }}>
            {settlingId === tx.id ? "…" : tx.settled ? "↺ Desfazer pagamento" : "✓ Marcar como pago"}
          </AccButton>
        )}
        <AccButton
          tone="dark"
          onClick={(e) => {
            e.stopPropagation();
            if (onEditTx) onEditTx(tx);
            /* A sanfona NÃO fecha. Ela fechava por uma corrida que não existe
               neste caminho: a edição navega para
               `/transactions/{-$transactionId}`, segmento OPCIONAL da mesma
               rota, então a página não desmonta e `selected` sobrevive ao modal.
               Fechar tirava da tela justamente o contexto de onde a pessoa
               chamou a edição — e ao voltar ela caía numa lista sem marca de
               onde estava. A sanfona já faz merge do resultado, então ela volta
               com os dados novos sem recarregar. */
            onEditRequested?.(tx);
          }}>
          ✎ Editar
        </AccButton>
        {onDuplicateTx && (
          <AccButton onClick={(e) => { e.stopPropagation(); onDuplicateTx(tx); }}>
            ⧉ Duplicar
          </AccButton>
        )}
        {deletingId === tx.id ? (
          <AccButton
            tone="red"
            onClick={async (e) => {
              e.stopPropagation();
              if (shouldUseRealData) {
                try {
                  await transactionsData.removeTransaction(tx.id);
                } catch (_) {
                  return;
                }
              } else {
                setMockTxList((prev) => prev.filter((item) => item.id !== tx.id));
              }
              setSelected(null);
              setDeletingId(null);
              // A linha colapsa ANTES do refetch. Sem isso a lista se
              // reorganizaria de um quadro para o outro e o olho perderia onde
              // estava; `onRowLeave` roda a saída e só então revalida.
              onRowLeave?.(tx.id);
            }}>
            {/* Rótulo CURTO: "Confirmar exclusão" estourava a célula da grade
                2×2 do mobile e empurrava o botão vizinho. O que a pessoa
                precisa ler é que este clique é o definitivo. */}
            🗑 Confirmar
          </AccButton>
        ) : (
          <AccButton tone="red" onClick={(e) => { e.stopPropagation(); setDeletingId(tx.id); }}>
            🗑 Excluir
          </AccButton>
        )}
        {/* Sem CANCELAR, "Excluir" era uma porta sem saída: a linha ficava
            armada para sempre, e o único jeito de sair era confirmar ou
            recarregar. Ocupa a célula da dica, que só existe no desktop. */}
        {deletingId === tx.id ? (
          <AccButton onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}>
            Cancelar
          </AccButton>
        ) : null}
        {inline && !isMobileDetail && deletingId !== tx.id && (
          <span style={{ ...G, marginLeft:"auto", fontSize:10.5, color:T.inkLight }}>
            Enter expande · Esc fecha
          </span>
        )}
      </div>
    </div>
  );
};

export function TransacoesPage(props) {
  if (props.dataMode === "empty") {
    return <TransactionsEmptyState extraTx={props.extraTx ?? []} onNewTx={props.onNewTx} />;
  }
  return <TransacoesPageBody {...props} />;
}

function TransacoesPageBody({
  onNav,
  isMobile = false,
  onEditTx,
  onDuplicateTx,
  onNewTx,
  dataMode = "live",
  organizationId = null,
  transactionsRefreshToken = 0,
  onTransactionsInvalidate,
}) {
  const urlSearch = useSearch({ strict: false });
  const navigate = useNavigate();
  /* Calculado UMA vez, no primeiro layout — redimensionar a janela não pode
     disparar refetch. E só cresce: trocar para uma lista mais densa aumenta a
     página, mas voltar não encolhe o que já foi carregado. */
  const pageSizeRef = useRef(0);
  if (pageSizeRef.current === 0) {
    const prefs = readListPrefs();
    pageSizeRef.current = computePageSize(
      typeof window !== "undefined" ? window.innerHeight - 240 : 0,
      rowCost(prefs.density, isMobile, prefs.grouped),
    );
  }
  const PAGE_SIZE = pageSizeRef.current;

  const parseDate = d => {
    if (!d) return new Date(0);
    const parts = d.split("/");
    if (parts.length === 3) return new Date(+parts[2], +parts[1]-1, +parts[0]);
    if (parts.length === 2) return new Date(new Date().getFullYear(), +parts[1]-1, +parts[0]);
    return new Date(0);
  };
  const fmtDateLabel = (d) => {
    const dt = parseDate(d);
    const today = new Date();
    const yest  = new Date();
    yest.setDate(today.getDate() - 1);
    if (dt.toDateString() === today.toDateString()) return "Hoje";
    if (dt.toDateString() === yest.toDateString())  return "Ontem";
    // Só a PRIMEIRA letra sobe. O `textTransform:"capitalize"` do CSS sobe a
    // inicial de CADA palavra e produzia "Quinta-Feira, 20 De Agosto" — em
    // português só o começo da frase é maiúsculo aqui.
    const label = dt.toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long",
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  /** Período: default "mes" + persistência por org (`transactionsPeriodStorage`). */
  const periodBootstrapRef = useRef(null);
  if (periodBootstrapRef.current === null) {
    periodBootstrapRef.current = getTransactionsPeriodBootstrap(organizationId);
  }
  const b0 = periodBootstrapRef.current;

  /**
   * Estado canônico dos filtros + ordenação multi-nível (Variação C — Faceted Pills).
   * O período inicial vem do localStorage por org (preservado da implementação anterior).
   */
  const filter = useTransactionsFilterState({
    initial: {
      period: b0.period,
      customFrom: b0.customFrom,
      customTo: b0.customTo,
    },
    initialSort: DEFAULT_SORT,
  });

  // Deep-link vindo do Calendário: `?fc_date=YYYY-MM-DD` filtra exatamente aquele dia.
  const fcDate = urlSearch?.[FC.DATE];
  const fcDateAppliedRef = useRef(false);
  useEffect(() => {
    if (fcDateAppliedRef.current) return;
    if (fcDate && /^\d{4}-\d{2}-\d{2}$/.test(fcDate)) {
      fcDateAppliedRef.current = true;
      filter.setPeriod("custom");
      filter.setCustomFrom(fcDate);
      filter.setCustomTo(fcDate);
    }
  }, [fcDate, filter]);

  const periodPersistFingerprintRef = useRef("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth : DESKTOP_FILTERS_EXPAND_BREAKPOINT),
  );
  const [viewportHeight, setViewportHeight] = useState(
    () => (typeof window !== "undefined" ? window.innerHeight : DESKTOP_FILTERS_EXPAND_MIN_HEIGHT),
  );
  const [compactDesktopFiltersOpen, setCompactDesktopFiltersOpen] = useState(false);
  const [wideDesktopFiltersOpen, setWideDesktopFiltersOpen] = useState(false);
  /* Largura do painel ancorado, na regra do artefato: até 1600 px a lista
     precisa da largura e o painel fica em 396. Acima disso sobra espaço de
     verdade e ele vai a ~metade da área de conteúdo, com teto de 860 — passar
     disso deixaria a lista mais estreita que o painel que a filtra. */
  const dockPanelWidth = useMemo(() => {
    const content = Math.max(0, viewportWidth - SIDEBAR_WIDTH);
    return viewportWidth >= 1600 ? Math.min(860, Math.round(content * 0.5)) : 396;
  }, [viewportWidth]);

  /* Qual faceta o painel mostra. Começa em "Período" porque é a que mais muda
     e a única sempre ativa; abrir em "Ativos" com a lista limpa daria uma tela
     vazia como primeira impressão do painel. */
  /* Largura REAL da lista, medida. O rótulo da ação rápida cresce para dentro do
     vão da linha, e o vão depende da lista — não da viewport: com a dock aberta
     em 1300 px a lista cai para ~695 px (1300 − sidebar 195 − painel 396 − 14),
     e um limiar de viewport deixaria o rótulo crescer por cima da categoria e do
     fim da descrição. Medir é a única leitura que sobrevive à dock. */
  const [listWidth, setListWidth] = useState(0);
  useEffect(() => {
    const el = listScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => {
      setListWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  const [chipsBudget, setChipsBudget] = useState(null);
  const [confirmAcao, setConfirmAcao] = useState(null);
  /* `rovingId` guarda a linha lembrada; `rovingStopId` é a que REALMENTE está
     na tela. A comparação era `tx.id === rovingId` com `rovingId` sempre string
     e `tx.id` numérico no mock: `1 === "1"` é falso, então nenhuma linha era a
     parada e a lista inteira saía da ordem de Tab — exatamente a regressão que
     esta feature veio evitar. E mesmo com UUIDs, a linha lembrada some ao ser
     excluída ou filtrada, e ninguém limpava o estado. Se a lembrada não está
     mais renderizada, a parada volta para a primeira linha. */
  const [rovingId, setRovingId] = useState(null);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const buscaRef = useRef(null);
  /* Qual linha pediu a edição. Ao fechar o modal, o foco volta para ela: sem
     isso o Tab recomeça do topo do documento e quem editou perde o lugar. */
  const editandoDeRef = useRef(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const [panelFacet, setPanelFacet] = useState("periodo");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const swipeActions = useSwipeActions();
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [listPrefs, setListPrefsState] = useState(() => readListPrefs());
  const setListPrefs = useCallback((next) => {
    setListPrefsState((cur) => {
      const merged = { ...cur, ...next };
      writeListPrefs(merged);
      return merged;
    });
  }, []);
  const [saveViewFormOpen, setSaveViewFormOpen] = useState(false);
  const [saveViewFormMode, setSaveViewFormMode] = useState("create");
  // ── Bottom sheet drag-to-dismiss ──────────────────────────────
  const sheetRef      = useRef(null);
  const snapFullRef   = useRef(true);    // read in RAF/touch handlers (no stale closure)
  const isClosingRef  = useRef(false);   // prevents double-close
  /* O sheet de filtros abre JÁ EM TELA CHEIA. Ele é o painel mais denso do
     app — visualizações salvas, ordenação e nove facetas — e abrir a 72%
     obrigava a arrastar antes de conseguir usar. As duas saídas continuam de
     pé: o ✕ do cabeçalho e o puxador, que reduz. */
  const snapFullRefInit = true;
  const [snapFull,    setSnapFull]    = useState(snapFullRefInit);  // false=72dvh, true=100dvh
  const [sheetClosing,setSheetClosing]= useState(false);  // drives exit animation
  const [selected,    setSelected]    = useState(null);
  /** Estável entre renders: se a identidade mudasse, `TxRow` re-renderizaria à toa
      e o ganho de içar o componente para o módulo iria embora. */
  /**
   * Rola o MÍNIMO para a sanfona recém-aberta caber inteira.
   *
   * Abrir uma linha no fim da lista revelava um painel que nascia fora da
   * área visível: a pessoa via a linha destacar e nada acontecer. Rola só o
   * quanto falta — puxar a linha para o topo tiraria de vista o contexto ao
   * redor, que é justamente o que a sanfona existe para preservar.
   *
   * Roda como ref callback, no mesmo commit em que o painel entra no DOM, e
   * espera a animação de entrada (`fadeInDown`, 180ms) terminar: medir antes
   * disso pega a altura no meio do movimento.
   */
  const revealAccordion = useCallback((node) => {
    if (!node) return;
    const scroller = isMobile
      ? node.closest(".fincla-scroll")
      : listScrollRef.current;
    if (!scroller) return;
    const settle = () => {
      const box = node.getBoundingClientRect();
      const view = scroller.getBoundingClientRect();
      const overflow = box.bottom - view.bottom;
      if (overflow <= 0) return;
      // Nunca mais que o topo da linha: passar disso empurraria a própria
      // transação para fora da tela.
      const row = node.previousElementSibling;
      const maxUp = row ? row.getBoundingClientRect().top - view.top : Infinity;
      scroller.scrollBy({
        top: Math.min(overflow + 12, Math.max(0, maxUp)),
        behavior: "smooth",
      });
    };
    const t = setTimeout(settle, 200);
    return () => clearTimeout(t);
  }, [isMobile]);

  const handleSelectTx = useCallback((tx) => {
    setSelected((cur) => {
      const next = cur?.id === tx.id ? null : tx;
      // O erro de liquidação é de UMA transação; sem isto ele reapareceria
      // colado na próxima que fosse aberta. A confirmação de exclusão segue a
      // mesma regra: fechar a sanfona ou abrir outra linha DESARMA o "tem
      // certeza?" — deixá-lo armado faria a próxima abertura já nascer a um
      // clique de apagar.
      if (cur?.id !== next?.id) {
        setSettleError("");
        setDeletingId(null);
      }
      return next;
    });
  }, []);
  const [visible,     setVisible]     = useState(PAGE_SIZE);
  const listScrollRef = useRef(null);
  const savedViewsSectionRef = useRef(null);
  /** Snapshot imediatamente anterior à aplicação da view ativa (para desaplicar). */
  const snapshotBeforeViewRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);
  const loadMoreCooldownRef = useRef(false);
  // fincla-frontend#109 rodada 4, achado 2: uma falha ao "carregar mais" não
  // tem NENHUM gatilho de retentativa hoje — `refreshToken` (prop, global)
  // não muda por causa disso. Este token LOCAL, só combinado no
  // `refreshToken` composto abaixo, dá à pessoa uma ação explícita
  // ("Tentar novamente") sem reusar o token global (que também dispara
  // outros efeitos da página, ex.: âncoras de saldo).
  const [loadMoreRetryToken, setLoadMoreRetryToken] = useState(0);
  const [deletingId,  setDeletingId]  = useState(null);
  // Id em liquidação — trava o botão para o clique duplo não disparar settle + unsettle.
  const [settlingId,  setSettlingId]  = useState(null);
  const [undoToast,   setUndoToast]   = useState(null);
  /** Erro da liquidação, mostrado ao lado do botão (a faixa global fica coberta
      pelo bottom sheet no mobile, onde essa ação vive). */
  const [settleError, setSettleError] = useState("");
  const [mockTxList,  setMockTxList]  = useState(TRANSACTIONS);

  /** Saved views (Variação C) persistidas em localStorage por org. */
  const savedViewsApi = useSavedViews(organizationId);
  const [savedViewActive, setSavedViewActive] = useState(null);

  const isDesktopCompact =
    !isMobile
    && (viewportWidth < DESKTOP_FILTERS_EXPAND_BREAKPOINT
      || viewportHeight < DESKTOP_FILTERS_EXPAND_MIN_HEIGHT);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isDesktopCompact) setCompactDesktopFiltersOpen(false);
  }, [isDesktopCompact]);

  useLayoutEffect(() => {
    if (!organizationId) {
      periodPersistFingerprintRef.current = "";
      return;
    }
    // Deep-link `?fc_date` tem precedência: não deixar o bootstrap de período
    // (localStorage) sobrescrever o filtro do dia vindo do calendário.
    if (fcDate) return;
    const row = getTransactionsPeriodBootstrap(organizationId);
    periodPersistFingerprintRef.current = JSON.stringify({
      org: organizationId,
      period: row.period,
      customFrom: row.customFrom,
      customTo: row.customTo,
    });
    filter.setPeriod(row.period);
    filter.setCustomFrom(row.customFrom);
    filter.setCustomTo(row.customTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    // Deep-link do calendário (`?fc_date=`) é um filtro transiente: não persistir
    // como período padrão do usuário (senão `/transactions` fica preso naquele dia).
    if (fcDate) return;
    const fp = JSON.stringify({
      org: organizationId,
      period: filter.period,
      customFrom: filter.customFrom,
      customTo: filter.customTo,
    });
    if (fp === periodPersistFingerprintRef.current) return;
    periodPersistFingerprintRef.current = fp;
    writeTransactionsPeriodToStorage(organizationId, {
      period: filter.period,
      customFrom: filter.customFrom,
      customTo: filter.customTo,
    });
  }, [organizationId, fcDate, filter.period, filter.customFrom, filter.customTo]);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === "") {
      setDebouncedSearch("");
      setVisible(PAGE_SIZE);
      return;
    }
    setVisible(PAGE_SIZE);
    const id = window.setTimeout(() => {
      setDebouncedSearch(trimmed);
    }, TRANSACTIONS_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const searchAwaitingCommit = searchInput.trim() !== debouncedSearch;

  const shouldUseRealData = shouldUseRealDataForMode(organizationId, dataMode);

  /** Âncoras de saldo por conta — dizem quais lançamentos já estão contemplados num
      acerto e por isso não mexem no saldo. Falha silenciosa de propósito: sem elas a
      lista só deixa de mostrar a marca, o que é melhor do que não carregar a tela. */
  const [balanceAnchors, setBalanceAnchors] = useState({});
  useEffect(() => {
    if (!shouldUseRealData || !organizationId) {
      setBalanceAnchors({});
      return undefined;
    }
    let cancelled = false;
    // As duas fontes: o feed de ajustes e as contas (para a âncora implícita do saldo
    // de abertura, que não tem linha em `balance_adjustments`).
    Promise.all([
      listOrgBalanceAdjustments(organizationId),
      listAccounts(organizationId).catch(() => []),
    ])
      .then(([rows, accounts]) => {
        if (!cancelled) setBalanceAnchors(latestAnchorByAccount(rows, accounts));
      })
      .catch(() => {
        if (!cancelled) setBalanceAnchors({});
      });
    return () => {
      cancelled = true;
    };
  }, [shouldUseRealData, organizationId, transactionsRefreshToken]);

  const categoryTagsData = useCategoryTagsData({
    organizationId,
    enabled: shouldUseRealData,
  });
  // Necessário aqui (antes de `transactionsFilters`) para detectar "Todas
  // categorias selecionadas" e mapear pro filtro vazio do backend.
  const totalCategoriesForBackend = shouldUseRealData
    ? categoryTagsData.categories?.length || 0
    : 0;
  // Catálogo de tags não-categoria (`detalhe`, `contexto`, `local`, `pessoa`...)
  // da organização inteira — não só as que aparecem na página atual. Precisamos
  // dele para resolver o RÓTULO que a facet "Tags" guarda (`filter.tags`) em um
  // UUID de verdade: o backend só filtra por `tag_id`, nunca por nome
  // (fincla-frontend#78; ver nota em filtersToLegacyParams.js). Ver
  // useTransactionsTagCatalog.js para o porquê de NÃO reaproveitar
  // `useNovaTransacaoDetailTags` (achado 6 da revisão da PR #96: aquele hook
  // só traz `tag_type=detalhe`, mas a linha da transação mostra qualquer tag
  // não-categoria).
  const tagCatalog = useTransactionsTagCatalog({
    organizationId,
    enabled: shouldUseRealData,
  });
  const categoryLabelById = useMemo(() => {
    const map = new Map();
    for (const c of categoryTagsData.categories || []) {
      if (c?.id != null) map.set(String(c.id), c.labelPt);
    }
    return map;
  }, [categoryTagsData.categories]);
  // Achado 1: tags não-categoria podem repetir o NOME sob categorias-pai
  // diferentes (ex.: "mensal" em Casa e em Trabalho) — `buildTagOptions`
  // desambigua o rótulo exibido quando isso acontece, então cada opção do
  // painel resolve para um único id, nunca colapsa duas tags num chip só.
  const tagOptions = useMemo(
    () => buildTagOptions(tagCatalog.rows, categoryLabelById),
    [tagCatalog.rows, categoryLabelById],
  );
  const tagDisplayToId = useMemo(() => tagOptionsToDisplayMap(tagOptions), [tagOptions]);
  // A facet voltou a ser multi agora que `tag_id` é repetível: resolvemos a
  // seleção INTEIRA, e se qualquer rótulo falhar o conjunto todo bloqueia —
  // ver `resolveTagFilterStatuses` para o porquê de não mandar o subconjunto.
  const tagFilterStatus = useMemo(
    () =>
      shouldUseRealData
        ? resolveTagFilterStatuses({
            selectedLabels: filter.tags,
            // fincla-frontend#101: `tagDisplayToId` (via `tagOptions`) depende
            // de `categoryLabelById` — enquanto CATEGORIAS ainda carregam,
            // `categoryLabelById` está vazio e uma tag com nome colidente
            // (duas tags "mensal" em categorias diferentes) resolve para um
            // `displayLabel` PROVISÓRIO (ex.: "mensal · sem categoria (uuid)")
            // diferente do rótulo FINAL, estável, que aparece quando as
            // categorias terminam de carregar (ex.: "mensal · Casa"). Uma
            // seleção persistida (view salva) com o rótulo final batia contra
            // o catálogo provisório e virava "unresolved" — falso positivo
            // de "renomeada ou removida" que sumia sozinho um instante depois.
            // Contar `categoryTagsData.isLoading` aqui também trava a busca
            // (fail closed) até o rótulo ser o definitivo, nunca resolve (ou
            // recusa) contra um valor que ainda vai mudar.
            loading: tagCatalog.loading || categoryTagsData.isLoading,
            error: tagCatalog.error,
            displayToId: tagDisplayToId,
          })
        : { kind: "none" },
    [
      shouldUseRealData,
      filter.tags,
      tagCatalog.loading,
      tagCatalog.error,
      categoryTagsData.isLoading,
      tagDisplayToId,
    ],
  );
  const resolvedTagIds = useMemo(
    () => (tagFilterStatus.kind === "resolved" ? tagFilterStatus.ids : []),
    [tagFilterStatus],
  );
  // Achado 4: um rótulo selecionado que não resolve para id NUNCA pode virar
  // "sem filtro" por baixo do capô — isso mostraria a lista inteira parecendo
  // filtrada. Enquanto o catálogo carrega, falhou, ou o rótulo não existe mais
  // (view salva com tag renomeada/apagada), a busca fica em espera (fail
  // closed, ver `enabled` abaixo) e um aviso visível explica o motivo.
  const tagFilterBlocked = shouldUseRealData && isTagFilterBlocked(tagFilterStatus);
  const transactionsFilters = useMemo(
    () =>
      filtersToLegacyParams(
        {
          type: filter.type,
          method: filter.method,
          cats: filter.cats,
          period: filter.period,
          customFrom: filter.customFrom,
          customTo: filter.customTo,
          sort: filter.sort,
          valueMin: filter.valueMin,
          valueMax: filter.valueMax,
          settlement: filter.settlement,
          rec: filter.rec,
          tagMode: filter.tagMode,
        },
        {
          limit: visible,
          debouncedSearch,
          totalCategories: totalCategoriesForBackend,
          tagIds: resolvedTagIds,
        },
      ),
    [
      debouncedSearch,
      filter.type,
      filter.method,
      filter.cats,
      filter.period,
      filter.customFrom,
      filter.customTo,
      filter.sort,
      filter.valueMin,
      filter.valueMax,
      filter.settlement,
      filter.rec,
      filter.tagMode,
      visible,
      totalCategoriesForBackend,
      resolvedTagIds,
    ],
  );
  const transactionsData = useTransactionsData({
    organizationId,
    // Achado 4 (fail-closed): com uma tag selecionada que ainda não resolveu
    // para um id, NÃO disparamos a busca com o filtro "esquecido" — melhor
    // mostrar nada por um instante (com aviso, ver `tagFilterStatus` abaixo)
    // do que mostrar a lista inteira se passando por filtrada.
    enabled: shouldUseRealData && !tagFilterBlocked,
    filters: transactionsFilters,
    // Composto com `loadMoreRetryToken`: o hook só compara por `!==`
    // (nunca faz aritmética), então uma chave composta funciona igual a um
    // número — e mantém o retry de paginação isolado do token GLOBAL (que
    // também dispara outros efeitos da página).
    refreshToken: `${transactionsRefreshToken}:${loadMoreRetryToken}`,
  });
  /* Total do período SEM os demais filtros — o "de 20" de "17 de 20
     transações". Sozinho, "17" não diz se o filtro cortou muito ou pouco, e é
     essa relação que responde "meu filtro está certo?".

     Só é buscado quando há algum filtro além do período: sem filtro os dois
     números são o mesmo e a requisição seria pura perda. */
  const periodOnlyFilters = useMemo(
    () =>
      filtersToLegacyParams(
        {
          type: "todos", method: [], cats: [],
          period: filter.period, customFrom: filter.customFrom, customTo: filter.customTo,
          sort: filter.sort, valueMin: "", valueMax: "", settlement: "todas", rec: "any",
        },
        { limit: 1, debouncedSearch: "" },
      ),
    [filter.period, filter.customFrom, filter.customTo, filter.sort],
  );
  const narrowedByMoreThanPeriod =
    Boolean(debouncedSearch) ||
    filter.type !== "todos" ||
    filter.method.length > 0 ||
    filter.cats.length > 0 ||
    filter.tags.length > 0 ||
    filter.cardSel.length > 0 ||
    filter.rec !== "any" ||
    filter.settlement !== "todas" ||
    Boolean(filter.valueMin || filter.valueMax);
  const periodTotal = useTransactionsFacetCounts({
    organizationId,
    filters: periodOnlyFilters,
    enabled: shouldUseRealData && narrowedByMoreThanPeriod,
    refreshToken: transactionsRefreshToken,
  });

  // Contagens por opção do painel de filtro. A busca é preguiçosa: quem só quer
  // ver a lista não paga uma requisição a mais por um número que nunca vai
  // aparecer na tela.
  //
  // São DUAS superfícies de filtro, e cada uma anuncia de um jeito. A barra
  // (`TransactionsFilterBar`, usada no mobile e no desktop compacto) avisa qual
  // facet abriu via `onExpandedChange`. O painel ancorado (`TransactionsFilterPanel`,
  // só no desktop largo) não avisa nada: ele sempre tem uma facet selecionada,
  // então o gatilho dele é simplesmente estar aberto. Considerar só a primeira
  // deixava TODAS as contagens mortas no painel — inclusive o histograma de
  // valor, que existe no código e nunca chegava a aparecer.
  const [expandedFacet, setExpandedFacet] = useState(null);
  const anyFacetPanelOpen = expandedFacet != null || (!isMobile && wideDesktopFiltersOpen);
  const facetCounts = useTransactionsFacetCounts({
    organizationId,
    filters: transactionsFilters,
    enabled: shouldUseRealData && !tagFilterBlocked && anyFacetPanelOpen,
    refreshToken: transactionsRefreshToken,
  });

  const txList = shouldUseRealData
    ? transactionsData.transactions
    : resolveLocalData({ dataMode, mockData: mockTxList, emptyData: [] });
  /* Espelho de `txList` para callbacks que rodam FORA do render (o pulso da
     sanfona). Sem ele o callback precisaria de `txList` na lista de
     dependências e seria recriado a cada página carregada. */
  const txListRef = useRef(txList);
  txListRef.current = txList;


  // fincla-frontend#106 — mesmo padrão do calendário (`useCalendarData`):
  // `hasLoaded` só vira `true` num sucesso, então "nunca carregou com
  // sucesso" é a única leitura válida de `!hasLoaded`. Enquanto isso for
  // verdade, `groups` vazio (mais abaixo) é uma LACUNA de informação — busca
  // em voo ou falhou —, não o fato "nenhuma transação". Depois da 1ª carga
  // bem-sucedida, uma falha de revalidação (troca de filtro, refresh) já tem
  // dados válidos pra mostrar via stale-while-revalidate (ver
  // useTransactionsData) e não deve regredir a lista pro estado de loading.
  //
  // fincla-frontend#109 achado 2 (revisão da PR #109): `listLoading` usava
  // `transactionsData.isLoading` — mas esse booleano só liga DEPOIS que o
  // `useEffect` do hook roda; no 1º quadro (e em qualquer transição de
  // `enabled` false→true, ex.: logo que `tagFilterBlocked` desbloqueia a
  // busca) ele ainda está `false`, e a tela caía no "vazio de verdade" antes
  // da API responder — a MESMA falha que o `hasLoaded` acima existe pra
  // evitar. Dentro de `listNeverLoaded`, "carregando" e "falhou" são
  // complementares por definição (`!hasLoaded` só sai desse estado num
  // sucesso ou numa falha visível): sem erro ainda visível, só pode ser
  // "em voo" — não depende de `isLoading` ter tido tempo de ligar.
  const listNeverLoaded = shouldUseRealData && !transactionsData.hasLoaded;
  const listLoadFailed = listNeverLoaded && Boolean(transactionsData.error);
  const listLoading = listNeverLoaded && !listLoadFailed;

  /** Categorias normalizadas para a FacetBar (id + label + color + icon). */
  const categoriesForFilter = useMemo(() => {
    if (shouldUseRealData && categoryTagsData.categories?.length) {
      return categoryTagsData.categories.map((c) => ({
        id: c.id,
        label: c.labelPt,
        color: c.color || CAT_COLORS[c.labelPt] || T.inkMid,
        icon: "●",
      }));
    }
    return [...new Set(txList.map((t) => t.cat))]
      .sort()
      .map((label) => ({
        id: label,
        label,
        color: CAT_COLORS[label] || T.inkMid,
        icon: "●",
      }));
  }, [shouldUseRealData, categoryTagsData.categories, txList]);

  /**
   * Rótulos disponíveis para o painel de Tags. Em modo live usa o catálogo da
   * organização inteira já desambiguado (`tagOptions`) — não só as tags que
   * aparecem na página atual — senão um período/filtro sem resultados
   * esvaziaria a lista de opções e o painel diria "nenhuma tag cadastrada"
   * mesmo com tags existindo. Modo demo/mock (sem catálogo real) cai para a
   * derivação a partir de `txList` (nomes das transações já carregadas).
   *
   * Falha ao carregar o catálogo (`tagCatalog.error`) é tratada à parte
   * (achado 5 x prioridade 3 da revisão da PR #96 — as duas mexem na mesma
   * decisão em direções opostas):
   *  - achado 5: sem opção nenhuma, o painel caía em "Nenhuma tag cadastrada."
   *    — falso, é erro de rede, não ausência de tags.
   *  - prioridade 3: a correção do achado 5 tinha oferecido as tags vistas em
   *    `txList` como opções "de fallback" — mas ISSO era uma armadilha:
   *    `useTransactionsTagCatalog` não tem retry (efeito só depende de
   *    `[enabled, organizationId]`), então QUALQUER seleção nesse estado cai
   *    em `tagFilterStatus.kind === "error"` pra sempre — a página trava com
   *    "Tente novamente em instantes" sendo mentira pela sessão inteira.
   * Solução: em erro, NÃO oferece opções (evita a armadilha) — o painel
   * mostra uma mensagem de erro própria (não "nenhuma tag cadastrada"),
   * atendendo os dois achados sem reabrir nenhum dos dois.
   */
  const allTagsForFilter = useMemo(() => {
    if (shouldUseRealData) {
      if (tagCatalog.error) return [];
      return tagOptions.map((o) => o.displayLabel);
    }
    const set = new Set();
    txList.forEach((t) => (t.tags || []).forEach((tg) => set.add(tg)));
    return Array.from(set).sort();
  }, [shouldUseRealData, tagCatalog.error, tagOptions, txList]);

  /** Cartões cadastrados — placeholder até integração com `useCreditCardsData`. */
  const cardsForFilter = useMemo(() => {
    const set = new Map();
    txList.forEach((t) => {
      const id = t.parcela?.cartao || null;
      if (id && !set.has(id)) {
        set.set(id, {
          id,
          label: id.split("••")[0]?.trim() || id,
          last4: id.split("••")[1]?.trim() || "",
          color: T.purple,
        });
      }
    });
    return Array.from(set.values());
  }, [txList]);

  const categoryFromUrl = urlSearch[FC.CATEGORY];
  useEffect(() => {
    if (!categoryFromUrl || String(categoryFromUrl).trim() === "") return;
    const slug = String(categoryFromUrl).trim();
    const strip = () =>
      navigate({
        replace: true,
        search: (prev) => {
          const next = { ...prev };
          delete next[FC.CATEGORY];
          return next;
        },
      });

    if (shouldUseRealData) {
      if (categoryTagsData.isLoading) return;
      if (categoryTagsData.categories?.length) {
        const byId = categoryTagsData.categories.find((c) => c.id === slug);
        if (byId) {
          filter.setCats([byId.id]);
          setFiltersOpen(false);
          strip();
          return;
        }
        const byLabel = categoryTagsData.categories.find((c) => c.labelPt === slug);
        if (byLabel) {
          filter.setCats([byLabel.id]);
          setFiltersOpen(false);
          strip();
          return;
        }
      }
    }
    filter.setCats([slug]);
    setFiltersOpen(false);
    strip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    categoryFromUrl,
    shouldUseRealData,
    categoryTagsData.isLoading,
    categoryTagsData.categories,
    navigate,
  ]);

  // Period presets
  const TODAY = new Date();
  const periodFilter = (t) => {
    const d = parseDate(t.date);
    const period = filter.period;
    if (period === "tudo")    return true;
    if (period === "hoje")    return d.toDateString() === TODAY.toDateString();
    if (period === "semana")  { const w = new Date(TODAY); w.setDate(w.getDate()-7); return d >= w; }
    if (period === "mes")     return d.getMonth()===TODAY.getMonth() && d.getFullYear()===TODAY.getFullYear();
    if (period === "mes-ant") { const m = new Date(TODAY); m.setMonth(m.getMonth()-1); return d.getMonth()===m.getMonth() && d.getFullYear()===m.getFullYear(); }
    if (period === "3m")      { const m3 = new Date(TODAY); m3.setMonth(m3.getMonth()-3); return d >= m3; }

    if (period === "ano")     return d.getFullYear()===TODAY.getFullYear();
    // "rel" grava o intervalo nos campos custom, então cai no MESMO ramo — e
    // não num `return true` que deixava tudo passar.
    if (period === "custom" || period === "rel") {
      const from = filter.customFrom ? new Date(filter.customFrom) : null;
      const to   = filter.customTo   ? new Date(filter.customTo+"T23:59:59") : null;
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    }
    return true;
  };

  /** Limpa filtros + sort + busca + paginação e desseleciona visualização salva. */
  const clearAll = () => {
    setSearchInput("");
    filter.clearAll();
    setSavedViewActive(null);
    setSaveViewFormOpen(false);
    snapshotBeforeViewRef.current = null;
    setVisible(PAGE_SIZE);
  };

  // ── Filter + sort ────────────────────────────────────────────────────────
  //
  // Em modo **live** a API já aplicou período, tipo, categorias, faixa de
  // valor, busca, ordenação, situação e forma(s) de pagamento (`payment_method`
  // repetido casa com qualquer uma das selecionadas). Tags: só a PRIMEIRA
  // selecionada vira `tag_id` de verdade (mesma limitação de "um valor só" que
  // categoria já tinha) e perde a prioridade se uma categoria também estiver
  // selecionada — o backend só entende um `tag_id` por vez (fincla-frontend#78,
  // ver filtersToLegacyParams.js). Recorrência ainda não tem filtro no backend.
  // Refiltrar aqui quebraria a lista: `txList` carrega linhas de *apresentação*
  // (ex.: `date` é "21/05", sem ano), e o recorte por página descartaria linhas
  // que na verdade casam nas demais páginas — era exatamente o bug da lista
  // vazia com 2+ formas selecionadas.
  const filtered = useMemo(() => {
    if (shouldUseRealData) {
      return txList;
    }

    const matches = txList.filter((t) => {
      if (!periodFilter(t)) return false;
      if (filter.type === "receita" && (t.type !== "income" || t.val < 0)) return false;
      if (filter.type === "despesa" && (t.type !== "expense" || t.val > 0)) return false;
      if (filter.method.length > 0 && !filter.method.includes(t.paymentMethodKey)) return false;
      if (filter.cats.length > 0 && !filter.cats.includes(t.cat)) return false;
      if (filter.tags.length > 0 && !(t.tags || []).some((tg) => filter.tags.includes(tg))) return false;
      if (filter.rec === "yes" && !t.rec) return false;
      if (filter.rec === "no" && t.rec) return false;
      // Sem isto o chip "Situação" acende no modo demo e a lista fica idêntica.
      if (filter.settlement === "pagas" && !t.settled) return false;
      if (filter.settlement === "a-pagar" && t.settled) return false;
      if (!matchesValueRange(Math.abs(t.val), filter.valueMin, filter.valueMax)) return false;
      if (debouncedSearch) {
        const needle = debouncedSearch.toLowerCase();
        const haystack = [t.desc, t.cat, ...(t.tags || [])];
        if (!haystack.some((s) => String(s).toLowerCase().includes(needle))) return false;
      }
      return true;
    });
    return filter.sortItems(matches);
  }, [
    shouldUseRealData,
    txList,
    debouncedSearch,
    filter.type,
    filter.method,
    filter.cats,
    filter.tags,
    filter.rec,
    filter.settlement,
    filter.valueMin,
    filter.valueMax,
    filter.period,
    filter.customFrom,
    filter.customTo,
    filter.sort,
  ]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  // A API já filtra por todas as formas selecionadas, então o summary remoto
  // vale mesmo com múltiplas formas.
  const canUseRemoteSummary = shouldUseRealData;
  const totalReceita = canUseRemoteSummary && transactionsData.summary
    ? transactionsData.summary.total_income
    : filtered.filter(t=>t.type==="income").reduce((s,t)=>s+t.val,0);
  // total_expenses do backend é BRUTO (não desconta refunds).
  const totalDespesaBruto = canUseRemoteSummary && transactionsData.summary
    ? transactionsData.summary.total_expenses
    : filtered.filter(t=>t.type==="expense").reduce((s,t)=>s+Math.abs(t.val),0);
  const totalEstorno = canUseRemoteSummary && transactionsData.summary
    ? (transactionsData.summary.total_refunds ?? 0)
    : filtered.filter(t=>t.type==="refund").reduce((s,t)=>s+Math.abs(t.val),0);
  // Despesa líquida = bruto − estornos da mesma origem. Pode ser negativa.
  const totalDespesaLiquido = totalDespesaBruto - totalEstorno;
  const saldo = canUseRemoteSummary && transactionsData.summary
    ? transactionsData.summary.balance
    : totalReceita - totalDespesaBruto + totalEstorno;
  const filteredCount = canUseRemoteSummary ? transactionsData.total : filtered.length;

  /* Contagens por tipo. Em modo live vêm do summary — do FILTRO INTEIRO.
     Antes eram sempre contadas nas linhas carregadas, e como os totais vêm do
     filtro, dividir um pelo outro dava uma "média" que podia sair 10× alta.
     O código escondia a média por causa disso; com a contagem certa ela volta. */
  const sumario = canUseRemoteSummary ? transactionsData.summary : null;
  const countReceita = sumario?.income_count ?? filtered.filter(t=>t.type==="income").length;
  const countDespesa = sumario?.expense_count ?? filtered.filter(t=>t.type==="expense").length;
  const countEstorno = sumario?.refund_count ?? filtered.filter(t=>t.type==="refund").length;
  /* `countsArePartial` deixa de ser "estamos em live" e passa a ser o que o
     nome diz: as contagens descrevem menos que o filtro. Com os campos novos
     elas descrevem o filtro inteiro. */
  const countsArePartial = canUseRemoteSummary && sumario?.income_count == null;

  const maiorReceita = sumario?.largest_income ?? null;
  const maiorDespesa = sumario?.largest_expense ?? null;
  const aPagarCount = sumario?.unsettled_count ?? null;
  const aPagarDespesas = sumario?.unsettled_expenses ?? null;
  const saldoLiquidado = sumario?.settled_balance ?? null;

  /* A coluna de tags é medida UMA vez por página de resultados — sobre as
     mesmas linhas que serão renderizadas, e não sobre o filtro inteiro: medir o
     que não está na tela daria uma coluna larga por causa de uma linha que
     ninguém vê. Abaixo de 1200 px ela não entra: a descrição precisa da
     largura, e o vão que a financiaria já não existe. */
  /* Medir sobre a PRIMEIRA página, não sobre tudo que já foi carregado.
     `visible` cresce com a rolagem infinita, e como as duas medidas são um
     máximo, cada "carregar mais" só podia ALARGAR as faixas — a lista inteira
     re-diagramava e a descrição encolhia sob o cursor de quem estava lendo.
     A primeira página é amostra suficiente e é estável. */
  const pageRows = useMemo(() => filtered.slice(0, PAGE_SIZE), [filtered, PAGE_SIZE]);
  /* A coluna depende da largura da LISTA, não da viewport. Com a dock aberta em
     1300 px a lista cai para ~695 px, e ali as faixas fixas (data, ícone,
     categoria, tags, valor, situação) somam quase tudo — a descrição, que é
     `minmax(0,1fr)`, colapsaria a zero. É o mesmo critério do rótulo da ação
     rápida, pelo mesmo motivo. */
  const tagsColPx = useMemo(
    () => {
      const largura = listWidth > 0 ? listWidth : viewportWidth - 200;
      if (isMobile || largura < 1000) return 0;
      return larguraColunaTags(pageRows);
    },
    [isMobile, listWidth, viewportWidth, pageRows],
  );
  const catColPx = useMemo(
    () => (isMobile ? 0 : larguraColunaCategoria(pageRows)),
    [isMobile, pageRows],
  );

  /* A parada de Tab que EXISTE na tela. Se a linha lembrada saiu da lista
     (excluída, filtrada, ou a página trocou), a parada volta para a primeira —
     nunca para "nenhuma", que tirava a lista da ordem de Tab. */
  const rovingStopId = useMemo(() => {
    const visiveis = filtered.slice(0, visible).map((t) => String(t.id));
    if (visiveis.length === 0) return null;
    return rovingId && visiveis.includes(rovingId) ? rovingId : visiveis[0];
  }, [filtered, visible, rovingId]);

  // ── Group by date ─────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const map = {};
    filtered.slice(0, visible).forEach(t => {
      const k = t.date || "Sem data";
      if (!map[k]) map[k] = [];
      map[k].push(t);
    });
    const entries = Object.entries(map);
    return shouldUseRealData
      ? entries
      : entries.sort((a,b) => parseDate(b[0]) - parseDate(a[0]));
  }, [shouldUseRealData, filtered, visible]);

  // fincla-frontend#109 rodada 4, achado 1 (CRÍTICO): uma falha ao "carregar
  // mais" não seta mais o `error` geral (achado 2 da rodada 3) — sem esta
  // exclusão explícita de `pageError`, `hasMore` continuava `true`, a
  // sentinela seguia montada, e `tryLoadMore` (chaveado em `isLoading`, que
  // alterna a cada tentativa) recriava o `IntersectionObserver` a cada
  // falha — cuja entrega inicial já dispara `tryLoadMore` de novo. Isso virou
  // uma tempestade de requisições sem fim, com `limit` crescendo pra sempre,
  // sem nenhuma ação da pessoa. Enquanto houver `pageError`, exige uma ação
  // EXPLÍCITA ("Tentar novamente" abaixo) — a sentinela some, o observer não
  // é recriado, e nada re-dispara sozinho.
  const hasMore =
    !searchAwaitingCommit &&
    (shouldUseRealData
      ? transactionsData.hasMore && !transactionsData.pageError
      : visible < filtered.length);

  // fincla-frontend#109 rodada 4, achado 2: bumpa o token LOCAL de retry
  // (definido acima, perto de `loadMoreSentinelRef`) — é a ÚNICA forma de
  // re-disparar a MESMA consulta que falhou (organização/filtros/limit
  // idênticos, então só um `refreshToken` novo força o efeito a rodar de
  // novo).
  const retryLoadMore = useCallback(() => {
    setLoadMoreRetryToken((t) => t + 1);
  }, []);

  const tryLoadMore = useCallback(() => {
    if (searchAwaitingCommit) return;
    if (!hasMore) return;
    if (shouldUseRealData && transactionsData.isLoading) return;
    if (loadMoreCooldownRef.current) return;
    loadMoreCooldownRef.current = true;
    /* `visible` É o `limit` da API, que rejeita acima de 100 com 422 — e o
       "Tentar novamente" reenviava a MESMA query estourada, deixando a pessoa
       presa sem saída. Com PAGE_SIZE fixo em 10 a sequência batia exatamente em
       100; dimensionado pela viewport ela passava do teto. */
    setVisible((v) => Math.min(TX_PAGE_MAX, v + PAGE_SIZE));
    window.setTimeout(() => {
      loadMoreCooldownRef.current = false;
    }, 400);
  }, [
    searchAwaitingCommit,
    hasMore,
    shouldUseRealData,
    transactionsData.isLoading,
  ]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore) return;
    const root = isMobile ? null : listScrollRef.current;
    if (!isMobile && !root) return;

    const io = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (!e?.isIntersecting) return;
        tryLoadMore();
      },
      { root, rootMargin: "160px", threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMore, isMobile, tryLoadMore]);

  const listFiltersActive =
    searchInput.trim() !== "" || filter.hasAnyActive;

  /** Snapshot do estado atual para alimentar saved views. */
  const currentSnapshot = useMemo(
    () => ({ ...filter.snapshot, searchInput, debouncedSearch }),
    [filter.snapshot, searchInput, debouncedSearch],
  );

  const activeSavedView = useMemo(
    () => savedViewsApi.views.find((v) => v.id === savedViewActive) ?? null,
    [savedViewsApi.views, savedViewActive],
  );

  const activeSavedViewDirty = useMemo(() => {
    if (!activeSavedView) return false;
    return !viewSnapshotsEqual(currentSnapshot, activeSavedView.filters);
  }, [activeSavedView, currentSnapshot]);

  const applySavedViewFilters = useCallback(
    (view) => {
      if (!view?.filters) return;
      filter.applySnapshot(view.filters);
      const search =
        view.filters.searchInput ?? view.filters.debouncedSearch ?? "";
      setSearchInput(search);
      setVisible(PAGE_SIZE);
    },
    [filter],
  );

  const captureSnapshotBeforeView = useCallback(() => {
    snapshotBeforeViewRef.current = { ...currentSnapshot };
  }, [currentSnapshot]);

  const deapplyActiveSavedView = useCallback(() => {
    const snap = snapshotBeforeViewRef.current;
    if (snap) {
      filter.applySnapshot(snap);
      setSearchInput(snap.searchInput ?? snap.debouncedSearch ?? "");
    } else {
      setSearchInput("");
      filter.clearAll();
    }
    snapshotBeforeViewRef.current = null;
    setSavedViewActive(null);
    setVisible(PAGE_SIZE);
  }, [filter]);

  const openSaveViewForm = useCallback(
    (mode) => {
      setSaveViewFormMode(mode);
      setSaveViewFormOpen(true);
      if (isMobile) {
        setFiltersOpen(false);
        setSheetClosing(false);
        setSnapFull(false);
        snapFullRef.current = false;
        isClosingRef.current = false;
      }
      window.requestAnimationFrame(() => {
        savedViewsSectionRef.current?.scrollIntoView?.({
          behavior: "smooth",
          block: "nearest",
        });
      });
    },
    [isMobile],
  );

  const handleSaveViewForm = useCallback(
    ({ mode, name, icon, color }) => {
      if (mode === "update" && savedViewActive) {
        savedViewsApi.updateView({
          id: savedViewActive,
          name,
          icon,
          color,
          filters: currentSnapshot,
        });
      } else {
        const view = savedViewsApi.createView({
          name,
          icon,
          color,
          filters: currentSnapshot,
        });
        if (view) {
          if (!snapshotBeforeViewRef.current) {
            snapshotBeforeViewRef.current = { ...DEFAULT_RESTORE_SNAPSHOT };
          }
          setSavedViewActive(view.id);
        }
      }
      setSaveViewFormOpen(false);
    },
    [savedViewsApi, savedViewActive, currentSnapshot],
  );

  const canSaveNewView =
    listFiltersActive && (!savedViewActive || activeSavedViewDirty);
  const canUpdateSavedView = Boolean(savedViewActive && activeSavedViewDirty);

  /** Saved views adaptadas para `<SavedViewsCards>`. */
  const savedViewsProp = useMemo(
    () => ({
      items: savedViewsApi.views.map((v) => ({
        id: v.id,
        label: v.label,
        icon: v.icon,
        color: v.color,
        hint: describeView(v, countActiveFiltersInSnapshot(v.filters)),
        modified: savedViewActive === v.id && activeSavedViewDirty,
      })),
      active: savedViewActive,
      onActivate: (id) => {
        const view = savedViewsApi.views.find((v) => v.id === id);
        if (!view) return;

        if (savedViewActive === id) {
          deapplyActiveSavedView();
          return;
        }

        captureSnapshotBeforeView();
        setSavedViewActive(id);
        applySavedViewFilters(view);
      },
      onDelete: (id) => {
        if (savedViewActive === id) {
          deapplyActiveSavedView();
        }
        savedViewsApi.removeView(id);
      },
      /* Sem isto o formulário do sheet mobile FECHA SEM GRAVAR: o
         `TransactionsFilterBar` cai num fallback que não faz nada quando nem
         `onSaveView` nem `onCreate` existem, e a pessoa vê o painel sumir
         achando que salvou. `SavedViewsCards` chama com
         `{ mode, name, icon, color }`, que é a mesma forma que
         `handleSaveViewForm` já espera. */
      onSaveView: handleSaveViewForm,
      /* SEM `onOpenSaveForm` de propósito. Aquele caminho FECHA o sheet no
         mobile e rola até a faixa de views da página — o que estava certo
         enquanto as views só existiam lá. Agora que elas moram DENTRO do
         sheet, fechá-lo ao tocar "＋ Nova" tira a pessoa de onde ela está e
         abre o formulário noutro lugar. Sem o callback, `SavedViewsCards`
         abre o formulário inline, no próprio sheet. */
    }),
    [
      savedViewsApi,
      savedViewActive,
      activeSavedViewDirty,
      applySavedViewFilters,
      captureSnapshotBeforeView,
      deapplyActiveSavedView,
      handleSaveViewForm,
    ],
  );

  const showSavedViewsSection = shouldShowSavedViewsSection(
    savedViewsProp.items.length,
    listFiltersActive,
  );

  // Uma única derivação de facets para os dois consumidores: os chips de
  // filtro ativo e o resumo das views salvas. Duas listas construídas em
  // lugares diferentes acabariam divergindo no rótulo de algum filtro.
  const allFacets = useMemo(() => {
    const categoriesById = Object.fromEntries(
      categoriesForFilter.map((c) => [c.id, c]),
    );
    const cardsById = Object.fromEntries(cardsForFilter.map((c) => [c.id, c]));
    return filter.buildFacets({ categoriesById, cardsById });
  }, [filter, categoriesForFilter, cardsForFilter]);


  /* Um recorte por filtro ativo, cada um SEM aquele filtro — é o que permite
     dizer qual deles matou o resultado. Montado aqui porque só a página conhece
     o estado inteiro; o hook só mede. */
  const filtersWithoutEach = useMemo(() => {
    if (!listFiltersActive) return {};
    const base = {
      type: filter.type, method: filter.method, cats: filter.cats,
      period: filter.period, customFrom: filter.customFrom, customTo: filter.customTo,
      sort: filter.sort, valueMin: filter.valueMin, valueMax: filter.valueMax,
      settlement: filter.settlement, rec: filter.rec, tagMode: filter.tagMode,
    };
    const drops = {
      busca: { search: "" },
      periodo: { period: "mes", customFrom: "", customTo: "" },
      tipo: { type: "todos", method: [] },
      forma: { method: [] },
      categoria: { cats: [] },
      tag: { tagIds: [] },
      valor: { valueMin: "", valueMax: "" },
      recorrencia: { rec: "any" },
      situacao: { settlement: "todas" },
    };
    const active = new Set(allFacets.filter((f) => f.active).map((f) => f.key));
    if (debouncedSearch) active.add("busca");
    const out = {};
    for (const key of active) {
      const { tagIds: dropTagIds, search: dropSearch, ...stateDrop } = drops[key] || {};
      out[key] = filtersToLegacyParams(
        { ...base, ...stateDrop },
        {
          limit: 1,
          debouncedSearch: dropSearch != null ? dropSearch : debouncedSearch,
          totalCategories: totalCategoriesForBackend,
          tagIds: dropTagIds != null ? dropTagIds : resolvedTagIds,
        },
      );
    }
    return out;
  }, [
    listFiltersActive, allFacets, debouncedSearch, filter.type, filter.method,
    filter.cats, filter.period, filter.customFrom, filter.customTo, filter.sort,
    filter.valueMin, filter.valueMax, filter.settlement, filter.rec, filter.tagMode,
    totalCategoriesForBackend, resolvedTagIds,
  ]);

  const facetLabels = useMemo(() => {
    // Sem aspas aqui: o texto do vazio já envolve o rótulo em aspas curvas, e
    // as duas juntas viravam «busca "termo"» dentro de outro par de aspas.
    const map = { busca: `busca ${debouncedSearch}` };
    for (const f of allFacets) map[f.key] = `${f.label}: ${f.value}`;
    return map;
  }, [allFacets, debouncedSearch]);

  const activeFacetsForSavedViews = useMemo(
    () =>
      allFacets
        .filter((f) => f.active)
        .map((f) => ({
          label: f.label,
          value: f.value,
          icon: f.icon,
          color: f.color || T.ink,
        })),
    [allFacets],
  );

  /**
   * Clique na categoria da própria linha → filtra por ela.
   *
   * `tx.cat` é o RÓTULO exibido; o filtro trabalha com o id da tag. Quando o
   * rótulo não resolve para um id (categoria renomeada, catálogo ainda
   * carregando) não fazemos nada: aplicar um filtro pelo texto traria um
   * recorte diferente do que o chip promete, e um clique sem efeito é melhor
   * que um recorte errado com o chip aceso.
   */
  const filterByCategoryFromRow = useCallback(
    (tx) => {
      const hit = categoriesForFilter.find((c) => c.label === tx.cat);
      if (!hit) return;
      filter.setCats([hit.id]);
      setVisible(PAGE_SIZE);
    },
    [categoriesForFilter, filter, PAGE_SIZE],
  );

  /** Mesma ideia para as tags da linha — a facet Tags guarda o rótulo. */
  /* Clicar numa tag SOMA ao filtro; clicar de novo tira.
     É a regra que a categoria não tem: categoria é uma por transação, então
     clicar substitui. Tag é várias, e o filtro já tem o par OU/E — substituir
     faria o segundo clique desfazer o primeiro, que é o oposto do que se quer
     ao clicar em duas tags seguidas. */
  const filterByTagFromRow = useCallback(
    (tag) => {
      const atuais = filter.tags || [];
      filter.setTags(atuais.includes(tag) ? atuais.filter((t) => t !== tag) : [...atuais, tag]);
      setVisible(PAGE_SIZE);
    },
    [filter, PAGE_SIZE],
  );

  /** "Sem filtros" / "3 filtros" — o que o desfazer vai devolver. */
  const describeFilterSnapshot = useCallback((snap) => {
    const n = countActiveFiltersInSnapshot(snap);
    if (n === 0) return "sem filtros";
    return n === 1 ? "1 filtro" : `${n} filtros`;
  }, []);

  // Desfazer dos filtros. O rótulo diz para ONDE volta ("3 filtros"), não
  // "desfazer" genérico — sem isso o controle é uma aposta.
  const filterHistory = useFilterHistory(
    filter.snapshot,
    filter.applySnapshot,
    describeFilterSnapshot,
  );
  const undoFilter = useCallback(() => {
    filterHistory.undo();
    setVisible(PAGE_SIZE);
  }, [filterHistory, PAGE_SIZE]);
  const redoFilter = useCallback(() => {
    filterHistory.redo();
    setVisible(PAGE_SIZE);
  }, [filterHistory, PAGE_SIZE]);

  // Pedido de abrir uma facet vindo de fora da barra (clique num chip). O
  // `nonce` faz o mesmo chip reabrir o mesmo painel duas vezes seguidas.
  const [requestOpenFacet, setRequestOpenFacet] = useState(null);
  const openFacetFromChip = useCallback((key) => {
    setRequestOpenFacet((prev) => ({ key, nonce: (prev?.nonce ?? 0) + 1 }));
    setPanelFacet(key === "busca" ? "ativos" : key);
    // No mobile e no desktop compacto os painéis vivem atrás do botão
    // "Filtros"; abrir a facet sem abrir o container deixaria o clique sem
    // efeito visível nenhum.
    setFiltersOpen(true);
    setCompactDesktopFiltersOpen(true);
    setWideDesktopFiltersOpen(true);
  }, []);

  const clearFacetAndResetPage = useCallback(
    (key) => {
      if (key === "busca") setSearchInput("");
      else filter.clearFacet(key);
      setVisible(PAGE_SIZE);
    },
    [filter, PAGE_SIZE],
  );

  const scrollListToTop = useCallback(() => {
    const el = listScrollRef.current;
    if (!el || typeof el.scrollTo !== "function") return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // fincla-frontend#109 rodada 3, achado 4: `resultsLoading` usava
  // `transactionsData.isLoading` cru — o MESMO booleano que não é confiável
  // no 1º quadro. Trocado por `listNeverLoaded` — mas isso trocou um bug por
  // outro (rodada 4, achado 5): `listNeverLoaded` continua `true` PRA SEMPRE
  // em dois casos que não são "carregando" de jeito nenhum — a 1ª carga
  // FALHOU (`hasLoaded` só liga num sucesso) e o filtro de tag está
  // BLOQUEADO (`enabled:false` trava o hook em `EMPTY_STATE` pra sempre). O
  // CTA "Ver N transações" ficava desabilitado dizendo "Atualizando…" — uma
  // afirmação falsa, já que nada estava de fato em andamento.
  //
  // `listLoading` (definido acima) já exclui o caso de FALHA
  // (`listNeverLoaded && !listLoadFailed`); falta só excluir o BLOQUEIO.
  const resultsStillLoading = listLoading && !tagFilterBlocked;
  const filterBarApplyProps = useMemo(
    () => ({
      filteredCount,
      resultsLoading: searchAwaitingCommit || resultsStillLoading,
      onAfterApply: isMobile ? undefined : scrollListToTop,
    }),
    [
      filteredCount,
      searchAwaitingCommit,
      resultsStillLoading,
      isMobile,
      scrollListToTop,
    ],
  );

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = "Data,Descrição,Categoria,Método,Valor,Status,Tags";
    // A busca e o filtro por categoria não têm equivalente no endpoint de CSV,
    // então esses casos caem no export client-side. Forma(s) de pagamento agora
    // vão para o backend (param repetido), então não limitam mais o caminho remoto.
    if (
      shouldUseRealData &&
      organizationId &&
      !debouncedSearch &&
      filter.cats.length === 0
    ) {
      downloadTransactionsCsvForUi(
        organizationId,
        filtersToCsvOptions({
          type: filter.type,
          method: filter.method,
          period: filter.period,
          customFrom: filter.customFrom,
          customTo: filter.customTo,
        }),
      ).catch(() => {});
      return;
    }

    const rows = filtered.map((t) =>
      `${t.date},"${t.desc}","${t.cat}","${t.method}","${t.val > 0 ? "+" : ""}${t.val}","${t.status}","${(t.tags || []).join(";")}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "transacoes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Detail panel content ──────────────────────────────────────────────────

  // ── Transaction row ───────────────────────────────────────────────────────
  // ── Tooltip helper ─────────────────────────────────────────────────────────




  // ── Filter UI: extraído para `<TransactionsFilterBar>` (Variação C) ──────

  const filterBarCommonProps = {
    filter,
    categories: categoriesForFilter,
    cards: cardsForFilter,
    allTags: allTagsForFilter,
    // Achado 5: sem isto o painel mostra "Nenhuma tag cadastrada" enquanto o
    // catálogo ainda está a caminho — parece "você não tem tags" quando é só
    // um instante de carregamento.
    allTagsLoading: shouldUseRealData && tagCatalog.loading,
    // Prioridade 3: erro tem mensagem própria — nunca "nenhuma tag cadastrada"
    // (achado 5) nem uma lista de opções que sempre trava ao ser clicada
    // (a armadilha que motivou tirar as opções em `allTagsForFilter`).
    allTagsError: shouldUseRealData && Boolean(tagCatalog.error),
    hideSavedViews: true,
    searchInput,
    setSearchInput: (v) => {
      setSearchInput(v);
      setVisible(PAGE_SIZE);
    },
    onClearAll: clearAll,
    onSaveViewCreate:
      canSaveNewView && !saveViewFormOpen ? () => openSaveViewForm("create") : undefined,
    onSaveViewUpdate:
      canUpdateSavedView && !saveViewFormOpen ? () => openSaveViewForm("update") : undefined,
    saveViewUpdateLabel: activeSavedView?.label ?? "",
    filterToolbarActive: listFiltersActive,
    facetCounts,
    onExpandedChange: setExpandedFacet,
    requestOpenFacet,
    ...filterBarApplyProps,
  };

  /* Quantos filtros estão aplicados — a busca conta como um, porque ela recorta
     a lista igual a qualquer faceta e o usuário não faz essa distinção. */
  const activeFilterCount =
    allFacets.filter((f) => f.active).length + (debouncedSearch ? 1 : 0);

  const filtersToggleButton = (expanded, onToggle) => {
    const filtersApplied = activeFilterCount > 0 || expanded;
    return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        ...G,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 13px",
        /* O destaque usa a MESMA definição do contador (`activeFilterCount`,
           que inclui a busca). Com `filter.hasAnyActive` o botão ficava branco
           mostrando "1" ao lado: dois sinais no mesmo botão discordando sobre
           se existe filtro. */
        background: filtersApplied ? T.ink : T.surface,
        color: filtersApplied ? "#fff" : T.inkMid,
        border: `1px solid ${filtersApplied ? T.ink : T.border}`,
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        flexShrink: 0,
      }}
      /* Nome estável + `aria-expanded`: é o padrão de disclosure, e é o que
         mantém o nome acessível igual ao rótulo visível (o "Fechar filtros"
         quebrava isso, além de colidir com o ✕ do sheet). O estado quem conta é
         o `aria-expanded`. */
      aria-label={
        activeFilterCount > 0
          ? `Filtros — ${activeFilterCount} aplicado${activeFilterCount === 1 ? "" : "s"}`
          : "Filtros"
      }
      aria-expanded={expanded}
    >
      <SlidersHorizontal size={14} />
      Filtros
      {/* No mobile os chips não cabem na barra, então este número é a ÚNICA
          pista de quanto está filtrado. O fundo preto diz que há filtro; o
          contador diz quantos — e é a segunda pergunta que decide se vale
          abrir o sheet. */}
      {activeFilterCount > 0 && (
        <span
          aria-hidden="true"
          style={{
            ...G,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 999,
            background: filtersApplied ? "rgba(255,255,255,0.22)" : T.blue,
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {activeFilterCount}
        </span>
      )}
    </button>
    );
  };

  /* As ações rápidas usam os MESMOS caminhos do detalhe — nenhuma segunda
     implementação de liquidar/excluir, que é onde as duas divergiriam. */
  /* Esc fecha a sanfona — sem isso, quem abriu por teclado não tem como sair
     sem tabular por todo o detalhe. */
  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  /**
   * Movimento de saída e de confirmação da lista.
   *
   * `leavingIds`: a linha excluída fica na lista mais 260 ms, colapsando a
   * própria altura. Só depois disso pedimos o refetch — trocar a lista no
   * mesmo quadro faria as linhas de baixo pularem de uma vez para o lugar da
   * que saiu, e a pessoa perderia onde estava lendo.
   *
   * `settledFlash`: um pulso verde na linha que acabou de ser paga. O ✓ some
   * quando o estado muda, e sem o pulso não sobra nenhum sinal de que a ação
   * aconteceu — só uma linha que mudou de cor num canto.
   */
  const [leavingIds, setLeavingIds] = useState(() => new Set());
  const [settledFlashId, setSettledFlashId] = useState(null);

  /* O sheet cobre a tela, mas o botão que o abriu continua no fluxo de Tab por
     trás do backdrop: sem prender, quem navega por teclado tabula para fora,
     alcança controles que não vê e age neles às cegas. E ao fechar, o foco
     volta para o gatilho em vez de recomeçar do topo do documento. */
  useFocusTrap(sheetRef, isMobile && filtersOpen && !sheetClosing);

  /* O modal de edição é uma ROTA (`/transactions/{-$transactionId}`), então a
     volta dele é uma mudança de caminho — que é o sinal mais confiável que esta
     página tem. Watch de estado do modal não serve: ele vive no App. */
  const caminhoAtual = useRouterState({ select: (st) => st.location.pathname });
  const emModalDeTransacao = /\/transactions\/[^/]+/.test(caminhoAtual);
  useEffect(() => {
    const id = editandoDeRef.current;
    if (!id) return;
    if (emModalDeTransacao) return; // ainda no modal
    editandoDeRef.current = null;
    const linha = document.querySelector(`[data-tx-row="${id}"]`);
    if (!linha) return;
    setRovingId(id);
    linha.focus();
    linha.scrollIntoView({ block: "nearest" });
    /* O mesmo flash que a lista já usa ao liquidar: quem volta de um modal
       precisa de uma marca dizendo "você estava aqui". */
    setSettledFlashId(id);
    setTimeout(() => setSettledFlashId((cur) => (cur === id ? null : cur)), 900);
  }, [caminhoAtual, emModalDeTransacao]);
  const leaveTimers = useRef([]);

  useEffect(
    () => () => {
      leaveTimers.current.forEach(clearTimeout);
      leaveTimers.current = [];
    },
    [],
  );

  const startRowLeave = useCallback(
    (id) => {
      setLeavingIds((prev) => new Set(prev).add(id));
      const t = setTimeout(() => {
        setLeavingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        onTransactionsInvalidate?.();
      }, ROW_LEAVE_MS);
      leaveTimers.current.push(t);
    },
    [onTransactionsInvalidate],
  );

  const flashSettled = useCallback((id) => {
    setSettledFlashId(id);
    const t = setTimeout(() => setSettledFlashId((cur) => (cur === id ? null : cur)), 900);
    leaveTimers.current.push(t);
  }, []);

  /**
   * Desfazer a liquidação anunciada na torrada.
   *
   * Reaplica o inverso pela API (não é um rollback local): o saldo da conta só
   * conta `status='paid'`, então um desfazer que mexesse só na tela deixaria a
   * lista e o saldo contando coisas diferentes.
   */
  const undoLastAction = useCallback(async () => {
    if (!undoToast) return;
    const { id, revert } = undoToast;
    setUndoToast(null);
    try {
      if (shouldUseRealData) {
        await transactionsData.setTransactionSettled(id, !revert);
        onTransactionsInvalidate?.();
      } else {
        setMockTxList((cur) => cur.map((t) => (t.id === id ? { ...t, settled: !revert } : t)));
      }
      flashSettled(id);
    } catch (e) {
      setSettleError(e?.message || "Não foi possível desfazer.");
    }
  }, [undoToast, shouldUseRealData, transactionsData, onTransactionsInvalidate, flashSettled]);

  /** Pulso + torrada quando a liquidação vem da sanfona, não da ação rápida. */
  const handleSettledFromDetail = useCallback(
    (id, next) => {
      flashSettled(id);
      const tx = txListRef.current.find((t) => t.id === id);
      setUndoToast({
        id,
        label: next
          ? `"${tx?.desc ?? "Transação"}" marcada como paga`
          : `Pagamento de "${tx?.desc ?? "transação"}" desfeito`,
        revert: next,
      });
    },
    [flashSettled],
  );

  const quickActions = useMemo(() => ({
    /* Marca a origem ANTES de navegar: é ela que traz o foco de volta ao
       fechar o modal. Vale para o ✎ da linha e para a tecla E — os dois passam
       por aqui, e sem a marca o foco ficava no `body` depois de editar, que é
       justamente o caminho que o painel de atalhos anuncia. */
    onEdit: (tx) => {
      editandoDeRef.current = String(tx.id);
      if (onEditTx) onEditTx(tx);
    },
    // Só existe quando o consumidor sabe duplicar. Um botão que não faz nada
    // é pior que um botão ausente.
    onDuplicate: onDuplicateTx ? (tx) => onDuplicateTx(tx) : null,
    /* No DESKTOP a pergunta vai num modal. Abrir a sanfona só para perguntar
       move a lista inteira sob o cursor e esconde a resposta atrás de uma
       animação de expansão — e a linha tem 48 px, onde a pergunta não cabe.
       No toque continua na sanfona, que já está aberta e já é o foco da tela:
       um modal ali seria uma camada a mais para ler e para sair. */
    onDelete: (tx) => {
      if (isMobile) { setSelected(tx); setDeletingId(tx.id); return; }
      setConfirmAcao({ kind: "delete", tx });
    },
    onSettle: async (tx) => {
      if (settlingId) return;
      setSettleError("");
      setSettlingId(tx.id);
      try {
        const next = !tx.settled;
        if (shouldUseRealData) {
          await transactionsData.setTransactionSettled(tx.id, next);
          if (onTransactionsInvalidate) onTransactionsInvalidate();
        } else {
          setMockTxList((cur) => cur.map((t) => (t.id === tx.id ? { ...t, settled: next } : t)));
        }
        flashSettled(tx.id);
        // Liquidar é reversível pela própria API (`unsettle`), então o desfazer
        // é honesto aqui. Excluir não tem volta no backend — por isso ele
        // continua atrás da confirmação, e não ganha torrada de desfazer.
        setUndoToast({
          id: tx.id,
          label: next ? `"${tx.desc}" marcada como paga` : `Pagamento de "${tx.desc}" desfeito`,
          revert: next,
        });
      } catch (e) {
        // O erro só é renderizado dentro da sanfona. Usando o ✓ da linha sem
        // abrir nada, a falha ficava invisível — indistinguível de um no-op — e
        // a string sobrevivia no nível da página, aparecendo depois colada numa
        // transação sem relação. Abrir a linha põe o erro no contexto certo.
        setSettleError(e?.message || "Não foi possível atualizar o pagamento.");
        setSelected(tx);
      } finally {
        setSettlingId(null);
      }
    },
  }), [onEditTx, onDuplicateTx, settlingId, shouldUseRealData, transactionsData,
      onTransactionsInvalidate, flashSettled]);

  /* Os atalhos usam os MESMOS caminhos das ações rápidas — nenhuma segunda
     implementação de liquidar/excluir, que é onde as duas divergiriam. */
  useTransactionsKeyboard({
    containerRef: listScrollRef,
    /* O modal de edição é uma ROTA e a página segue montada por baixo dele
       (é o que faz a sanfona sobreviver). Sem esta guarda, "/" mandava o foco
       para a busca ATRÁS do modal, "f" abria a dock por trás e ↑↓ arrancavam o
       foco de dentro do modal para a lista. */
    enabled: !isMobile && !confirmAcao && !ajudaAberta && !emModalDeTransacao,
    onFocusSearch: () => buscaRef.current?.focus(),
    /* Cada layout tem o SEU estado de dock. Alternar sempre o `wide` abria o
       painel largo enquanto o botão visível no compacto continuava dizendo
       "fechado" — a tecla mexia num estado que ninguém estava vendo. */
    onToggleFilters: () =>
      isDesktopCompact
        ? setCompactDesktopFiltersOpen((v) => !v)
        : setWideDesktopFiltersOpen((v) => !v),
    onHelp: () => setAjudaAberta(true),
    getTransaction: (id) => txList.find((t) => String(t.id) === String(id)) || null,
    onSettle: (tx) => quickActions.onSettle(tx),
    onEdit: (tx) => quickActions.onEdit(tx),
    onDuplicate: (tx) => quickActions.onDuplicate?.(tx),
    onDelete: (tx) => quickActions.onDelete(tx),
    onRovingChange: setRovingId,
  });


  /* Agrupar por data só faz sentido ordenado por data: por valor ou categoria
     cada "grupo" vira um item só, o pior dos dois mundos. */
  const canGroup = groupingAllowed(filter.sort?.[0]?.field ?? filter.sort?.field);
  const isGrouped = listPrefs.grouped && canGroup;
  const listRowHeight = densityRowHeight(listPrefs.density, isMobile);

  /* Densidade e agrupamento: mudam COMO a lista aparece, não QUAIS transações
     aparecem (isso é o painel de filtros). No artefato eles moram na ponta
     direita da barra de comando, ao lado da ordenação — junto do resto do que
     controla a apresentação, em vez de soltos na linha do título. */
  const listPrefsButtons = (
    <>
          <button
            type="button"
            onClick={() => {
              const order = Object.keys(DENSITIES);
              const next = order[(order.indexOf(listPrefs.density) + 1) % order.length];
              setListPrefs({ density: next });
            }}
            title={`Densidade da lista: ${DENSITIES[listPrefs.density].label}`}
            aria-label={`Densidade da lista: ${DENSITIES[listPrefs.density].label}. Clique para alternar.`}
            style={{ ...G, width:32, height:32, borderRadius:9, cursor:"pointer",
              border:`1px solid ${T.border}`, background:T.surface, color:T.inkMid,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>
            ▤
          </button>
          <button
            type="button"
            disabled={!canGroup}
            onClick={() => setListPrefs({ grouped: !listPrefs.grouped })}
            title={canGroup
              ? (isGrouped ? "Agrupado por data" : "Lista contínua")
              : "Agrupar por data só vale ordenando por data"}
            aria-pressed={isGrouped}
            aria-label="Agrupar por data"
            style={{ ...G, width:32, height:32, borderRadius:9,
              cursor: canGroup ? "pointer" : "not-allowed",
              opacity: canGroup ? 1 : 0.4,
              border:`1px solid ${isGrouped ? "#BFD3FA" : T.border}`,
              background: isGrouped ? T.blueLight : T.surface,
              color: isGrouped ? T.blue : T.inkMid,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>
            ▦
          </button>
    </>
  );

  /* A visualização salva ativa vira o primeiro item da barra, como no
     artefato. Antes ela ocupava uma faixa própria acima, com cards de ~74 px
     que existiam mesmo sem nenhuma view salva — altura cobrada de todo mundo
     por um recurso que poucos usam, e longe dos filtros que ela guarda. */
  const savedViewsChip = (
    <SavedViewsChip
      items={savedViewsProp.items}
      active={savedViewsProp.active}
      dirty={activeSavedViewDirty}
      onActivate={savedViewsProp.onActivate}
      onDelete={savedViewsProp.onDelete}
      onCreate={() => openSaveViewForm("create")}
      onUpdate={() => openSaveViewForm("update")}
      canCreate={canSaveNewView}
      canUpdate={canUpdateSavedView}
    />
  );

  /* Os chips do que está filtrando, já com o "＋ Filtros" embutido. Abaixo de
     1200 px eles recolhem para o contador do próprio botão: nessa largura não
     cabem sem espremer a busca. */
  const commandBarChips = (
    <TransactionsFilterChips
      facets={allFacets}
      searchActive={Boolean(debouncedSearch)}
      searchLabel={debouncedSearch}
      onOpenFacet={openFacetFromChip}
      onClearFacet={clearFacetAndResetPage}
      onClearAll={clearAll}
      /* Sem escada de breakpoints: quem decide é o orçamento medido pela
         própria barra. `maxVisible` continua como piso para quem renderiza os
         chips fora dela (testes, mocks). */
      maxVisible={2}
      chipsBudget={chipsBudget}
      collapsed={viewportWidth < 1200}
      filtersOpen={wideDesktopFiltersOpen}
      onToggleFilters={() => setWideDesktopFiltersOpen((open) => !open)}
    />
  );

  const commandBarChipsCompact = (
    <TransactionsFilterChips
      facets={allFacets}
      searchActive={Boolean(debouncedSearch)}
      searchLabel={debouncedSearch}
      onOpenFacet={openFacetFromChip}
      onClearFacet={clearFacetAndResetPage}
      onClearAll={clearAll}
      collapsed
      filtersOpen={compactDesktopFiltersOpen}
      onToggleFilters={() => setCompactDesktopFiltersOpen((open) => !open)}
    />
  );


  /* Quantos lançamentos do filtro ainda não entraram no saldo. Substitui o
     aviso de 16 px que ocupava uma faixa própria para dizer a mesma coisa. */
  /* "N a pagar" do cabeçalho vem do FILTRO INTEIRO quando a API o fornece.
     Contar só as linhas carregadas dava 19 no cabeçalho e 34 nas estatísticas
     logo acima — dois números para a mesma pergunta, na mesma tela. A contagem
     local fica como fallback (mock, ou API antiga sem o campo). */
  const pendingCount = aPagarCount ?? txList.filter((t) => t.settleable && !t.settled).length;

  const listIsEmptyUnderFilters =
    shouldUseRealData && !tagFilterBlocked && !listLoading && !listLoadFailed &&
    filteredCount === 0 && listFiltersActive;
  const { narrowest } = useNarrowestFilter({
    organizationId,
    filtersByKey: filtersWithoutEach,
    enabled: listIsEmptyUnderFilters,
    labelsByKey: facetLabels,
  });

  const listContent = (
    /* Um card só: o cabeçalho é o TOPO da lista, não um bloco solto acima
       dela. Enquanto estavam separados, o cabeçalho ficava quadrado e o
       primeiro lançamento aparecia arredondado por baixo — dois cantos
       diferentes na mesma junção.
       SEM `overflow:hidden` de propósito: ele criaria um scrollport novo e o
       `position:sticky` do cabeçalho e dos cabeçalhos de dia passaria a se
       ancorar NESTE card em vez de na região rolável — os dois parariam de
       grudar no topo ao rolar. O arredondamento vem de raios explícitos. */
    <div style={{ display:"flex", flexDirection:"column", gap:0,
      background:T.surface, border:`1px solid ${T.border}`, borderRadius:12 }}>
      <TransactionsListHeader
        total={filteredCount}
        totalUnfiltered={narrowedByMoreThanPeriod ? periodTotal.total : null}
        pending={filter.settlement === "todas" ? pendingCount : 0}
        sum={canUseRemoteSummary || filtered.length ? saldo : null}
        fmt={fmtBRL}
        loading={tagFilterBlocked || listNeverLoaded}
        statusLabel={
          tagFilterBlocked
            ? "Aguardando filtro de tag"
            : listLoadFailed
              ? "Não foi possível carregar"
              : listLoading
                ? "Carregando…"
                : null
        }
        onPendingClick={(e) => {
          /* A label voa até o botão de filtros antes de sumir. Ela some porque
             com "a pagar" ativo toda linha visível é a pagar e o contador vira
             zero por definição — mas sumir sem transição desorienta: a pessoa
             clica e o que ela clicou evapora. O voo diz que é o mesmo objeto
             mudando de lugar. */
          const alvo = document.querySelector(
            '[aria-label^="Abrir filtros"], [aria-label^="Fechar filtros"], [aria-label^="Filtros"]',
          );
          if (e?.currentTarget && alvo) flyToChip(e.currentTarget, alvo);
          filter.setSettlement("a-pagar");
        }}
        onSumClick={isMobile ? () => setStatsExpanded((v) => !v) : undefined}
        sumOpen={isMobile && statsExpanded}
        canUndo={filterHistory.canUndo}
        onUndo={undoFilter}
        undoLabel={filterHistory.undoLabel}
        canRedo={filterHistory.canRedo}
        onRedo={redoFilter}
        redoLabel={filterHistory.redoLabel}
        compact={isMobile}
      />
      {groups.length === 0 ? (
        // Prioridade 2 (revisão adversarial da PR #96): com a busca em espera
        // (`tagFilterBlocked`), `groups` também dá 0 — mas "Nenhuma transação
        // encontrada" é uma afirmação categórica sobre uma pergunta que a API
        // nem chegou a responder. Mostrar isso (mais "0 resultados" e KPIs em
        // R$ 0,00, ver a faixa de KPI abaixo) é a mesma confusão que a issue
        // original queria eliminar, só que invertida: parece resposta, é
        // pendência. O banner âmbar ao lado não é suficiente — o card
        // principal da lista precisa dizer a verdade também.
        tagFilterBlocked ? (
          <CardEmptyWithCta
            icon="⏳"
            iconSize={28}
            title="Filtro de tag pendente"
            sub={tagFilterStatusMessage(tagFilterStatus)}
            primaryLabel="Limpar filtro de tag"
            onPrimary={() => filter.setTags([])}
          />
        ) : listLoading ? (
          // fincla-frontend#106 — 1ª carga ainda em voo: NÃO usar o componente
          // do "vazio de verdade" antes da resposta chegar, senão a tela
          // afirma "nenhuma transação encontrada" sobre uma busca que nem
          // terminou.
          //
          // E não um texto centralizado: ele deixa a área vazia e depois a
          // enche de uma vez, e o olho perde onde estava. O esqueleto ocupa a
          // MESMA grade das linhas, então quando o dado chega nada muda de
          // lugar — só as barras viram texto.
          <TransactionsSkeleton
            /* Tantas linhas quantas caberiam: menos deixa buraco embaixo,
               mais empurra o rodapé e cria uma rolagem que some sozinha. */
            rows={Math.max(4, Math.min(14, PAGE_SIZE))}
            rowHeight={listRowHeight}
            isMobile={isMobile}
            /* Mesmas larguras das linhas reais: senão o esqueleto deixa de
               cumprir o que promete e tudo desliza de lado quando o dado
               chega. */
            catColPx={catColPx}
            tagsColPx={tagsColPx}
          />
        ) : listLoadFailed ? (
          // 1ª carga falhou (nunca tivemos dados válidos pra este filtro) —
          // distinto do "vazio de verdade": o card diz que a busca falhou,
          // não que não há transações. `transactionsData.error` já aparece
          // no banner do topo da página; aqui é a pista LOCAL, junto da lista.
          <CardEmptyWithCta
            icon="⚠️"
            iconSize={28}
            title="Não foi possível carregar as transações"
            sub={transactionsData.error || "Tente novamente em instantes."}
          />
        ) : (
          /* Vazio SEMÂNTICO: quando dá para apontar o culpado, o texto nomeia
             o filtro que mais restringe e o botão remove exatamente aquele.
             "Tente ajustar os filtros" deixa a pessoa tentando às cegas qual
             dos seis filtros ativos matou o resultado. */
          narrowest ? (
            <CardEmptyWithCta
              icon="🔍"
              iconSize={28}
              title="Nenhuma transação neste filtro"
              sub={`O filtro “${narrowest.label}” é o que mais restringe: sem ele ${
                narrowest.total === 1 ? "volta 1 transação" : `voltam ${narrowest.total} transações`
              }.`}
              primaryLabel={`Remover “${narrowest.label}”`}
              onPrimary={() => clearFacetAndResetPage(narrowest.key)}
              secondaryLabel="Limpar filtros"
              onSecondary={clearAll}
            />
          ) : (
          <CardEmptyWithCta
            icon="🔍"
            iconSize={28}
            title={listFiltersActive ? "Nenhuma transação neste filtro" : "Nenhuma transação encontrada"}
            sub="Tente ajustar os filtros ou a busca — ou registre um lançamento novo."
            primaryLabel={listFiltersActive ? "Limpar filtros" : onNewTx ? "+ Nova transação" : undefined}
            onPrimary={listFiltersActive ? clearAll : onNewTx || undefined}
            secondaryLabel={listFiltersActive && onNewTx ? "+ Nova transação" : undefined}
            onSecondary={listFiltersActive && onNewTx ? onNewTx : undefined}
          />
          )
        )
      ) : (
        /* Lista contínua (padrão) ou agrupada por data — a preferência é do
           usuário. Contínua: um card só, linhas separadas por hairline, data em
           coluna. Agrupada: cabeçalho de dia sticky de 24 px (contra os 48 de
           antes) e a coluna de data some, porque o cabeçalho já a carrega. */
        /* Sem borda nem raio próprios: quem os carrega é o card externo, que
           agora inclui o cabeçalho. Repeti-los aqui desenharia uma segunda
           moldura logo abaixo da primeira. */
        <div>
          {groups.map(([date, txs], gi) => (
            <React.Fragment key={date}>
              {isGrouped && (
                <div style={{ display:"flex", alignItems:"center", gap:10,
                  height: DAY_HEADER_HEIGHT, padding:"0 14px",
                  /* Gruda logo ABAIXO do cabeçalho da lista, que também é
                     sticky no mesmo container. O valor vem da constante para
                     não poder divergir da altura real de novo. */
                  position:"sticky",
                  top: isMobile ? LIST_HEADER_HEIGHT_COMPACT : LIST_HEADER_HEIGHT,
                  background:"#F4F6F9", zIndex:2,
                  borderTop: gi > 0 ? `1px solid ${T.border}` : "none",
                  borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid,
                  }}>{fmtDateLabel(date)}</div>
                  <div style={{ flex:1 }}/>
                  <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:11,
                    color: txs.reduce((s,t)=>s+t.val,0) >= 0 ? T.green : T.red, fontWeight:700 }}>
                    {txs.reduce((s,t)=>s+t.val,0) >= 0 ? "+" : "−"}{fmtBRL(Math.abs(txs.reduce((s,t)=>s+t.val,0)))}
                  </div>
                </div>
              )}
              {txs.map((tx, i) => (
                <div key={tx.id}
                  className={[
                    leavingIds.has(tx.id) ? "fincla-tx-leave" : "",
                    settledFlashId === tx.id ? "fincla-tx-settled" : "",
                  ].filter(Boolean).join(" ")}
                  style={{
                  borderBottom: (gi === groups.length - 1 && i === txs.length - 1 && selected?.id !== tx.id)
                    ? "none" : `1px solid ${T.border}` }}>
                  <TxRow
                    tx={tx}
                    isMobile={isMobile}
                    isSelected={selected?.id === tx.id}
                    onSelect={handleSelectTx}
                    coveringAnchor={anchorCovering(tx, balanceAnchors)}
                    rowHeight={listRowHeight}
                    showDate={!isGrouped}
                    dateLabel={shortDateLabel(tx.date)}
                    quickActions={quickActions}
                    onFilterByCategory={filterByCategoryFromRow}
                    onFilterByTag={filterByTagFromRow}
                    swipe={isMobile ? swipeActions : null}
                    flash={settledFlashId === tx.id}
                    wide={!isMobile && viewportWidth >= 1600}
                    tagsColPx={tagsColPx}
                    catColPx={catColPx}
                    tagsAtivas={filter.tags}
                    isRovingStop={rovingStopId === String(tx.id)}
                    /* 1000 px de LISTA — não de viewport. Abaixo disso o vão
                       não comporta o botão aberto e ele invadiria a descrição.
                       Enquanto a medição não chega (primeiro render), cai no
                       limiar de viewport, que erra só para menos. */
                    showActionLabels={
                      !isMobile && (listWidth > 0 ? listWidth >= 1000 : viewportWidth >= 1200)
                    }
                    xwide={!isMobile && viewportWidth >= 2100}
                  />
                  {/* Sanfona: o detalhe nasce ONDE O OLHO JÁ ESTÁ, em vez de
                      numa coluna de 320 px que, em 1366×768, sobrava com 32 px
                      de área rolável — sem os botões Editar e Excluir à vista.
                      Mesmo padrão dos itens de fatura em Cartões. */}
                  {selected?.id === tx.id && (
                    <div
                      ref={revealAccordion}
                      role="region"
                      aria-label={`Detalhes de ${tx.desc}`}
                      style={{ background:"#FAFBFF", boxShadow:`inset 3px 0 0 ${T.blue}`,
                        borderTop:`1px solid ${T.border}`,
                        animation:"fadeInDown 0.18s ease" }}>
                      <DetailPanel
                        inline
                        tx={tx}
                        onClose={() => setSelected(null)}
                        onEditTx={onEditTx}
                        onEditRequested={(tx) => { editandoDeRef.current = String(tx.id); }}
                        setSelected={setSelected}
                        shouldUseRealData={shouldUseRealData}
                        transactionsData={transactionsData}
                        setMockTxList={setMockTxList}
                        onTransactionsInvalidate={onTransactionsInvalidate}
                        deletingId={deletingId}
                        setDeletingId={setDeletingId}
                        onRowLeave={startRowLeave}
                        onDuplicateTx={onDuplicateTx}
                        onFilterByCategory={filterByCategoryFromRow}
                        isMobileDetail={isMobile}
                        onSettled={handleSettledFromDetail}
                        settlingId={settlingId}
                        setSettlingId={setSettlingId}
                        settleError={settleError}
                        setSettleError={setSettleError}
                      />
                    </div>
                  )}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
      {/* Paginação infinita: sentinel + feedback (carregamento ao chegar ao fim da lista).
          `data-testid` só pra prova de teste (fincla-frontend#109 rodada 4,
          achado 1, CRÍTICO): a garantia central da correção é que este nó
          SOME do DOM assim que `pageError` liga — é isso que impede o
          `IntersectionObserver` de ser recriado/observado de novo e alimentar
          a tempestade de requisições. */}
      {hasMore && (
        <div
          ref={loadMoreSentinelRef}
          data-testid="load-more-sentinel"
          style={{ height:1, marginTop:8, flexShrink:0 }}
          aria-hidden
        />
      )}
      {hasMore && shouldUseRealData && transactionsData.isLoading && (
        <div style={{ ...G, textAlign:"center", fontSize:12, color:T.inkLight, padding:"10px 0 4px" }}>
          Carregando mais…
        </div>
      )}
      {/* fincla-frontend#109 rodada 4, achado 2: `pageError` nunca era
          consumido em lugar nenhum — a falha ficava muda, a lista truncada
          com CARA de completa (sem sentinela, sem "Carregando mais…", sem
          nada). Fora de `hasMore` de propósito: precisa aparecer mesmo com
          a sentinela escondida (achado 1). */}
      {shouldUseRealData && transactionsData.pageError && (
        <div style={{ ...G, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          textAlign:"center", fontSize:12, color:T.inkLight, padding:"10px 0 4px" }}>
          <span>Não foi possível carregar mais transações.</span>
          <button type="button" onClick={retryLoadMore}
            style={{ ...G, background:"none", border:"none", padding:0, fontSize:12,
              fontWeight:700, color:T.blue, cursor:"pointer", textDecoration:"underline" }}>
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );

  // ── Bottom sheet drag & snap ─────────────────────────────────────
  // Rule: DOM direct for 60fps drag. React state only for layout snaps + close.

  const onSheetClose = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setSheetClosing(true);
    // Wait for CSS exit animation (sheetDown) then unmount
    setTimeout(() => {
      setFiltersOpen(false);
      setSheetClosing(false);
      // Volta ao PADRÃO — que agora é cheio — e não a 72%: senão a próxima
      // abertura viria menor do que a pessoa acabou de usar.
      setSnapFull(true);
      snapFullRef.current  = true;
      isClosingRef.current = false;
    }, 420);
  };

  const onSheetTouchStart = (e) => {
    const el = sheetRef.current;
    if (!el) return;
    const startY = e.touches[0].clientY;
    const startT = Date.now();
    let lastDelta = 0;

    const onMove = (ev) => {
      const delta = ev.touches[0].clientY - startY;
      lastDelta = delta;
      if (delta < 0) {
        // ── Drag UP ──────────────────────────────────────────────
        if (!snapFullRef.current && delta < -52) {
          // Expand to fullscreen — update ref first, then state
          snapFullRef.current = true;
          setSnapFull(true);
          el.style.transform = '';
          cleanup();
        } else if (snapFullRef.current) {
          // Rubber-band at top
          el.style.transform = `translateY(${delta / 3}px)`;
        }
      } else {
        // ── Drag DOWN ────────────────────────────────────────────
        if (snapFullRef.current && delta > 64) {
          // Collapse from fullscreen to default snap
          snapFullRef.current = false;
          setSnapFull(false);
          el.style.transform = '';
          cleanup();
        } else {
          // Live follow finger (dismiss gesture or rubber-band from full)
          const resistance = snapFullRef.current ? 0.3 : 1;
          el.style.transform = `translateY(${Math.max(0, delta * resistance)}px)`;
        }
      }
    };

    const onEnd = () => {
      const elapsed  = Date.now() - startT;
      const velocity = lastDelta / Math.max(elapsed, 1); // px/ms
      const sheetH   = el.offsetHeight || 400;
      if (!snapFullRef.current && (velocity > 0.45 || lastDelta > sheetH * 0.30)) {
        // Dismiss — animate sheet off screen, then close
        el.style.transition = 'transform 0.38s cubic-bezier(0.32,0.72,0,1)';
        el.style.transform  = 'translateY(105%)';
        setTimeout(() => {
          el.style.transform  = '';
          el.style.transition = '';
          onSheetClose();
        }, 380);
      } else {
        // Snap back with spring
        el.style.transition = 'transform 0.4s cubic-bezier(0.32,0.72,0,1)';
        el.style.transform  = 'translateY(0)';
        setTimeout(() => { el.style.transition = ''; }, 400);
      }
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onEnd);
    };

    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend',  onEnd);
  };


  return (
    /* No mobile a raiz OCUPA a altura que o shell deu e pode encolher, em vez
       de crescer com a lista. É o que torna a tela autocontida: a barra de
       comando e o botão de filtros ficam sempre à vista, e quem rola é a
       lista. No desktop a altura já vinha travada por `calc`. */
    <div style={{ display:"flex", flexDirection:"column", gap:14,
      ...(isMobile ? { flex:1, minHeight:0 } : { height:"calc(100dvh - 116px)" }) }}>
      {shouldUseRealData && transactionsData.error && (
        <div style={{ ...G, fontSize:13, color:T.red, background:T.redLight, border:`1px solid ${T.red}22`, borderRadius:12, padding:"12px 14px" }}>
          {transactionsData.error}
        </div>
      )}

      {/* Achado 4 (revisão PR #96): tag selecionada que ainda não resolveu para
          um id — a busca fica em espera (ver `tagFilterBlocked`) e este aviso
          explica o motivo, para nunca parecer que a lista abaixo está filtrada
          quando na verdade está travada. */}
      {tagFilterBlocked && (
        <div
          role="status"
          style={{ ...G, fontSize:13, color:T.amber, background:T.amberLight, border:`1px solid ${T.amberBorder}`, borderRadius:12, padding:"12px 14px" }}
        >
          {tagFilterStatusMessage(tagFilterStatus)}
        </div>
      )}

      {/* ── Row 1: Título + estatísticas + CSV ───────────────────
          A faixa de KPIs de 87 px e o aviso de "a pagar" de 16 px saíram: os
          três números vieram para cá (a linha era quase toda espaço vazio) e a
          contagem foi para o cabeçalho da lista, que é o que ela descreve. */}
      <div style={{ display:"flex", alignItems: statsExpanded ? "flex-start" : "center",
        justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <PageTitle sans="Minhas" serif="Transações"/>
        {!isMobile && (
          <div style={{ flex:"1 1 420px", minWidth:0, maxWidth:900, marginLeft:"auto" }}>
            <TransactionsStats
              receita={totalReceita}
              despesa={totalDespesaLiquido}
              resultado={saldo}
              countReceita={countReceita}
              countDespesa={countDespesa}
              countEstorno={countEstorno}
              totalEstorno={totalEstorno}
              filteredCount={filteredCount}
              countsArePartial={countsArePartial}
              maiorReceita={maiorReceita}
              maiorDespesa={maiorDespesa}
              aPagarCount={aPagarCount}
              aPagarDespesas={aPagarDespesas}
              saldoLiquidado={saldoLiquidado}
              unknown={tagFilterBlocked || listNeverLoaded}
              expanded={statsExpanded}
              onToggleExpanded={() => setStatsExpanded((v) => !v)}
              compactLabels={viewportWidth < 1400}
              fmt={fmtBRL}
            />
          </div>
        )}
        {/* No MOBILE tudo isso vira um "⋯": densidade, agrupamento e exportação
            são ajustes ocasionais, e três controles permanentes ao lado de um
            título que já compete por largura empurrariam a busca para baixo. */}
        {isMobile ? (
          <div style={{ position:"relative", flexShrink:0 }}>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={mobileMenuOpen}
              aria-label="Opções da lista"
              style={{ ...G, width:36, height:36, borderRadius:10, background:T.surface,
                border:`1px solid ${T.border}`, color:T.inkMid, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>
              ⋯
            </button>
            {mobileMenuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ position:"fixed", inset:0, zIndex:11, border:"none",
                    background:"transparent", cursor:"default" }}
                />
                <div role="menu"
                  style={{ position:"absolute", right:0, top:"calc(100% + 8px)", zIndex:12,
                    width:246, background:T.surface, border:`1px solid ${T.border}`,
                    borderRadius:13, boxShadow:"0 16px 44px rgba(0,0,0,.18)", padding:6,
                    display:"flex", flexDirection:"column", gap:2 }}>
                  <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:11,
                    letterSpacing:"0.09em", textTransform:"uppercase", color:T.inkGhost,
                    padding:"8px 10px 4px" }}>Densidade</div>
                  <div style={{ display:"flex", gap:4, padding:"0 4px 6px" }}>
                    {Object.entries(DENSITIES).map(([key, d]) => (
                      <button key={key} type="button"
                        onClick={() => setListPrefs({ density: key })}
                        aria-pressed={listPrefs.density === key}
                        style={{ ...G, flex:1, height:32, borderRadius:8, cursor:"pointer",
                          fontSize:11, fontWeight:600, whiteSpace:"nowrap",
                          border:`1px solid ${listPrefs.density === key ? T.ink : T.border}`,
                          background: listPrefs.density === key ? T.ink : T.surface,
                          color: listPrefs.density === key ? "#fff" : T.inkMid }}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ height:1, background:T.border, margin:"3px 4px" }}/>
                  <button type="button" role="menuitemcheckbox"
                    aria-checked={isGrouped}
                    disabled={!canGroup}
                    onClick={() => setListPrefs({ grouped: !listPrefs.grouped })}
                    style={{ ...G, height:38, borderRadius:9, display:"flex", alignItems:"center",
                      gap:10, padding:"0 10px", fontSize:12.5, border:"none", textAlign:"left",
                      cursor: canGroup ? "pointer" : "not-allowed",
                      opacity: canGroup ? 1 : 0.45,
                      background: isGrouped ? T.blueLight : "none",
                      color: isGrouped ? T.blue : T.inkMid,
                      fontWeight: isGrouped ? 700 : 500 }}>
                    ▦ Agrupar por data
                    {!canGroup && (
                      <span style={{ marginLeft:"auto", fontSize:11, color:T.inkGhost }}>
                        só por data
                      </span>
                    )}
                  </button>
                  <button type="button" role="menuitem"
                    onClick={() => { setMobileMenuOpen(false); exportCSV(); }}
                    style={{ ...G, height:38, borderRadius:9, display:"flex", alignItems:"center",
                      gap:10, padding:"0 10px", fontSize:12.5, border:"none", background:"none",
                      color:T.inkMid, cursor:"pointer", textAlign:"left" }}>
                    <Download size={13}/> Exportar CSV
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button onClick={exportCSV}
            style={{ ...G, display:"flex", alignItems:"center", gap:5, background:T.surface,
              border:`1px solid ${T.border}`, borderRadius:9, padding:"8px 13px",
              fontSize:12, fontWeight:600, color:T.inkMid, cursor:"pointer", flexShrink:0 }}>
            <Download size={13}/> CSV
          </button>
        )}
      </div>

      {/* A faixa de cards de views salvas saiu: ela virou o chip da barra de
          comando (`savedViewsChip`). O formulário de salvar/atualizar continua
          aqui, montado só quando aberto — ele precisa de largura, e como chip
          não caberia. */}
      {saveViewFormOpen && (
        <div ref={savedViewsSectionRef}>
          <SavedViewsCards
            items={[]}
            active={null}
            onActivate={() => {}}
            onDelete={() => {}}
            onOpenSaveForm={openSaveViewForm}
            onSaveView={handleSaveViewForm}
            activeFacets={activeFacetsForSavedViews}
            compact={isMobile}
            saveFormMode={saveViewFormMode}
            saveFormInitialName={
              saveViewFormMode === "update" ? activeSavedView?.label ?? "" : ""
            }
            saveFormInitialIcon={activeSavedView?.icon ?? "bookmark"}
            saveFormInitialColor={activeSavedView?.color}
            updateViewLabel={activeSavedView?.label ?? ""}
            newFormOpen={saveViewFormOpen}
            onNewFormOpenChange={setSaveViewFormOpen}
          />
        </div>
      )}

      {/* ── Row 2 (mobile): Search compacto + botão Filtros que abre o bottom sheet ─ */}
      {isMobile && (
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", gap:8,
            background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"9px 14px" }}>
            <Search size={14} color={T.inkMid}/>
            <input value={searchInput} onChange={e=>{setSearchInput(e.target.value);setVisible(PAGE_SIZE);}}
              placeholder="Buscar por descrição, categoria ou tag…"
              style={{ ...G, flex:1, minWidth:0, border:"none", outline:"none",
                background:"transparent", fontSize:13, color:T.ink }}/>
            {searchInput && <button onClick={()=>setSearchInput("")} style={{ background:"none", border:"none",
              cursor:"pointer", padding:2, display:"flex" }}><X size={12} color={T.inkLight}/></button>}
          </div>
          {/* O botão ALTERNA. Antes só abria: com o sheet aberto ele já dizia
              "Ocultar" e não fazia nada, e o rótulo novo ("Fechar filtros")
              tornou a mentira explícita. Fechar passa por `onSheetClose` para a
              animação de saída rodar — `setFiltersOpen(false)` cru desmontaria
              o sheet no meio dela. */}
          {filtersToggleButton(filtersOpen, () => {
            if (filtersOpen) { onSheetClose(); return; }
            setFiltersOpen(true);
            setSnapFull(true);
            snapFullRef.current = true;
          })}
        </div>
      )}

      {/* ── Desktop compacto (md): busca + toggle na mesma linha; facets abaixo quando expandido ─ */}
      {isDesktopCompact && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TransactionsFilterBar
                {...filterBarCommonProps}
                hideSavedViews
                hideFacets
                barLeading={savedViewsChip}
                barChips={commandBarChipsCompact}
                /* Os atalhos valem em TODO desktop, então a busca e o "?"
                   precisam existir aqui também: sem o ref, "/" engolia a tecla
                   e focava um `null`. */
                searchInputRef={buscaRef}
                onHelp={() => setAjudaAberta(true)}
              />
            </div>
          </div>
          {compactDesktopFiltersOpen && (
            <TransactionsFilterBar {...filterBarCommonProps} hideSearch />
          )}
        </>
      )}

      <UndoToast
        toast={undoToast}
        onUndo={undoLastAction}
        onDismiss={() => setUndoToast(null)}
      />

      {/* ── Desktop largo: MESMA barra de comando do compacto ────
          O artefato substitui a faixa permanente de nove cards de faceta por
          uma linha só — busca, chips do que está filtrando e "+ Filtros". A
          faixa custava 57 px de altura o tempo todo para mostrar sobretudo
          "Todas / Todos / Qualquer": nove rótulos que só informam quando algum
          deles sai do padrão, que é justamente o que os chips já dizem. */}
      {!isMobile && !isDesktopCompact && (
        <>
          <TransactionsFilterBar
            {...filterBarCommonProps}
            hideSavedViews
            hideFacets
            barLeading={savedViewsChip}
            onChipsBudget={setChipsBudget}
            searchInputRef={buscaRef}
            onHelp={() => setAjudaAberta(true)}
            barChips={commandBarChips}
            barTrailing={listPrefsButtons}
          />
        </>
      )}

      {ajudaAberta && <ShortcutsModal onClose={() => setAjudaAberta(false)} />}

      {confirmAcao && (
        <ConfirmActionModal
          kind={confirmAcao.kind}
          desc={confirmAcao.tx.desc}
          busy={deletingBusy}
          onCancel={() => setConfirmAcao(null)}
          onConfirm={async () => {
            const tx = confirmAcao.tx;
            setDeletingBusy(true);
            try {
              if (shouldUseRealData) await transactionsData.removeTransaction(tx.id);
              else setMockTxList((prev) => prev.filter((item) => item.id !== tx.id));
            } catch (_) {
              setDeletingBusy(false);
              return;
            }
            setDeletingBusy(false);
            setConfirmAcao(null);
            setSelected((cur) => (cur && cur.id === tx.id ? null : cur));
            /* A linha colapsa ANTES do refetch: sem isso a lista se
               reorganizaria de um quadro para o outro e o olho perderia onde
               estava. */
            onRowLeave(tx.id);
          }}
        />
      )}

      {/* ── MOBILE FILTER BOTTOM SHEET ───────────────────────────────── */}
      {isMobile && (filtersOpen || sheetClosing) && (
        <div style={{ position:"fixed", inset:0, zIndex:500, display:"flex",
          flexDirection:"column", justifyContent:"flex-end" }}
          onClick={e=>{ if(e.target===e.currentTarget) onSheetClose(); }}>
          {/* Backdrop */}
          <div onClick={onSheetClose}
            style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.45)",
              animation: sheetClosing
                ? "backdropOut 0.38s ease-in both"
                : "backdropIn 0.22s ease-out both" }}/>
          {/* Sheet */}
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Filtros"
            style={{ position:"relative", background:T.surface,
              /* Cantos QUADRAM no cheio. É o sinal de que o sheet deixou de ser
                 camada sobre a lista e virou tela — e o único disponível, já
                 que o fundo escurecido some junto. */
              borderRadius: snapFull ? "0" : "24px 24px 0 0",
              /* 100dvh, não 92: o painel de Período mede 669 px e o corpo a
                 92% deixa a última fileira do calendário fora. Em 100% sobram
                 712 px de corpo e ele cabe inteiro.
                 As DUAS saídas continuam de pé, e é o que autoriza chegar a
                 100%: o ✕ do cabeçalho nunca sai da tela (ele mora fora da
                 região que rola) e o puxador continua reduzindo o sheet no
                 arrasto para baixo. */
              maxHeight: snapFull ? "100dvh" : "72dvh",
              paddingTop: snapFull ? "env(safe-area-inset-top, 0px)" : 0,
              transition: "max-height 0.38s cubic-bezier(0.32,0.72,0,1), border-radius 0.2s ease",
              display:"flex", flexDirection:"column",
              animation: sheetClosing
                ? "sheetDown 0.38s cubic-bezier(0.32,0.72,0,1) both"
                : "sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both",
              willChange:"transform",
              boxShadow:"0 -2px 0 rgba(0,0,0,0.05), 0 -8px 32px rgba(0,0,0,0.14), 0 -24px 80px rgba(0,0,0,0.08)" }}>
            {/* Handle — ONLY drag zone. Touch here = dismiss/expand. Content scroll is unaffected. */}
            <div
              onTouchStart={onSheetTouchStart}
              style={{ padding:"12px 0 8px", flexShrink:0, cursor:"grab", userSelect:"none",
                touchAction:"none", display:"flex", flexDirection:"column",
                alignItems:"center", gap:4,
                minHeight:44 }}>
              <div style={{ width:36, height:4, borderRadius:99,
                background:"rgba(0,0,0,0.18)" }}/>
              <div style={{ fontSize: 11, color:"rgba(0,0,0,0.2)", lineHeight:1,
                letterSpacing:1, userSelect:"none" }}>
                {snapFull ? "▼" : "▲"}
              </div>
            </div>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"4px 20px 10px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
              <div style={{ ...G, fontSize:16, fontWeight:800, color:T.ink }}>Filtros</div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {/* Mesma definição do contador do botão. Com `filter.hasAnyActive`
                    a busca não contava — e ela é externa nesta página
                    (`searchInput`/`debouncedSearch`), então um filtro só de busca
                    deixava o botão preto com "1" e o sheet sem "Limpar tudo". */}
                {activeFilterCount > 0 && (
                  <button onClick={clearAll}
                    style={{ ...G, background:T.redLight, border:"none", cursor:"pointer",
                      fontSize:12, color:T.red, fontWeight:700, padding:"6px 12px",
                      borderRadius:8 }}>
                    Limpar tudo
                  </button>
                )}
                {/* Este é o ÚNICO controle de fechar visível com o sheet aberto:
                    o botão da barra fica atrás do backdrop. */}
                <button onClick={onSheetClose}
                  aria-label="Fechar filtros"
                  style={{ background:"none", border:"none", cursor:"pointer", padding:6,
                    borderRadius:8, display:"flex" }}>
                  <X size={18} color={T.inkMid}/>
                </button>
              </div>
            </div>
            {/* Scrollable content — Variação C inteira dentro do sheet */}
            <div style={{ overflowY:"auto", flex:1, padding:"16px 16px 20px",
              overscrollBehavior:"contain" }}>
              <TransactionsFilterBar
                {...filterBarCommonProps}
                compact
                hideSearch
                /* Uma visualização É um filtro, então ela mora junto dos
                   filtros — no TOPO do sheet, antes das facetas. Estava só no
                   menu `⋯`, que é sobre COMO a lista aparece, não sobre QUAIS
                   transações aparecem. E quem tem uma view quase sempre quer
                   aplicá-la inteira, não montar filtro do zero. */
                hideSavedViews={false}
                savedViews={savedViewsProp}
              />
            </div>
            {/* Footer CTA — safe area aware. fincla-frontend#109 rodada 3,
                achado 4 + rodada 4, achado 6: espelha o `FacetApplyFooter`
                do desktop no RÓTULO (enquanto `resultsLoading`, "Ver 0
                transações" seria uma afirmação falsa), mas — diferente do
                desktop — NUNCA desabilita. Este é o controle de FECHAR o
                sheet em tela cheia, o mais óbvio pra sair; travá-lo (mesmo
                achando que é transitório) deixa a pessoa sem saída óbvia se
                o estado "carregando" persistir (1ª carga falhou, filtro de
                tag bloqueado). O X e o backdrop já fecham de qualquer jeito
                — só o texto/opacidade avisam que a contagem pode mudar. */}
            <div style={{ padding:"12px 20px", paddingBottom:"calc(12px + env(safe-area-inset-bottom, 0px))",
              borderTop:`1px solid ${T.border}`, background:T.surface, flexShrink:0 }}>
              <button onClick={onSheetClose}
                style={{ ...G, width:"100%", background:T.ink, color:"#fff",
                  border:"none", borderRadius:12, padding:"15px",
                  fontSize:15, fontWeight:800, cursor:"pointer",
                  opacity: filterBarApplyProps.resultsLoading ? 0.7 : 1,
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {filterBarApplyProps.resultsLoading ? "Atualizando…" : <>Ver {filteredCount} transaç{filteredCount!==1?"ões":"ão"}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No MOBILE não existe faixa de KPIs. O cabeçalho da lista já carrega a
          contagem, a situação e o resultado; os outros dois totais abrem numa
          sheet a partir dele. A faixa custava ~87 px permanentes numa tela de
          844, e a alternativa antes tentada — três números atrás de uma rolagem
          lateral — escondia informação atrás de um gesto que ninguém adivinha. */}
      <TransactionsSummarySheet
        open={isMobile && statsExpanded}
        onClose={() => setStatsExpanded(false)}
        receita={totalReceita}
        despesa={totalDespesaLiquido}
        resultado={saldo}
        countReceita={countReceita}
        countDespesa={countDespesa}
        totalEstorno={totalEstorno}
        countsArePartial={countsArePartial}
        fmt={fmtBRL}
      />

            {/* Lista. O painel lateral de 320 px e o bottom sheet de detalhes
                deixaram de existir: a sanfona abre embaixo da própria linha.
                Medido antes: em 1366×768 o painel herdava a altura espremida da
                lista e sobrava com 32 px de área rolável para 233 px de
                conteúdo — Editar, Excluir e Marcar como pago ficavam fora de
                alcance sem rolar dentro dessa janela. */}
      {/* `overflow:hidden` cria um SCROLLPORT, e `position:sticky` gruda no
          scrollport mais próximo — não em quem realmente rola. No mobile quem
          rola é a página, várias camadas acima: com este `hidden` no caminho,
          o cabeçalho da lista e os rótulos de dia grudavam num container que
          nunca rola, ou seja, não grudavam em nada. Ele existe para o painel
          ancorado do desktop, que no mobile não existe. */}
      <div style={{ display:"flex", flex:1, minHeight:0, overflow:"hidden" }}>
        <div
          ref={listScrollRef}
          /* No mobile a lista NÃO é uma região de rolagem própria: quem rola é
             a página. Marcá-la como `.fincla-scroll` aqui aplicava
             `overscroll-behavior: contain` num container que não precisa
             rolar (o conteúdo cabe), e o `contain` ISOLA o gesto — arrastar
             em cima de um item não encadeava para o scroller de fora, então
             só dava para rolar pelas margens laterais vazias. */
          /* A lista É a região de rolagem, no mobile também. Antes ela ficava
             `visible` e quem rolava era a página inteira — o que empurrava a
             barra de comando e o botão de filtros para fora da vista bem na
             hora de procurar algo. Como agora ela REALMENTE rola, o
             `overscroll-behavior: contain` do `.fincla-scroll` deixa de ser
             problema: ele isola o gesto de um container que precisa dele.
             Foi o contrário disso — `contain` num container que NÃO rolava —
             que tinha travado a rolagem por cima dos itens. */
          className="fincla-scroll"
          style={{ flex:1, minWidth:0, minHeight:0,
            overflowY:"auto", overflowX:"hidden" }}
        >
          {listContent}
        </div>
        {/* Ancorado: a lista COMPRIME em vez de o painel flutuar por cima dela.
            É o que permite julgar o filtro pelo resultado — a lista continua
            visível e atualizando enquanto se escolhe. */}
        {!isMobile && wideDesktopFiltersOpen && (
          <div style={{ flex:"none", width:dockPanelWidth, marginLeft:14, minHeight:0 }}>
            <TransactionsFilterPanel
              filter={filter}
              facet={panelFacet}
              onFacetChange={setPanelFacet}
              categories={categoriesForFilter}
              cards={cardsForFilter}
              allTags={allTagsForFilter}
              allTagsLoading={shouldUseRealData && tagCatalog.loading}
              allTagsError={shouldUseRealData && Boolean(tagCatalog.error)}
              facetCounts={facetCounts}
              activeFacets={allFacets.filter((f) => f.active)}
              onClearFacet={clearFacetAndResetPage}
              onClearAll={clearAll}
              onApply={() => setWideDesktopFiltersOpen(false)}
              onClose={() => setWideDesktopFiltersOpen(false)}
              resultCount={filteredCount}
              /* A MESMA regra da barra, não `listLoading` cru: com o filtro
                 de tag BLOQUEADO nenhuma busca acontece, `hasLoaded` nunca
                 vira true e o CTA ficaria "Atualizando…" para sempre — sem
                 nunca dizer quantas transações o filtro devolve. */
              resultsLoading={filterBarApplyProps.resultsLoading}
              width={dockPanelWidth}
            />
          </div>
        )}
      </div>
    </div>
  );
}
