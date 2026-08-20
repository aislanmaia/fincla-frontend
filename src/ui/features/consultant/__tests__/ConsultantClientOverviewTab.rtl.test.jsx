// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultantClientOverviewTab } from "../ConsultantClientOverviewTab.jsx";

const HEALTH = {
  patrimonio_liquido: 7300, avg_income: 7000, avg_expense: 4500, avg_surplus: 2500,
  income_commitment: 0.64, savings_rate: 0.36, emergency_fund_months: 1.9,
  goals_on_track: 3, goals_total: 5, goal_progress_avg: 42,
  cash_flow_risk: "low", score: 72,
};

const client = { client_name: "Mariana Costa", organization_id: "a", balance: "1200.00" };

function state(over = {}) {
  return { loading: false, error: "", hasLoaded: true, data: null, ...over };
}

const healthState = state({ data: HEALTH });
const categoriesState = { loading: false, error: "", hasLoaded: true, categories: [
  { tag_name: "Moradia", total: 3000, tag_color: "#0F0F0D" },
  { tag_name: "Alimentação", total: 900, tag_color: "#2563EB" },
] };
const goalsState = { isLoading: false, error: "", hasLoaded: true, goals: [
  { id: "g1", nome: "Reserva", progress: 70 },
  { id: "g2", nome: "Viagem", progress: 20 },
] };

afterEach(() => cleanup());

describe("ConsultantClientOverviewTab", () => {
  it("mostra os 4 KPIs, o donut de categorias, o diagnóstico e as metas", () => {
    render(<ConsultantClientOverviewTab client={client} health={healthState} categories={categoriesState} goals={goalsState} />);
    // KPIs (o rótulo "Taxa de poupança" também aparece no diagnóstico → getAllByText)
    expect(screen.getByText("Saldo atual")).toBeInTheDocument();
    expect(screen.getAllByText("Taxa de poupança").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("36.0%")).toBeInTheDocument();
    // Donut "para onde vai o dinheiro"
    expect(screen.getByText("Para onde vai o dinheiro")).toBeInTheDocument();
    expect(screen.getByText("Moradia")).toBeInTheDocument();
    // Diagnóstico
    expect(screen.getByText("Diagnóstico de saúde")).toBeInTheDocument();
    expect(screen.getByText("Reserva de emergência")).toBeInTheDocument();
    // Metas
    expect(screen.getByText("Metas em andamento")).toBeInTheDocument();
    expect(screen.getByText("Reserva")).toBeInTheDocument();
    expect(screen.getByText("3 de 5")).toBeInTheDocument();
  });

  it("renderiza os blocos de Trilha B como stub 'em breve'", () => {
    render(<ConsultantClientOverviewTab client={client} health={healthState} categories={categoriesState} goals={goalsState} />);
    expect(screen.getByText(/Leitura da IA/)).toBeInTheDocument();
    expect(screen.getByText("Alertas ativos")).toBeInTheDocument();
    expect(screen.getByText("Notas do consultor")).toBeInTheDocument();
    expect(screen.getByText("Próximos passos sugeridos")).toBeInTheDocument();
    expect(screen.getAllByText("em breve").length).toBeGreaterThanOrEqual(4);
  });

  it("KPIs de saúde mostram '…' enquanto a saúde carrega (saldo já aparece)", () => {
    const loadingHealth = { loading: true, error: "", hasLoaded: false, data: null };
    render(<ConsultantClientOverviewTab client={client} health={loadingHealth} categories={categoriesState} goals={goalsState} />);
    expect(screen.getByText("R$ 1.200")).toBeInTheDocument(); // saldo (da carteira)
    expect(screen.getAllByText("…").length).toBeGreaterThanOrEqual(1); // renda/poupança/comprometimento
  });

  it("Notas do consultor: renderiza notas, tags e objetivo quando há perfil", () => {
    const profile = { loading: false, error: "", hasLoaded: true, profile: {
      has_profile: true, notes: "Foco em reserva de emergência", tags: ["poupador", "autônomo"],
      main_goal: "montar_reserva", experience_level: "iniciante", priority: true,
    } };
    render(<ConsultantClientOverviewTab client={client} health={healthState} categories={categoriesState} goals={goalsState} profile={profile} />);
    expect(screen.getByText("Foco em reserva de emergência")).toBeInTheDocument();
    expect(screen.getByText("poupador")).toBeInTheDocument();
    expect(screen.getByText("Montar reserva")).toBeInTheDocument();
    expect(screen.getByText("prioridade")).toBeInTheDocument();
  });

  it("Notas do consultor: estado vazio quando não há perfil (has_profile=false)", () => {
    const profile = { loading: false, error: "", hasLoaded: true, profile: { has_profile: false, tags: [] } };
    render(<ConsultantClientOverviewTab client={client} health={healthState} categories={categoriesState} goals={goalsState} profile={profile} />);
    expect(screen.getByText("Sem notas registradas para este cliente.")).toBeInTheDocument();
  });
});

/**
 * Uma revisão provou por mutação que as mudanças de RENDERIZAÇÃO desta correção não
 * tinham cobertura nenhuma: revertendo os dois trechos de JSX, a suíte continuava
 * verde. O texto do hint estava testado; o que o usuário VÊ, não.
 */
describe("<ConsultantClientOverviewTab> — fator sem base de cálculo", () => {
  const semDespesa = { ...HEALTH, emergency_fund_months: null };

  it("não desenha barra colorida quando a reserva é indefinida", () => {
    render(
      <ConsultantClientOverviewTab
        client={client}
        health={state({ data: semDespesa })}
        categories={categoriesState}
        goals={goalsState}
      />,
    );
    // Trilho tracejado, não barra em 0% — que se leria como o pior valor possível.
    expect(screen.getByTestId("fator-indefinido")).toBeInTheDocument();
    expect(screen.getByText(/sem despesas no período/i)).toBeInTheDocument();
    expect(screen.queryByText(/abaixo do ideal/i)).not.toBeInTheDocument();
  });

  it("com reserva conhecida, volta a desenhar a barra normal", () => {
    render(
      <ConsultantClientOverviewTab
        client={client}
        health={healthState}
        categories={categoriesState}
        goals={goalsState}
      />,
    );
    expect(screen.queryByTestId("fator-indefinido")).not.toBeInTheDocument();
  });
});
/**
 * Revisão da PR #107: medição em Chromium headless com 4 famílias de fonte
 * achou 3 casos onde o CSS puro (sem lógica de breakpoint) evita overflow/
 * desalinhamento — em vez de confiar em "o texto de exemplo cabe", a
 * asserção trava a PROPRIEDADE CSS que garante isso para qualquer palavra
 * mais longa que caiba no domínio dos dados (rótulos vêm de código, não de
 * input livre do usuário, mas "Comprometimento" já é hoje o mais longo).
 */
describe("<ConsultantClientOverviewTab> — geometria de texto (revisão PR #107)", () => {
  it("rótulo do KPI 'Comprometimento' quebra dentro da palavra em vez de vazar do card", () => {
    render(<ConsultantClientOverviewTab client={client} health={healthState} categories={categoriesState} goals={goalsState} />);
    // Palavra única e maiúscula: sem overflowWrap, a ~901–940px de viewport
    // ela é mais larga que o card e vaza para o gap do grid (achado 1).
    expect(screen.getByText("Comprometimento").style.overflowWrap).toBe("anywhere");
  });

  it("sub do KPI 'Comprometimento' também quebra em vez de forçar o card a ficar mais alto de forma feia", () => {
    render(<ConsultantClientOverviewTab client={client} health={healthState} categories={categoriesState} goals={goalsState} />);
    expect(screen.getByText("da renda com dívidas").style.overflowWrap).toBe("anywhere");
  });

  it("linha rótulo+hint do Diagnóstico fica numa linha só: rótulo trunca, hint (com a cor do sinal) nunca quebra", () => {
    render(<ConsultantClientOverviewTab client={client} health={healthState} categories={categoriesState} goals={goalsState} />);
    // Com income_commitment=0.64 (>0.5), o fator "Comprometimento de renda"
    // mostra o hint "renda muito comprometida" — o par mais largo do card
    // (achado 2 da revisão: juntos, quebravam em duas linhas em fontes largas).
    const label = screen.getByText("Comprometimento de renda");
    const hint = screen.getByText("renda muito comprometida");
    expect(label.style.whiteSpace).toBe("nowrap");
    expect(label.style.textOverflow).toBe("ellipsis");
    expect(label.style.overflow).toBe("hidden");
    expect(hint.style.whiteSpace).toBe("nowrap");
    expect(hint.style.flexShrink).toBe("0");
  });
});
