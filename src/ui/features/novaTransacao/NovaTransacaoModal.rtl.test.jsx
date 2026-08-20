// @vitest-environment jsdom
/**
 * Issue #79 — o botão "Adicionar" do quick-add de cartão (drawer Nova
 * transação) só limpava o formulário; nunca chamava a API. Estes testes
 * renderizam o drawer de verdade (não mockam a função de criar cartão) e
 * afirmam o efeito observável: o POST sai com o payload certo, a lista de
 * cartões é recarregada e o cartão novo fica selecionado — ou, em erro da
 * API, a mensagem aparece em PT-BR e o formulário continua aberto.
 *
 * Mock único no limite de rede (`apiClient`): tudo que fica entre o clique
 * e o POST — `buildCreateCreditCardPayload`, `createCreditCardForUi`,
 * `listCreditCards`, `handleApiError` — roda de verdade.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/client", async () => {
  const actual = await vi.importActual("../../../api/client");
  return {
    ...actual,
    default: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import apiClient from "../../../api/client";
import { NovaTransacaoModal } from "./NovaTransacaoModal.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ORG_ID = "11111111-1111-4111-8111-111111111111";

/** Cartões já cadastrados na "API" (mutável por teste, começa vazia). */
let cardsInApi;

beforeEach(() => {
  cardsInApi = [];

  apiClient.get.mockImplementation((url) => {
    if (url === "/credit-cards") {
      return Promise.resolve({ data: cardsInApi });
    }
    // Qualquer outro GET (tags, balances, transactions/summary, etc.) —
    // os adapters do app tratam ausência de campo com `?? []` / `|| []`,
    // então um corpo vazio não quebra os outros hooks do drawer.
    return Promise.resolve({ data: {} });
  });

  apiClient.post.mockImplementation((url, body) => {
    if (url === "/credit-cards") {
      const created = {
        id: cardsInApi.length + 1,
        organization_id: body.organization_id,
        last4: body.last4,
        brand: body.brand,
        due_day: body.due_day,
        description: body.description,
        credit_limit: body.credit_limit,
        closing_day: body.closing_day,
        color: body.color,
        available_limit: null,
        used_limit: 0,
        limit_usage_percent: null,
      };
      cardsInApi = [...cardsInApi, created];
      return Promise.resolve({ data: created, status: 201 });
    }
    return Promise.resolve({ data: {} });
  });

  apiClient.patch.mockResolvedValue({ data: {} });
  apiClient.delete.mockResolvedValue({ data: {} });
});

function renderDrawer() {
  return render(
    <NovaTransacaoModal
      open
      onClose={vi.fn()}
      onTransactionSaved={vi.fn()}
      isMobile={false}
      organizationId={ORG_ID}
      dataMode="live"
    />,
  );
}

/** Abre o painel lateral "Cartão de crédito" e espera a lista inicial carregar. */
async function openCardPanel(user) {
  const creditoBtn = await screen.findByRole("button", { name: "Crédito" });
  await user.click(creditoBtn);
  // Só aparece depois que o GET inicial (mesmo que vazio) resolve.
  return screen.findByText(/Novo cart\u00e3o/i);
}

describe("NovaTransacaoModal — quick-add de cartão no drawer (issue #79)", () => {
  it("cria o cartão via API, recarrega a lista e seleciona o cartão novo", async () => {
    const user = userEvent.setup();
    renderDrawer();

    await openCardPanel(user);
    await user.click(screen.getByText(/Novo cart\u00e3o/i));

    await user.type(
      screen.getByPlaceholderText("Nome (ex: Nubank Roxinho)"),
      "Nubank Roxinho",
    );
    await user.type(screen.getByPlaceholderText("4 últimos dígitos"), "4321");

    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    // Efeito 1: a criação disparou o POST certo — payload compatível com o
    // contrato do backend (organization_id, last4, brand, due_day).
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/credit-cards",
        expect.objectContaining({
          organization_id: ORG_ID,
          last4: "4321",
          brand: "Visa",
          due_day: 1,
          description: "Nubank Roxinho",
        }),
      );
    });

    // Efeito 2: a lista de cartões foi recarregada (2º GET /credit-cards)
    // e o cartão novo aparece no picker.
    await screen.findByText("Nubank Roxinho");
    const creditCardGets = apiClient.get.mock.calls.filter(
      ([url]) => url === "/credit-cards",
    );
    expect(creditCardGets.length).toBeGreaterThanOrEqual(2);

    // Efeito 3: o formulário de quick-add fechou.
    expect(
      screen.queryByPlaceholderText("Nome (ex: Nubank Roxinho)"),
    ).not.toBeInTheDocument();

    // Efeito 4: o cartão novo fica selecionado (mesmo destaque visual dos
    // demais cartões — fundo T.ink, ver NovaTransacaoModal.jsx).
    const cardTile = screen.getByText("Nubank Roxinho").parentElement;
    expect(cardTile.style.background).toBe("rgb(15, 15, 13)");
    // Drawer inteiro + vários hooks de dados: renderiza mais devagar que um
    // componente isolado, por isso o timeout maior (ver ConsultantAddClientWizard).
  }, 15000);

  it("mostra o erro em PT-BR quando a API rejeita e mantém o formulário aberto", async () => {
    const user = userEvent.setup();
    apiClient.post.mockImplementation((url) => {
      if (url === "/credit-cards") {
        return Promise.reject({
          isAxiosError: true,
          response: { status: 422, data: {} },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderDrawer();

    await openCardPanel(user);
    await user.click(screen.getByText(/Novo cart\u00e3o/i));

    await user.type(
      screen.getByPlaceholderText("Nome (ex: Nubank Roxinho)"),
      "Cartão Duplicado",
    );
    await user.type(screen.getByPlaceholderText("4 últimos dígitos"), "9999");

    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    // Erro visível em PT-BR — nada de falha silenciosa.
    await screen.findByText(
      "Não foi possível concluir a operação. Verifique os dados e tente novamente.",
    );

    // O formulário continua aberto para o usuário tentar de novo, e o
    // cartão inexistente não aparece na lista.
    expect(
      screen.getByPlaceholderText("Nome (ex: Nubank Roxinho)"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Cartão Duplicado")).not.toBeInTheDocument();
  }, 15000);
});
