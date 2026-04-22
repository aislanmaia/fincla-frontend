import { useEffect } from "react";
import {
  PROFILE_TAB_SLUG_TO_INTERNAL,
  profileSettingsTabSlugFromPathname,
} from "./profileSettingsTabs.js";
import { transactionEditIdFromPathname } from "./transactionPathId.js";

const SEGMENT_TITLES = {
  dashboard: "Visão geral",
  transactions: "Transações",
  rhythm: "Ritmo de gastos",
  budgets: "Orçamentos",
  recurring: "Recorrências",
  simulation: "Simulação",
  goals: "Metas",
  cards: "Cartões",
  reports: "Relatórios",
  profile: "Configurações",
};

const PROFILE_INTERNAL_TITLES = {
  perfil: "Meu perfil",
  seguranca: "Segurança",
  organizacao: "Organização",
  membros: "Membros",
  categorias: "Categorias e tags",
  whatsapp: "WhatsApp",
  assinatura: "Assinatura",
};

/**
 * document.title por segmento de rota (e separador de /profile/…).
 */
export function useFinclaDocumentTitle(pathname) {
  useEffect(() => {
    const seg = String(pathname ?? "").replace(/^\//, "").split("/").filter(Boolean)[0] ?? "";
    const base = "Fincla";
    if (!seg) {
      document.title = base;
      return;
    }
    const tabSlug = profileSettingsTabSlugFromPathname(pathname);
    if (seg === "profile" && tabSlug) {
      const internal = PROFILE_TAB_SLUG_TO_INTERNAL[tabSlug];
      const sub =
        internal && PROFILE_INTERNAL_TITLES[internal]
          ? PROFILE_INTERNAL_TITLES[internal]
          : "Configurações";
      document.title = `${sub} · ${base}`;
      return;
    }
    if (seg === "transactions" && transactionEditIdFromPathname(pathname)) {
      document.title = `Editar transação · ${base}`;
      return;
    }
    const label = SEGMENT_TITLES[seg];
    document.title = label ? `${label} · ${base}` : base;
  }, [pathname]);
}
