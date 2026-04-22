import { describe, expect, it } from "vitest";
import {
  PROFILE_SETTINGS_TAB_SLUGS,
  PROFILE_TAB_INTERNAL_TO_SLUG,
  PROFILE_TAB_SLUG_TO_INTERNAL,
  isProfileSettingsTabSlug,
  profileSettingsTabSlugFromPathname,
} from "../profileSettingsTabs.js";

describe("profileSettingsTabs", () => {
  it("lista slugs em inglês estável", () => {
    expect(PROFILE_SETTINGS_TAB_SLUGS).toContain("account");
    expect(PROFILE_SETTINGS_TAB_SLUGS).toContain("billing");
  });

  it("mapeia slug ↔ id interno", () => {
    expect(PROFILE_TAB_SLUG_TO_INTERNAL.account).toBe("perfil");
    expect(PROFILE_TAB_INTERNAL_TO_SLUG.perfil).toBe("account");
    expect(PROFILE_TAB_SLUG_TO_INTERNAL.billing).toBe("assinatura");
  });

  it("isProfileSettingsTabSlug", () => {
    expect(isProfileSettingsTabSlug("security")).toBe(true);
    expect(isProfileSettingsTabSlug("hack")).toBe(false);
  });

  it("profileSettingsTabSlugFromPathname", () => {
    expect(profileSettingsTabSlugFromPathname("/profile/security")).toBe("security");
    expect(profileSettingsTabSlugFromPathname("/profile/account")).toBe("account");
    expect(profileSettingsTabSlugFromPathname("/dashboard")).toBeNull();
    expect(profileSettingsTabSlugFromPathname("/profile")).toBeNull();
  });
});
