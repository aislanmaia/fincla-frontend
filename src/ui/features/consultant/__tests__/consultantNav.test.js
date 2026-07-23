import { describe, expect, it } from "vitest";
import { CONSULTANT_NAV, isConsultantNavActive } from "../consultantNav.js";

describe("CONSULTANT_NAV (modelo de navegação)", () => {
  const items = CONSULTANT_NAV.filter((i) => !i.sec);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));

  it("expõe as 5 seções na ordem do design", () => {
    const sections = CONSULTANT_NAV.filter((i) => i.sec).map((i) => i.sec);
    expect(sections).toEqual([
      "PRINCIPAL",
      "ANÁLISE",
      "RELACIONAMENTO",
      "INTELIGÊNCIA",
      "CONTA",
    ]);
  });

  it("usa ids/slugs em inglês e labels em PT-BR", () => {
    expect(Object.keys(byId).sort()).toEqual(
      ["clients", "copilot", "insights", "messages", "painel", "profile"].sort(),
    );
    expect(byId.clients.label).toBe("Clientes");
    expect(byId.copilot.label).toBe("Copiloto IA");
  });

  it("marca Mensagens como 'em breve' (sem rota)", () => {
    expect(byId.messages.comingSoon).toBe(true);
    expect(byId.messages.to).toBeUndefined();
  });

  it("Copiloto IA (A4) é navegável e realçado como item de IA", () => {
    // Deixou de ser 'em breve' quando a A4 entregou a página do chat; o gate
    // `consultant_ai` decide na própria página se abre o chat ou o teaser.
    expect(byId.copilot.comingSoon).toBeFalsy();
    expect(byId.copilot.to).toBe("/consultant/copiloto");
    expect(byId.copilot.ai).toBe(true);
  });

  it("itens navegáveis (painel/clients/insights/copilot/profile) têm rota e não são 'em breve'", () => {
    for (const id of ["painel", "clients", "insights", "copilot", "profile"]) {
      expect(byId[id].to).toMatch(/^\/consultant/);
      expect(byId[id].comingSoon).toBeFalsy();
    }
  });
});

describe("isConsultantNavActive", () => {
  it("painel (/consultant) só fica ativo na rota exata", () => {
    expect(isConsultantNavActive("/consultant", "/consultant")).toBe(true);
    expect(isConsultantNavActive("/consultant/", "/consultant")).toBe(true);
    expect(isConsultantNavActive("/consultant/clients", "/consultant")).toBe(false);
  });

  it("seções com sub-rotas ficam ativas no destino e em sub-caminhos", () => {
    expect(isConsultantNavActive("/consultant/clients", "/consultant/clients")).toBe(true);
    expect(isConsultantNavActive("/consultant/clients/c1", "/consultant/clients")).toBe(true);
    expect(isConsultantNavActive("/consultant/insights", "/consultant/clients")).toBe(false);
  });

  it("retorna false para itens sem rota (em breve)", () => {
    expect(isConsultantNavActive("/consultant", undefined)).toBe(false);
  });
});
