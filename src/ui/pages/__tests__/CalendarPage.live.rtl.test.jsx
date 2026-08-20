// @vitest-environment jsdom
//
// Issue #81 — a tela vivia em dois bugs: (1) não refletia uma transação nova sem F5,
// (2) não distinguia "carregando" de "vazio" de "erro". Os testes aqui rodam a
// CalendarPage de verdade em modo live, mockando só a costura de API (não o hook),
// para provar que os três estados renderizam coisas diferentes e que o token de
// invalidação (mesmo padrão de Cartões/Recorrências) realmente refaz a busca.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// "R$ 500,00"/"Entradas" aparecem em vários lugares (chip da grade, item do dia,
// filtro lateral) — o card KPI tem um data-testid próprio pra checagem inequívoca.
function entradasKpiText() {
  return screen.getByTestId("kpi-value-entradas").textContent;
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
    // resolver. Setembro ainda não carregou nem uma vez, então o KPI mostra "—"
    // (achado #3 da 2ª rodada: "R$ 0,00" seria uma afirmação, não uma lacuna) —
    // nunca "R$ 500,00" (o total de agosto) sob o rótulo "Setembro 2026".
    expect(entradasKpiText()).toBe("—");
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

  // ─── 2ª rodada de revisão adversarial da PR #94 ──────────────────────────

  it("achado #1 (2ª rodada): retry pendurado após falha na 1ª carga continua 'carregando', nunca 'vazio confiante'", async () => {
    vi.mocked(transactionsApi.listTransactions).mockRejectedValueOnce({
      response: { data: { detail: "Falhou." } },
    });
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockResolvedValue([]);

    const { rerender } = render(<CalendarPage organizationId="org-1" dataMode="live" transactionsRefreshToken={0} />);
    expect(await screen.findByText("Não foi possível carregar os lançamentos deste dia.")).toBeTruthy();

    // Usuário tenta de novo (ex.: salvou uma transação pelo CTA) — o token sobe,
    // mas a nova busca fica pendurada (nunca resolve): trava a tela exatamente
    // no meio do retry.
    vi.mocked(transactionsApi.listTransactions).mockReturnValue(new Promise(() => {}));
    act(() => {
      rerender(<CalendarPage organizationId="org-1" dataMode="live" transactionsRefreshToken={1} />);
    });

    // byDay continua {} e o período NUNCA carregou com sucesso — se `hasLoaded`
    // tivesse virado true na falha anterior (bug), este quadro cairia no
    // CardEmptyWithCta "Nenhum lançamento" por baixo do banner azul.
    expect(screen.getByText("Carregando lançamentos do mês…")).toBeTruthy();
    expect(screen.getByText("Carregando lançamentos…")).toBeTruthy();
    expect(screen.queryByText("Nenhum lançamento neste dia")).toBeFalsy();
  });

  it("achado #2 (2ª rodada): falha de revalidação avisa localmente sem esconder dado válido nem confundir dia vazio com falha", async () => {
    vi.mocked(transactionsApi.listTransactions).mockResolvedValueOnce({
      data: [{ id: "tx-1", description: "Salário", value: 500, type: "income", date: "2026-08-15", payment_method: "pix" }],
    });
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockResolvedValue([]);

    searchMock.value = { fc_cal_m: "2026-08", fc_cal_d: "2026-08-15" };
    const { rerender } = render(<CalendarPage organizationId="org-1" dataMode="live" transactionsRefreshToken={0} />);
    await waitFor(() => expect(transactionsApi.listTransactions).toHaveBeenCalledTimes(1));
    expect((await screen.findAllByText("Salário")).length).toBeGreaterThan(0);

    // Revalidação (token bump, ex.: outra transação salva) falha desta vez.
    vi.mocked(transactionsApi.listTransactions).mockRejectedValueOnce({
      response: { data: { detail: "Falha ao revalidar." } },
    });
    act(() => {
      rerender(<CalendarPage organizationId="org-1" dataMode="live" transactionsRefreshToken={1} />);
    });
    await screen.findByText("Falha ao revalidar.");

    // O dia 15 TEM dado válido (stale) — continua visível, com uma pista local
    // (não só a faixa do topo, que no mobile pode estar fora da tela).
    expect(screen.queryAllByText("Salário").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Não foi possível atualizar agora — mostrando os últimos lançamentos carregados."),
    ).toBeTruthy();
    // E não é lido como "a busca deste dia falhou" — ele tem dados de verdade.
    expect(screen.queryByText("Não foi possível carregar os lançamentos deste dia.")).toBeFalsy();

    // Um dia SEM lançamentos nos dados válidos que já temos continua "vazio de
    // verdade" (CTA), não "falhou" — a falha foi só na revalidação, o dado do
    // dia 20 (ausência de eventos) é um fato real, não uma lacuna.
    searchMock.value = { fc_cal_m: "2026-08", fc_cal_d: "2026-08-20" };
    act(() => {
      rerender(<CalendarPage organizationId="org-1" dataMode="live" transactionsRefreshToken={1} />);
    });
    expect(screen.getByText("Nenhum lançamento neste dia")).toBeTruthy();
    expect(screen.queryByText("Não foi possível carregar os lançamentos deste dia.")).toBeFalsy();
  });

  it("achado #3 (2ª rodada): KPIs e cabeçalho do dia não afirmam 'R$ 0,00 / 0 lançamentos' sem saber", async () => {
    vi.mocked(transactionsApi.listTransactions).mockReturnValue(new Promise(() => {})); // 1ª carga nunca resolve
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockReturnValue(new Promise(() => {}));

    render(<CalendarPage organizationId="org-1" dataMode="live" />);

    expect(await screen.findByTestId("kpi-value-entradas")).toHaveTextContent("—");
    expect(screen.getByTestId("kpi-value-saidas")).toHaveTextContent("—");
    expect(screen.getByTestId("kpi-value-saldo")).toHaveTextContent("—");
    // "R$ 0,00" (uma afirmação sobre o mês) não pode aparecer enquanto ainda não
    // sabemos — nem no card, nem no cabeçalho da lista do dia.
    expect(screen.queryByText("R$ 0,00")).toBeFalsy();
    expect(screen.queryByText("0 lançamentos")).toBeFalsy();
    expect(screen.getAllByText("carregando…").length).toBeGreaterThan(0);
  });

  it("achado #4 (2ª rodada): selecionar um dia do mês vizinho na visão Semana move o cursor de mês junto", async () => {
    vi.mocked(transactionsApi.listTransactions).mockResolvedValue({ data: [] });
    vi.mocked(balanceAdjustmentsApi.listOrgBalanceAdjustments).mockResolvedValue([]);

    // Semana de 30/ago a 05/set/2026 — atravessa a virada do mês.
    searchMock.value = { fc_cal_v: "week", fc_cal_m: "2026-08", fc_cal_d: "2026-08-31" };
    const { container } = render(<CalendarPage organizationId="org-1" dataMode="live" />);
    await waitFor(() => expect(transactionsApi.listTransactions).toHaveBeenCalledTimes(1));

    // Célula de um dia de setembro (mês vizinho): esmaecida (opacity 0.55), mas
    // continua clicável na visão Semana — ao contrário da visão Mês.
    const adjacentCell = [...container.querySelectorAll("div")].find(
      (d) => d.style.minHeight === "300px" && d.style.cursor === "pointer" && d.style.opacity === "0.55",
    );
    expect(adjacentCell).toBeTruthy();

    navigateMock.mockClear();
    fireEvent.click(adjacentCell);

    expect(navigateMock).toHaveBeenCalled();
    const call = navigateMock.mock.calls.find((c) => typeof c[0]?.search === "function");
    expect(call).toBeTruthy();
    const next = call[0].search({});
    // O dia virou setembro E o mês do cursor foi junto — sem isto o hook segue
    // buscando agosto, e o dia (que é real) renderiza como "vazio confiante".
    expect(next.fc_cal_d.slice(0, 7)).toBe("2026-09");
    expect(next.fc_cal_m).toBe("2026-09");
  });
});
