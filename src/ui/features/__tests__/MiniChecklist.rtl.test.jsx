// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MiniChecklist } from "../shellExtras.jsx";

// jsdom does no layout; the real check is a 390px browser screenshot (2/3 renders like 1/3: title on top,
// one item per line). This pins what makes it so: the item list needs 260px or it drops to its own line,
// instead of a bare flex:1 that let done items squeeze into a narrow column beside the title.
it("gives the first-steps items a 260px basis so they wrap below the title on a phone", () => {
  render(<MiniChecklist onboardingData={{}} completedTx completedBudget={false} onDismiss={vi.fn()} onNav={vi.fn()} />);
  const items = screen.getByTestId("first-steps-items");
  expect(items.style.flex).toBe("1 1 260px");
  expect(items.style.minWidth).toBe("0px");
  expect(screen.getByText("2/3")).toBeTruthy();
});
