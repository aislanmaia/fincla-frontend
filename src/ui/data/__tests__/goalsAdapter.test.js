import { describe, expect, it } from "vitest";
import {
  buildCreateGoalPayload,
  buildUpdateGoalPayload,
  mapGoalToUi,
} from "../goalsAdapter.js";

describe("goalsAdapter", () => {
  it("mapeia meta da API para o formato usado na UI", () => {
    expect(mapGoalToUi({
      id: "g1",
      organization_id: "org-1",
      name: "Reserva de emergência",
      target_amount: 18000,
      current_amount: 11400,
      deadline: "2026-12-15",
      status: "active",
      description: "6 meses de despesas fixas",
      created_at: "",
      updated_at: null,
      progress: 63,
    }, 0)).toEqual({
      id: "g1",
      nome: "Reserva de emergência",
      emoji: "🛡️",
      meta: 18000,
      atual: 11400,
      mensal: 550,
      prazo: "Dez 2026",
      cor: "#059669",
      corLight: "#ECFDF5",
      prioridade: "alta",
      desc: "6 meses de despesas fixas",
      status: "active",
    });
  });

  it("monta payload de criação a partir do formulário da UI", () => {
    expect(buildCreateGoalPayload({
      nome: "Viagem",
      desc: "Portugal",
      meta: "15.000,00",
      atual: "4.200,00",
      prazo: "Jul 2027",
    })).toEqual({
      name: "Viagem",
      description: "Portugal",
      target_amount: 15000,
      current_amount: 4200,
      deadline: "2027-07-01",
    });
  });

  it("monta payload de edição sem sobrescrever descrição vazia com null indevido", () => {
    expect(buildUpdateGoalPayload({
      nome: "Notebook novo",
      desc: "",
      meta: "6000",
      atual: "3800",
      prazo: "",
      status: "active",
    })).toEqual({
      name: "Notebook novo",
      description: null,
      target_amount: 6000,
      current_amount: 3800,
      deadline: null,
      status: "active",
    });
  });
});
