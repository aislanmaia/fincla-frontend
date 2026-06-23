import { describe, expect, it } from "vitest";
import {
  buildCreateGoalPayload,
  buildUpdateGoalPayload,
  mapGoalToUi,
} from "../goalsAdapter.js";

describe("goalsAdapter", () => {
  it("mapeia goal da API para a UI com os campos reais", () => {
    expect(mapGoalToUi({
      id: "g1",
      organization_id: "org-1",
      name: "Reserva de emergência",
      target_amount: 30000,
      current_amount: 18500,
      deadline: "2026-12-01",
      status: "active",
      description: "6 meses de despesas",
      progress: 62,
      type: "emergency_fund",
      term: "short",
      priority: 3,
      monthly_target: 1000,
      annual_return_rate: null,
    })).toEqual({
      id: "g1",
      nome: "Reserva de emergência",
      desc: "6 meses de despesas",
      status: "active",
      type: "emergency_fund",
      meta: 30000,
      atual: 18500,
      progress: 62,
      monthly_target: 1000,
      annual_return_rate: null,
      deadline: "2026-12-01",
      prazo: "Dez 2026",
      term: "short",
      termExplicit: "short",
      prioridade: "alta",
    });
  });

  it("buildCreate envia campos reais e NÃO envia current_amount", () => {
    const payload = buildCreateGoalPayload({
      nome: "Viagem",
      desc: "Portugal",
      type: "travel",
      meta: "18.000,00",
      deadline: "2027-07",
      prioridade: "media",
      monthly_target: "600",
      annual_return_rate: "",
    });
    expect(payload).toEqual({
      name: "Viagem",
      description: "Portugal",
      target_amount: 18000,
      deadline: "2027-07-01",
      type: "travel",
      term: null,
      priority: 2,
      monthly_target: 600,
      annual_return_rate: null,
    });
    expect("current_amount" in payload).toBe(false);
  });

  it("buildUpdate inclui status, term explícito e taxa em decimal", () => {
    expect(buildUpdateGoalPayload({
      nome: "Aposentadoria",
      desc: "",
      type: "retirement",
      meta: "500000",
      deadline: "",
      prioridade: "baixa",
      monthly_target: "1200",
      annual_return_rate: "10,5",
      term: "long",
      status: "active",
    })).toEqual({
      name: "Aposentadoria",
      description: null,
      target_amount: 500000,
      deadline: null,
      status: "active",
      type: "retirement",
      term: "long",
      priority: 1,
      monthly_target: 1200,
      annual_return_rate: 0.105,
    });
  });
});
