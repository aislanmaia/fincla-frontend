// @vitest-environment jsdom
// A ação à direita (o atalho "Conciliar extrato") encolhe e corta com "…"; a contagem nunca encolhe
// por causa dela (G3 achado 7). O jsdom não faz layout: o teste prende os estilos que garantem isso.
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { TransactionsListHeader } from "../TransactionsListHeader.jsx";

afterEach(cleanup);

const renderHeader = (action) =>
  render(
    <TransactionsListHeader total={12} totalUnfiltered={40} pending={3} sum={-120} fmt={(v) => String(v)}
      action={action} />,
  );

describe("TransactionsListHeader — ação longa", () => {
  it("com ação: o bloco da contagem não encolhe; o bloco da direita encolhe (minWidth 0) e a ação é a que cede", () => {
    renderHeader(<button type="button" style={{ flex: "0 1 auto", minWidth: 0 }}>Conciliar extrato da Conta Corrente Banco do Brasil Ag 1234</button>);
    const header = screen.getByTestId("transactions-list-header");
    const [countBlock, rightBlock] = header.children;
    expect(countBlock).toHaveTextContent(/12\s*de\s*40\s*transações/);
    expect(countBlock.style.flexShrink).toBe("0");
    expect(rightBlock.style.minWidth).toBe("0px");
    expect(rightBlock.style.flex).toBe("0 1 auto");
    expect(rightBlock).toContainElement(screen.getByRole("button", { name: /Conciliar extrato/ }));
  });

  it("sem ação: a contagem continua podendo encolher como antes (celular apertado)", () => {
    renderHeader(null);
    const [countBlock] = screen.getByTestId("transactions-list-header").children;
    expect(countBlock.style.flexShrink).not.toBe("0");
    expect(countBlock.style.minWidth).toBe("0px");
  });
});
