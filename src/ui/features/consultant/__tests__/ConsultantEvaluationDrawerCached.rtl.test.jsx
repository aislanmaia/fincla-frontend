// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConsultantEvaluationDrawer } from "../ConsultantEvaluationDrawer.jsx";

vi.mock("../useClientEvaluation.js", () => ({
  useClientEvaluation: vi.fn(),
  ERROR_INSUFFICIENT_DATA: "insufficient_data",
}));
vi.mock("../AiChart.jsx", () => ({ AiChart: () => <div data-testid="ai-chart" /> }));

import { useClientEvaluation } from "../useClientEvaluation.js";

const result = {
  summary: "Cliente em atenção.",
  health_read: { score: 61, label: "Atenção", headline: "Renda comprometida." },
  action_plan: [],
  watch_points: [],
  charts: [],
  disclaimers: ["Análise de apoio ao consultor."],
};

const hookState = (over = {}) => ({
  loading: false,
  error: "",
  errorCode: "",
  result: null,
  correlationId: "",
  cached: false,
  computedAt: null,
  run: vi.fn(),
  refresh: vi.fn(),
  reset: vi.fn(),
  ...over,
});

const renderDrawer = () =>
  render(
    <ConsultantEvaluationDrawer open organizationId="org-1" clientName="Rafael Menezes" onClose={() => {}} />
  );

/** Um `computed_at` de ~3 minutos atrás, sempre relativo a agora. */
const threeMinutesAgo = () => new Date(Date.now() - 3 * 60_000).toISOString();

beforeEach(() => vi.mocked(useClientEvaluation).mockReset());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ConsultantEvaluationDrawer — avaliação em cache", () => {
  it("mostra a idade da análise quando ela veio do cache", () => {
    // O cache torna o segundo clique instantâneo. Sem dizer a idade, o consultor
    // não tem como saber se está olhando um diagnóstico novo ou de 10 minutos atrás.
    vi.mocked(useClientEvaluation).mockReturnValue(
      hookState({ result, cached: true, computedAt: threeMinutesAgo() })
    );

    renderDrawer();

    expect(screen.getByText(/há 3 minutos/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /recalcular/i })).toBeTruthy();
  });

  it("NÃO mostra a faixa quando a avaliação acabou de ser calculada", () => {
    vi.mocked(useClientEvaluation).mockReturnValue(hookState({ result, cached: false }));

    renderDrawer();

    expect(screen.queryByRole("button", { name: /recalcular/i })).toBeNull();
  });

  it("'Recalcular' chama refresh — e é ele que fura o cache", () => {
    // Se o botão chamasse `run()` em vez de `refresh()`, o backend devolveria a
    // MESMA avaliação em cache: o consultor clicaria em "Recalcular" e nada mudaria.
    const refresh = vi.fn();
    const run = vi.fn();
    vi.mocked(useClientEvaluation).mockReturnValue(
      hookState({ result, cached: true, computedAt: threeMinutesAgo(), refresh, run })
    );

    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: /recalcular/i }));

    expect(refresh).toHaveBeenCalledTimes(1);
    // `run` foi chamado 1x pelo auto-run ao abrir — mas NÃO pelo clique.
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("some com a faixa se o backend não disser quando calculou", () => {
    // Um rótulo "Avaliação de —" seria pior que rótulo nenhum.
    vi.mocked(useClientEvaluation).mockReturnValue(
      hookState({ result, cached: true, computedAt: null })
    );

    renderDrawer();

    expect(screen.queryByRole("button", { name: /recalcular/i })).toBeNull();
  });
});
