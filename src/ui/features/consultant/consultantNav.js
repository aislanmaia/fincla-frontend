import {
  LayoutDashboard,
  Users,
  BarChart3,
  MessageSquare,
  Sparkles,
  Settings,
} from "lucide-react";

/**
 * Modelo de navegação da área do Consultor (espelha `cons-shell.jsx` do handoff
 * de design). Ids/slugs em inglês; labels em PT-BR.
 *
 * - `to` — rota de destino (item navegável). Ausente em itens "em breve".
 * - `comingSoon` — recurso ainda não disponível (Trilha B): renderiza desabilitado
 *   com selo "em breve" e não navega.
 * - `ai` — item da trilha de Inteligência (acento/realce); hoje sempre `comingSoon`.
 */
export const CONSULTANT_NAV = [
  { sec: "PRINCIPAL" },
  { id: "painel", label: "Painel da base", Icon: LayoutDashboard, to: "/consultant" },
  { id: "clients", label: "Clientes", Icon: Users, to: "/consultant/clients" },
  { sec: "ANÁLISE" },
  { id: "insights", label: "Insights", Icon: BarChart3, to: "/consultant/insights" },
  { sec: "RELACIONAMENTO" },
  { id: "messages", label: "Mensagens", Icon: MessageSquare, comingSoon: true },
  { sec: "INTELIGÊNCIA" },
  { id: "copilot", label: "Copiloto IA", Icon: Sparkles, ai: true, comingSoon: true },
  { sec: "CONTA" },
  { id: "profile", label: "Perfil", Icon: Settings, to: "/consultant/profile" },
];

const stripTrailing = (p) => String(p ?? "").replace(/\/+$/, "") || "/";

/**
 * Item ativo = a rota atual é exatamente o destino ou um sub-caminho dele.
 * "/consultant" (índice/painel) casa só de forma exata para não ficar ativo em
 * todas as sub-rotas do consultor.
 */
export function isConsultantNavActive(pathname, to) {
  if (!to) return false;
  const current = stripTrailing(pathname);
  const target = stripTrailing(to);
  if (target === "/consultant") return current === "/consultant";
  return current === target || current.startsWith(`${target}/`);
}
