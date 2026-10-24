// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConfirmActionInline, ConfirmActionModal, deletionScope } from "../ConfirmAction.jsx";

afterEach(() => cleanup());

const parcel = {
  desc: "Sofá",
  type: "expense",
  valorFormatado: "R$ 30,00",
  parcela: { atual: 2, total: 3, valorTotal: 90 },
};

describe("deletionScope", () => {
  it("is null for a plain transaction", () => {
    expect(deletionScope({ desc: "Mercado" })).toBeNull();
  });
  it("is null for a one-installment purchase", () => {
    expect(deletionScope({ parcela: { atual: 1, total: 1, valorTotal: 30 } })).toBeNull();
  });
  it("reports the whole purchase for an installment", () => {
    expect(deletionScope(parcel)).toEqual({ count: 3, total: 90, atual: 2 });
  });
});

describe("delete confirmation of an installment", () => {
  it("modal says the whole purchase goes away, with count and total", () => {
    render(<ConfirmActionModal kind="delete" desc="Sofá" tx={parcel} />);
    const text = screen.getByRole("alertdialog").textContent;
    expect(text).toMatch(/compra parcelada/i);
    expect(text).toMatch(/3 parcelas/);
    expect(text).toMatch(/90,00/);
    expect(text).toMatch(/2ª de 3/);
  });
  it("inline says the same on mobile", () => {
    render(<ConfirmActionInline kind="delete" desc="Sofá" tx={parcel} />);
    const text = screen.getByRole("alertdialog").textContent;
    expect(text).toMatch(/3 parcelas/);
    expect(text).toMatch(/90,00/);
  });
  it("a plain transaction keeps the short copy", () => {
    render(<ConfirmActionModal kind="delete" desc="Mercado" tx={{ desc: "Mercado", type: "expense", valorFormatado: "R$ 10,00" }} />);
    expect(screen.getByRole("alertdialog").textContent).not.toMatch(/parcelada/i);
  });
});
