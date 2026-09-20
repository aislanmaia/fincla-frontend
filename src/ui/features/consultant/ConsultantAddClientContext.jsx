import React from "react";

/**
 * Contexto para abrir o wizard "Adicionar cliente" (S5) de qualquer entrypoint
 * (topbar, header do Painel, header da Carteira) e para sinalizar quando um cliente
 * é criado, de modo que a carteira atualize a lista. O estado + o modal vivem no
 * `ConsultantShell`; os consumidores só chamam `openAddClient()` ou leem
 * `clientsVersion` (incrementa a cada criação → a carteira faz refetch).
 */
const ConsultantAddClientContext = React.createContext({
  openAddClient: () => {},
  clientsVersion: 0,
  notifyClientsChanged: () => {},
  quotaError: "",
  quota: null, // { limit, used, remaining } | null (desconhecida)
});

export function ConsultantAddClientProvider({ openAddClient, clientsVersion, notifyClientsChanged, quota = null, quotaError = "", children }) {
  const value = React.useMemo(
    () => ({ openAddClient, clientsVersion, notifyClientsChanged, quota, quotaError }),
    [openAddClient, clientsVersion, notifyClientsChanged, quota, quotaError],
  );
  return <ConsultantAddClientContext.Provider value={value}>{children}</ConsultantAddClientContext.Provider>;
}

export function useAddClient() {
  return React.useContext(ConsultantAddClientContext);
}
