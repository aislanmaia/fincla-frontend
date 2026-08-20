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
 *
 * Achados da revisão adversarial (PR #95) endereçados aqui:
 * - #1/#5: o cenário "cria e seleciona" agora sempre parte de uma lista com
 *   um cartão PRÉ-EXISTENTE — se a seleção explícita do cartão novo for
 *   removida do componente, o fallback da auto-seleção escolhe o cartão
 *   antigo (primeiro da lista), e a asserção reprova. Um teste dedicado
 *   também cobre `preConfig.cartaoId`, que é onde o achado 1 mora de fato
 *   (o efeito de auto-seleção forçava esse id de volta a cada recarga da
 *   lista, desfazendo a seleção do quick-add).
 * - #2: teste dedicado para POST ok + GET de recarga falho — a mensagem não
 *   pode aparecer como falha de criação.
 * - #4: teste dedicado para modo não-live — o quick-add avisa em vez de
 *   ficar com um formulário morto.
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
const SELECTED_BG = "rgb(15, 15, 13)"; // T.ink

/** Cartões já cadastrados na "API" (mutável por teste, começa vazia). */
let cardsInApi;

function apiCard(overrides) {
  return {
    id: 1,
    organization_id: ORG_ID,
    last4: "0000",
    brand: "Mastercard",
    description: "Cartão Antigo",
    credit_limit: 1000,
    due_day: 5,
    closing_day: null,
    available_limit: 1000,
    used_limit: 0,
    limit_usage_percent: 0,
    ...overrides,
  };
}

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

function renderDrawer(props = {}) {
  return render(
    <NovaTransacaoModal
      open
      onClose={vi.fn()}
      onTransactionSaved={vi.fn()}
      isMobile={false}
      organizationId={ORG_ID}
      dataMode="live"
      {...props}
    />,
  );
}

/** Abre o painel lateral "Cartão de crédito" e espera a lista inicial carregar. */
async function openCardPanel(user) {
  const creditoBtn = await screen.findByRole("button", { name: "Crédito" });
  await user.click(creditoBtn);
  // Só aparece depois que o GET inicial (mesmo que vazio) resolve.
  return screen.findByText(/Novo cartão/i);
}

/** Preenche os 3 campos hoje obrigatórios do mini-form (nome, 4 dígitos, vencimento). */
async function fillQuickAddForm(user, { name, last4, dueDay }) {
  await user.type(
    screen.getByPlaceholderText("Nome (ex: Nubank Roxinho)"),
    name,
  );
  await user.type(screen.getByPlaceholderText("4 últimos dígitos"), last4);
  await user.type(
    screen.getByPlaceholderText("Dia do vencimento (1-31)"),
    dueDay,
  );
}

describe("NovaTransacaoModal — quick-add de cartão no drawer (issue #79)", () => {
  it("cria o cartão via API, recarrega a lista e seleciona o cartão novo (não o mais antigo)", async () => {
    const user = userEvent.setup();
    // Lista começa com UM cartão já existente: se a seleção explícita do
    // cartão recém-criado for removida, o fallback da auto-seleção
    // (`realIds[0]`) escolhe ESTE cartão antigo, não o novo — é assim que
    // este teste reprova a regressão que a revisão apontou (achado #5).
    cardsInApi = [apiCard({ id: 1, description: "Cartão Antigo" })];

    renderDrawer();

    await openCardPanel(user);
    await user.click(screen.getByText(/Novo cartão/i));
    await fillQuickAddForm(user, {
      name: "Nubank Roxinho",
      last4: "4321",
      dueDay: "10",
    });

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
          due_day: 10,
          description: "Nubank Roxinho",
        }),
      );
    });

    // Efeito 2: a lista de cartões foi recarregada (2º GET /credit-cards)
    // e o cartão novo aparece no picker, ao lado do antigo.
    await screen.findByText("Nubank Roxinho");
    const creditCardGets = apiClient.get.mock.calls.filter(
      ([url]) => url === "/credit-cards",
    );
    expect(creditCardGets.length).toBeGreaterThanOrEqual(2);

    // Efeito 3: o formulário de quick-add fechou.
    expect(
      screen.queryByPlaceholderText("Nome (ex: Nubank Roxinho)"),
    ).not.toBeInTheDocument();

    // Efeito 4: o cartão NOVO fica selecionado — e o antigo não.
    await waitFor(() => {
      expect(screen.getByText("Nubank Roxinho").parentElement.style.background).toBe(
        SELECTED_BG,
      );
    });
    expect(screen.getByText("Cartão Antigo").parentElement.style.background).not.toBe(
      SELECTED_BG,
    );
  }, 15000);

  it("preConfig.cartaoId não rouba a seleção de volta depois que o quick-add cria outro cartão (achado 1)", async () => {
    const user = userEvent.setup();
    cardsInApi = [apiCard({ id: 1, description: "Cartão Antigo" })];

    renderDrawer({ preConfig: { method: "credito", cartaoId: 1 } });

    // O painel de cartão já abre sozinho (preConfig.method === "credito"),
    // com o cartão do preConfig pré-selecionado.
    const oldTile = await screen.findByText("Cartão Antigo");
    await waitFor(() => {
      expect(oldTile.parentElement.style.background).toBe(SELECTED_BG);
    });

    await user.click(screen.getByText(/Novo cartão/i));
    await fillQuickAddForm(user, {
      name: "Nubank Roxinho",
      last4: "4321",
      dueDay: "10",
    });
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/credit-cards",
        expect.objectContaining({ description: "Nubank Roxinho" }),
      );
    });

    // O cartão recém-criado fica selecionado...
    await waitFor(() => {
      expect(
        screen.getByText("Nubank Roxinho").parentElement.style.background,
      ).toBe(SELECTED_BG);
    });
    // ...e o efeito de auto-seleção do preConfig.cartaoId NÃO reverte a
    // escolha de volta pro cartão antigo (era exatamente esse o bug: a
    // recarga da lista após o quick-add reacionava `want` e forçava o
    // cartão do preConfig de volta, sem aviso nenhum).
    expect(
      screen.getByText("Cartão Antigo").parentElement.style.background,
    ).not.toBe(SELECTED_BG);
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
    await user.click(screen.getByText(/Novo cartão/i));
    await fillQuickAddForm(user, {
      name: "Cartão Duplicado",
      last4: "9999",
      dueDay: "12",
    });

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

  it("POST cria o cartão mas a recarga da lista falha — não vira erro de criação, não convida a duplicar, e NÃO derruba a lista (achado 2, e achado 1 da 2ª rodada)", async () => {
    const user = userEvent.setup();
    // Cartão pré-existente: prova que a lista continua visível depois do
    // aviso de recarga falha — na 1ª correção, o aviso ia pra
    // `modalCardsError`, que no JSX é a ALTERNATIVA à lista (loading ? … :
    // erro ? … : cards.map(…)). Preencher esse slot apagava a lista
    // inteira (cartões existentes + "+ Novo cartão") pelo resto da sessão.
    cardsInApi = [apiCard({ id: 1, description: "Cartão Antigo" })];
    let creditCardGetCalls = 0;
    apiClient.get.mockImplementation((url) => {
      if (url === "/credit-cards") {
        creditCardGetCalls += 1;
        // 1ª chamada (fetch inicial) funciona; a recarga pós-criação falha.
        if (creditCardGetCalls === 1) {
          return Promise.resolve({ data: cardsInApi });
        }
        return Promise.reject({
          isAxiosError: true,
          response: { status: 500, data: {} },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderDrawer();

    await openCardPanel(user);
    await user.click(screen.getByText(/Novo cartão/i));
    await fillQuickAddForm(user, {
      name: "Nubank Roxinho",
      last4: "4321",
      dueDay: "10",
    });
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    // O cartão FOI criado — o POST saiu.
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/credit-cards",
        expect.objectContaining({ description: "Nubank Roxinho" }),
      );
    });

    // A falha é só de RECARGA: o formulário fecha normalmente (não fica
    // preso mostrando "criação falhou", o que convidaria o usuário a
    // clicar "Adicionar" de novo e criar um cartão duplicado).
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("Nome (ex: Nubank Roxinho)"),
      ).not.toBeInTheDocument();
    });

    // O aviso aparece — mas convivendo com a lista, não no lugar dela.
    await screen.findByText(/Cartão criado, mas não foi possível atualizar a lista/);
    expect(screen.getByText("Cartão Antigo")).toBeInTheDocument();
    expect(screen.getByText(/Novo cartão/i)).toBeInTheDocument();
  }, 15000);

  it("modo não-live: quick-add avisa que está indisponível em vez de um formulário morto (achado 4)", async () => {
    const user = userEvent.setup();
    renderDrawer({ dataMode: "mock" });

    await openCardPanel(user);
    await user.click(screen.getByText(/Novo cartão/i));

    await screen.findByText(
      "Cadastro de cartão indisponível no modo demonstração.",
    );
    // Sem formulário morto: nem os campos aparecem, nem dá pra clicar
    // "Adicionar" sem fazer nada.
    expect(
      screen.queryByPlaceholderText("Nome (ex: Nubank Roxinho)"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Adicionar" }),
    ).not.toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalledWith(
      "/credit-cards",
      expect.anything(),
    );
  }, 15000);

  it("erro de cartão duplicado (400, corpo real {error,message,type} do backend) aparece em PT-BR (achado 3 da 2ª rodada)", async () => {
    const user = userEvent.setup();
    apiClient.post.mockImplementation((url) => {
      if (url === "/credit-cards") {
        // Forma real: RegisterCreditCardUseCase._check_uniqueness (fincla-api)
        // levanta InvalidCreditCardError com mensagem em inglês interpolada;
        // map_domain_error_to_http devolve 400 via DomainErrorHTTPException,
        // que o FastAPI serializa como `{"detail": {error, message, type}}`
        // (o `HTTPException(detail=...)` sempre vai dentro de "detail" no
        // corpo JSON) — NÃO o envelope "safe error" traduzido, e NÃO 422 (a
        // doc está desatualizada nisso). Sem tradução própria, essa frase em
        // inglês vazava pra tela através do caminho `isLegacyError`.
        return Promise.reject({
          isAxiosError: true,
          response: {
            status: 400,
            data: {
              detail: {
                error: "DOMAIN_VALIDATION_ERROR",
                message:
                  "Card with brand 'Visa' and last4 '4321' already exists in this organization",
                type: "domain_validation",
              },
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderDrawer();
    await openCardPanel(user);
    await user.click(screen.getByText(/Novo cartão/i));
    await fillQuickAddForm(user, {
      name: "Nubank Roxinho",
      last4: "4321",
      dueDay: "10",
    });
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    await screen.findByText(
      "Já existe um cartão com essa bandeira e esses 4 últimos dígitos nesta organização.",
    );
    expect(screen.queryByText(/Card with brand/i)).not.toBeInTheDocument();
  }, 15000);

  it("fechar e reabrir o drawer com um POST de criação em voo não deixa a sessão antiga vazar pra sessão nova (drawerSessionRef, achado 2 da 2ª rodada)", async () => {
    const user = userEvent.setup();
    let resolvePost;
    const pendingPost = new Promise((resolve) => {
      resolvePost = resolve;
    });
    apiClient.post.mockImplementation((url, body) => {
      if (url === "/credit-cards") {
        return pendingPost.then(() => {
          const created = {
            id: 999,
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
          return { data: created, status: 201 };
        });
      }
      return Promise.resolve({ data: {} });
    });

    const { rerender } = renderDrawer();
    await openCardPanel(user);
    await user.click(screen.getByText(/Novo cartão/i));
    await fillQuickAddForm(user, {
      name: "Sessão Velha",
      last4: "1111",
      dueDay: "10",
    });
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    // Confirma que ficou em voo antes de fechar.
    await screen.findByRole("button", { name: "Adicionando…" });

    // Fecha o drawer (o pai zera `open`) com o POST ainda pendente.
    rerender(
      <NovaTransacaoModal
        open={false}
        onClose={vi.fn()}
        onTransactionSaved={vi.fn()}
        isMobile={false}
        organizationId={ORG_ID}
        dataMode="live"
      />,
    );
    // Sessão nova sem preferências herdadas — determinístico (método
    // "credito" persistido na sessão anterior não deve vazar pra cá).
    localStorage.clear();
    rerender(
      <NovaTransacaoModal
        open
        onClose={vi.fn()}
        onTransactionSaved={vi.fn()}
        isMobile={false}
        organizationId={ORG_ID}
        dataMode="live"
      />,
    );
    await openCardPanel(user); // painel próprio da sessão nova

    // Só agora o POST da sessão antiga resolve.
    resolvePost();
    await waitFor(() => {
      expect(cardsInApi.some((c) => c.description === "Sessão Velha")).toBe(true);
    });
    // Dá tempo pro then/await do handleQuickAddCard antigo processar, caso
    // a guarda de sessão não funcione.
    await new Promise((resolve) => setTimeout(resolve, 100));

    // A sessão nova não viu nada da sessão antiga.
    expect(screen.queryByText("Sessão Velha")).not.toBeInTheDocument();
  }, 15000);

  it("trocar de preConfig com o drawer ABERTO e um POST em voo não deixa o setCardId tardio sobrescrever o formulário já resetado (achado 4 da 2ª rodada)", async () => {
    const user = userEvent.setup();
    cardsInApi = [apiCard({ id: 1, description: "Cartão Antigo" })];
    let resolvePost;
    const pendingPost = new Promise((resolve) => {
      resolvePost = resolve;
    });
    apiClient.post.mockImplementation((url, body) => {
      if (url === "/credit-cards") {
        return pendingPost.then(() => {
          const created = {
            id: 998,
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
          return { data: created, status: 201 };
        });
      }
      return Promise.resolve({ data: {} });
    });

    const { rerender } = renderDrawer({
      preConfig: { method: "credito", cartaoId: null },
    });
    // Painel já abre sozinho — preConfig.method === "credito".
    await screen.findByText(/Novo cartão/i);
    await user.click(screen.getByText(/Novo cartão/i));
    await fillQuickAddForm(user, {
      name: "Formulário Velho",
      last4: "2222",
      dueDay: "10",
    });
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await screen.findByRole("button", { name: "Adicionando…" });

    // Troca de preConfig com o drawer ainda ABERTO (`open` nunca vira
    // false) — dispara o reset do efeito de init-stamp por um caminho
    // diferente do fechar/reabrir. `cartaoId` muda de null pra 1, então o
    // stamp muda de verdade (senão o efeito nem re-executaria) e o painel
    // continua aberto (novo preConfig também é method: "credito"), então
    // se a guarda de sessão falhar, o `setModalityChoicealCardsRows`
    // tardio aparece na tela ainda aberta.
    rerender(
      <NovaTransacaoModal
        open
        onClose={vi.fn()}
        onTransactionSaved={vi.fn()}
        isMobile={false}
        organizationId={ORG_ID}
        dataMode="live"
        preConfig={{ method: "credito", cartaoId: 1 }}
      />,
    );

    resolvePost();
    await waitFor(() => {
      expect(cardsInApi.some((c) => c.description === "Formulário Velho")).toBe(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // O formulário resetado (novo preConfig) não foi reaberto/sobrescrito
    // pelo POST tardio da intenção anterior.
    expect(screen.queryByText("Formulário Velho")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Nome (ex: Nubank Roxinho)"),
    ).not.toBeInTheDocument();
  }, 15000);

  it("recarga da lista falha PERSISTENTEMENTE após criar: a seleção do cartão novo continua protegida mesmo depois de outro gatilho do efeito de auto-seleção (achado 1 da 3ª rodada)", async () => {
    const user = userEvent.setup();
    // Cartão pré-existente: é pra ELE que a seleção reverteria em silêncio
    // se a trava (`pendingQuickAddCardIdRef`) fosse liberada cedo demais.
    cardsInApi = [apiCard({ id: 1, description: "Cartão Antigo" })];
    let creditCardGetCalls = 0;
    apiClient.get.mockImplementation((url) => {
      if (url === "/credit-cards") {
        creditCardGetCalls += 1;
        // 1ª chamada (fetch inicial) funciona; TODAS as recargas seguintes
        // falham — diferente do teste do achado 2 da 2ª rodada (que só
        // falha uma vez), aqui a lista nunca chega a confirmar o cartão
        // novo, então a trava tem de segurar indefinidamente.
        if (creditCardGetCalls === 1) {
          return Promise.resolve({ data: cardsInApi });
        }
        return Promise.reject({
          isAxiosError: true,
          response: { status: 500, data: {} },
        });
      }
      return Promise.resolve({ data: {} });
    });

    renderDrawer();
    await openCardPanel(user);
    await user.click(screen.getByText(/Novo cartão/i));
    await fillQuickAddForm(user, {
      name: "Nubank Roxinho",
      last4: "4321",
      dueDay: "10",
    });
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/credit-cards",
        expect.objectContaining({ description: "Nubank Roxinho" }),
      );
    });
    await screen.findByText(/Cartão criado, mas não foi possível atualizar a lista/);

    // Troca de forma de pagamento e volta pra "Crédito" — dispara o efeito
    // de auto-seleção de novo (é exatamente o tipo de gatilho que o achado
    // citou: "trocar Débito→Crédito, ou o pai mudar preConfig.cartaoId").
    // A lista continua sem o cartão novo (a recarga segue falhando).
    await user.click(screen.getByRole("button", { name: "Débito" }));
    await user.click(screen.getByRole("button", { name: "Crédito" }));

    // Se a trava tivesse sido liberada cedo demais, o efeito de
    // auto-seleção acharia `cardId` "inválido" (não está em `realIds`,
    // que só tem o cartão antigo) e cairia pro fallback `realIds[0]` —
    // selecionando "Cartão Antigo" em silêncio, mesmo a transação real
    // devendo ir pro cartão recém-criado.
    expect(screen.getByText("Cartão Antigo").parentElement.style.background).not.toBe(
      SELECTED_BG,
    );
  }, 15000);
});
