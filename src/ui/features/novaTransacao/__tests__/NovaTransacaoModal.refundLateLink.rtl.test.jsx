// @vitest-environment jsdom
/**
 * Reabrir um estorno pra edição (deep-link ou "Abrir lançamento do estorno" na
 * fatura do cartão) hidrata o drawer em dois passos: `refundOfTransactionId`
 * chega de imediato, mas `refundLinkedTx` (a compra original) só depois de um
 * segundo fetch — o preConfig troca com o drawer já aberto. O reset de
 * hidratação do drawer só roda uma vez por sessão (carimbo que ignora
 * `refundLinkedTx` de propósito, pra não jogar fora edições em andamento), então
 * sem um caminho dedicado pra esse valor tardio o card "Estornando a compra"
 * ficava preso em "Qual a compra estornada?" mesmo com o vínculo já salvo.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/client", async () => {
  const actual = await vi.importActual("../../../api/client");
  return {
    ...actual,
    default: {
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({ data: {} }),
      patch: vi.fn().mockResolvedValue({ data: {} }),
      delete: vi.fn().mockResolvedValue({ data: {} }),
    },
  };
});

import { NovaTransacaoModal } from "../NovaTransacaoModal.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ORG_ID = "11111111-1111-4111-8111-111111111111";

function renderDrawer(preConfig) {
  return render(
    <NovaTransacaoModal
      open
      onClose={vi.fn()}
      onTransactionSaved={vi.fn()}
      isMobile={false}
      organizationId={ORG_ID}
      dataMode="live"
      preConfig={preConfig}
    />,
  );
}

describe("NovaTransacaoModal — vínculo tardio do estorno com a compra original", () => {
  it("aplica refundLinkedTx quando ele chega num preConfig posterior, com o drawer já aberto", async () => {
    const basePreConfig = {
      tipo: "despesa",
      isEstorno: true,
      refundOfTransactionId: 3933,
      desc: "Estorno contestação zoológico Rio de Janeiro",
      valorInicial: 296,
      editingTransactionId: 4070,
    };

    const { rerender } = renderDrawer(basePreConfig);

    // Passo 1: o toggle já mostra "estorno", mas a compra original ainda não chegou.
    expect(await screen.findByText("Lançando como estorno")).toBeInTheDocument();
    expect(
      screen.getByText("Qual a compra estornada? (opcional)"),
    ).toBeInTheDocument();

    // Passo 2: o fetch da compra original resolve e o pai manda um novo
    // preConfig com `refundLinkedTx` — mesmo objeto de sessão, só um campo a mais.
    rerender(
      <NovaTransacaoModal
        open
        onClose={vi.fn()}
        onTransactionSaved={vi.fn()}
        isMobile={false}
        organizationId={ORG_ID}
        dataMode="live"
        preConfig={{
          ...basePreConfig,
          refundLinkedTx: {
            id: 3933,
            desc: "zoologico rio de janeiro",
            dateLabel: "10/08/2026",
            val: 296,
            cat: "Lazer",
            categoryTagId: null,
            paymentMethodKey: "credito",
            cardId: 3,
          },
        }}
      />,
    );

    expect(await screen.findByText("zoologico rio de janeiro")).toBeInTheDocument();
    expect(screen.getByText("Estornando a compra")).toBeInTheDocument();
    expect(
      screen.queryByText("Qual a compra estornada? (opcional)"),
    ).not.toBeInTheDocument();
  });
});
