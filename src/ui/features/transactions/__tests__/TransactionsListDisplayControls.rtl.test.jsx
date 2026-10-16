/** @vitest-environment jsdom */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionsListDisplayControls } from "../TransactionsListDisplayControls.jsx";

afterEach(cleanup);

const setup = (props = {}) => render(<TransactionsListDisplayControls density="padrao" grouped canGroup onDensityChange={vi.fn()} onGroupChange={vi.fn()} onCollapseAll={vi.fn()} onExpandAll={vi.fn()} {...props} />);

describe("TransactionsListDisplayControls · teclado do menu", () => {
  it("abrir leva o foco ao item marcado e as setas percorrem os itens em círculo", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /Densidade da lista/ }));
    expect(screen.getByRole("menuitemradio", { name: "Padrão" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("menuitemradio", { name: "Compacto" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("menuitemradio", { name: "Confortável" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("menuitemradio", { name: "Compacto" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("menuitemradio", { name: "Confortável" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitemradio", { name: "Compacto" })).toHaveFocus();
  });

  it("no menu de agrupamento as setas para baixo e para cima passam pelas ações dos dias", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /Agrupamento da lista/ }));
    const items = [...screen.getAllByRole("menuitemradio"), ...screen.getAllByRole("menuitem")];
    expect(items.length).toBeGreaterThan(2);
    expect(document.activeElement).toBe(items.find((item) => item.getAttribute("aria-checked") === "true"));
    await user.keyboard("{End}");
    expect(items.at(-1)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(items.at(-1)).toHaveFocus();
  });

  it("Escape fecha o menu e devolve o foco ao botão", async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole("button", { name: /Densidade da lista/ });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
