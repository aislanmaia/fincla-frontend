import { describe, it, expect } from "vitest";
import { consultantAreaDecision, hasConsultantArea } from "../consultantAccess.js";

// Consultor de verdade: o backend disse `is_consultant` (carteira ou plano pago)
// E a assinatura ativa libera as capacidades.
const consultant = {
  is_consultant: true,
  subscription: { status: "active", features: ["multi_org_dashboard", "client_list"] },
};
// O BUG que este arquivo passou a travar (§1.7): plano beta concede
// `multi_org_dashboard`, então este usuário era mandado para o painel do
// consultor no login — mesmo nunca tendo assessorado ninguém. Aconteceu em
// produção com a conta pessoal do Owner. O backend agora responde
// `is_consultant: false` para ele.
const betaClient = {
  is_consultant: false,
  subscription: { status: "active", features: ["advanced_reports", "multi_org_dashboard"] },
};
// Beta que É consultor de verdade (tem carteira): tem de continuar entrando —
// beta é o plano dos testers, e bloquear por plano quebraria justamente eles.
const betaConsultant = {
  is_consultant: true,
  subscription: { status: "active", features: ["advanced_reports", "multi_org_dashboard"] },
};
const plainOwner = {
  is_consultant: false,
  subscription: { status: "active", features: ["basic_reports"] },
};
// Consultor com pagamento vencido: sem a feature ativa, o painel abriria numa
// tela de 403. Melhor mandar para o aviso de cobrança.
const unpaidConsultant = {
  is_consultant: true,
  subscription: { status: "pending_payment", features: ["multi_org_dashboard"] },
};

describe("consultantAreaDecision (é consultor + assinatura ativa)", () => {
  it("passthrough fora da área /consultant", () => {
    expect(consultantAreaDecision("/", consultant)).toBe("passthrough");
    expect(consultantAreaDecision("/dashboard", plainOwner)).toBe("passthrough");
    expect(consultantAreaDecision("/planning/goals", consultant)).toBe("passthrough");
  });

  it("allow para quem É consultor, inclusive no plano beta", () => {
    expect(consultantAreaDecision("/consultant", consultant)).toBe("allow");
    expect(consultantAreaDecision("/consultant/clients", betaConsultant)).toBe("allow");
  });

  it("redirect para cliente no plano beta — o bug de produção", () => {
    expect(consultantAreaDecision("/consultant", betaClient)).toBe("redirect");
    expect(consultantAreaDecision("/consultant/clients", betaClient)).toBe("redirect");
  });

  it("redirect para usuário comum, assinatura inativa, ou sem usuário", () => {
    expect(consultantAreaDecision("/consultant", plainOwner)).toBe("redirect");
    expect(consultantAreaDecision("/consultant", unpaidConsultant)).toBe("redirect");
    expect(consultantAreaDecision("/consultant/clients", null)).toBe("redirect");
  });
});

describe("hasConsultantArea (redirect de login + switcher)", () => {
  it("true só para quem É consultor com assinatura ativa", () => {
    expect(hasConsultantArea(consultant)).toBe(true);
    expect(hasConsultantArea(betaConsultant)).toBe(true);
  });

  it("false para cliente beta — é isto que impede o login de cair no painel", () => {
    expect(hasConsultantArea(betaClient)).toBe(false);
  });

  it("false para usuário comum, assinatura inativa, ou sem usuário", () => {
    expect(hasConsultantArea(plainOwner)).toBe(false);
    expect(hasConsultantArea(unpaidConsultant)).toBe(false);
    expect(hasConsultantArea(null)).toBe(false);
  });

  it("campo ausente (backend antigo) cai para a feature — janela de deploy", () => {
    // NÃO é fail-closed aqui, e a escolha é deliberada: se o frontend chegar
    // antes do backend, ou o backend for revertido com este bundle em cache,
    // fechar trancaria TODO consultor fora do painel. Trocar "beta demais" por
    // "ninguém" é pior — quebra quem paga. O fallback é transitório e sai
    // quando o backend novo estiver em produção.
    expect(
      hasConsultantArea({ subscription: { status: "active", features: ["multi_org_dashboard"] } }),
    ).toBe(true);
  });

  it("`false` explícito é resposta e NÃO cai no fallback", () => {
    // A distinção que faz o fallback ser seguro: só a AUSÊNCIA do campo é
    // silêncio. Se o backend disse `false`, é o backend novo respondendo, e
    // ignorar isso reabriria o bug de produção com o deploy já feito.
    expect(hasConsultantArea(betaClient)).toBe(false);
  });
});
