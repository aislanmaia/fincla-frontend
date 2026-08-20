/** @vitest-environment jsdom */

// fincla-frontend#105 — tooltips da tela de Transações ficavam presos no
// toque: nada além do próprio toque no gatilho fechava o tooltip, então
// vários ficavam abertos ao mesmo tempo e sobre o bottom sheet de Detalhes
// (prints do Owner). O componente `<Tip>` é puro (só precisa de `label` +
// `children`) e por isso é testado isolado aqui, sem montar a página inteira.
//
// Método: jsdom não faz layout nem toque de verdade (`getBoundingClientRect`
// devolve zeros e não há gesto físico) — por isso as provas verificam o
// COMPORTAMENTO observável (o tooltip sai/permanece fora do DOM ao disparar
// cada evento), nunca `getComputedStyle` nem posição em pixels.

import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Tip } from "../TransacoesPage.jsx";

afterEach(() => {
  cleanup();
});

function renderTip(label = "dica") {
  render(
    <Tip label={label}>
      <button type="button">alvo</button>
    </Tip>,
  );
  return screen.getByRole("button", { name: "alvo" });
}

describe("<Tip> — issue #105", () => {
  it("mostra o rótulo ao passar o mouse (hover) sobre o gatilho", () => {
    const trigger = renderTip();
    expect(screen.queryByText("dica")).not.toBeInTheDocument();
    fireEvent.mouseEnter(trigger);
    expect(screen.getByText("dica")).toBeInTheDocument();
  });

  it("toque no gatilho mostra o tooltip", () => {
    const trigger = renderTip();
    fireEvent.touchStart(trigger);
    expect(screen.getByText("dica")).toBeInTheDocument();
  });

  it("achado (a): toque/clique fora fecha o tooltip", () => {
    const trigger = renderTip();
    fireEvent.mouseEnter(trigger);
    expect(screen.getByText("dica")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("dica")).not.toBeInTheDocument();
  });

  it("achado (c): rolagem de qualquer região fecha o tooltip (não fica desalinhado)", () => {
    const trigger = renderTip();
    fireEvent.mouseEnter(trigger);
    expect(screen.getByText("dica")).toBeInTheDocument();

    // Captura no `window` — precisa fechar mesmo quando quem rola é um
    // container `.fincla-scroll` aninhado, que não borbulha `scroll` normal.
    const nested = document.createElement("div");
    document.body.appendChild(nested);
    fireEvent.scroll(nested);
    expect(screen.queryByText("dica")).not.toBeInTheDocument();
    nested.remove();
  });

  it("Escape fecha o tooltip", () => {
    const trigger = renderTip();
    fireEvent.mouseEnter(trigger);
    expect(screen.getByText("dica")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("dica")).not.toBeInTheDocument();
  });

  it("achado (b): abrir um segundo tooltip fecha o primeiro — nunca dois ao mesmo tempo", () => {
    render(
      <>
        <Tip label="dica-1">
          <button type="button">alvo-1</button>
        </Tip>
        <Tip label="dica-2">
          <button type="button">alvo-2</button>
        </Tip>
      </>,
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "alvo-1" }));
    expect(screen.getByText("dica-1")).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "alvo-2" }));
    expect(screen.getByText("dica-2")).toBeInTheDocument();
    expect(screen.queryByText("dica-1")).not.toBeInTheDocument();
  });

  it("2º toque no MESMO gatilho fecha (toggle) — pointerdown no próprio gatilho não interfere", () => {
    const trigger = renderTip();
    fireEvent.touchStart(trigger);
    expect(screen.getByText("dica")).toBeInTheDocument();

    // Sequência real do navegador para um toque: `pointerdown` (fase de
    // captura) dispara antes de `touchstart` (handler local do gatilho). O
    // listener global ignora pointerdown DENTRO do próprio gatilho de
    // propósito — é o toggle local que decide; se o listener global fechasse
    // aqui, o toggle local leria `rect` já nulo e reabriria no mesmo gesto.
    fireEvent.pointerDown(trigger);
    fireEvent.touchStart(trigger);
    expect(screen.queryByText("dica")).not.toBeInTheDocument();
  });

  it("pointerdown fora do gatilho fecha mesmo sem passar por touchstart (clique de mouse)", () => {
    const trigger = renderTip();
    fireEvent.mouseEnter(trigger);
    expect(screen.getByText("dica")).toBeInTheDocument();

    const other = document.createElement("button");
    document.body.appendChild(other);
    fireEvent.pointerDown(other);
    expect(screen.queryByText("dica")).not.toBeInTheDocument();
    other.remove();
  });

  it("achado (d): zIndex fica abaixo dos sheets/modais da página (400+)", () => {
    const trigger = renderTip();
    fireEvent.mouseEnter(trigger);
    const tooltip = screen.getByText("dica");
    expect(Number(tooltip.style.zIndex)).toBeLessThan(400);
  });

  it("mouseLeave continua fechando (hover normal de desktop)", () => {
    const trigger = renderTip();
    fireEvent.mouseEnter(trigger);
    expect(screen.getByText("dica")).toBeInTheDocument();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByText("dica")).not.toBeInTheDocument();
  });
});
