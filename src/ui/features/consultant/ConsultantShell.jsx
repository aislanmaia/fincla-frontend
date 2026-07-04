import React from "react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { T } from "../../tokens";
import { G } from "../../typography";
import { useFinclaPages } from "../../routing/finclaPageContext.jsx";
import { ConsultantSidebar } from "./ConsultantSidebar.jsx";
import { ConsultantTopbar } from "./ConsultantTopbar.jsx";
import { ConsultantAddClientWizard } from "./ConsultantAddClientWizard.jsx";
import { ConsultantAddClientProvider } from "./ConsultantAddClientContext.jsx";

/**
 * Shell da área do Consultor (A0.3) — layout próprio (independente do app do
 * cliente): Sidebar + Topbar + `<Outlet/>` rolável. Mobile-first: a sidebar vira
 * drawer sob 768px (mesmo padrão da `Sidebar` do cliente).
 *
 * O acesso já é decidido no `App` via `consultantAreaDecision`; aqui só montamos
 * o chrome. "Adicionar cliente" e a busca ⌘K são stubs (fatias futuras: S5/⌘K).
 */
export function ConsultantShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pages = useFinclaPages();
  const user = pages?.user;

  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 768);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [addClientOpen, setAddClientOpen] = React.useState(false);
  const openAddClient = React.useCallback(() => setAddClientOpen(true), []);
  // Incrementa a cada cliente criado → a carteira observa e faz refetch.
  const [clientsVersion, setClientsVersion] = React.useState(0);
  const notifyClientsChanged = React.useCallback(() => setClientsVersion((v) => v + 1), []);

  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const go = (to) => {
    setMenuOpen(false);
    navigate({ to });
  };

  return (
    <ConsultantAddClientProvider openAddClient={openAddClient} clientsVersion={clientsVersion} notifyClientsChanged={notifyClientsChanged}>
    <div style={{ ...G, display: "flex", height: "100vh", width: "100%", overflow: "hidden", background: T.bg }}>
      {!isMobile && <ConsultantSidebar pathname={pathname} onNav={go} user={user} />}

      {isMobile && menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", overflow: "hidden" }}>
          <style>{`@keyframes consSidebarIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
          <div
            role="presentation"
            onClick={() => setMenuOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(15,23,35,0.42)" }}
          />
          <div style={{ position: "relative", animation: "consSidebarIn 0.22s ease-out" }}>
            <ConsultantSidebar pathname={pathname} onNav={go} user={user} onClose={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <ConsultantTopbar
          isMobile={isMobile}
          onOpenMenu={() => setMenuOpen(true)}
          onNav={go}
          onAddClient={openAddClient}
          user={user}
        />
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <Outlet />
        </div>
      </div>

      <ConsultantAddClientWizard open={addClientOpen} onClose={() => setAddClientOpen(false)} onCreated={notifyClientsChanged} />
    </div>
    </ConsultantAddClientProvider>
  );
}
