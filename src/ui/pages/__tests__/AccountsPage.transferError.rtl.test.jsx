/** @vitest-environment jsdom */

import React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { AccountsPage } from "../AccountsPage.jsx";

/**
 * #291 — a transferência com uma conta desativada volta 422 com `detail` OBJETO
 * `{code, message}` (fincla-api#466). A tela lia só string e array de validação e
 * mostrava "Request failed with status code 422".
 *
 * Sem mock do hook nem do cliente: `useAccountsData` e o axios rodam de verdade,
 * e o único dublê é a rede (MSW) — o defeito morava justamente no formatador
 * que o hook usa.
 */
const ORG = "11111111-1111-4111-8111-111111111111";
const DEACTIVATED =
  "A conta 'Nubank' está desativada. Reative-a ou escolha outra conta.";

const accounts = [
  { id: "acc-a", name: "Nubank", type: "checking", currency: "BRL" },
  { id: "acc-b", name: "Itaú", type: "checking", currency: "BRL" },
];

let transferReply;
const server = setupServer(
  http.get("*/v1/balances", () =>
    HttpResponse.json({
      as_of: "2026-11-05T09:00:00",
      total: { amount: "300.00", currency: "BRL" },
      consolidation: { target_currency: "BRL", rates: [], unavailable: null },
      accounts: accounts.map((a) => ({
        account_id: a.id, name: a.name, type: a.type, include_in_total: true,
        balance: { amount: "150.00", currency: "BRL" },
        initial_balance: { amount: "0", currency: "BRL" },
      })),
    })),
  http.get("*/v1/accounts", () =>
    HttpResponse.json(accounts.map((a) => ({
      ...a, organization_id: ORG, is_active: true, include_in_total: true,
      initial_balance: { amount: "0", currency: "BRL" },
    })))),
  http.post("*/v1/transfers", () => transferReply()),
  // O resto da página (cotação, transações do acerto) não importa aqui.
  http.get("*", () => HttpResponse.json([])),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

async function submitTransfer() {
  render(<AccountsPage organizationId={ORG} dataMode="live" />);
  fireEvent.click(await screen.findByText("⇄ Transferir"));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByPlaceholderText("R$ 0,00"), { target: { value: "50" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Transferir" }));
  return dialog;
}

describe("AccountsPage — erro da transferência (#291)", () => {
  it("conta desativada: mostra a mensagem do backend, não o erro do axios", async () => {
    transferReply = () =>
      HttpResponse.json({ detail: { code: "business_rule", message: DEACTIVATED } }, { status: 422 });
    const dialog = await submitTransfer();

    expect(await within(dialog).findByText(DEACTIVATED)).toBeInTheDocument();
    expect(screen.queryByText(/Request failed/)).not.toBeInTheDocument();
  });

  it("moedas diferentes (detail string) continua chegando à tela", async () => {
    const message = "Moedas diferentes: informe o valor que entrou na conta de destino.";
    transferReply = () => HttpResponse.json({ detail: message }, { status: 422 });
    const dialog = await submitTransfer();

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
  });

  it("validação (detail array) vira frase em português, não o texto do Pydantic", async () => {
    transferReply = () =>
      HttpResponse.json(
        { detail: [{ loc: ["body", "amount"], msg: "Input should be greater than 0", type: "greater_than" }] },
        { status: 422 },
      );
    const dialog = await submitTransfer();

    expect(await within(dialog).findByText("Informe um valor maior que 0")).toBeInTheDocument();
  });
});
