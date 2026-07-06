/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

function categoryRow() {
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
  };
}

function detailRow(id, name) {
  return {
    id,
    name,
    color: null,
    is_default: false,
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
