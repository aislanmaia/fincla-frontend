// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KebabMenu } from "../KebabMenu.jsx";

afterEach(() => cleanup());

function makeItems(onSelect = vi.fn()) {
  return [
    { key: "a", label: "Ação A", onSelect },
    { key: "b", label: "Ação B", disabled: true, badge: "em breve" },
  ];
}

describe("KebabMenu", () => {
  it("abre no clique e renderiza os itens (com badge)", () => {
    render(<KebabMenu ariaLabel="Ações do item" items={makeItems()} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ações do item" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /Ação A/ })).toBeInTheDocument();
    expect(within(menu).getByText("em breve")).toBeInTheDocument();
  });

  it("item ativo chama onSelect e fecha; item desabilitado não age", () => {
    const onSelect = vi.fn();
    render(<KebabMenu ariaLabel="Ações do item" items={makeItems(onSelect)} />);
    fireEvent.click(screen.getByRole("button", { name: "Ações do item" }));

    const disabled = screen.getByRole("menuitem", { name: /Ação B/ });
    expect(disabled).toBeDisabled();
    fireEvent.click(disabled);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /Ação A/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("fecha no Escape", () => {
    render(<KebabMenu ariaLabel="Ações do item" items={makeItems()} />);
    fireEvent.click(screen.getByRole("button", { name: "Ações do item" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("fecha ao clicar fora (pointerdown fora do menu e do gatilho)", () => {
    render(
      <div>
        <span data-testid="outside">fora</span>
        <KebabMenu ariaLabel="Ações do item" items={makeItems()} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ações do item" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("aria-expanded reflete o estado e o toggle fecha", () => {
    render(<KebabMenu ariaLabel="Ações do item" items={makeItems()} />);
    const trigger = screen.getByRole("button", { name: "Ações do item" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("triggerStyle é mesclado sobre o padrão; triggerTestId, testId do item e o ponto aparecem", () => {
    render(
      <KebabMenu
        ariaLabel="Mais"
        items={[{ key: "a", label: "Ação A", testId: "item-a" }]}
        triggerStyle={{ width: 40 }}
        triggerTestId="more"
        triggerDot
      />,
    );
    const trigger = screen.getByTestId("more");
    expect(trigger.style.width).toBe("40px");
    expect(trigger.style.cursor).toBe("pointer");
    expect(screen.getByTestId("kebab-dot")).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByTestId("item-a")).toHaveTextContent("Ação A");
  });

  it("sem triggerDot não há ponto", () => {
    render(<KebabMenu ariaLabel="Mais" items={makeItems()} />);
    expect(screen.queryByTestId("kebab-dot")).toBeNull();
  });
});
