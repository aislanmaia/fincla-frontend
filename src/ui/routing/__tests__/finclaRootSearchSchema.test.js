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

  describe("deep link de Lançamentos (fc_from/fc_to/fc_type/fc_status)", () => {
    it("aceita valores válidos", () => {
      expect(
        parseFinclaRootSearch({ fc_from: "2026-10-01", fc_to: "2026-10-31", fc_type: "expense", fc_status: "paid" }),
      ).toEqual({ fc_from: "2026-10-01", fc_to: "2026-10-31", fc_type: "expense", fc_status: "paid" });
      expect(parseFinclaRootSearch({ fc_type: "income", fc_status: "to_pay" })).toEqual({ fc_type: "income", fc_status: "to_pay" });
    });

    it.each(["2026-02-31", "2026-13-01", "2026-10-1", "26-10-01", "2026-10-01T00:00", "abc", "", "9999-99-99"])(
      "descarta data inválida %j",
      (bad) => {
        expect(parseFinclaRootSearch({ fc_from: bad, fc_to: bad }).fc_from).toBeUndefined();
        expect(parseFinclaRootSearch({ fc_from: bad, fc_to: bad }).fc_to).toBeUndefined();
      },
    );

    it("aceita 29/02 só em ano bissexto", () => {
      expect(parseFinclaRootSearch({ fc_from: "2028-02-29" }).fc_from).toBe("2028-02-29");
      expect(parseFinclaRootSearch({ fc_from: "2026-02-29" }).fc_from).toBeUndefined();
    });

    it.each(["transfer", "refund", "EXPENSE", "despesa", "expense,income", "", "1"])("descarta fc_type %j", (bad) => {
      expect(parseFinclaRootSearch({ fc_type: bad }).fc_type).toBeUndefined();
    });

    it.each(["settled", "pagas", "PAID", "unpaid", "paid,to_pay", ""])("descarta fc_status %j", (bad) => {
      expect(parseFinclaRootSearch({ fc_status: bad }).fc_status).toBeUndefined();
    });

    it("não derruba o parse: inválidos somem e o resto (inclusive fc_category) segue", () => {
      expect(parseFinclaRootSearch({ fc_from: "x", fc_type: "zzz", fc_status: {}, fc_category: "Alimentação" })).toEqual({
        fc_category: "Alimentação",
      });
    });
  });
});
