/** @vitest-environment jsdom */
// O trilho dos passos fica à vista ao rolar no computador (Owner, 2026-11-26); no celular rola junto.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StepRail, StickyTop } from "../ReconciliationFrame.jsx";

const STEPS = [{ key: "a", title: "Passo A" }, { key: "b", title: "Passo B" }];
const statusOf = () => ({ tone: "neutral", text: "Falta conferir" });

function Page({ touch }) {
  return (
    <div data-fincla-main-scroll style={{ paddingTop: 20 }}>
      <StickyTop><div>Diferença</div></StickyTop>
      <StepRail steps={STEPS} statusOf={statusOf} current="a" onOpen={() => {}} touch={touch} />
    </div>
  );
}

describe("StepRail", () => {
  afterEach(cleanup);

  it("no computador gruda logo abaixo do topo fixo", () => {
    render(<Page touch={false} />);
    const rail = screen.getByTestId("step-rail");

    expect(rail.style.position).toBe("sticky");
    expect(rail.style.top).toBe("var(--reconciliation-rail-top, 12px)");
    // O topo fixo publica onde o trilho gruda, descontando o padding do alto da área que rola.
    const scroller = rail.closest("[data-fincla-main-scroll]");
    expect(scroller.style.getPropertyValue("--reconciliation-rail-top")).toMatch(/^-?\d+(\.\d+)?px$/);
  });

  it("no celular rola junto com a lista", () => {
    render(<Page touch />);

    expect(screen.getByTestId("step-rail").style.position).toBe("");
  });
});
