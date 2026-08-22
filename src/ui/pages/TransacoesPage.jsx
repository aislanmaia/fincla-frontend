import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
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
import { resolveLocalData, shouldUseRealData as shouldUseRealDataForMode } from "../dataMode.js";
import { TransactionsEmptyState } from "../features/transactions/TransactionsEmptyState.jsx";
import { TransactionsStats } from "../features/transactions/TransactionsStats.jsx";
import { UndoToast } from "../features/transactions/UndoToast.jsx";
import { TransactionsFilterChips } from "../features/transactions/filters/TransactionsFilterChips.jsx";
import { useFilterHistory } from "../features/transactions/filters/useFilterHistory.js";
import { TransactionsListHeader } from "../features/transactions/TransactionsListHeader.jsx";
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
  onFilterByCategory = null, onFilterByTag = null, wide = false, xwide = false }) => {
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

  /* A grade nasce das medições do artefato. As colunas de conta e de rótulo da
     situação só existem acima de 1600 px: abaixo disso a descrição precisa da
     largura, e uma coluna de conta espremida em 60 px não informa nada. */
  const columns = [
    showDate ? (isMobile ? "44px" : "54px") : null,
    `${iconPx}px`,
    "minmax(0,1fr)",
    dense ? "104px" : "128px",
    xwide ? "150px" : null,
    wide ? "120px" : null,
    wide ? "1fr" : null,
    dense ? "88px" : "100px",
    wide ? "76px" : "20px",
    "14px",
  ].filter(Boolean).join(" ");

  const statusRing = tx.settleable && !tx.settled;

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
      tabIndex={0}
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
          <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{methodLine}</span>
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
              <span style={{ whiteSpace:"nowrap" }}>⚓</span>
            </Tip>
          )}
        </div>
      </div>

      {/* Coluna da categoria. No hover ela dá lugar às ações rápidas: é o único
          bloco que pode sumir sem esconder informação que a pessoa precisa para
          decidir. */}
      <div style={{ minWidth:0, display:"flex", justifyContent:"flex-start" }}>
        {/* SEM `display` inline: estilo inline vence a folha de estilo, e o
            `display:none` de `.fincla-row:hover .fincla-quick-hides` deixava de
            valer — a pílula continuava desenhada POR BAIXO das ações rápidas,
            as duas empilhadas na mesma célula. */}
        {/* SEM `display` inline: estilo inline vence a folha de estilo, e o
            `display:none` de `.fincla-row:hover .fincla-quick-hides` deixava de
            valer — a pílula continuava desenhada POR BAIXO das ações rápidas.

            E rótulo, não botão: no hover esta célula dá lugar às ações rápidas,
            então uma pílula clicável seria inalcançável pelo mouse — ela some
            exatamente quando o ponteiro chega. Filtrar pela categoria mora na
            sanfona, no campo CATEGORIA. */}
        <span className="fincla-quick-hides" style={{ minWidth:0 }}>
          <Tip label={`Categoria: ${tx.cat}`}>
            <span style={{ ...G, fontSize:10, fontWeight:600, color:catCol,
              background:`${catCol}18`, borderRadius:99, padding:"2px 7px",
              maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis",
              whiteSpace:"nowrap", lineHeight:1.5, display:"inline-block" }}>{tx.cat}</span>
          </Tip>
        </span>
        {quickActions && (
          <div className="fincla-quick">
            {tx.settleable && (
              <QuickAction
                label={tx.settled ? `Desfazer pagamento de ${tx.desc}` : `Marcar ${tx.desc} como pago`}
                tone="green"
                onClick={(e) => { e.stopPropagation(); quickActions.onSettle(tx); }}
              >
                {tx.settled ? "↺" : "✓"}
              </QuickAction>
            )}
            <QuickAction
              label={`Editar ${tx.desc}`}
              onClick={(e) => { e.stopPropagation(); quickActions.onEdit(tx); }}
            >
              ✎
            </QuickAction>
            {quickActions.onDuplicate && (
              <QuickAction
                label={`Duplicar ${tx.desc}`}
                onClick={(e) => { e.stopPropagation(); quickActions.onDuplicate(tx); }}
              >
                ⧉
              </QuickAction>
            )}
            <QuickAction
              label={`Excluir ${tx.desc}`}
              tone="red"
              onClick={(e) => { e.stopPropagation(); quickActions.onDelete(tx); }}
            >
              🗑
            </QuickAction>
          </div>
        )}
      </div>

      {/* Tags — só acima de 2100 px. Abaixo disso elas competiriam com a
          descrição por largura, e o artefato as reserva para quando a folga
          existe de verdade. */}
      {xwide && (
        <div style={{ display:"flex", gap:5, minWidth:0, overflow:"hidden" }}>
          {tags.slice(0, 2).map((tag) =>
            onFilterByTag ? (
              // `title` é o rótulo CRU: ele existe para deixar legível um nome
              // truncado ("mensal (a1b2c3d4)"). A ação mora no `aria-label`.
              <button key={tag} type="button" title={tag}
                onClick={(e) => { e.stopPropagation(); onFilterByTag(tag); }}
                aria-label={`Filtrar pela tag ${tag}`}
                style={{ ...G, fontSize:10, fontWeight:600, color:T.inkMid,
                  background:T.grayLight, border:"none", borderRadius:6,
                  padding:"2px 7px", cursor:"pointer", maxWidth:70,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {tag}
              </button>
            ) : (
              <span key={tag} title={tag} style={{ ...G, fontSize:10, fontWeight:600,
                color:T.inkMid, background:T.grayLight, borderRadius:6, padding:"2px 7px",
                maxWidth:70, overflow:"hidden", textOverflow:"ellipsis",
                whiteSpace:"nowrap" }}>{tag}</span>
            ),
          )}
        </div>
      )}

      {/* Conta — só acima de 1600 px, onde a folga vira informação em vez de
          esticar a descrição por 2700 px e jogar o valor no fim do trilho. */}
      {wide && (
        <div style={{ ...G, fontSize:11, color:T.inkLight, minWidth:0,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {tx.accountLabel || tx.contaLabel || "Conta principal"}
        </div>
      )}
      {wide && <span />}

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
            {wide ? "A pagar" : ""}
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

const QuickAction = ({ label, tone, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    style={{ ...G, width:28, height:28, borderRadius:8, cursor:"pointer",
      display:"flex", alignItems:"center", justifyContent:"center", fontSize:12,
      background:T.surface,
      border:`1px solid ${tone === "green" ? "#B7E4CE" : tone === "red" ? "#F5C9C9" : T.border}`,
      color: tone === "green" ? T.green : tone === "red" ? T.red : T.inkMid }}>
    {children}
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
  setSelected,
  shouldUseRealData,
  transactionsData,
  setMockTxList,
  onTransactionsInvalidate,
  deletingId,
  onRowLeave,
  onDuplicateTx,
  onFilterByCategory,
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
        ? { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",
            gap:"10px 18px", padding:"4px 14px 0 107px" }
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
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap",
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
                return;
              }
              setSettlingId(tx.id);
              setSettleError("");
              try {
                const updated = await transactionsData.setTransactionSettled(tx.id, next);
                // O painel renderiza a partir de `selected`, que é um snapshot — sem
                // isto ele continuaria mostrando o estado antigo até fechar.
                if (updated) setSelected((cur) => (cur && cur.id === tx.id ? { ...cur, ...updated } : cur));
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
            // Fecha o painel no próximo tick para o pai aplicar `flushSync` +
            // `navigate` antes do unmount (evita corrida com o estado do modal).
            queueMicrotask(() => onClose());
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
            🗑 Confirmar exclusão
          </AccButton>
        ) : (
          <AccButton tone="red" onClick={(e) => { e.stopPropagation(); setDeletingId(tx.id); }}>
            🗑 Excluir
          </AccButton>
        )}
        {inline && (
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
    return dt.toLocaleDateString("pt-BR",{weekday:"long", day:"numeric", month:"long"});
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
  const snapFullRef   = useRef(false);   // read in RAF/touch handlers (no stale closure)
  const isClosingRef  = useRef(false);   // prevents double-close
  const [snapFull,    setSnapFull]    = useState(false);  // false=72dvh, true=92dvh
  const [sheetClosing,setSheetClosing]= useState(false);  // drives exit animation
  const [selected,    setSelected]    = useState(null);
  /** Estável entre renders: se a identidade mudasse, `TxRow` re-renderizaria à toa
      e o ganho de içar o componente para o módulo iria embora. */
  const handleSelectTx = useCallback((tx) => {
    setSelected((cur) => {
      const next = cur?.id === tx.id ? null : tx;
      // O erro de liquidação é de UMA transação; sem isto ele reapareceria
      // colado na próxima que fosse aberta.
      if (cur?.id !== next?.id) setSettleError("");
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
  // Contagens por opção do painel de filtro. `expandedFacet` mantém a busca
  // preguiçosa: quem só quer ver a lista não paga uma requisição a mais por um
  // número que nunca vai aparecer na tela.
  const [expandedFacet, setExpandedFacet] = useState(null);
  const facetCounts = useTransactionsFacetCounts({
    organizationId,
    filters: transactionsFilters,
    enabled: shouldUseRealData && !tagFilterBlocked && expandedFacet != null,
    refreshToken: transactionsRefreshToken,
  });

  const txList = shouldUseRealData
    ? transactionsData.transactions
    : resolveLocalData({ dataMode, mockData: mockTxList, emptyData: [] });

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
    if (period === "custom")  {
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
  // Contagens por tipo (apenas no modo mock — em modo live usaríamos endpoints separados).
  const countReceita = filtered.filter(t=>t.type==="income").length;
  const countDespesa = filtered.filter(t=>t.type==="expense").length;
  const countEstorno = filtered.filter(t=>t.type==="refund").length;

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
    }),
    [
      savedViewsApi,
      savedViewActive,
      activeSavedViewDirty,
      applySavedViewFilters,
      captureSnapshotBeforeView,
      deapplyActiveSavedView,
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
  const filterByTagFromRow = useCallback(
    (tag) => {
      filter.setTags([tag]);
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

  const filtersToggleButton = (expanded, onToggle) => (
    <button
      type="button"
      onClick={onToggle}
      style={{
        ...G,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 13px",
        background: filter.hasAnyActive || expanded ? T.ink : T.surface,
        color: filter.hasAnyActive || expanded ? "#fff" : T.inkMid,
        border: `1px solid ${filter.hasAnyActive || expanded ? T.ink : T.border}`,
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        flexShrink: 0,
      }}
      aria-label={expanded ? "Ocultar filtros" : "Abrir filtros"}
      aria-expanded={expanded}
    >
      <SlidersHorizontal size={14} />
      {expanded ? "Ocultar" : "Filtros"}
    </button>
  );

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

  const quickActions = useMemo(() => ({
    onEdit: (tx) => { if (onEditTx) onEditTx(tx); },
    // Só existe quando o consumidor sabe duplicar. Um botão que não faz nada
    // é pior que um botão ausente.
    onDuplicate: onDuplicateTx ? (tx) => onDuplicateTx(tx) : null,
    onDelete: (tx) => { setSelected(tx); setDeletingId(tx.id); },
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
      maxVisible={viewportWidth >= 1600 ? 3 : 2}
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
  const pendingCount = txList.filter((t) => t.settleable && !t.settled).length;

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
        onPendingClick={() => filter.setSettlement("a-pagar")}
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
          // fincla-frontend#106 — 1ª carga ainda em voo: mesmo cuidado do
          // calendário (`isLoading` no DayList), NÃO usar o componente do
          // "vazio de verdade" antes da resposta da API chegar, senão a tela
          // afirma "nenhuma transação encontrada" sobre uma busca que nem
          // terminou.
          <div
            style={{
              ...G,
              fontSize: 13,
              color: T.inkLight,
              textAlign: "center",
              padding: "40px 16px",
            }}
          >
            Carregando transações…
          </div>
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
          <CardEmptyWithCta
            icon="🔍"
            iconSize={28}
            title="Nenhuma transação encontrada"
            sub="Tente ajustar os filtros ou a busca — ou registre um lançamento novo."
            primaryLabel={listFiltersActive ? "Limpar filtros" : onNewTx ? "+ Nova transação" : undefined}
            onPrimary={listFiltersActive ? clearAll : onNewTx || undefined}
            secondaryLabel={listFiltersActive && onNewTx ? "+ Nova transação" : undefined}
            onSecondary={listFiltersActive && onNewTx ? onNewTx : undefined}
          />
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
                  position:"sticky", top:isMobile ? 32 : 28, background:"#F4F6F9", zIndex:2,
                  borderTop: gi > 0 ? `1px solid ${T.border}` : "none",
                  borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid,
                    textTransform:"capitalize" }}>{fmtDateLabel(date)}</div>
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
                    wide={!isMobile && viewportWidth >= 1600}
                    xwide={!isMobile && viewportWidth >= 2100}
                  />
                  {/* Sanfona: o detalhe nasce ONDE O OLHO JÁ ESTÁ, em vez de
                      numa coluna de 320 px que, em 1366×768, sobrava com 32 px
                      de área rolável — sem os botões Editar e Excluir à vista.
                      Mesmo padrão dos itens de fatura em Cartões. */}
                  {selected?.id === tx.id && (
                    <div
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
      setSnapFull(false);
      snapFullRef.current  = false;
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
    <div style={{ display:"flex", flexDirection:"column", gap:14, height: isMobile ? undefined : "calc(100dvh - 116px)" }}>
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
              countsArePartial={canUseRemoteSummary}
              unknown={tagFilterBlocked || listNeverLoaded}
              expanded={statsExpanded}
              onToggleExpanded={() => setStatsExpanded((v) => !v)}
              compactLabels={viewportWidth < 1400}
              fmt={fmtBRL}
            />
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
        </div>
        <button onClick={exportCSV}
          style={{ ...G, display:"flex", alignItems:"center", gap:5, background:T.surface,
            border:`1px solid ${T.border}`, borderRadius:9, padding:"8px 13px",
            fontSize:12, fontWeight:600, color:T.inkMid, cursor:"pointer", flexShrink:0 }}>
          <Download size={13}/> CSV
        </button>
      </div>

      {showSavedViewsSection && (
        <div ref={savedViewsSectionRef}>
          <SavedViewsCards
            items={savedViewsProp.items}
            active={savedViewsProp.active}
            onActivate={savedViewsProp.onActivate}
            onDelete={savedViewsProp.onDelete}
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
          {filtersToggleButton(filtersOpen, () => { setFiltersOpen(true); setSnapFull(false); })}
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
                barChips={commandBarChipsCompact}
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
            barChips={commandBarChips}
            barTrailing={listPrefsButtons}
          />
          {wideDesktopFiltersOpen && (
            <TransactionsFilterBar {...filterBarCommonProps} hideSearch />
          )}
        </>
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
            style={{ position:"relative", background:T.surface,
              borderRadius:"24px 24px 0 0",
              maxHeight: snapFull ? "92dvh" : "72dvh",
              transition: "max-height 0.38s cubic-bezier(0.32,0.72,0,1)",
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
                {filter.hasAnyActive && (
                  <button onClick={clearAll}
                    style={{ ...G, background:T.redLight, border:"none", cursor:"pointer",
                      fontSize:12, color:T.red, fontWeight:700, padding:"6px 12px",
                      borderRadius:8 }}>
                    Limpar tudo
                  </button>
                )}
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

      {/* A faixa de KPIs de 87 px foi para a linha do título (Row 1) e a
          contagem para o cabeçalho da lista. No mobile, onde não há largura para
          dividir a linha do título, as estatísticas viram uma faixa própria. */}
      {isMobile && (
        <TransactionsStats
          receita={totalReceita}
          despesa={totalDespesaLiquido}
          resultado={saldo}
          countReceita={countReceita}
          countDespesa={countDespesa}
          countEstorno={countEstorno}
          totalEstorno={totalEstorno}
          filteredCount={filteredCount}
          countsArePartial={canUseRemoteSummary}
          unknown={tagFilterBlocked || listNeverLoaded}
          expanded={statsExpanded}
          onToggleExpanded={() => setStatsExpanded((v) => !v)}
          stacked
          compactLabels
          fmt={fmtBRL}
        />
      )}

            {/* Lista. O painel lateral de 320 px e o bottom sheet de detalhes
                deixaram de existir: a sanfona abre embaixo da própria linha.
                Medido antes: em 1366×768 o painel herdava a altura espremida da
                lista e sobrava com 32 px de área rolável para 233 px de
                conteúdo — Editar, Excluir e Marcar como pago ficavam fora de
                alcance sem rolar dentro dessa janela. */}
      <div style={{ display:"flex", flex:1, minHeight:0, overflow:"hidden" }}>
        <div
          ref={listScrollRef}
          className="fincla-scroll"
          style={{ flex:1, minWidth:0, overflowY:"auto", overflowX:"hidden" }}
        >
          {listContent}
        </div>
      </div>
    </div>
  );
}
