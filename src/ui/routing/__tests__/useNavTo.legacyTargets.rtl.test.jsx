// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

import { useNavTo } from "../useNavTo.js";

beforeEach(() => navigate.mockClear());

function navTo() {
  return renderHook(() => useNavTo({ session: { signOut: vi.fn() }, setCenarioId: vi.fn(), onSignOutReset: vi.fn() })).result.current;
}

// Hoje (errado): "budgets"/"goals"/"simulation" deixaram de ser rotas (viraram áreas do Planejamento) e o
// navTo ignorava o clique: "Criar →" do checklist, "Metas"/"Orçamentos" do menu de comandos, "Simular"...
it.each([
  ["budgets", "/planning/budgets"],
  ["goals", "/planning/goals"],
  ["simulation", "/planning/simulator"],
])("navTo(%s) abre %s", (target, to) => {
  navTo()(target);
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate.mock.calls[0][0].to).toBe(to);
});

it("mantém os parâmetros do simulador (abrir já preenchido)", () => {
  navTo()("simulation", { autoOpenModal: true, autoTipo: "despesa_recorrente" });
  const search = navigate.mock.calls[0][0].search({});
  expect(Object.keys(search).length).toBeGreaterThan(0);
});

it("rotas atuais continuam iguais", () => {
  navTo()("transactions");
  expect(navigate.mock.calls[0][0].to).toBe("/transactions");
});
