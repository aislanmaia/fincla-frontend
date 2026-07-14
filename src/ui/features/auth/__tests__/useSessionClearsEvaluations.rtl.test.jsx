// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../data/sessionAdapter", () => ({
  isAuthenticated: vi.fn(() => false),
  getCurrentUser: vi.fn(),
  getMyOrganizations: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPasswordWithToken: vi.fn(),
  formatSessionApiError: vi.fn((error) => String(error?.message ?? error)),
}));

vi.mock("../../../../api/consultant", () => ({
  evaluateClientWithAi: vi.fn(),
  newEvaluationRequestId: vi.fn(() => "22222222-2222-4222-8222-222222222222"),
}));

vi.mock("../../../../api/client", () => ({
  handleApiError: vi.fn(() => "erro generico"),
}));

import { evaluateClientWithAi } from "../../../../api/consultant";
import {
  __resetStore,
  getSlice,
  runEvaluation,
} from "../../consultant/clientEvaluationStore.js";
import { useSession } from "../useSession.js";

const ORG = "11111111-1111-4111-8111-111111111111";

const output = {
  summary: "Cliente em atencao.",
  health_read: { score: 61, label: "Atenção", headline: "Renda comprometida." },
  action_plan: [],
  watch_points: [],
  charts: [],
  disclaimers: [],
};

beforeEach(() => {
  __resetStore();
  vi.mocked(evaluateClientWithAi).mockReset().mockResolvedValue({
    output,
    correlation_id: "22222222-2222-4222-8222-222222222222",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * As avaliações de IA moram num store de módulo (fora do React) para a run
 * sobreviver ao fechamento do painel. Sair da conta não recarrega a página —
 * logo, sem uma limpeza explícita, esse store atravessa o logout e o próximo
 * consultor a entrar na mesma aba herda a análise do anterior. O cache do
 * backend é isolado por consultor; este cache do front furaria essa isolação.
 */
describe("useSession — encerrar a sessão esquece as avaliações de IA", () => {
  it("signOut() limpa o store de avaliações do consultor", async () => {
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));

    await act(async () => {
      await runEvaluation(ORG);
    });
    expect(getSlice(ORG).result).toBeTruthy();

    act(() => {
      result.current.signOut();
    });

    expect(getSlice(ORG).result).toBeNull();
  });

  it("a sessão expirada (fincla:auth-expired) também limpa", async () => {
    // Token vencido não passa pelo signOut — o interceptor do axios dispara o
    // evento. O vazamento seria o mesmo.
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false));

    await act(async () => {
      await runEvaluation(ORG);
    });
    expect(getSlice(ORG).result).toBeTruthy();

    act(() => {
      window.dispatchEvent(new Event("fincla:auth-expired"));
    });

    expect(getSlice(ORG).result).toBeNull();
  });
});
