// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../api/tags", () => ({
  getSystemCategoryCatalog: vi.fn().mockResolvedValue({
    categories: [{
      system_key: "food_groceries",
      label: "Alimentação",
      icon_key: "shopping-cart",
      color: "#059669",
      allowed_transaction_types: ["expense"],
      is_onboarding_highlight: true,
      is_fallback: false,
      details: [{ system_key: "food_groceries_grocery", label: "Supermercado", icon_key: "shopping-basket" }],
    }],
  }),
}));

vi.mock("../../../../api/consultant", () => ({
  deleteConsultantCategoryTemplate: vi.fn(),
  listConsultantCategoryTemplates: vi.fn().mockResolvedValue([]),
  saveConsultantCategoryTemplate: vi.fn().mockResolvedValue({}),
}));

import { saveConsultantCategoryTemplate } from "../../../../api/consultant";
import { ConsultantCategoryTemplatesPanel } from "../ConsultantCategoryTemplatesPanel.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<ConsultantCategoryTemplatesPanel>", () => {
  it("persists a standard-category override and a new detail as a real custom tag", async () => {
    render(<ConsultantCategoryTemplatesPanel />);

    await screen.findByRole("button", { name: "Novo modelo" });
    fireEvent.click(screen.getByRole("button", { name: "Novo modelo" }));
    fireEvent.change(screen.getByLabelText("Nome do modelo"), { target: { value: "Modelo de teste" } });
    fireEvent.click(screen.getByRole("button", { name: "Configurar" }));

    fireEvent.change(screen.getByRole("textbox", { name: "Nome para o cliente" }), {
      target: { value: "Alimentação da família" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Etiqueta" }));
    const detailInputs = screen.getAllByRole("textbox", { name: "Nome da etiqueta" });
    fireEvent.change(detailInputs.at(-1), { target: { value: "Mercearia local" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar categoria" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar modelo" }));

    await waitFor(() => expect(saveConsultantCategoryTemplate).toHaveBeenCalledTimes(1));
    expect(saveConsultantCategoryTemplate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        name: "Modelo de teste",
        definition: expect.objectContaining({
          categories: [expect.objectContaining({
            system_key: "food_groceries",
            custom_name: "Alimentação da família",
            details: expect.arrayContaining([
              expect.objectContaining({ system_key: "food_groceries_grocery" }),
              expect.objectContaining({ name: "Mercearia local", icon_key: "tag" }),
            ]),
          })],
        }),
      }),
    );
    const payload = vi.mocked(saveConsultantCategoryTemplate).mock.calls[0][1];
    const addedDetail = payload.definition.categories.find((category) => category.system_key === "food_groceries").details.find((detail) => detail.name === "Mercearia local");
    expect(addedDetail).not.toHaveProperty("custom_name");
  });
});
