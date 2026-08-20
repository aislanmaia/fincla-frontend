// @vitest-environment jsdom
//
// Issue #81 — a tela vivia em dois bugs: (1) não refletia uma transação nova sem F5,
// (2) não distinguia "carregando" de "vazio" de "erro". Os testes aqui rodam a
// CalendarPage de verdade em modo live, mockando só a costura de API (não o hook),
// para provar que os três estados renderizam coisas diferentes e que o token de
// invalidação (mesmo padrão de Cartões/Recorrências) realmente refaz a busca.
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

// Mesmo Intl.NumberFormat da página — evita divergência de espaço estreito
// não separável (NNBSP) que o Intl usa entre "R$" e o valor.
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// "R$ 500,00" e o rótulo "Entradas" aparecem em vários lugares (chip da grade,
// item do dia, filtro lateral) — para checar o total do MÊS de forma inequívoca,
// acha o card KPI específico (o único "Entradas" cujo irmão começa com "R$").
function entradasKpiText() {
  const candidates = screen.getAllByText("Entradas");
  for (const label of candidates) {
    const value = within(label.parentElement).queryByText(/^R\$/);
    if (value) return value.textContent;
  }
  throw new Error("Card KPI 'Entradas' não encontrado");
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

  it("mostra erro em PT-BR quando a busca falha, sem cair no 'vazio confiante'", async () => {
    vi.mocked(transactionsApi.listTransactions).mockRejectedValue({
      response: { data: { detail: "Não foi possível carregar as transações." } },
    });
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockResolvedValue([]);

    render(<CalendarPage organizationId="org-1" dataMode="live" />);

    expect(await screen.findByText("Não foi possível carregar as transações.")).toBeTruthy();
    // Erro e carregamento nunca aparecem juntos.
    expect(screen.queryByText("Carregando lançamentos do mês…")).toBeFalsy();
    // Achado #1 da revisão: byDay fica {} quando a busca falha (igual ao vazio real),
    // então sem um estado de erro dedicado no DayList a falha de rede virava
    // "Nenhum lançamento neste dia" + CTA de registrar — lendo como "você não tem
    // nada" em vez de "a busca falhou". O DayList precisa de um aviso próprio.
    expect(screen.queryByText("Nenhum lançamento neste dia")).toBeFalsy();
    expect(await screen.findByText("Não foi possível carregar os lançamentos deste dia.")).toBeTruthy();
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

  it("achado #2: ao trocar de mês, não mostra o total do mês anterior sob o rótulo do mês novo", async () => {
    vi.mocked(transactionsApi.listTransactions).mockResolvedValueOnce({
      data: [{ id: "tx-ago", description: "Salário", value: 500, type: "income", date: "2026-08-15", payment_method: "pix" }],
    });
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockResolvedValue([]);

    searchMock.value = { fc_cal_m: "2026-08", fc_cal_d: "2026-08-15" };
    const { rerender } = render(<CalendarPage organizationId="org-1" dataMode="live" />);

    // Agosto carregado: KPI "Entradas" reflete os R$ 500,00 da transação.
    await waitFor(() => expect(transactionsApi.listTransactions).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(entradasKpiText()).toBe(brl.format(500)));

    // Troca pra setembro (equivalente a clicar "Próximo mês") com a busca do mês
    // novo ainda em voo — nunca resolve, pra travar a tela exatamente no meio da
    // transição e poder inspecionar esse quadro.
    vi.mocked(transactionsApi.listTransactions).mockReturnValue(new Promise(() => {}));
    searchMock.value = { fc_cal_m: "2026-09", fc_cal_d: "2026-09-15" };
    act(() => {
      rerender(<CalendarPage organizationId="org-1" dataMode="live" />);
    });

    // O rótulo já mudou (é derivado só da URL, síncrono) — aparece tanto no
    // cabeçalho quanto no mini-calendário, daí o "AllBy".
    expect(screen.getAllByText("Setembro 2026").length).toBeGreaterThan(0);
    // ...e os R$ 500,00 de agosto NÃO podem aparecer sob o rótulo de setembro: o
    // período mudou, então os dados do período anterior somem já no mesmo render
    // em que o cursor muda — não só depois que o fetch (que nem respondeu ainda)
    // resolver. Sem isto, o KPI mostraria "R$ 500,00" (o total de agosto) com
    // "Setembro 2026" escrito ao lado.
    expect(entradasKpiText()).toBe(brl.format(0));
    expect(screen.getByText("Carregando lançamentos do mês…")).toBeTruthy();
  });

  it("achado #3: revalidar (token) mantém a grade visível — não apaga tudo pra 'carregando'", async () => {
    vi.mocked(transactionsApi.listTransactions).mockResolvedValueOnce({
      data: [{ id: "tx-1", description: "Salário", value: 500, type: "income", date: "2026-08-15", payment_method: "pix" }],
    });
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockResolvedValue([]);

    searchMock.value = { fc_cal_m: "2026-08", fc_cal_d: "2026-08-15" };
    const { rerender } = render(<CalendarPage organizationId="org-1" dataMode="live" transactionsRefreshToken={0} />);
    await waitFor(() => expect(transactionsApi.listTransactions).toHaveBeenCalledTimes(1));
    expect((await screen.findAllByText("Salário")).length).toBeGreaterThan(0);

    // Simula outra transação sendo salva com o calendário aberto NO MESMO mês:
    // App.jsx bumpa o token, mas a resposta da revalidação ainda não chegou.
    vi.mocked(transactionsApi.listTransactions).mockReturnValue(new Promise(() => {}));
    act(() => {
      rerender(<CalendarPage organizationId="org-1" dataMode="live" transactionsRefreshToken={1} />);
    });

    // Sinaliza que está buscando de novo...
    expect(screen.getByText("Carregando lançamentos do mês…")).toBeTruthy();
    // ...mas "Salário" (dado já carregado) continua na tela — stale-while-revalidate.
    // Sem isto, o request em voo apagaria a grade inteira até a resposta chegar.
    expect(screen.queryAllByText("Salário").length).toBeGreaterThan(0);
    expect(screen.queryByText("Nenhum lançamento neste dia")).toBeFalsy();
  });
});
