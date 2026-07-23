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

/**
 * O consultor logado pode gerar o "Resumo da base por IA" (A2)?
 *
 * É a MESMA feature `consultant_ai` da avaliação individual — o backend gateia as
 * duas Skills com `require_consultant_feature("consultant_ai")`. Existe como
 * função à parte só pela clareza no ponto de uso (o card do Painel não fala de
 * "avaliar cliente"), e para que, no dia em que as duas Skills tiverem tiers
 * diferentes, haja um único lugar por superfície para mudar.
 */
export function useCanSummarizePortfolioWithAi() {
  const pages = useFinclaPages();
  return useEntitlement(CONSULTANT_AI_FEATURE, pages?.user);
}

/**
 * O consultor logado pode ver as "Tendências detectadas pela IA" (A3)?
 *
 * Mesma feature `consultant_ai` das outras Skills. Importa mais aqui que nas
 * irmãs: a seção de tendências AUTO-DISPARA a geração ao montar, então sem este
 * gate a tela de Insights de um consultor sem o recurso dispararia uma chamada
 * que o backend recusa com 403 — melhor não montar a seção.
 */
export function useCanDetectTrendsWithAi() {
  const pages = useFinclaPages();
  return useEntitlement(CONSULTANT_AI_FEATURE, pages?.user);
}
