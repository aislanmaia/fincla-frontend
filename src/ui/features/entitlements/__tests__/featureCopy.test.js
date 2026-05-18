import { describe, expect, it } from "vitest";

import {
  FEATURE_COPY,
  FEATURE_GROUPS,
  PLAN_COMPARISON_FEATURES,
  getFeatureCopy,
} from "../featureCopy.js";

describe("featureCopy", () => {
  it("returns a friendly PT-BR label for known feature keys", () => {
    expect(getFeatureCopy("manual_transactions").label).toBe(
      "Transações ilimitadas",
    );
    expect(getFeatureCopy("whatsapp_assistant").label).toBe("Bot do WhatsApp");
    expect(getFeatureCopy("advanced_reports").label).toBe("Relatórios avançados");
    expect(getFeatureCopy("ai_categorization").label).toBe(
      "Categorização automática",
    );
  });

  it("assigns each known feature to a valid group", () => {
    const validGroupKeys = new Set(FEATURE_GROUPS.map((g) => g.key));
    for (const [, copy] of Object.entries(FEATURE_COPY)) {
      expect(validGroupKeys.has(copy.group)).toBe(true);
    }
  });

  it("returns a fallback shape for unknown keys (defensive against backend drift)", () => {
    const result = getFeatureCopy("totally_made_up_key");
    expect(result.label).toBe("totally_made_up_key");
    expect(result.group).toBeNull();
  });

  it("defines the three product groups in display order", () => {
    expect(FEATURE_GROUPS.map((g) => g.key)).toEqual([
      "essentials",
      "advanced",
      "ai",
    ]);
    expect(FEATURE_GROUPS.map((g) => g.label)).toEqual([
      "Essenciais",
      "Recursos avançados",
      "Inteligência artificial",
    ]);
  });

  it("only lists features in PLAN_COMPARISON_FEATURES that exist in FEATURE_COPY", () => {
    for (const [groupKey, keys] of Object.entries(PLAN_COMPARISON_FEATURES)) {
      const validGroupKeys = new Set(FEATURE_GROUPS.map((g) => g.key));
      expect(validGroupKeys.has(groupKey)).toBe(true);
      for (const k of keys) {
        expect(FEATURE_COPY[k]).toBeDefined();
        // The curated comparison list should also keep features in their
        // declared group — protects against accidental drift when adding
        // new keys.
        expect(FEATURE_COPY[k].group).toBe(groupKey);
      }
    }
  });

  it("groups AI features under the 'ai' group", () => {
    expect(getFeatureCopy("ai_insights").group).toBe("ai");
    expect(getFeatureCopy("ai_anomaly_detection").group).toBe("ai");
    expect(getFeatureCopy("ai_predictive_reports").group).toBe("ai");
  });
});
