import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../api/consultant", () => ({
  evaluateClientWithAi: vi.fn(),
  newEvaluationRequestId: vi.fn(),
}));

vi.mock("../../../../api/client", () => ({
  handleApiError: vi.fn(() => "erro generico"),
}));

import { evaluateClientWithAi, newEvaluationRequestId } from "../../../../api/consultant";
import {
  __resetStore,
  clearAllEvaluations,
  getSlice,
  runEvaluation,
  subscribe,
} from "../clientEvaluationStore.js";

const ORG = "11111111-1111-4111-8111-111111111111";
const REQ_ID = "22222222-2222-4222-8222-222222222222";

const output = {
  summary: "Cliente em atencao.",
  health_read: { score: 61, label: "Atenção", headline: "Renda comprometida." },
  action_plan: [],
  watch_points: [],
  charts: [],
  disclaimers: [],
};

beforeEach(() => {
  vi.mocked(evaluateClientWithAi).mockReset();
  vi.mocked(newEvaluationRequestId).mockReset().mockReturnValue(REQ_ID);
  __resetStore();
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * O store vive fora do React e fora do ciclo de vida da sessão. Isso é o que faz
 * a run sobreviver ao fechamento do painel — e é exatamente o que o faz
 * atravessar o logout se ninguém o limpar. Estes testes trancam a limpeza.
 */
describe("clientEvaluationStore — fim de sessão", () => {
  it("esquece as avaliações: o próximo consultor não herda a análise do anterior", async () => {
    vi.mocked(evaluateClientWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });
    await runEvaluation(ORG);
    expect(getSlice(ORG).result).toBeTruthy();

    clearAllEvaluations();

    expect(getSlice(ORG).result).toBeNull();
    expect(getSlice(ORG).computedAt).toBeNull();
  });

  it("uma run em voo no logout NÃO repovoa o store quando a resposta chega", async () => {
    // O furo mais sutil: a avaliação leva de 12 a 50 segundos. Limpar o store no
    // logout não basta — a promessa continua viva, e sem o guard de geração ela
    // escreveria o resultado do consultor que SAIU na memória do que acabou de
    // entrar. O backend nem é consultado: o store serviria o dado direto.
    let entregar;
    vi.mocked(evaluateClientWithAi).mockReturnValue(new Promise((r) => { entregar = r; }));

    const emVoo = runEvaluation(ORG);
    expect(getSlice(ORG).loading).toBe(true);

    clearAllEvaluations();

    entregar({ output, correlation_id: REQ_ID });
    await emVoo;

    expect(getSlice(ORG).result).toBeNull();
    expect(getSlice(ORG).loading).toBe(false);
  });

  it("uma run em voo que FALHA depois do logout também não escreve o erro", async () => {
    let recusar;
    vi.mocked(evaluateClientWithAi).mockReturnValue(new Promise((_, r) => { recusar = r; }));

    const emVoo = runEvaluation(ORG);
    clearAllEvaluations();

    recusar(Object.assign(new Error("HTTP 422"), { response: { status: 422 } }));
    await emVoo;

    expect(getSlice(ORG).error).toBe("");
  });

  it("notifica quem está montado, em vez de descartar os listeners", async () => {
    // Descartar os listeners deixaria um drawer aberto surdo: ele continuaria
    // pintando a avaliação do usuário anterior até ser desmontado.
    vi.mocked(evaluateClientWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });
    await runEvaluation(ORG);

    const avisado = vi.fn();
    subscribe(ORG, avisado);

    clearAllEvaluations();

    expect(avisado).toHaveBeenCalled();
  });

  it("depois da limpeza o store volta a funcionar para o novo usuário", async () => {
    // O guard de geração não pode trancar o store: quem entra depois precisa
    // conseguir avaliar normalmente.
    vi.mocked(evaluateClientWithAi).mockResolvedValue({ output, correlation_id: REQ_ID });
    await runEvaluation(ORG);
    clearAllEvaluations();

    await runEvaluation(ORG);

    expect(getSlice(ORG).result?.health_read.score).toBe(61);
    expect(evaluateClientWithAi).toHaveBeenCalledTimes(2);
  });
});
