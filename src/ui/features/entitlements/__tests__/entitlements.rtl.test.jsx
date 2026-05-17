// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

import {
  FeatureGate,
  PlanBadge,
  UpgradePrompt,
  UpgradeWall,
  useEntitlement,
} from "../index.js";

function _userWith(features) {
  return { subscription: { features } };
}

describe("useEntitlement", () => {
  it("returns true when the feature is in the user's plan", () => {
    expect(
      useEntitlement(
        "whatsapp_assistant",
        _userWith(["whatsapp_assistant", "manual_transactions"]),
      ),
    ).toBe(true);
  });

  it("returns false when the feature is absent", () => {
    expect(
      useEntitlement("advanced_reports", _userWith(["manual_transactions"])),
    ).toBe(false);
  });

  it("returns false when user is missing/null/undefined", () => {
    expect(useEntitlement("x", null)).toBe(false);
    expect(useEntitlement("x", undefined)).toBe(false);
    expect(useEntitlement("x", {})).toBe(false);
    expect(useEntitlement("x", { subscription: {} })).toBe(false);
    // Features as non-array (legacy/broken backend) → false, not crash.
    expect(
      useEntitlement("x", { subscription: { features: "not-array" } }),
    ).toBe(false);
  });

  it("returns false for empty feature key", () => {
    expect(useEntitlement("", _userWith(["x"]))).toBe(false);
  });
});

describe("<FeatureGate>", () => {
  it("renders children when feature present", () => {
    render(
      <FeatureGate feature="x" user={_userWith(["x"])}>
        <span>visible</span>
      </FeatureGate>,
    );
    expect(screen.getByText("visible")).toBeInTheDocument();
  });

  it("renders fallback when feature absent", () => {
    render(
      <FeatureGate
        feature="x"
        user={_userWith([])}
        fallback={<span>upgrade!</span>}
      >
        <span>visible</span>
      </FeatureGate>,
    );
    expect(screen.queryByText("visible")).not.toBeInTheDocument();
    expect(screen.getByText("upgrade!")).toBeInTheDocument();
  });

  it("renders nothing (null fallback) when feature absent", () => {
    const { container } = render(
      <FeatureGate feature="x" user={_userWith([])}>
        <span>visible</span>
      </FeatureGate>,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("<UpgradeWall>", () => {
  it("renders title, description and triggers CTA", async () => {
    const handle = vi.fn();
    render(
      <UpgradeWall
        feature="advanced_reports"
        title="Relatórios avançados"
        description="Disponível no plano Pro."
        ctaLabel="Conhecer Pro"
        onUpgradeClick={handle}
        benefits={["Cascata", "Velocidade"]}
      />,
    );

    expect(screen.getByText("Relatórios avançados")).toBeInTheDocument();
    expect(screen.getByText("Disponível no plano Pro.")).toBeInTheDocument();
    expect(screen.getByText("Cascata")).toBeInTheDocument();
    expect(screen.getByText("Velocidade")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /conhecer pro/i });
    button.click();
    expect(handle).toHaveBeenCalledOnce();
  });
});

describe("<UpgradePrompt>", () => {
  it("renders message and CTA", () => {
    const handle = vi.fn();
    render(
      <UpgradePrompt
        feature="ai_categorization"
        message="Categorização por IA"
        ctaLabel="Pro"
        onUpgradeClick={handle}
      />,
    );
    expect(screen.getByText("Categorização por IA")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /pro/i });
    button.click();
    expect(handle).toHaveBeenCalledOnce();
  });
});

describe("<PlanBadge>", () => {
  it("renders the tier label", () => {
    render(<PlanBadge tier="pro" />);
    expect(screen.getByText(/pro/i)).toBeInTheDocument();
  });

  it("falls back to pro when tier unknown", () => {
    render(<PlanBadge tier="weird" />);
    expect(screen.getByText(/pro/i)).toBeInTheDocument();
  });
});
