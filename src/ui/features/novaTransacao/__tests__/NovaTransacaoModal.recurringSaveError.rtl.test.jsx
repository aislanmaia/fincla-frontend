// @vitest-environment jsdom
/**
 * #291 — salvar uma série recorrente com uma conta desativada volta 422 com
 * `detail` OBJETO `{code, message}` (fincla-api#466); a moeda diferente volta
 * `detail` string. As duas formas precisam chegar à tela como frase.
 *
 * O PATCH sai pelo axios de verdade e o único dublê é a rede (MSW): o
 * formatador é a camada sob teste, então nada acima dele é mockado.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const CATEGORY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SERIES_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

// Referência ESTÁVEL de propósito: o modal relê as categorias num efeito que
// também limpa o erro de envio, e um array novo a cada render (o hook real
// memoriza) apagaria a mensagem que este teste procura.
const categoryTags = vi.hoisted(() => ({
  isLoading: false,
  error: "",
  options: [{ value: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", label: "Moradia" }],
  categories: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", labelPt: "Moradia", iconKey: null }],
}));
vi.mock("../../tags/useCategoryTagsData.js", () => ({
  useCategoryTagsData: () => categoryTags,
}));

vi.mock("../../tags/useNovaTransacaoDetailTags.js", () => ({
  useNovaTransacaoDetailTags: () => ({
    findByLabel: () => null,
    ensureDetailTag: vi.fn(),
    labelForDetailId: (id) => String(id),
    detailTagRowsForCategory: [],
    error: "",
  }),
}));

vi.mock("../useNovaTransacaoFinancialImpact.js", () => ({
  useNovaTransacaoFinancialImpact: () => ({
    impactLive: false,
    preview: null,
    previewLoading: false,
    previewError: "",
    spendingLoading: false,
    spendingError: "",
    chartData: [],
    refLineDay: null,
    showProjLine: false,
    categoryProjectedEom: null,
    categoryProjectionMeta: null,
  }),
}));

vi.mock("../useNovaTransacaoPeriodSaldo.js", () => ({
  useNovaTransacaoPeriodSaldo: () => ({ periodBalance: null, loading: false, error: "", live: false }),
  projectedBalanceAfterTx: () => null,
  fmtSaldoLine: () => "",
  clearNovaTransacaoSummaryCache: vi.fn(),
}));

vi.mock("../../../../api/creditCards", () => ({
  listCreditCards: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../api/balances", () => ({
  getOrgBalances: vi.fn().mockResolvedValue({ accounts: [] }),
}));

import { mapRecurringSeriesToUi } from "../../../data/recurringSeriesAdapter.js";
import { buildEditRecurringPreConfig } from "../buildEditRecurringPreConfig.js";
import { NovaTransacaoModal } from "../NovaTransacaoModal.jsx";

let patchReply;
const server = setupServer(
  http.patch("*/v1/recurring-series/:id", () => patchReply()),
  http.get("*", () => HttpResponse.json([])),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

const series = {
  id: SERIES_ID,
  description: "Aluguel da casa",
  type: "expense",
  value: "800.00",
  frequency: "monthly",
  payment_method: "pix",
  is_active: true,
  day_of_month: 26,
  start_date: "2026-05-26",
  tags: [{ id: CATEGORY_ID, name: "Housing", is_active: true, tag_type: { id: "t1", name: "categoria" } }],
};

async function saveSeries() {
  const user = userEvent.setup();
  render(
    <NovaTransacaoModal
      open
      onClose={vi.fn()}
      onTransactionSaved={vi.fn()}
      isMobile={false}
      organizationId="org-1"
      dataMode="live"
      preConfig={buildEditRecurringPreConfig(mapRecurringSeriesToUi(series))}
    />,
  );
  await user.click(screen.getByRole("button", { name: /Revisar recorrência/i }));
  const confirmButtons = await screen.findAllByRole("button", { name: /Confirmar recorrência/i });
  await user.click(confirmButtons[confirmButtons.length - 1]);
}

describe("NovaTransacaoModal — erro ao salvar série recorrente (#291)", () => {
  it("conta desativada (detail objeto) mostra a mensagem do backend", async () => {
    const message = "A conta 'Nubank' está desativada. Reative-a ou escolha outra conta.";
    patchReply = () => HttpResponse.json({ detail: { code: "business_rule", message } }, { status: 422 });
    await saveSeries();
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("moeda diferente (detail string) continua chegando à tela", async () => {
    const message = "Moedas diferentes: a série precisa estar na moeda da conta.";
    patchReply = () => HttpResponse.json({ detail: message }, { status: 422 });
    await saveSeries();

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
