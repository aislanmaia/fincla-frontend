import React, {
  useCallback,
  useEffect,
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
import { useTransactionsData } from "../features/transactions/useTransactionsData.js";
import { resolveLocalData, shouldUseRealData as shouldUseRealDataForMode } from "../dataMode.js";
import { TransactionsEmptyState } from "../features/transactions/TransactionsEmptyState.jsx";
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

/** Viewport ≥ breakpoint: filtros desktop sempre visíveis. Abaixo: colapsados por padrão. */
const DESKTOP_FILTERS_EXPAND_BREAKPOINT = 1280;

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
  onNewTx,
  dataMode = "live",
  organizationId = null,
  transactionsRefreshToken = 0,
  onTransactionsInvalidate,
}) {
  const urlSearch = useSearch({ strict: false });
  const navigate = useNavigate();
  const PAGE_SIZE = 10;

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
  const catBg = (label) => `${catColor(label)}18`;

  const fmtBRL = v => "R$\u00a0" + Math.abs(v).toLocaleString("pt-BR",{minimumFractionDigits:2});
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
  const [compactDesktopFiltersOpen, setCompactDesktopFiltersOpen] = useState(false);
  const [saveViewFormOpen, setSaveViewFormOpen] = useState(false);
  const [saveViewFormMode, setSaveViewFormMode] = useState("create");
  // ── Bottom sheet drag-to-dismiss ──────────────────────────────
  const sheetRef      = useRef(null);
  const snapFullRef   = useRef(false);   // read in RAF/touch handlers (no stale closure)
  const isClosingRef  = useRef(false);   // prevents double-close
  const [snapFull,    setSnapFull]    = useState(false);  // false=72dvh, true=92dvh
  const [sheetClosing,setSheetClosing]= useState(false);  // drives exit animation
  const [selected,    setSelected]    = useState(null);
  const [visible,     setVisible]     = useState(PAGE_SIZE);
  const listScrollRef = useRef(null);
  const savedViewsSectionRef = useRef(null);
  /** Snapshot imediatamente anterior à aplicação da view ativa (para desaplicar). */
  const snapshotBeforeViewRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);
  const loadMoreCooldownRef = useRef(false);
  const [deletingId,  setDeletingId]  = useState(null);
  const [mockTxList,  setMockTxList]  = useState(TRANSACTIONS);

  /** Saved views (Variação C) persistidas em localStorage por org. */
  const savedViewsApi = useSavedViews(organizationId);
  const [savedViewActive, setSavedViewActive] = useState(null);

  const isDesktopCompact =
    !isMobile && viewportWidth < DESKTOP_FILTERS_EXPAND_BREAKPOINT;

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
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
  const categoryTagsData = useCategoryTagsData({
    organizationId,
    enabled: shouldUseRealData,
  });
  // Necessário aqui (antes de `transactionsFilters`) para detectar "Todas
  // categorias selecionadas" e mapear pro filtro vazio do backend.
  const totalCategoriesForBackend = shouldUseRealData
    ? categoryTagsData.categories?.length || 0
    : 0;
  const transactionsFilters = useMemo(
    () =>
      filtersToLegacyParams(
        {
          type: filter.type,
          cats: filter.cats,
          period: filter.period,
          customFrom: filter.customFrom,
          customTo: filter.customTo,
          sort: filter.sort,
          valueMin: filter.valueMin,
          valueMax: filter.valueMax,
        },
        {
          limit: visible,
          debouncedSearch,
          totalCategories: totalCategoriesForBackend,
        },
      ),
    [
      debouncedSearch,
      filter.type,
      filter.cats,
      filter.period,
      filter.customFrom,
      filter.customTo,
      filter.sort,
      filter.valueMin,
      filter.valueMax,
      visible,
      totalCategoriesForBackend,
    ],
  );
  const transactionsData = useTransactionsData({
    organizationId,
    enabled: shouldUseRealData,
    filters: transactionsFilters,
    refreshToken: transactionsRefreshToken,
  });
  const txList = shouldUseRealData
    ? transactionsData.transactions
    : resolveLocalData({ dataMode, mockData: mockTxList, emptyData: [] });

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

  /** Tags disponíveis para o painel de Tags. */
  const allTagsForFilter = useMemo(() => {
    const set = new Set();
    txList.forEach((t) => (t.tags || []).forEach((tg) => set.add(tg)));
    return Array.from(set).sort();
  }, [txList]);

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

  // ── Filter + sort (modo mock — em modo live a API faz tudo) ──────────────
  const filtered = useMemo(() => {
    if (shouldUseRealData) return txList;

    const matches = txList.filter((t) => {
      if (!periodFilter(t)) return false;
      if (filter.type === "receita" && (t.type !== "income" || t.val < 0)) return false;
      if (filter.type === "despesa" && (t.type !== "expense" || t.val > 0)) return false;
      if (filter.cats.length > 0 && !filter.cats.includes(t.cat)) return false;
      if (filter.tags.length > 0 && !(t.tags || []).some((tg) => filter.tags.includes(tg))) return false;
      if (filter.rec === "yes" && !t.rec) return false;
      if (filter.rec === "no" && t.rec) return false;
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
    filter.cats,
    filter.tags,
    filter.rec,
    filter.valueMin,
    filter.valueMax,
    filter.period,
    filter.customFrom,
    filter.customTo,
    filter.sort,
  ]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
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

  const hasMore =
    !searchAwaitingCommit &&
    (shouldUseRealData
      ? transactionsData.hasMore
      : visible < filtered.length);

  const tryLoadMore = useCallback(() => {
    if (searchAwaitingCommit) return;
    if (!hasMore) return;
    if (shouldUseRealData && transactionsData.isLoading) return;
    if (loadMoreCooldownRef.current) return;
    loadMoreCooldownRef.current = true;
    setVisible((v) => v + PAGE_SIZE);
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

  const activeFacetsForSavedViews = useMemo(() => {
    const categoriesById = Object.fromEntries(
      categoriesForFilter.map((c) => [c.id, c]),
    );
    const cardsById = Object.fromEntries(cardsForFilter.map((c) => [c.id, c]));
    return filter
      .buildFacets({ categoriesById, cardsById })
      .filter((f) => f.active)
      .map((f) => ({
        label: f.label,
        value: f.value,
        icon: f.icon,
        color: f.color || T.ink,
      }));
  }, [filter, categoriesForFilter, cardsForFilter]);

  const scrollListToTop = useCallback(() => {
    const el = listScrollRef.current;
    if (!el || typeof el.scrollTo !== "function") return;
    el.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const filterBarApplyProps = useMemo(
    () => ({
      filteredCount,
      resultsLoading:
        searchAwaitingCommit ||
        (shouldUseRealData && transactionsData.isLoading),
      onAfterApply: isMobile ? undefined : scrollListToTop,
    }),
    [
      filteredCount,
      searchAwaitingCommit,
      shouldUseRealData,
      transactionsData.isLoading,
      isMobile,
      scrollListToTop,
    ],
  );

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = "Data,Descrição,Categoria,Método,Valor,Status,Tags";
    if (shouldUseRealData && organizationId && !debouncedSearch && filter.cats.length === 0) {
      downloadTransactionsCsvForUi(
        organizationId,
        filtersToCsvOptions({
          type: filter.type,
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
  const DetailPanel = ({ tx, onClose }) => {
    if (!tx) return null;
    const isReceita = tx.val > 0;
    return (
      <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0 }}>
        {/* Header */}
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
        {/* Amount hero */}
        <div style={{ padding:"24px 20px 16px", background: isReceita ? T.greenLight : T.redLight,
          borderBottom:`1px solid ${T.border}`, textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:6 }}>{tx.icon}</div>
          <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:26, fontWeight:800,
            color: isReceita ? T.green : T.red, letterSpacing:"-0.02em" }}>
            {isReceita ? "+" : "−"}{fmtBRL(tx.val)}
          </div>
          <div style={{ ...G, fontSize:13, color:T.inkMid, marginTop:4 }}>{tx.desc}</div>
        </div>
        {/* Fields */}
        <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:"16px 20px", display:"flex", flexDirection:"column", gap:0, minHeight:0 }}>
          {[
            { label:"Categoria", val: <span style={{ ...G, display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:catColor(tx.cat), flexShrink:0 }}/>
                {tx.cat}
              </span>},
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
            <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"11px 0", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ ...G, fontSize:12, color:T.inkMid }}>{label}</div>
              <div style={{ ...G, fontSize:13, color:T.ink, fontWeight:500 }}>{val}</div>
            </div>
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
                  <span key={tag} style={{ ...G, fontSize:11, background:T.grayLight,
                    color:T.inkMid, padding:"3px 9px", borderRadius:99 }}>#{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Actions */}
        <div style={{ padding:"14px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:10 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onEditTx) onEditTx(tx);
              // Fecha o painel no próximo tick para o pai aplicar `flushSync` + `navigate`
              // antes do unmount do detalhe (evita corridas com o estado do modal).
              queueMicrotask(() => onClose());
            }}
            style={{ ...G, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              background:T.ink, color:"#fff", border:"none", borderRadius:10,
              padding:"10px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            <Pencil size={13}/> Editar
          </button>
          {deletingId === tx.id ? (
            <button onClick={async () => {
              if (shouldUseRealData) {
                try {
                  await transactionsData.removeTransaction(tx.id);
                  onTransactionsInvalidate?.();
                } catch (_) {
                  return;
                }
              } else {
                setMockTxList((prev) => prev.filter((item) => item.id !== tx.id));
              }
              setSelected(null);
              setDeletingId(null);
            }}
              style={{ ...G, flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                background:T.red, color:"#fff", border:"none", borderRadius:10,
                padding:"10px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              <Trash2 size={13}/> Confirmar exclusão
            </button>
          ) : (
            <button onClick={() => setDeletingId(tx.id)}
              style={{ ...G, display:"flex", alignItems:"center", justifyContent:"center",
                background:"none", color:T.red, border:`1px solid ${T.red}44`,
                borderRadius:10, padding:"10px 14px", fontSize:13, cursor:"pointer" }}>
              <Trash2 size={13}/>
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Transaction row ───────────────────────────────────────────────────────
  // ── Tooltip helper ─────────────────────────────────────────────────────────
  const Tip = ({ label, children, pos = "top" }) => {
    const [rect, setRect] = useState(null);
    const ref = useRef(null);
    if (!label) return <>{children}</>;

    const show = (e) => {
      if (ref.current) setRect(ref.current.getBoundingClientRect());
    };
    const hide = () => setRect(null);

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
            whiteSpace:"nowrap", zIndex:9999, pointerEvents:"none",
            boxShadow:"0 4px 14px rgba(0,0,0,0.28)", lineHeight:1.4,
          }}>
            {label}
          </span>
        )}
      </span>
    );
  };


  const TxRow = ({ tx }) => {
    const isSelected = selected?.id === tx.id;
    const isRefund   = tx.type === "refund";
    const isReceita  = tx.type === "income" || isRefund;
    const hasParcela = !!tx.parcela && !isRefund;
    const isCredito  = tx.paymentMethodKey === "credito" || tx.method === "Crédito";
    const hasRefundsLinked = tx.refundsSummary && tx.refundsSummary.count > 0;
    const tags       = tx.tags || [];
    const visibleTags = tags.slice(0,2);
    const hiddenTags  = tags.slice(2);

    // Avatar: estorno usa fundo verde claro com ícone ↺. Demais mantêm a cor da categoria.
    const avatarBg = isRefund ? T.greenLight : catBg(tx.cat);

    return (
      <div
        onClick={() => setSelected(isSelected ? null : tx)}
        className="fincla-row"
        style={{ display:"flex", alignItems:"flex-start", gap:12,
          padding: isMobile ? "13px 16px" : "12px 18px",
          background: isSelected ? `${catColor(tx.cat)}08` : "transparent",
          borderLeft: isSelected ? `3px solid ${catColor(tx.cat)}` : "3px solid transparent",
          cursor:"pointer", transition:"background 0.12s, border-color 0.12s" }}>

        {/* Icon */}
        <div style={{ width:38, height:38, borderRadius:11, background:avatarBg,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, color: isRefund ? T.green : undefined,
          fontWeight: isRefund ? 700 : undefined,
          flexShrink:0, marginTop:1 }}>
          {tx.icon}
        </div>

        {/* Main info */}
        <div style={{ flex:1, minWidth:0 }}>

          {/* Row 1: description — estorno ganha ícone ↺ inline + badge "Há estorno" quando aplicável */}
          <div style={{ ...G, fontSize:13, fontWeight:600, color:T.ink,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:3,
            display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {tx.desc}
            </span>
            {hasRefundsLinked && !isRefund && (
              <Tip label={`${tx.refundsSummary.count} estorno${tx.refundsSummary.count !== 1 ? "s" : ""} relacionado${tx.refundsSummary.count !== 1 ? "s" : ""} · ${fmtBRL(tx.refundsSummary.totalValue)} abatido${tx.refundsSummary.totalValue !== 1 ? "s" : ""}`}>
                <span style={{ ...G, fontSize:10, color:T.green, background:T.greenLight,
                  borderRadius:99, padding:"1px 6px", fontWeight:700, cursor:"default", whiteSpace:"nowrap" }}>
                  ↺ Estorno
                </span>
              </Tip>
            )}
          </div>

          {/* Row 2: categoria · método · card digits · status chips */}
          <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap",
            marginBottom: (hasParcela || visibleTags.length > 0) ? 4 : 0 }}>
            <Tip label={`Categoria: ${tx.cat}`}>
              <span style={{ ...G, fontSize:11, color:catColor(tx.cat), fontWeight:600 }}>{tx.cat}</span>
            </Tip>
            <span style={{ ...G, fontSize:11, color:T.inkGhost }}>·</span>

            {/* Para Crédito: mostra "Crédito ●● 1177" inline se tiver cartão, senão só "Crédito" */}
            {isCredito ? (
              <Tip label={tx.parcela?.cartao || "Cartão de crédito"}>
                <span style={{ ...G, fontSize:11, color:T.inkMid }}>
                  Crédito
                  {tx.parcela?.cartao && (
                    <span style={{ color:T.inkGhost, fontFamily:"'Geist Mono',monospace", letterSpacing:"0.04em" }}>
                      {" ●● "}{tx.parcela.cartao.split("••")[1]?.trim()}
                    </span>
                  )}
                </span>
              </Tip>
            ) : (
              <Tip label={`Método: ${tx.method}`}>
                <span style={{ ...G, fontSize:11, color:T.inkMid }}>{tx.method}</span>
              </Tip>
            )}

            {tx.rec && (
              <Tip label="Transação recorrente — repete todo mês">
                <span style={{ ...G, fontSize:11, color:T.blue, background:T.blueLight,
                  borderRadius:99, padding:"1px 6px", fontWeight:700, cursor:"default" }}>↻</span>
              </Tip>
            )}

            {tx.status === "pendente" && (
              <Tip label="Aguardando confirmação do lançamento">
                <span style={{ ...G, fontSize:11, color:T.amber, background:T.amberLight,
                  borderRadius:99, padding:"1px 6px", fontWeight:700 }}>⏳ Pendente</span>
              </Tip>
            )}

            {isRefund && (
              <>
                <span style={{ ...G, fontSize:11, color:T.inkGhost }}>·</span>
                <span style={{ ...G, fontSize:11, color:T.green, fontWeight:600 }}>↺ Estorno</span>
              </>
            )}
          </div>

          {/* Row 3: parcela — compacta, sem redundância com row 2 */}
          {hasParcela && (
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom: visibleTags.length > 0 ? 4 : 0 }}>
              <Tip label={`${tx.parcela.atual}ª de ${tx.parcela.total} parcelas · ${tx.parcela.cartao}`}>
                <span style={{ ...G, fontSize:11, color:T.blue, fontWeight:600,
                  fontFamily:"'Geist Mono',monospace" }}>
                  {tx.parcela.atual}/{tx.parcela.total}×
                </span>
              </Tip>
              <span style={{ ...G, fontSize:10, color:T.inkGhost }}>·</span>
              <Tip label={`Parcela: ${fmtBRL(tx.parcela.valParcela)}/mês · Vence ${tx.parcela.vencimento}`}>
                <span style={{ ...G, fontSize:11, color:T.inkMid,
                  fontFamily:"'Geist Mono',monospace" }}>
                  {fmtBRL(tx.parcela.valParcela)}/mês
                </span>
              </Tip>
              <span style={{ ...G, fontSize:10, color:T.inkGhost }}>·</span>
              <Tip label={`Já pago: ${fmtBRL(tx.parcela.valorPago)} · Residual: ${fmtBRL(tx.parcela.valorResidual)}`}>
                <span style={{ ...G, fontSize:11, color:T.inkLight }}>
                  {tx.parcela.total - tx.parcela.atual} restantes
                </span>
              </Tip>
            </div>
          )}

          {/* Row 4: tags */}
          {visibleTags.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
              {visibleTags.map(tag => (
                <span key={tag} style={{ ...G, fontSize:10, color:T.inkMid, background:T.grayLight,
                  borderRadius:99, padding:"2px 8px", fontWeight:500 }}>#{tag}</span>
              ))}
              {hiddenTags.length > 0 && (
                <Tip label={`Todas: ${tags.map(t=>"#"+t).join(", ")}`} pos="top">
                  <span style={{ ...G, fontSize:10, color:T.blue, background:T.blueLight,
                    borderRadius:99, padding:"2px 8px", fontWeight:700, cursor:"default" }}>
                    +{hiddenTags.length}
                  </span>
                </Tip>
              )}
            </div>
          )}
        </div>

        {/* Amount column — total da compra + parcela/mês abaixo */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", flexShrink:0, gap:2, marginTop:1 }}>
          <Tip label={hasParcela ? `Total da compra: ${fmtBRL(tx.val)}` : isRefund ? "Estorno · dinheiro voltando" : ""} pos="top">
            <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:14, fontWeight:700,
              color: isRefund ? T.green : (isReceita ? T.green : T.ink) }}>
              {isReceita ? "+" : "−"}{fmtBRL(tx.val)}
            </div>
          </Tip>
          {!isMobile && (
            <ChevronRight size={12} color={isSelected ? catColor(tx.cat) : T.inkGhost}
              style={{ marginTop:2, transition:"color 0.12s" }}/>
          )}
        </div>
      </div>
    );
  };


  // ── Filter UI: extraído para `<TransactionsFilterBar>` (Variação C) ──────

  const filterBarCommonProps = {
    filter,
    categories: categoriesForFilter,
    cards: cardsForFilter,
    allTags: allTagsForFilter,
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

  const listContent = (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {groups.length === 0 ? (
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
      ) : (
        groups.map(([date, txs]) => (
          <div key={date}>
            {/* Date group header */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding: isMobile ? "10px 16px 4px" : "10px 18px 4px",
              position:"sticky", top:0, background:T.bg, zIndex:2,
              boxShadow:"0 1px 0 rgba(15,23,42,0.06)" }}>
              <div style={{ ...G, fontSize:11, fontWeight:700, color:T.inkMid,
                textTransform:"capitalize" }}>{fmtDateLabel(date)}</div>
              <div style={{ flex:1, height:1, background:T.border }}/>
              <div style={{ ...G, fontFamily:"'Geist Mono',monospace", fontSize:11,
                color: txs.reduce((s,t)=>s+t.val,0) >= 0 ? T.green : T.red, fontWeight:700 }}>
                {txs.reduce((s,t)=>s+t.val,0) >= 0 ? "+" : "−"}{fmtBRL(Math.abs(txs.reduce((s,t)=>s+t.val,0)))}
              </div>
            </div>
            {/* Rows */}
            <div style={{ background:T.surface, borderRadius:12, overflow:"hidden",
              border:`1px solid ${T.border}`, margin: isMobile ? "0 0 10px" : "0 0 8px" }}>
              {txs.map((tx, i) => (
                <div key={tx.id} style={{ borderBottom: i<txs.length-1?`1px solid ${T.border}`:"none" }}>
                  <TxRow tx={tx}/>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      {/* Paginação infinita: sentinel + feedback (carregamento ao chegar ao fim da lista) */}
      {hasMore && (
        <div
          ref={loadMoreSentinelRef}
          style={{ height:1, marginTop:8, flexShrink:0 }}
          aria-hidden
        />
      )}
      {hasMore && shouldUseRealData && transactionsData.isLoading && (
        <div style={{ ...G, textAlign:"center", fontSize:12, color:T.inkLight, padding:"10px 0 4px" }}>
          Carregando mais…
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

      {/* ── Row 1: Title + CSV ─────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <PageTitle sans="Minhas" serif="Transações"/>
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
              />
            </div>
            {filtersToggleButton(
              compactDesktopFiltersOpen,
              () => setCompactDesktopFiltersOpen((open) => !open),
            )}
          </div>
          {compactDesktopFiltersOpen && (
            <TransactionsFilterBar {...filterBarCommonProps} hideSearch />
          )}
        </>
      )}

      {/* ── Desktop wide: barra completa ─ */}
      {!isMobile && !isDesktopCompact && (
        <TransactionsFilterBar {...filterBarCommonProps} />
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
              <div style={{ fontSize:7, color:"rgba(0,0,0,0.2)", lineHeight:1,
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
            {/* Footer CTA — safe area aware */}
            <div style={{ padding:"12px 20px", paddingBottom:"calc(12px + env(safe-area-inset-bottom, 0px))",
              borderTop:`1px solid ${T.border}`, background:T.surface, flexShrink:0 }}>
              <button onClick={onSheetClose}
                style={{ ...G, width:"100%", background:T.ink, color:"#fff",
                  border:"none", borderRadius:12, padding:"15px",
                  fontSize:15, fontWeight:800, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                Ver {filteredCount} transaç{filteredCount!==1?"ões":"ão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Row 5: KPI strip ─────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: isMobile ? 8 : 12 }}>
        {(() => {
          // Despesa líquida pode ser negativa quando estornos > despesas no período.
          // Quando líquida < 0, cor vira verde mas o sinal `−` é preservado (matemática honesta).
          const despesaPositiva = totalDespesaLiquido >= 0;
          const despesaColor = despesaPositiva ? T.red : T.green;
          const despesaBg = despesaPositiva ? T.redLight : T.greenLight;
          return [
            {
              label: "Receitas",
              val: totalReceita,
              sign: "+",
              color: T.green,
              bg: T.greenLight,
              countLine: `${countReceita} lançamento${countReceita !== 1 ? "s" : ""}`,
            },
            {
              label: "Despesas",
              val: Math.abs(totalDespesaLiquido),
              sign: despesaPositiva ? "−" : "−", // mantém sinal mesmo quando líquido < 0
              color: despesaColor,
              bg: despesaBg,
              subLine: totalEstorno > 0
                ? `↳ ${fmtBRL(totalEstorno)} em estornos abatidos`
                : null,
              countLine: countEstorno > 0
                ? `${countDespesa} desp · ${countEstorno} ↺`
                : `${countDespesa} lançamento${countDespesa !== 1 ? "s" : ""}`,
              tooltip: !despesaPositiva ? "Saldo positivo de estornos no período" : undefined,
            },
            {
              label: "Saldo",
              val: Math.abs(saldo),
              sign: saldo >= 0 ? "+" : "−",
              color: saldo >= 0 ? T.green : T.red,
              bg: saldo >= 0 ? T.greenLight : T.redLight,
              countLine: `${filteredCount} transaç${filteredCount !== 1 ? "ões" : "ão"}`,
            },
          ].map((k) => (
            <div
              key={k.label}
              title={k.tooltip}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: isMobile ? "12px 14px" : "14px 18px",
                gridColumn: isMobile && k.label === "Saldo" ? "1 / -1" : "auto",
              }}
            >
              <div style={{ ...G, fontSize: 10, fontWeight: 700, color: T.inkMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                {k.label}
              </div>
              <div style={{ ...G, fontFamily: "'Geist Mono',monospace", fontSize: isMobile ? 14 : 16, fontWeight: 800, color: k.color, letterSpacing: "-0.01em" }}>
                {k.sign}{fmtBRL(k.val)}
              </div>
              {k.subLine && (
                <div style={{ ...G, fontSize: 10, color: T.green, marginTop: 3, fontWeight: 600 }}>
                  {k.subLine}
                </div>
              )}
              <div style={{ ...G, fontSize: 10, color: T.inkLight, marginTop: 3 }}>
                {k.countLine}
              </div>
            </div>
          ));
        })()}
      </div>

            {/* List + Detail panel */}
      {isMobile ? (
        /* Mobile: list full width, detail as bottom sheet */
        <>
          {listContent}
          {selected && (
            <div
              style={{ position:"fixed", inset:0, zIndex:400,
                display:"flex", flexDirection:"column", justifyContent:"flex-end" }}
              onClick={e=>{ if(e.target===e.currentTarget) setSelected(null); }}>
              {/* Backdrop */}
              <div onClick={()=>setSelected(null)}
                style={{ position:"absolute", inset:0,
                  background:"rgba(0,0,0,0.45)",
                  animation:"backdropIn 0.22s ease-out both" }}/>
              {/* Sheet */}
              <div style={{ position:"relative", background:T.surface,
                borderRadius:"24px 24px 0 0",
                height:"85dvh", display:"flex", flexDirection:"column",
                animation:"sheetUp 0.5s cubic-bezier(0.32,0.72,0,1) both",
                boxShadow:"0 -2px 0 rgba(0,0,0,0.05), 0 -8px 32px rgba(0,0,0,0.14), 0 -24px 80px rgba(0,0,0,0.08)" }}
                id="tx-detail-sheet">
                {/* Handle — drag down to dismiss */}
                <div
                  onTouchStart={e => {
                    const sheet  = document.getElementById('tx-detail-sheet');
                    const startY = e.touches[0].clientY;
                    const startT = Date.now();
                    let last = 0;
                    const mv = ev => {
                      last = ev.touches[0].clientY - startY;
                      if (last > 0) sheet.style.transform = `translateY(${last}px)`;
                    };
                    const up = () => {
                      const vel = last / Math.max(1, Date.now() - startT);
                      sheet.style.transition = 'transform 0.34s cubic-bezier(0.22,1,0.36,1)';
                      if (vel > 0.45 || last > sheet.offsetHeight * 0.3) {
                        sheet.style.transform = 'translateY(110%)';
                        setTimeout(() => { setSelected(null); sheet.style.transform=''; sheet.style.transition=''; }, 340);
                      } else {
                        sheet.style.transform = '';
                        setTimeout(() => sheet.style.transition = '', 340);
                      }
                      document.removeEventListener('touchmove', mv);
                      document.removeEventListener('touchend', up);
                    };
                    document.addEventListener('touchmove', mv, { passive: true });
                    document.addEventListener('touchend', up);
                  }}
                  style={{ padding:"12px 0 6px", flexShrink:0, cursor:"grab",
                    touchAction:"none", display:"flex", justifyContent:"center" }}>
                  <div style={{ width:36, height:4, borderRadius:99, background:"rgba(0,0,0,0.15)" }}/>
                </div>
                <DetailPanel tx={selected} onClose={()=>setSelected(null)}/>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Desktop: master-detail — flex:1 fills remaining height, list scrolls internally */
        <div style={{ display:"flex", gap:16, flex:1, minHeight:0, overflow:"hidden" }}>
          {/* List — scrolls internally */}
          <div
            ref={listScrollRef}
            style={{ flex:1, minWidth:0, overflowY:"auto", overflowX:"hidden" }}
          >
            {listContent}
          </div>
          {/* Detail panel — fixed width, fills full height of this zone */}
          {selected && (
            <div style={{ width:320, flexShrink:0, display:"flex", flexDirection:"column",
              background:T.surface, border:`1px solid ${T.border}`, borderRadius:16,
              overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,0.08)",
              animation:"fadeIn 0.15s ease" }}>
              <DetailPanel tx={selected} onClose={()=>setSelected(null)}/>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
