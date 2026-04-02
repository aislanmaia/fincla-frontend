import { describe, expect, it } from "vitest";
import {
  buildImmediateCreditCardPreview,
  buildImmediateRecurringPreview,
  buildOrganizationDescription,
  formatLocalIsoDate,
  parseMoneyInput,
} from "../onboardingValueUtils.js";

describe("onboardingValueUtils", () => {
  it("converte valores monetários brasileiros com milhar", () => {
    expect(parseMoneyInput("5.000,00")).toBe(5000);
    expect(parseMoneyInput("2.200,50")).toBe(2200.5);
    expect(parseMoneyInput("")).toBeNull();
  });

  it("gera data local ISO sem depender de UTC", () => {
    expect(formatLocalIsoDate(new Date(2026, 2, 24, 23, 30, 0))).toBe("2026-03-24");
  });

  it("gera preview imediato da recorrência com próximo vencimento correto", () => {
    expect(buildImmediateRecurringPreview({
      temRec: "sim",
      recDesc: "Salário",
      recVal: "2.200,00",
      recDia: "10",
      recTipo: "fixo",
    }, new Date(2026, 2, 24, 10, 0, 0))).toMatchObject({
      desc: "Salário",
      val: 2200,
      dia: 10,
      proximo: "10/04/2026",
      inicio: "Mar 2026",
      valorTipo: "fixo",
    });
  });

  it("gera preview imediato do cartão com limite numérico correto", () => {
    expect(buildImmediateCreditCardPreview({
      temCartao: "sim",
      cardNome: "Nubank Roxinho",
      cardLim: "5.000,00",
      cardVenc: "10",
    })).toMatchObject({
      banco: "Nubank Roxinho",
      limite: 5000,
      disponivel: 5000,
      vencimento: 10,
      fechamento: 3,
    });
  });

  it("gera descrição coerente para o tipo de organização selecionado", () => {
    expect(buildOrganizationDescription("couple")).toBe("Organizacao de casal criada no onboarding");
    expect(buildOrganizationDescription("casal")).toBe("Organizacao de casal criada no onboarding");
    expect(buildOrganizationDescription("business")).toBe("Organizacao de negocio criada no onboarding");
    expect(buildOrganizationDescription("negocio")).toBe("Organizacao de negocio criada no onboarding");
    expect(buildOrganizationDescription("personal")).toBe("Organizacao pessoal criada no onboarding");
    expect(buildOrganizationDescription("outro")).toBe("Organizacao pessoal criada no onboarding");
  });
});
