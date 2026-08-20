/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CategoriesTagsSettingsPanel } from "./CategoriesTagsSettingsPanel.jsx";
import * as tagsApi from "../../../api/tags";

vi.mock("../../../api/tags", () => ({
  createTag: vi.fn(),
  deleteTag: vi.fn(),
  listTags: vi.fn(),
  listTagTypes: vi.fn(),
  updateTag: vi.fn(),
}));

const ORG = "org-1";
const CATEGORY_ID = "cat-1";

function categoryRow(over = {}) {
  return {
    id: CATEGORY_ID,
    name: "Doações e Presentes",
    color: "#2563EB",
    is_default: false,
    is_active: true,
    organization_id: ORG,
    sort_order: 0,
    is_onboarding_highlight: false,
    icon_key: null,
    parent_category_tag_id: null,
    tag_type: {
      id: "tt-cat",
      name: "categoria",
      description: null,
      is_required: false,
      max_per_transaction: null,
    },
    ...over,
  };
}

function detailRow(id, name, isDefault = false) {
  return {
    id,
    name,
    color: null,
    is_default: isDefault,
    is_active: true,
    organization_id: ORG,
    sort_order: 0,
    is_onboarding_highlight: false,
    icon_key: null,
    parent_category_tag_id: CATEGORY_ID,
    tag_type: {
      id: "tt-det",
      name: "detalhe",
      description: null,
      is_required: false,
      max_per_transaction: null,
    },
  };
}

function renderPanel() {
  return render(
    <CategoriesTagsSettingsPanel
      dataMode="live"
      organizationId={ORG}
      SectionCard={({ children }) => <section>{children}</section>}
    />,
  );
}

describe("CategoriesTagsSettingsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    const details = [];

    vi.mocked(tagsApi.listTags).mockImplementation(async (_orgId, tagType) => ({
      tags: tagType === "categoria" ? [categoryRow()] : details,
    }));

    vi.mocked(tagsApi.listTagTypes).mockResolvedValue({
      tag_types: [
        {
          id: "tt-cat",
          name: "categoria",
          description: null,
          is_required: false,
          max_per_transaction: null,
        },
        {
          id: "tt-det",
          name: "detalhe",
          description: null,
          is_required: false,
          max_per_transaction: null,
        },
      ],
    });

    vi.mocked(tagsApi.createTag).mockImplementation(async (_orgId, payload) => {
      const created = detailRow(`det-${details.length + 1}`, payload.name);
      details.push(created);
      return created;
    });
  });

  it("cria uma tag detalhe via Enter e recarrega a categoria com a tag persistida", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      await screen.findByRole("button", { name: /Expandir tags de Doações e Presentes/i }),
    );

    const input = screen.getByLabelText(/Nova tag de Doações e Presentes/i);
    await user.type(input, "Presente especial{enter}");

    await waitFor(() => {
      expect(tagsApi.createTag).toHaveBeenCalledWith(ORG, {
        name: "presente-especial",
        tag_type_id: "tt-det",
        parent_category_tag_id: CATEGORY_ID,
      });
    });

    expect(await screen.findByText("#presente-especial")).toBeInTheDocument();
  });

  it("cria uma tag detalhe via botão + Tag", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      await screen.findByRole("button", { name: /Expandir tags de Doações e Presentes/i }),
    );

    await user.type(
      await screen.findByLabelText(/Nova tag de Doações e Presentes/i),
      "Pix solidário",
    );
    await user.click(screen.getByRole("button", { name: /\+ Tag/i }));

    await waitFor(() => {
      expect(tagsApi.createTag).toHaveBeenCalledWith(ORG, {
        name: "pix-solidário",
        tag_type_id: "tt-det",
        parent_category_tag_id: CATEGORY_ID,
      });
    });

    expect(await screen.findByText("#pix-solidário")).toBeInTheDocument();
  });
});

describe("CategoriesTagsSettingsPanel — categoria/tag do seed em inglês (regressão #77)", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Payload real de `GET /tags?tag_type=categoria|detalhe`: o seed
    // (fincla-api/seed_default_tags.py) cria essas linhas em inglês pra toda
    // organização nova — não é um fixture PT já traduzido como nos testes acima.
    vi.mocked(tagsApi.listTags).mockImplementation(async (_orgId, tagType) => ({
      tags:
        tagType === "categoria"
          ? [categoryRow({ name: "Food & Groceries", icon_key: "shopping-cart", is_default: true })]
          : [detailRow("det-grocery", "grocery", true)],
    }));

    vi.mocked(tagsApi.listTagTypes).mockResolvedValue({
      tag_types: [
        { id: "tt-cat", name: "categoria", description: null, is_required: false, max_per_transaction: null },
        { id: "tt-det", name: "detalhe", description: null, is_required: false, max_per_transaction: null },
      ],
    });
  });

  /**
   * O estado inicial (`DEFAULT_CATEGORIES`, mock) já tem uma categoria chamada
   * "Alimentação" — mesmo nome PT que o seed traduzido também produz. Um
   * `findByRole` ingênuo pode pegar o botão do mock antes do fetch (`GET
   * /tags?tag_type=categoria`) substituir `cats` pela linha real, clicando
   * numa categoria que já não existe mais na lista → o painel nunca expande.
   * Espera a lista assentar em exatamente 1 categoria (a fetchada) primeiro.
   */
  async function waitForSingleFetchedCategory() {
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Expandir tags de/i })).toHaveLength(1);
    });
    return screen.getByRole("button", { name: /Expandir tags de Alimentação/i });
  }

  it("mostra a categoria traduzida em PT-BR, nunca o nome cru do seed", async () => {
    renderPanel();

    await waitForSingleFetchedCategory();
    expect(screen.getByText("Alimentação")).toBeInTheDocument();
    expect(screen.queryByText("Food & Groceries")).not.toBeInTheDocument();
  });

  it("mostra a tag detalhe traduzida ao expandir a categoria, nunca o slug cru do seed", async () => {
    renderPanel();

    const expandBtn = await waitForSingleFetchedCategory();
    // `fireEvent` (não `userEvent`) aqui: é um clique simples num botão sem
    // teclado/hover envolvidos, e evita o mesmo tipo de flake de timers reais
    // já conhecido neste arquivo sob carga (ver testes "cria uma tag detalhe").
    fireEvent.click(expandBtn);

    expect(await screen.findByText("#mercado")).toBeInTheDocument();
    expect(screen.queryByText("#grocery")).not.toBeInTheDocument();
  });

  // Regressão do review adversarial da PR #97 (rodada 2, prioridade 5): antes
  // digitar o rótulo PT que já é a tradução da tag seed virava um beco sem
  // saída (sem request, sem erro, sem limpar o input). Agora não duplica MAS
  // também limpa o campo — não pode ficar sem feedback nenhum.
  it("não cria tag duplicada ao digitar o rótulo PT que já é a tradução da tag seed, e limpa o input", async () => {
    renderPanel();

    const expandBtn = await waitForSingleFetchedCategory();
    fireEvent.click(expandBtn);
    await screen.findByText("#mercado");

    const input = screen.getByLabelText(/Nova tag de Alimentação/i);
    fireEvent.change(input, { target: { value: "mercado" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(tagsApi.createTag).not.toHaveBeenCalled();
    // Continua só um chip "#mercado" — não vira dois.
    expect(screen.getAllByText("#mercado")).toHaveLength(1);
    // Não é beco sem saída: o campo limpa mesmo sem criar nada.
    expect(input).toHaveValue("");
  });

  // Regressão do review adversarial da PR #97: o lápis pré-preenchia o input
  // com o nome cru em inglês, mismatch ao lado da linha que mostra "Alimentação".
  it("o lápis pré-preenche o input de edição com o rótulo PT exibido, não o nome cru", async () => {
    renderPanel();

    await waitForSingleFetchedCategory();
    const editBtn = screen.getByRole("button", { name: /Editar categoria Alimentação/i });
    fireEvent.click(editBtn);

    expect(screen.getByLabelText(/Editar categoria Alimentação/i)).toHaveValue("Alimentação");
  });

  // Regressão GRAVE do review adversarial da PR #97 (rodada 2, prioridade 1):
  // editar só a COR (sem tocar no nome) não pode reescrever o nome canônico
  // do seed pro rótulo PT traduzido no banco. Comprovado por sonda: abrir o
  // lápis e clicar OK sem digitar nada mandava PATCH {"name":"Alimentação"}.
  it("editar só a cor NÃO reescreve o nome canônico do seed no PATCH", async () => {
    renderPanel();

    await waitForSingleFetchedCategory();
    fireEvent.click(screen.getByRole("button", { name: /Editar categoria Alimentação/i }));
    // Não mexe no nome — só clica em OK (fluxo "só quero trocar a cor").
    fireEvent.click(screen.getByRole("button", { name: /^OK$/i }));

    await waitFor(() => {
      expect(tagsApi.updateTag).toHaveBeenCalledWith(
        CATEGORY_ID,
        expect.objectContaining({ name: "Food & Groceries" }),
      );
    });
  });

  // Mesma prioridade 1: se o usuário digitar um nome novo de verdade, isso
  // precisa ser respeitado e mandado como está (não voltar pro nome cru).
  it("renomear de propósito manda o texto digitado, não o nome cru", async () => {
    renderPanel();

    await waitForSingleFetchedCategory();
    fireEvent.click(screen.getByRole("button", { name: /Editar categoria Alimentação/i }));
    const nameInput = screen.getByLabelText(/Editar categoria Alimentação/i);
    fireEvent.change(nameInput, { target: { value: "Mercado do Zé" } });
    fireEvent.click(screen.getByRole("button", { name: /^OK$/i }));

    await waitFor(() => {
      expect(tagsApi.updateTag).toHaveBeenCalledWith(
        CATEGORY_ID,
        expect.objectContaining({ name: "Mercado do Zé" }),
      );
    });
  });
});

describe("CategoriesTagsSettingsPanel — categoria do usuário com nome igual a um canônico do seed (regressão review rodada 2, prioridade 2)", () => {
  afterEach(() => {
    cleanup();
  });

  const USER_RENDA_ID = "cat-renda-user";

  beforeEach(() => {
    vi.clearAllMocks();
    // Categoria criada pelo usuário, `is_default: false`, com o mesmo nome de
    // um canônico do seed ("Renda" → mapa PT tem "renda": "Receita").
    vi.mocked(tagsApi.listTags).mockImplementation(async (_orgId, tagType) => ({
      tags:
        tagType === "categoria"
          ? [categoryRow({ id: USER_RENDA_ID, name: "Renda", is_default: false, icon_key: null })]
          : [],
    }));
    vi.mocked(tagsApi.listTagTypes).mockResolvedValue({
      tag_types: [
        { id: "tt-cat", name: "categoria", description: null, is_required: false, max_per_transaction: null },
        { id: "tt-det", name: "detalhe", description: null, is_required: false, max_per_transaction: null },
      ],
    });
  });

  it("mostra 'Renda' como o usuário escreveu, não 'Receita' (mapa PT não sequestra tag do usuário)", async () => {
    renderPanel();

    await screen.findByRole("button", { name: /Expandir tags de Renda/i });
    expect(screen.getByText("Renda")).toBeInTheDocument();
    expect(screen.queryByText("Receita")).not.toBeInTheDocument();
  });
});
