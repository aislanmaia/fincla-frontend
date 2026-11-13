/** @vitest-environment jsdom */

/**
 * #315 — o campo de limite do formulário de cartão tinha "R$" chapado. Na edição, a
 * moeda é a do cartão; na criação (Hub), a base da organização, lida pelo caminho de
 * verdade (axios → MSW). Sem moeda conhecida, o campo fica sem símbolo.
 */
import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { CardFormSheet } from "./CardFormSheet.jsx";
import { CreateCardDialog } from "../cardHub/CreateCardDialog.jsx";

const ORG = "12121212-1212-4212-8212-121212121212";
let baseCurrency = "USD";
const server = setupServer(
  http.get(`*/v1/organizations/${ORG}`, () => HttpResponse.json({ id: ORG, name: "Org", base_currency: baseCurrency })),
  http.get("*", () => HttpResponse.json({ detail: "fora do escopo" }, { status: 503 })),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

const noop = () => {};
const sheet = (currency) => (
  <CardFormSheet open isMobile={false} isEdit draftIssuer="" setDraftIssuer={noop} draftName="" setDraftName={noop}
    draftLast4="" setDraftLast4={noop} draftBrand="" setDraftBrand={noop} draftLimit="" setDraftLimit={noop}
    draftDueDay="" setDraftDueDay={noop} draftClosingDay="" setDraftClosingDay={noop} draftSuccess={false}
    saving={false} error="" onSave={noop} onUpdate={noop} onCancel={noop} currency={currency} />
);
const limitBox = () => screen.getByLabelText("Limite total").parentElement.textContent;

describe("CardFormSheet — moeda do limite (#315)", () => {
  it("cartão em US$: o campo diz US$", () => {
    render(sheet("USD"));
    expect(limitBox()).toBe("US$");
  });
  it("cartão em R$: como antes", () => {
    render(sheet("BRL"));
    expect(limitBox()).toBe("R$");
  });
  it("moeda desconhecida: sem símbolo, nunca R$", () => {
    render(sheet(null));
    expect(limitBox()).toBe("");
  });
  it("criação no Hub: a base da organização (US$)", async () => {
    baseCurrency = "USD";
    render(<CreateCardDialog organizationId={ORG} isMobile={false} onCreate={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(limitBox()).toBe("US$"));
  });
});
