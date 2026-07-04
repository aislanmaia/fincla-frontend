import React from "react";

/**
 * Contexto para abrir o wizard "Adicionar cliente" (S5) de qualquer entrypoint
 * (topbar, header do Painel, header da Carteira). O estado + o modal vivem no
 * `ConsultantShell`; os consumidores só chamam `openAddClient()`.
 */
const ConsultantAddClientContext = React.createContext({ openAddClient: () => {} });

export function ConsultantAddClientProvider({ openAddClient, children }) {
  const value = React.useMemo(() => ({ openAddClient }), [openAddClient]);
  return <ConsultantAddClientContext.Provider value={value}>{children}</ConsultantAddClientContext.Provider>;
}

export function useAddClient() {
  return React.useContext(ConsultantAddClientContext);
}
