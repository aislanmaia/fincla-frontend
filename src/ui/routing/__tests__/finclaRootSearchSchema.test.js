import { describe, expect, it } from "vitest";
import { FC, FC_MODAL } from "../searchContract.js";
import { parseFinclaRootSearch } from "../finclaRootSearchSchema.js";

describe("finclaRootSearchSchema", () => {
  it("aceita somente modalidade de fatura suportada no deep link", () => {
    expect(parseFinclaRootSearch({ fc_invoice_modality: "refund" }).fc_invoice_modality).toBe("refund");
    expect(parseFinclaRootSearch({ fc_invoice_modality: "installment" }).fc_invoice_modality).toBe("installment");
    expect(parseFinclaRootSearch({ fc_invoice_modality: "recurring" }).fc_invoice_modality).toBeUndefined();
  });
  it("aceita o identificador público do cartão no Hub e descarta IDs inválidos", () => {
    const publicId = "00000000-0000-4000-8000-000000000001";
    expect(parseFinclaRootSearch({ view: "new", card: ` ${publicId} ` })).toMatchObject({ view: "new", card: publicId });
    expect(parseFinclaRootSearch({ view: "new", card: "2abc" }).card).toBeUndefined();
    expect(parseFinclaRootSearch({ view: "new", card: "2" }).card).toBeUndefined();
  });
  it("remove chaves fora da allowlist", () => {
    const out = parseFinclaRootSearch({
      invite_token: "abc",
      utm_source: "evil",
      foo: "bar",
    });
    expect(out).toEqual({ invite_token: "abc" });
    expect(out.utm_source).toBeUndefined();
  });

  it("preserva fluxo convite (aliases de token)", () => {
    expect(
      parseFinclaRootSearch({
        invitation_token: "  tok  ",
      }),
    ).toEqual({ invitation_token: "tok" });
    expect(
      parseFinclaRootSearch({
        action: "accept_invite",
        token: "x",
      }),
    ).toEqual({ action: "accept_invite", token: "x" });
  });

  it("preserva reset_token e fluxo reset via action", () => {
    expect(parseFinclaRootSearch({ reset_token: "  r  " })).toEqual({
      reset_token: "r",
    });
    expect(
      parseFinclaRootSearch({
        action: "reset_password",
        token: "t",
      }),
    ).toEqual({ action: "reset_password", token: "t" });
  });

  it("normaliza strings vazias para ausência de campo", () => {
    expect(
      parseFinclaRootSearch({
        invite_token: "   ",
        reset_token: "",
      }),
    ).toEqual({});
  });

  it("aceita fc_modal válido e rejeita valor inválido", () => {
    expect(
      parseFinclaRootSearch({ [FC.MODAL]: FC_MODAL.NEW_RECURRING }),
    ).toEqual({ [FC.MODAL]: FC_MODAL.NEW_RECURRING });
    expect(
      parseFinclaRootSearch({ [FC.MODAL]: FC_MODAL.EDIT_TRANSACTION }),
    ).toEqual({ [FC.MODAL]: FC_MODAL.EDIT_TRANSACTION });
    expect(
      parseFinclaRootSearch({ [FC.MODAL]: FC_MODAL.NEW_REFUND }),
    ).toEqual({ [FC.MODAL]: FC_MODAL.NEW_REFUND });
    expect(parseFinclaRootSearch({ [FC.MODAL]: "hack" })).toEqual({});
  });

  it("fc_tx com UUID inválido vira ausência do campo", () => {
    expect(
      parseFinclaRootSearch({
        [FC.TX]: "not-a-uuid",
        invite_token: "ok",
      }),
    ).toEqual({ invite_token: "ok" });
  });

  it("preserva fc_category e fc_sim_item permitidos", () => {
    expect(
      parseFinclaRootSearch({
        [FC.CATEGORY]: "  Moradia  ",
        [FC.SIM_OPEN]: "1",
        [FC.SIM_ITEM]: "recurring_expense",
      }),
    ).toEqual({
      [FC.CATEGORY]: "Moradia",
      [FC.SIM_OPEN]: "1",
      [FC.SIM_ITEM]: "recurring_expense",
    });
  });

  it("aceita fc_add e fc_sim_open como número 1 (query coerced)", () => {
    expect(parseFinclaRootSearch({ [FC.ADD]: 1 })).toEqual({ [FC.ADD]: "1" });
    expect(parseFinclaRootSearch({ [FC.SIM_OPEN]: 1 })).toEqual({
      [FC.SIM_OPEN]: "1",
    });
  });
});
