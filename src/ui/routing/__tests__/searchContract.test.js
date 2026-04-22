import { describe, expect, it } from "vitest";
import { FC, FC_MODAL, mergeNavSearch, simulationTipoFromUrl, simulationTipoToUrl } from "../searchContract.js";

describe("searchContract", () => {
  it("simulationTipoToUrl e fromUrl são inversos para tipos conhecidos", () => {
    expect(simulationTipoToUrl("despesa_recorrente")).toBe("recurring_expense");
    expect(simulationTipoFromUrl("recurring_expense")).toBe("despesa_recorrente");
  });

  it("simulationTipoFromUrl retorna null para valor desconhecido", () => {
    expect(simulationTipoFromUrl("nope")).toBeNull();
    expect(simulationTipoFromUrl("")).toBeNull();
  });

  it("mergeNavSearch preserva auth e aplica fc_* pedidos", () => {
    const prev = {
      invite_token: "keep",
      [FC.CATEGORY]: "old",
      [FC.ADD]: "1",
    };
    const out = mergeNavSearch(prev, "transactions", {
      filterCat: "Alimentação",
      autoOpenAdd: true,
    });
    expect(out.invite_token).toBe("keep");
    expect(out[FC.CATEGORY]).toBe("Alimentação");
    expect(out[FC.ADD]).toBe("1");
  });

  it("mergeNavSearch define simulação com autoOpenModal + autoTipo", () => {
    const out = mergeNavSearch(
      { token: "x" },
      "simulation",
      { autoOpenModal: true, autoTipo: "despesa_recorrente" },
    );
    expect(out.token).toBe("x");
    expect(out[FC.SIM_OPEN]).toBe("1");
    expect(out[FC.SIM_ITEM]).toBe("recurring_expense");
  });

  it("mergeNavSearch limpa fc_modal ao navegar", () => {
    const prev = { [FC.MODAL]: FC_MODAL.NEW_TRANSACTION, [FC.TX]: "550e8400-e29b-41d4-a716-446655440000" };
    const out = mergeNavSearch(prev, "dashboard", {});
    expect(out[FC.MODAL]).toBeUndefined();
    expect(out[FC.TX]).toBeUndefined();
  });
});
