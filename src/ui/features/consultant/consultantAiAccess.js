import { useFinclaPages } from "../../routing/finclaPageContext.jsx";
import { useEntitlement } from "../entitlements/useEntitlement.js";

/**
 * Feature que libera "Avaliar com IA" (Consultor IA — A1). Espelha o gate do
 * backend (`require_consultant_feature("consultant_ai")`): assinatura ativa +
 * feature no plano. Está em `consultant_pro` / `consultant_premium` / `beta` —
 * **não** em `consultant_basic`.
 *
 * Mesma escolha do [CONSULTANT_FEATURE]: gatear pela feature, e não por
 * `role === "consultant"`, mantém frontend e backend consistentes.
 */
export const CONSULTANT_AI_FEATURE = "consultant_ai";

/**
 * O consultor logado pode rodar a avaliação com IA?
 *
 * O backend já barra quem não pode (403), mas deixar o botão habilitado faria o
 * consultor `consultant_basic` esperar um round-trip para descobrir que não tem
 * o recurso. Gateando aqui, o botão vira um convite de upgrade — o mesmo padrão
 * dos itens Pro da sidebar (`/reports`, `/simulation`).
 *
 * A checagem é defesa em profundidade, nunca a única: o gate que importa é o do
 * servidor.
 */
export function useCanEvaluateClientWithAi() {
  const pages = useFinclaPages();
  return useEntitlement(CONSULTANT_AI_FEATURE, pages?.user);
}
