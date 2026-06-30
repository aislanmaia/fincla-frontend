import { describe, it, expect } from "vitest";
import { isConsultant } from "../isConsultant.js";
import { consultantAreaDecision } from "../consultantAccess.js";

// Usuário com a capacidade de consultor = assinatura ativa + feature multi_org_dashboard
// (espelha o gate do backend; cobre consultant_* e beta).
const withConsultantFeature = {
  role: "consultant",
  subscription: { status: "active", features: ["multi_org_dashboard", "client_list"] },
};
// Beta: backend serve a área, mas role exibido é "owner" — deve poder acessar.
const betaTester = {
  role: "owner",
  subscription: { status: "active", features: ["advanced_reports", "multi_org_dashboard"] },
};
// Usuário comum sem a feature.
const plainOwner = { role: "owner", subscription: { status: "active", features: ["basic_reports"] } };
// Assinatura inativa, mesmo com a feature → sem acesso (defesa em profundidade).
const inactiveConsultant = {
  role: "consultant",
  subscription: { status: "pending_payment", features: ["multi_org_dashboard"] },
};

describe("isConsultant (role)", () => {
  it("true só quando role === 'consultant'", () => {
    expect(isConsultant({ role: "consultant" })).toBe(true);
    expect(isConsultant({ role: "owner" })).toBe(false);
    expect(isConsultant(null)).toBe(false);
    expect(isConsultant({})).toBe(false);
  });
});

describe("consultantAreaDecision (capacidade = feature)", () => {
  it("passthrough fora da área /consultant", () => {
    expect(consultantAreaDecision("/", withConsultantFeature)).toBe("passthrough");
    expect(consultantAreaDecision("/dashboard", plainOwner)).toBe("passthrough");
    expect(consultantAreaDecision("/planning/goals", withConsultantFeature)).toBe("passthrough");
  });

  it("allow quando tem a feature multi_org_dashboard (consultant_* OU beta)", () => {
    expect(consultantAreaDecision("/consultant", withConsultantFeature)).toBe("allow");
    expect(consultantAreaDecision("/consultant/clients", betaTester)).toBe("allow");
  });

  it("redirect quando NÃO tem a feature, ou assinatura inativa, ou sem usuário", () => {
    expect(consultantAreaDecision("/consultant", plainOwner)).toBe("redirect");
    expect(consultantAreaDecision("/consultant", inactiveConsultant)).toBe("redirect");
    expect(consultantAreaDecision("/consultant/clients", null)).toBe("redirect");
  });
});
