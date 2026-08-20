/** @vitest-environment jsdom */

// Testa no nível onde o bug (issue #81) vive de fato: a costura entre o hook e a API.
// Mockar o próprio hook provaria só que ele foi chamado com um valor — não que o
// efeito refaz o fetch quando o token de invalidação muda. Aqui mockamos a API
// (a mesma costura usada pelo useCreditCardsData) e observamos o comportamento real.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as transactionsApi from "../../../../api/transactions";
import * as balanceAdjustmentsApi from "../../../../api/balanceAdjustments";
import { useCalendarData } from "../useCalendarData.js";

vi.mock("../../../../api/transactions", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, listTransactions: vi.fn() };
});
vi.mock("../../../../api/balanceAdjustments", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, listOrgBalanceAdjustments: vi.fn() };
});

describe("useCalendarData (RTL)", () => {
  beforeEach(() => {
    // Reseta (chamadas + implementação) entre testes — sem isso, a contagem de
    // chamadas de um teste vaza para o próximo mock de módulo compartilhado.
    vi.mocked(transactionsApi.listTransactions).mockReset().mockResolvedValue({ data: [] });
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockReset().mockResolvedValue([]);
  });

  it("rebusca quando transactionsRefreshToken muda, mesmo com organização/mês iguais", async () => {
    const { rerender } = renderHook(
      ({ token }) =>
        useCalendarData({ organizationId: "org-1", year: 2026, month: 8, enabled: true, transactionsRefreshToken: token }),
      { initialProps: { token: 0 } },
    );

    await waitFor(() => {
      expect(transactionsApi.listTransactions).toHaveBeenCalledTimes(1);
    });
    vi.mocked(transactionsApi.listTransactions).mockClear();

    // Simula o que App.jsx faz depois de uma transação nova: bumpTransactionsList().
    rerender({ token: 1 });

    await waitFor(() => {
      expect(transactionsApi.listTransactions).toHaveBeenCalledTimes(1);
    });
    expect(transactionsApi.listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: "org-1", date_start: "2026-08-01" }),
    );
  });

  it("não rebusca à toa quando o token não muda (mesma organização/mês)", async () => {
    const { rerender } = renderHook(
      ({ token }) =>
        useCalendarData({ organizationId: "org-1", year: 2026, month: 8, enabled: true, transactionsRefreshToken: token }),
      { initialProps: { token: 0 } },
    );

    await waitFor(() => expect(transactionsApi.listTransactions).toHaveBeenCalledTimes(1));
    vi.mocked(transactionsApi.listTransactions).mockClear();

    rerender({ token: 0 });

    // Sem novidade no token: nenhum novo fetch (evita martelar a API a cada render).
    expect(transactionsApi.listTransactions).not.toHaveBeenCalled();
  });

  it("expõe loading true durante a busca e false + hasLoaded depois de resolver", async () => {
    let resolveFetch;
    vi.mocked(transactionsApi.listTransactions).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useCalendarData({ organizationId: "org-1", year: 2026, month: 8, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.error).toBe("");

    resolveFetch({ data: [] });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.error).toBe("");
  });

  it("expõe uma mensagem de erro em PT-BR quando a busca falha", async () => {
    vi.mocked(transactionsApi.listTransactions).mockRejectedValue({
      response: { data: { detail: "Não foi possível carregar as transações." } },
    });

    const { result } = renderHook(() =>
      useCalendarData({ organizationId: "org-1", year: 2026, month: 8, enabled: true }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Não foi possível carregar as transações.");
    // Achado #1 da 2ª rodada de revisão: `hasLoaded` significa "carregou com
    // sucesso ao menos uma vez" — uma falha no 1º carregamento NÃO conta, senão
    // o gate `!hasLoaded` (que decide "vazio real" vs. "lacuna de informação")
    // fica morto pra sempre depois da primeira falha.
    expect(result.current.hasLoaded).toBe(false);
  });

  it("mantém hasLoaded=true quando uma REVALIDAÇÃO (após sucesso) falha", async () => {
    vi.mocked(transactionsApi.listTransactions).mockResolvedValueOnce({ data: [] });

    const { result, rerender } = renderHook(
      ({ token }) => useCalendarData({ organizationId: "org-1", year: 2026, month: 8, enabled: true, transactionsRefreshToken: token }),
      { initialProps: { token: 0 } },
    );
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.error).toBe("");

    // Transação nova salva com o calendário aberto: token sobe, mas desta vez a
    // revalidação falha (ex.: instabilidade momentânea de rede).
    vi.mocked(transactionsApi.listTransactions).mockRejectedValueOnce({
      response: { data: { detail: "Falha ao revalidar." } },
    });
    rerender({ token: 1 });

    await waitFor(() => expect(result.current.error).toBe("Falha ao revalidar."));
    // hasLoaded continua true: já tivemos um carregamento válido antes, e os
    // dados dessa carga (byDay) permanecem na tela — só a revalidação falhou.
    expect(result.current.hasLoaded).toBe(true);
  });
});
