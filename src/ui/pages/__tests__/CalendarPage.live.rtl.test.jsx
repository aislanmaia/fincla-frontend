// @vitest-environment jsdom
//
// Issue #81 — a tela vivia em dois bugs: (1) não refletia uma transação nova sem F5,
// (2) não distinguia "carregando" de "vazio" de "erro". Os testes aqui rodam a
// CalendarPage de verdade em modo live, mockando só a costura de API (não o hook),
// para provar que os três estados renderizam coisas diferentes e que o token de
// invalidação (mesmo padrão de Cartões/Recorrências) realmente refaz a busca.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { navigateMock, searchMock } = vi.hoisted(() => ({ navigateMock: vi.fn(), searchMock: { value: {} } }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useSearch: () => searchMock.value,
}));

vi.mock("../../../api/transactions", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, listTransactions: vi.fn() };
});
vi.mock("../../../api/balanceAdjustments", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, listOrgBalanceAdjustments: vi.fn() };
});

import * as transactionsApi from "../../../api/transactions";
import * as balanceAdjustmentsApi from "../../../api/balanceAdjustments";
import { CalendarPage } from "../CalendarPage.jsx";

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

afterEach(() => {
  cleanup();
  navigateMock.mockClear();
  searchMock.value = {};
  vi.mocked(transactionsApi.listTransactions).mockReset();
  vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockReset();
});

describe("<CalendarPage> v2 — feedback de busca (live)", () => {
  it("mostra o estado de carregamento — distinto do vazio — enquanto a busca não responde", async () => {
    vi.mocked(transactionsApi.listTransactions).mockReturnValue(new Promise(() => {})); // nunca resolve
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockReturnValue(new Promise(() => {}));

    render(<CalendarPage organizationId="org-1" dataMode="live" />);

    expect(await screen.findByText("Carregando lançamentos do mês…")).toBeTruthy();
    expect(await screen.findByText("Carregando lançamentos…")).toBeTruthy();
    // O texto do "vazio de verdade" não pode aparecer enquanto ainda está carregando.
    expect(screen.queryByText("Nenhum lançamento neste dia")).toBeFalsy();
  });

  it("mostra erro em PT-BR quando a busca falha", async () => {
    vi.mocked(transactionsApi.listTransactions).mockRejectedValue({
      response: { data: { detail: "Não foi possível carregar as transações." } },
    });
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockResolvedValue([]);

    render(<CalendarPage organizationId="org-1" dataMode="live" />);

    expect(await screen.findByText("Não foi possível carregar as transações.")).toBeTruthy();
    // Erro e carregamento nunca aparecem juntos.
    expect(screen.queryByText("Carregando lançamentos do mês…")).toBeFalsy();
  });

  it("mostra o vazio de verdade (CardEmptyWithCta) só depois de carregar sem erro e sem dados", async () => {
    vi.mocked(transactionsApi.listTransactions).mockResolvedValue({ data: [] });
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockResolvedValue([]);

    render(<CalendarPage organizationId="org-1" dataMode="live" />);

    expect(await screen.findByText("Nenhum lançamento neste dia")).toBeTruthy();
    expect(screen.queryByText("Carregando lançamentos do mês…")).toBeFalsy();
    expect(screen.queryByText(/Não foi possível/)).toBeFalsy();
  });

  it("reflete uma transação nova sem reload quando transactionsRefreshToken muda", async () => {
    const today = todayYmd();
    vi.mocked(transactionsApi.listTransactions).mockResolvedValueOnce({ data: [] });
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockResolvedValue([]);

    const { rerender } = render(<CalendarPage organizationId="org-1" dataMode="live" transactionsRefreshToken={0} />);
    await waitFor(() => expect(transactionsApi.listTransactions).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Nenhum lançamento neste dia")).toBeTruthy();

    // Simula o efeito de uma transação criada em outra tela: App.jsx bumpa o token.
    vi.mocked(transactionsApi.listTransactions).mockResolvedValueOnce({
      data: [{ id: "tx-1", description: "Salário", value: 500, type: "income", date: today, payment_method: "pix" }],
    });

    act(() => {
      rerender(<CalendarPage organizationId="org-1" dataMode="live" transactionsRefreshToken={1} />);
    });

    await waitFor(() => expect(transactionsApi.listTransactions).toHaveBeenCalledTimes(2));
    // Aparece tanto no chip da grade quanto na lista do dia — daí o "AllBy".
    expect((await screen.findAllByText("Salário")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Nenhum lançamento neste dia")).toBeFalsy();
  });
});
