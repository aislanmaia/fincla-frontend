// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DashboardPeriodSelector } from "../DashboardPeriodSelector.jsx";

afterEach(cleanup);

const props = {
  isMobile: false,
  presetId: "personalizado",
  onPresetChange: () => {},
  customStart: "2025-11-04",
  customEnd: "2026-11-04",
  onCustomDatesChange: () => {},
};

describe("DashboardPeriodSelector trigger", () => {
  it("shows the title and the date range by default", () => {
    render(<DashboardPeriodSelector {...props} />);
    const trigger = screen.getByRole("button", { expanded: false });
    expect(trigger).toHaveTextContent("Período personalizado");
    expect(trigger.textContent.length).toBeGreaterThan("Período personalizado".length);
  });

  it("compact mode keeps only the title, because the caller shows the range next to it", () => {
    render(<DashboardPeriodSelector {...props} compact />);
    const trigger = screen.getByRole("button", { expanded: false });
    expect(trigger.textContent).toBe("Período personalizado");
    expect(trigger.style.minHeight).toBe("32px");
  });
});
