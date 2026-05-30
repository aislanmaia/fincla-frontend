import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import "./injectFonts";
import { T } from "./tokens";
import { AnimStyles } from "./animations";
import { G, S } from "./typography";

import { PageEnter } from "./components/primitives";
import { Sidebar } from "./layouts/Sidebar.jsx";
import { Topbar } from "./layouts/Topbar.jsx";

import { MOODS, calcMood } from "./features/moodV4";
import { MiniChecklist, StatePanelV4 } from "./features/shellExtras.jsx";

import { useSession } from "./features/auth/useSession.js";
import { parseAuthEntryUrl, stripAuthEntryQueryAndHash } from "./features/auth/authEntryUrl.js";
import {
  AcceptInvitationPage,
  LoginPage,
  PasswordResetPage,
  ErrorBoundary,
} from "./features/authViews.jsx";

import { OnboardingFlow } from "./features/onboarding/OnboardingFlow.jsx";
import { useFirstStepsLiveStatus } from "./features/onboarding/useFirstStepsLiveStatus.js";
import { submitOnboarding } from "./features/onboarding/onboardingApi.js";
import {
  buildImmediateCreditCardPreview,
  buildImmediateRecurringPreview,
} from "./features/onboarding/onboardingValueUtils.js";

import { DashboardPage as DashboardPageView } from "./pages/DashboardPage.jsx";
import { RitmoPage as RitmoPageView } from "./pages/RitmoPage.jsx";
import { TransacoesPage as TransacoesPageView } from "./pages/TransacoesPage.jsx";
import { RecorrenciasPage as RecorrenciasPageView } from "./pages/RecorrenciasPage.jsx";
import { ConfiguracoesPage } from "./pages/ConfiguracoesPage.jsx";
import { MetasPage as MetasPageView } from "./pages/MetasPage.jsx";
import { OrcamentosPage } from "./pages/OrcamentosPage.jsx";
import { RelatoriosPage } from "./pages/RelatoriosPage.jsx";
import { SimulacaoPage as SimulacaoPageView } from "./pages/SimulacaoPage.jsx";
import { CartoesPage } from "./pages/CartoesPage.jsx";

import { acceptOrganizationInvitation } from "./data/invitationAdapter.js";
import {
  isUuidString,
  modalPaymentKeyFromTransactionUi,
  transactionDateIsoFromBrDisplay,
  transactionUiValAbsForEdit,
} from "./data/transactionsAdapter.js";
import { SIM_CENARIOS_INIT } from "./data/simulationMockData.js";

import { NovaTransacaoModal } from "./features/novaTransacao/NovaTransacaoModal.jsx";
import { useTransactionModalController } from "./features/novaTransacao/useTransactionModalController.js";

import { finclaMainOutletRemountKey, firstPathSegment, isAuthRouteSegment } from "./routing/appSegments.js";
import { useFinclaDocumentTitle } from "./routing/useFinclaDocumentTitle.js";
import { FC, FC_MODAL } from "./routing/searchContract.js";
import { FinclaPageContext } from "./routing/finclaPageContext.jsx";
import { useNavTo } from "./routing/useNavTo.js";
import { useAuthRedirects } from "./routing/useAuthRedirects.js";

import { resolveDataMode } from "./dataMode.js";

/* ─── APP ────────────────────────────────────────────────── */
export default function App() {
  const session = useSession();
  const mockDataEnabled = import.meta.env.VITE_ENABLE_UI_MOCKS === "true";
  const navigate = useNavigate();
  const { pathname, searchStr } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      searchStr: s.location.searchStr ?? "",
    }),
  });
  useFinclaDocumentTitle(pathname);
  useLayoutEffect(() => {
    document.querySelector("[data-fincla-main-scroll]")?.scrollTo?.(0, 0);
  }, [pathname]);
  const activeSegment = useMemo(() => {
    const seg = firstPathSegment(pathname);
    return isAuthRouteSegment(seg) ? seg : "";
  }, [pathname]);

  // shared simulation state — empty by default (API-driven); mock only when VITE_ENABLE_UI_MOCKS
  const [cenarios,   setCenarios]  = useState(mockDataEnabled ? SIM_CENARIOS_INIT : []);
  const [cenarioId,  setCenarioId] = useState(mockDataEnabled ? SIM_CENARIOS_INIT[0].id : null);
  const [panelOpen,          setPanelOpen]          = useState(false);
  /** Legado: botão fixo (Sliders, canto superior direito) que alterna `StatePanelV4`. `true` para reexibir na UI. */
  const showLegacyStatePanelFloatButton = false;
  const [requestedDataMode,  setRequestedDataMode]  = useState("live"); // "live" | "mock" | "empty"
  const [showOnboarding,     setShowOnboarding]     = useState(false);
  const [onboardingData,     setOnboardingData]      = useState(null);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  const [extraRecs,         setExtraRecs]          = useState([]); // recorrências semeadas pelo onboarding
  const [extraCards,        setExtraCards]         = useState([]); // cartões semeados pelo onboarding
  // Synthetic transactions derived from seeded recorrências (shown in Transações when empty)
  const extraTx = extraRecs.map((r, i) => ({
    id: `onb-tx-${i+1}`,
    desc: r.desc,
    cat: r.cat,
    val: r.tipo === "receita" ? +r.val : -r.val,
    date: `${String(r.dia).padStart(2,"0")}/04`,
    icon: r.icone || "💼",
    method: r.metodo || "Pix",
    rec: true,
    status: "agendado",
    valorTipo: r.valorTipo,
  }));
  const [checklistDismissed, setChecklistDismissed]  = useState(false);
  const [checklistProbeVersion, setChecklistProbeVersion] = useState(0);
  const [mounted, setMounted]     = useState(false);
  const [day, setDay]             = useState(11);
  const [budgetPct, setBudgetPct] = useState(38);
  const [freePct, setFreePct]     = useState(45);
  const [isMobile, setIsMobile]   = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [transactionsListVersion, setTransactionsListVersion] = useState(0);
  const bumpTransactionsList = useCallback(() => {
    setTransactionsListVersion((n) => n + 1);
  }, []);

  useEffect(() => {
    setChecklistProbeVersion((v) => v + 1);
  }, [transactionsListVersion]);

  // Revalida o checklist «primeiros passos» quando o utilizador volta ao separador.
  // Não usar `window` `focus`: ao clicar na app após o DevTools (ou outro painel do browser)
  // o evento dispara e refaz GETs de transactions/budgets/goals sem necessidade.
  useEffect(() => {
    let wasHidden = document.visibilityState === "hidden";
    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      if (wasHidden && !hidden) {
        setChecklistProbeVersion((v) => v + 1);
      }
      wasHidden = hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, []);

  const moodKey  = useMemo(() => calcMood(day, budgetPct, freePct), [day, budgetPct, freePct]);
  const mood     = MOODS[moodKey];
  const stateCtrl= { day, budgetPct, freePct, mounted, isMobile };
  const activeOrganization = useMemo(
    () =>
      session.organizations.find(
        (item) => item.organization.id === session.activeOrgId,
      )?.organization ?? null,
    [session.activeOrgId, session.organizations],
  );
  const dataMode = resolveDataMode(requestedDataMode, mockDataEnabled);

  const firstStepsLive = useFirstStepsLiveStatus({
    organizationId: session.activeOrgId,
    enabled: session.isAuthenticated && dataMode === "live",
    refreshToken: checklistProbeVersion,
  });
  const completedTx = firstStepsLive.completedTx;
  const completedBudget = firstStepsLive.completedBudget;

  useEffect(() => {
    if (!session.isAuthenticated) {
      setShowOnboarding(false);
    }
  }, [session.isAuthenticated]);

  useAuthRedirects({ session, pathname, searchStr, showOnboarding });

  useEffect(() => {
    if (!activeOrganization) return;

    setOnboardingData((current) => ({
      ...(current ?? {}),
      orgNome: current?.orgNome ?? activeOrganization.name,
      orgTipo: current?.orgTipo ?? activeOrganization.org_type ?? "personal",
      membros: current?.membros ?? [],
    }));
  }, [activeOrganization]);

  const {
    txModalOpen,
    novaRecorrenciaModal,
    modalPreConfig,
    setModalPreConfig,
    openTxModal,
    closeTxModal,
  } = useTransactionModalController({
    session,
    pathname,
    showOnboarding,
    dataMode,
    mockDataEnabled,
  });

  const navTo = useNavTo({
    session,
    setCenarioId,
    onSignOutReset: useCallback(() => {
      setShowOnboarding(false);
      setOnboardingData(null);
      setExtraRecs([]);
      setExtraCards([]);
      setRequestedDataMode("live");
    }, []),
  });
  const pages = {
    dashboard:    <DashboardPageView onNav={navTo} stateCtrl={stateCtrl} dataMode={dataMode} onboardingData={onboardingData} extraRecs={extraRecs} onNewTx={()=>openTxModal()} organizationId={session.activeOrgId} />,
    rhythm: <RitmoPageView
      onNav={navTo}
      isMobile={isMobile}
      dataMode={dataMode}
      organizationId={session.activeOrgId}
      onNewTx={() => openTxModal()}
    />,
    transactions: <TransacoesPageView
      onNav={navTo}
      isMobile={isMobile}
      dataMode={dataMode}
      organizationId={session.activeOrgId}
      transactionsRefreshToken={transactionsListVersion}
      onTransactionsInvalidate={bumpTransactionsList}
      extraTx={extraTx}
      onNewTx={() => openTxModal()}
      onEditTx={(tx) => {
        const txMethod = modalPaymentKeyFromTransactionUi(tx);
        const isParcelado = tx.parcela && tx.parcela.total > 1;
        // Refund: tx.val é positivo mas o tipo no domínio é 'refund' → drawer abre na aba Despesa com toggle estorno ON.
        let tipoForModal;
        if (tx.type === "refund") tipoForModal = "despesa";
        else if (tx.type === "income" || tx.val > 0) tipoForModal = "receita";
        else tipoForModal = "despesa";
        flushSync(() => {
          setModalPreConfig({
            tipo: tipoForModal,
            isEstorno: tx.type === "refund",
            desc: tx.desc,
            cat: tx.cat,
            categoryTagId: tx.categoryTagId ?? null,
            method: txMethod,
            valorInicial: transactionUiValAbsForEdit(tx),
            recorre: tx.rec,
            editingTransactionId: tx.id,
            dateIso:
              tx.dateIsoForEdit ??
              transactionDateIsoFromBrDisplay(tx.date) ??
              undefined,
            cartaoId: tx.cartaoId != null ? tx.cartaoId : undefined,
            modalidade: txMethod === "credito"
              ? (isParcelado ? "parcelado" : "avista")
              : undefined,
            parcelas: isParcelado ? tx.parcela.total : undefined,
            tags: tx.tags ?? [],
            detailTagIds: tx.detailTagIds ?? [],
            detailTagDisplayById: tx.detailTagDisplayById ?? {},
            refundOfTransactionId: tx.refundOfTransactionId ?? null,
          });
        });
        openTxModal({ [FC.TX]: String(tx.id) });
      }}
    />,
    recurring: <RecorrenciasPageView onNav={navTo} cenarios={cenarios} isMobile={isMobile} dataMode={dataMode} extraRecs={extraRecs} organizationId={session.activeOrgId} recurringRefreshToken={transactionsListVersion} onNovaRec={(tipo) => {
      if (tipo) setModalPreConfig({ novaRecorrencia: true, tipo });
      openTxModal({ [FC.MODAL]: FC_MODAL.NEW_RECURRING });
    }} onEditar={(rec) => {
              const freqId = rec.freqId || rec.freq?.split(" ")[0]?.toLowerCase() || "mensal";
              const encId  = rec.encId || (rec.enc === "Sem data fim" ? "sem-fim" : rec.enc === "Após N repetições" ? "repeticoes" : rec.enc === "Data específica" ? "data" : "sem-fim");
              const methodId = rec.methodId || (rec.metodo === "Pix" ? "pix" : rec.metodo === "Boleto" ? "boleto" : rec.metodo === "Débito" || rec.metodo === "Débito auto." ? "debito" : rec.metodo === "Transferência" ? "transferencia" : rec.metodo === "Cartão crédito" ? "credito" : "pix");
              setModalPreConfig({
                tipo: rec.tipo,
                desc: rec.desc,
                cat: rec.cat,
                categoryTagId: rec.categoryTagId ?? undefined,
                method: methodId,
                valorInicial: rec.val,
                recorre: true,
                freqRec: freqId,
                encRec: encId,
                dataFimRec: rec.endDateRaw || undefined,
                encEndDateYmdRec: rec.endDateRaw || undefined,
                valorTipoRec: rec.valorTipo || "fixo",
                isEditRecorrencia: true,
                recId: rec.id,
                cartaoId: rec.creditCardId != null ? String(rec.creditCardId) : undefined,
                transactionDate: rec.nextOccurrenceIso || undefined,
                selectedDayOfWeek: rec.dayOfWeek ?? null,
                selectedDayOfMonth: rec.dayOfMonth ?? null,
                customIntervalRec: rec.interval ?? 1,
                customUnitRec: rec.intervalUnit || "month",
                firstOccurrenceYmd: rec.startDateRaw || rec.nextOccurrenceIso || undefined,
              });
              openTxModal();
            }} />,
    cards:      <CartoesPage    onNav={navTo} isMobile={isMobile} cards={dataMode==="empty" ? extraCards : undefined} dataMode={dataMode} organizationId={session.activeOrgId} transactionsRefreshToken={transactionsListVersion} onNovaItem={(cartaoId) => {
      const id = String(cartaoId);
      setModalPreConfig((p) => ({
        ...(p || {}),
        tipo: "despesa",
        method: "credito",
        cartaoId: id,
      }));
      openTxModal(isUuidString(id) ? { [FC.CARD]: id } : {});
    }} onLancarEstorno={(item, fromCard) => {
      // Abre o drawer já configurado pra estorno linkado à compra original (transaction_id pai).
      if (!item || item.transactionId == null) return;
      const cardIdNum = fromCard?.cardId != null && Number.isFinite(Number(fromCard.cardId))
        ? Number(fromCard.cardId)
        : null;
      const totalCompraOriginal = item.parcela?.total != null
        ? Number(item.parcela.total)
        : Number(item.val);
      setModalPreConfig({
        tipo: "despesa",
        isEstorno: true,
        method: "credito",
        cartaoId: cardIdNum != null ? String(cardIdNum) : undefined,
        cat: item.cat,
        categoryTagId: null,
        refundOfTransactionId: Number(item.transactionId),
        refundLinkedTx: {
          id: Number(item.transactionId),
          desc: item.desc,
          dateLabel: item.data,
          val: Math.abs(totalCompraOriginal),
          cat: item.cat,
          categoryTagId: null,
          paymentMethodKey: "credito",
          cardId: cardIdNum,
        },
        valorInicial: Math.abs(totalCompraOriginal),
      });
      openTxModal(cardIdNum != null ? { [FC.CARD]: String(cardIdNum) } : {});
    }} />,
    budgets:   <OrcamentosPage onNav={navTo} isMobile={isMobile} dataMode={dataMode} organizationId={session.activeOrgId} />,
    goals:        <MetasPageView    isMobile={isMobile} initialMetas={dataMode==="empty" ? [] : undefined} dataMode={dataMode} organizationId={session.activeOrgId} onContribuir={(meta) => { setModalPreConfig({ tipo:"receita", desc:`Aporte — ${meta.nome}`, cat:"Poupança" }); openTxModal(); }} />,
    profile:        <ConfiguracoesPage onNav={navTo} isMobile={isMobile} onboardingData={onboardingData} dataMode={dataMode} organizationId={session.activeOrgId} currentUser={session.user} />,
    reports:   <RelatoriosPage onNav={(dest)=>{ if(dest==="_nova_transacao") openTxModal(); else navTo(dest); }} isMobile={isMobile} dataMode={dataMode} extraRecs={extraRecs} organizationId={session.activeOrgId} />,
    simulation:    <SimulacaoPageView cenarios={cenarios} setCenarios={setCenarios} cenarioId={cenarioId} setCenarioId={setCenarioId} isMobile={isMobile} organizationId={session.activeOrgId} dataMode={dataMode} />,
  };

  if (session.isBootstrapping) return (
    <>
      <AnimStyles/>
      <div style={{ ...G, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:T.bg, padding:24 }}>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:"28px 24px", minWidth:320, textAlign:"center", boxShadow:T.sm }}>
          <img src="/logo.png" alt="Fincla" width={32} height={32} style={{ objectFit:"contain", display:"block", margin:"0 auto 14px" }} />
          <div style={{ ...S, fontSize:28, color:T.ink, marginBottom:10 }}>
            Carregando sua sessao
          </div>
          <div style={{ ...G, fontSize:13, color:T.inkMid, lineHeight:1.65 }}>
            Buscando usuario, organizacao ativa e estado inicial do app.
          </div>
        </div>
      </div>
    </>
  );

  if (session.isAuthenticated && (session.onboardingRequired || showOnboarding)) return (
    <OnboardingFlow
      isMobile={isMobile}
      isSubmitting={onboardingSubmitting}
      errorMessage={onboardingError}
      onComplete={async (data) => {
        setOnboardingError("");
        setOnboardingSubmitting(true);
        setOnboardingData(data);
        try {
          const onboardingResult = await submitOnboarding(data);
          session.completeOnboarding(onboardingResult);
          setShowOnboarding(false);
          setChecklistDismissed(false);
          setRequestedDataMode("live");
          setCenarios([]);
          setCenarioId(null);
          const recurringPreview = buildImmediateRecurringPreview(data);
          const creditCardPreview = buildImmediateCreditCardPreview(data);

          setExtraRecs(recurringPreview ? [recurringPreview] : []);
          setExtraCards(creditCardPreview ? [creditCardPreview] : []);

          navigate({ to: "/dashboard", replace: true });
        } catch (error) {
          setOnboardingError(
            error instanceof Error ? error.message : "Nao foi possivel concluir o onboarding.",
          );
        } finally {
          setOnboardingSubmitting(false);
        }
      }}
    />
  );

  if (!session.isAuthenticated) {
    const entry = parseAuthEntryUrl();
    if (entry.kind === "invite" && entry.token) {
      return (
        <AcceptInvitationPage
          token={entry.token}
          onAccept={acceptOrganizationInvitation}
          onComplete={() => {
            stripAuthEntryQueryAndHash();
            window.location.reload();
          }}
        />
      );
    }
    if (entry.kind === "reset" && entry.token) {
      return (
        <PasswordResetPage
          token={entry.token}
          onResetPassword={session.resetPasswordWithToken}
          onComplete={() => {
            stripAuthEntryQueryAndHash();
            window.location.reload();
          }}
        />
      );
    }
    return (
      <LoginPage
        onLogin={session.signIn}
        initialError={session.error}
        onRequestPasswordReset={session.requestPasswordReset}
        showDemoAccessHint={mockDataEnabled}
      />
    );
  }

  return (
    <>
    <AnimStyles/>
    <FinclaPageContext.Provider value={{ pages, user: session.user }}>
    <div style={{ ...G, display:"flex", height:"100vh", background:T.bg, overflow:"hidden" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 99px; }
        input[type=range] { -webkit-appearance: none; height: 4px; border-radius: 99px; outline: none; cursor: pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: ${T.ink}; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
      `}</style>
      <Sidebar
        page={activeSegment} onNav={navTo}
        isMobile={isMobile}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={session.user}
      />
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <Topbar
          onNew={() => openTxModal()}
          isMobile={isMobile}
          onMenuOpen={() => setSidebarOpen(true)}
          onNav={navTo}
          page={activeSegment}
          user={session.user}
        />

        {/* Mood top border on dashboard */}
        {activeSegment === "dashboard" && mood.topBorder !== "transparent" && (
          <div style={{ height:2, background:mood.topBorder, transition:"background 0.18s", flexShrink:0 }} />
        )}

        {/* Legado: toggle flutuante do painel de estado — desligado na UI; ver `showLegacyStatePanelFloatButton` */}
        {showLegacyStatePanelFloatButton && activeSegment === "dashboard" && !isMobile && (
          <button onClick={() => setPanelOpen(p => !p)} style={{ position:"fixed", top:68, right:16, zIndex:201, width:32, height:32, borderRadius:8, border:`1px solid ${T.border}`, background:panelOpen?T.ink:T.surface, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.2s", boxShadow:T.sm }}>
            <SlidersHorizontal size={13} color={panelOpen?"#fff":T.inkMid} />
          </button>
        )}

        {!isMobile && <StatePanelV4 open={panelOpen} day={day} setDay={setDay} budgetPct={budgetPct} setBudgetPct={setBudgetPct} freePct={freePct} setFreePct={setFreePct} moodKey={moodKey} onStartOnboarding={() => { setPanelOpen(false); setShowOnboarding(true); }} dataMode={dataMode} allowDataModeToggle={mockDataEnabled} onSetDataMode={(mode) => { setRequestedDataMode(mode); if (mode === 'empty') { setCenarios([]); setCenarioId(null); } else { setCenarios(SIM_CENARIOS_INIT); setCenarioId(SIM_CENARIOS_INIT[0].id); } }} />}

        <div data-fincla-main-scroll style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:isMobile?"14px 14px 40px":"20px 28px 40px" }}>
          {activeSegment === "dashboard" && onboardingData && !checklistDismissed && (
            <MiniChecklist
              onboardingData={onboardingData}
              completedTx={completedTx}
              completedBudget={completedBudget}
              onDismiss={() => setChecklistDismissed(true)}
              onNav={(dest) => { if (dest === "_nova_transacao") { openTxModal(); } else { navTo(dest); } }}
            />
          )}
          <ErrorBoundary key={finclaMainOutletRemountKey(pathname)}><PageEnter key={finclaMainOutletRemountKey(pathname)}><Outlet /></PageEnter></ErrorBoundary>
        </div>
      </div>
      <NovaTransacaoModal open={txModalOpen} onClose={closeTxModal} onTransactionSaved={bumpTransactionsList} novaRecorrencia={novaRecorrenciaModal} preConfig={modalPreConfig} isMobile={isMobile} organizationId={session.activeOrgId} dataMode={dataMode} />
    </div>
    </FinclaPageContext.Provider>
    </>
  );
}
