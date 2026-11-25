// G3-P-11 — `listTransactionsForUi` não ignora `page` em silêncio quando o
// `limit` passa do teto do servidor (100): antes, `page: 2, limit: 250`
// devolvia a página 1.
import { afterEach, describe, expect, it, vi } from "vitest";
import { listTransactions } from "../../../api/transactions";
import { listTransactionsForUi } from "../transactionsAdapter.js";

vi.mock("../../../api/transactions", async (importOriginal) => ({
  ...(await importOriginal()),
  listTransactions: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

function page(n, size, total) {
  return {
    data: Array.from({ length: size }, (_, i) => ({ id: (n - 1) * size + i + 1 })),
    pagination: { page: n, limit: size, total, has_next: n * size < total },
  };
}

describe("listTransactionsForUi — limit acima do teto", () => {
  it("page > 1 com limit > 100 é recusado, sem nenhum pedido", async () => {
    await expect(listTransactionsForUi({ organization_id: "o", page: 2, limit: 250 })).rejects.toThrow(/page 1/);
    expect(listTransactions).not.toHaveBeenCalled();
  });

  it("page 1 com limit > 100 junta lotes de 100", async () => {
    listTransactions.mockImplementation(async (q) => page(q.page, 100, 300));
    const res = await listTransactionsForUi({ organization_id: "o", page: 1, limit: 250 });
    expect(res.data).toHaveLength(250);
    expect(listTransactions.mock.calls.map(([q]) => [q.page, q.limit])).toEqual([[1, 100], [2, 100], [3, 100]]);
  });

  it("até 100, a página pedida vai como está e o sinal de cancelamento viaja junto", async () => {
    listTransactions.mockResolvedValue(page(3, 20, 100));
    const controller = new AbortController();
    await listTransactionsForUi({ organization_id: "o", page: 3, limit: 20 }, { signal: controller.signal });
    expect(listTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, limit: 20 }),
      { signal: controller.signal },
    );
  });
});
