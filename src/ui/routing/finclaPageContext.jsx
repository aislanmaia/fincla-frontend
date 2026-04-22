import { createContext, useContext } from "react";

/** Conteúdo das páginas principais (mapa segment → ReactNode), preenchido em App.jsx. */
export const FinclaPageContext = createContext(null);

export function useFinclaPages() {
  return useContext(FinclaPageContext);
}
