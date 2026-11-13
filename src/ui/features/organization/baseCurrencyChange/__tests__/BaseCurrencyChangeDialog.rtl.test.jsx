/** @vitest-environment jsdom */

import React from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { BaseCurrencyChangeDialog } from "../BaseCurrencyChangeDialog.jsx";
import { BaseCurrencySetting } from "../BaseCurrencySetting.jsx";
import { clearCurrencyRegistry } from "../../../../money/currencyRegistry.js";
import { CURRENCIES, ORG, emptyPreview, impactPreview } from "./fixtures.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => clearCurrencyRegistry());
afterEach(() => {
  server.resetHandlers();
  cleanup();
});

/** Rotas reais do cliente (`src/api/baseCurrencyChange.ts`); devolve o que foi pedido. */
function backend({ previews = [impactPreview()], apply = null, orgBase = "BRL", currencies = () => HttpResponse.json({ currencies: CURRENCIES }) } = {}) {
  const calls = { previews: [], applies: [], currencies: 0 };
  let n = 0;
  server.use(
    http.get("*/v1/currencies", () => {
      calls.currencies += 1;
      return currencies(calls.currencies);
    }),
    http.get(`*/v1/organizations/${ORG}`, () => HttpResponse.json({ id: ORG, name: "Casa", base_currency: orgBase, monthly_income: { amount: "5000.00", currency: orgBase } })),
    http.get(`*/v1/organizations/${ORG}/base-currency-change/preview`, ({ request }) => {
      calls.previews.push(new URL(request.url).searchParams.get("to"));
      const p = previews[Math.min(n, previews.length - 1)];
      n += 1;
      return HttpResponse.json(p);
    }),
    http.post(`*/v1/organizations/${ORG}/base-currency-change`, async ({ request }) => {
      const body = await request.json();
      calls.applies.push(body);
      if (apply) return apply(body, calls.applies.length);
      return HttpResponse.json({
        organization: { id: ORG, name: "Casa", base_currency: body.to, monthly_income: { amount: "917.00", currency: body.to } },
        from_currency: "BRL", to_currency: body.to, quote: null, audit_event_id: "a1",
        items: [{ key: "organization:x:monthly_income", group: "income", label: "Renda mensal declarada", mode: "convert",
          before: { amount: "5000.00", currency: "BRL" }, after: { amount: "917.00", currency: "USD" } }],
      });
    }),
  );
  return calls;
}

function renderDialog(props = {}) {
  const onChanged = vi.fn();
  const onClose = vi.fn();
  render(<BaseCurrencyChangeDialog organizationId={ORG} currentCurrency="BRL" onChanged={onChanged} onClose={onClose} {...props} />);
  return { onChanged, onClose };
}

async function pickDollar(user) {
  await user.click(await screen.findByRole("button", { name: /Dólar americano/ }));
}

describe("currency picker", () => {
  it("offers only ACTIVE currencies other than the current base", async () => {
    backend();
    renderDialog();
    const group = await screen.findByRole("group", { name: "Nova moeda base" });
    await within(group).findByRole("button", { name: /Dólar americano/ });
    expect(within(group).queryByRole("button", { name: /Real brasileiro/ })).toBeNull();
    expect(within(group).queryByRole("button", { name: /Euro/ })).toBeNull();
  });

  it("a failed currency registry offers a retry instead of loading forever", async () => {
    const calls = backend({ currencies: (n) => (n === 1 ? HttpResponse.json({ detail: "down" }, { status: 503 }) : HttpResponse.json({ currencies: CURRENCIES })) });
    const user = userEvent.setup();
    renderDialog();
    expect(await screen.findByText("Não foi possível carregar as moedas.")).toBeInTheDocument();
    expect(screen.queryByText("Carregando as moedas…")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("button", { name: /Dólar americano/ })).toBeInTheDocument();
    expect(calls.currencies).toBe(2);
  });
});

describe("org with nothing stored in the base", () => {
  it("asks a simple question and applies with keep and no quote", async () => {
    const calls = backend({ previews: [emptyPreview()] });
    const user = userEvent.setup();
    const { onChanged } = renderDialog();
    await pickDollar(user);
    expect(await screen.findByText("Trocar moeda base de R$ para US$?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Trocar para US$" }));
    expect(await screen.findByText("Moeda base trocada para US$.")).toBeInTheDocument();
    expect(calls.previews).toEqual(["USD"]);
    expect(calls.applies).toEqual([{ to: "USD", fingerprint: "fp-1", mode: "keep", quote: null, groups: {}, items: {} }]);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onChanged.mock.calls[0][0].organization.monthly_income).toBe(917);
  });
});

describe("impact screen", () => {
  it("shows the pair and the date the way the app writes quotes", async () => {
    backend();
    const user = userEvent.setup();
    renderDialog();
    await pickDollar(user);
    const header = await screen.findByTestId("bcc-header");
    expect(header).toHaveTextContent("Cotação: US$ 1 = R$ 5,4526 (05/11)");
  });

  it("going back USD → BRL shows the rate as 'US$ 1 = R$ x' too, and keeps the API's converted amounts (#311)", async () => {
    const m = (amount, currency) => ({ amount, currency });
    const back = impactPreview({
      from_currency: "USD", to_currency: "BRL",
      quote: { base: "USD", quote: "BRL", rate: "5.6436000000", quoted_on: "2026-11-12" },
      groups: [{ group: "budgets", count: 1, locked_count: 0, undisclosed_count: 0, items: [
        { key: "budget:b1:amount", entity_id: "b1", field: "amount", label: "Mercado", can_skip: true, locked_reason: null,
          current: m("100.00", "USD"), kept: m("100.00", "BRL"), converted: m("564.36", "BRL") },
      ] }],
    });
    backend({ previews: [back], orgBase: "USD" });
    const user = userEvent.setup();
    renderDialog({ currentCurrency: "USD" });
    await user.click(await screen.findByRole("button", { name: /Real brasileiro/ }));
    const header = await screen.findByTestId("bcc-header");
    expect(header).toHaveTextContent("Cotação: US$ 1 = R$ 5,6436 (12/11)");
    expect(header).not.toHaveTextContent("R$ 1 =");
    const convert = screen.getByRole("radio", { name: /Converter pela cotação/ });
    expect(convert.closest("label")).toHaveTextContent("(US$ 1 = R$ 5,6436)");
    expect(convert.closest("label")).not.toHaveTextContent("R$ 1 =");
    await user.click(convert);
    await user.click(screen.getByRole("button", { name: /Orçamentos \(1\)/ }));
    // Display-only fix: the converted amount is still the API's, untouched.
    expect(await screen.findByTestId("bcc-item-budget:b1:amount")).toHaveTextContent("564,36");
  });

  it("requires the global choice before confirming, and the groups start collapsed with counts", async () => {
    backend();
    const user = userEvent.setup();
    renderDialog();
    await pickDollar(user);
    const confirm = await screen.findByRole("button", { name: "Trocar para US$" });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("button", { name: /Orçamentos \(2\)/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /Metas \(3\)/ })).toBeInTheDocument();
    expect(screen.queryByText("Mercado")).toBeNull();
    await user.click(screen.getByRole("radio", { name: /Converter pela cotação/ }));
    expect(confirm).toBeEnabled();
    expect(screen.getByTestId("bcc-summary")).toHaveTextContent("7 convertidos pela cotação · 1 fica em R$");
  });

  it("converts with a group override and a typed value, sending the quote that was shown", async () => {
    const calls = backend();
    const user = userEvent.setup();
    const { onChanged } = renderDialog();
    await pickDollar(user);
    await user.click(await screen.findByRole("radio", { name: /Converter pela cotação/ }));

    await user.click(screen.getByRole("button", { name: /Orçamentos \(2\)/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Escolha para Orçamentos" }), "skip");
    expect(screen.getByTestId("bcc-item-budget:b1:amount")).toHaveTextContent("R$ 800,00 → R$ 800,00");

    await user.click(screen.getByRole("button", { name: /Renda declarada \(1\)/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Escolha para Renda mensal declarada" }), "value");
    await user.type(screen.getByRole("textbox", { name: "Valor de Renda mensal declarada em US$" }), "1,000.50");
    expect(screen.getByTestId("bcc-item-organization:x:monthly_income")).toHaveTextContent("US$ 1.000,50");

    await user.click(screen.getByRole("button", { name: "Trocar para US$" }));
    await screen.findByText("Moeda base trocada para US$.");
    expect(calls.applies).toEqual([{
      to: "USD", fingerprint: "fp-1", mode: "convert",
      quote: { rate: "0.1834000000", quoted_on: "2026-11-05" },
      groups: { budgets: { mode: "skip" } },
      items: { "organization:x:monthly_income": { mode: "value", value: "1000.50" } },
    }]);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("a typed value that is not a number blocks the confirmation on the row", async () => {
    backend();
    const user = userEvent.setup();
    renderDialog();
    await pickDollar(user);
    await user.click(await screen.findByRole("radio", { name: /Manter os números/ }));
    await user.click(screen.getByRole("button", { name: /Renda declarada \(1\)/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Escolha para Renda mensal declarada" }), "value");
    await user.type(screen.getByRole("textbox", { name: "Valor de Renda mensal declarada em US$" }), "abc");
    expect(within(screen.getByTestId("bcc-item-organization:x:monthly_income")).getByRole("alert")).toHaveTextContent("Valor inválido");
    expect(screen.getByRole("button", { name: "Trocar para US$" })).toBeDisabled();
  });

  it("locked goals show the reason and no control; warnings and undisclosed items are shown without values", async () => {
    backend();
    const user = userEvent.setup();
    renderDialog();
    await pickDollar(user);
    await user.click(await screen.findByRole("radio", { name: /Converter pela cotação/ }));
    await user.click(screen.getByRole("button", { name: /Metas \(3\)/ }));
    const locked = screen.getByTestId("bcc-item-goal:g2:target_amount");
    expect(locked).toHaveTextContent("Meta com aportes: fica em R$");
    expect(within(locked).queryByRole("combobox")).toBeNull();
    expect(screen.getByTestId("bcc-warning-goal:g1:target_amount")).toHaveTextContent("Os próximos aportes precisam sair de uma conta em US$.");

    await user.click(screen.getByRole("button", { name: /Renda estimada pelo consultor \(2\)/ }));
    const hidden = screen.getByTestId("bcc-undisclosed-consultant_income");
    expect(hidden).toHaveTextContent("1 item de outro consultor (valor não exibido)");
    expect(hidden.textContent).not.toMatch(/\d+,\d{2}/);
  });

  it("without a quote, converting is disabled with the server's reason", async () => {
    const p = impactPreview({ quote: null, quote_unavailable_reason: "Não há cotação de US$ para hoje" });
    for (const g of p.groups) for (const i of g.items) i.converted = null;
    backend({ previews: [p] });
    const user = userEvent.setup();
    renderDialog();
    await pickDollar(user);
    const convert = await screen.findByRole("radio", { name: /Converter pela cotação/ });
    expect(convert).toBeDisabled();
    expect(screen.getAllByText(/Não há cotação de US\$ para hoje/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("radio", { name: /Manter os números/ }));
    expect(screen.getByRole("button", { name: "Trocar para US$" })).toBeEnabled();
  });

  it("409: previews again, keeps the choices, tells the user and lets them confirm the new numbers", async () => {
    const stale = impactPreview();
    const fresh = impactPreview({ fingerprint: "fp-2", quote: { base: "BRL", quote: "USD", rate: "0.1800000000", quoted_on: "2026-11-06" } });
    const calls = backend({
      previews: [stale, fresh],
      apply: (_body, n) => (n === 1
        ? HttpResponse.json({ detail: { code: "conflict", message: "A cotação mudou desde a prévia." } }, { status: 409 })
        : HttpResponse.json({ organization: { id: ORG, base_currency: "USD", monthly_income: null }, from_currency: "BRL", to_currency: "USD", quote: null, audit_event_id: "a2", items: [] })),
    });
    const user = userEvent.setup();
    const { onChanged } = renderDialog();
    await pickDollar(user);
    await user.click(await screen.findByRole("radio", { name: /Converter pela cotação/ }));
    await user.click(screen.getByRole("button", { name: "Trocar para US$" }));
    expect(await screen.findByText(/A cotação ou os dados mudaram desde a prévia/)).toBeInTheDocument();
    expect(screen.getByTestId("bcc-header")).toHaveTextContent("(06/11)");
    expect(screen.getByRole("radio", { name: /Converter pela cotação/ })).toBeChecked();
    expect(onChanged).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Trocar para US$" }));
    await screen.findByText("Moeda base trocada para US$.");
    expect(calls.previews).toEqual(["USD", "USD"]);
    expect(calls.applies[1].fingerprint).toBe("fp-2");
    expect(calls.applies[1].quote).toEqual({ rate: "0.1800000000", quoted_on: "2026-11-06" });
  });

  it("409 because another tab already switched to this currency: says so, refreshes, nothing left to confirm", async () => {
    const calls = backend({
      orgBase: "USD",
      apply: () => HttpResponse.json({ detail: { code: "conflict", message: "Os dados mudaram desde a prévia." } }, { status: 409 }),
    });
    const user = userEvent.setup();
    const { onChanged } = renderDialog();
    await pickDollar(user);
    await user.click(await screen.findByRole("radio", { name: /Manter os números/ }));
    await user.click(screen.getByRole("button", { name: "Trocar para US$" }));
    expect(await screen.findByText("A moeda base já foi trocada para US$.")).toBeInTheDocument();
    expect(calls.previews).toEqual(["USD"]);
    expect(calls.applies).toHaveLength(1);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onChanged.mock.calls[0][0].organization.base_currency).toBe("USD");
    expect(screen.queryByRole("button", { name: "Trocar para US$" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Fechar" }).length).toBeGreaterThan(0);
  });

  it("422: shows the server message and stays on the impact screen", async () => {
    backend({ apply: () => HttpResponse.json({ detail: { code: "business_rule", message: "'Mercado' ficaria zero em USD. Informe um valor." } }, { status: 422 }) });
    const user = userEvent.setup();
    const { onChanged } = renderDialog();
    await pickDollar(user);
    await user.click(await screen.findByRole("radio", { name: /Converter pela cotação/ }));
    await user.click(screen.getByRole("button", { name: "Trocar para US$" }));
    expect(await screen.findByText(/'Mercado' ficaria zero em USD/)).toBeInTheDocument();
    expect(screen.getByTestId("bcc-header")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("BaseCurrencySetting (Perfil › Organização)", () => {
  it("owners and consultants get the button; members only see the currency", () => {
    backend();
    const { rerender } = render(<BaseCurrencySetting organizationId={ORG} baseCurrency="BRL" membershipRole="member" />);
    expect(screen.getByTestId("org-base-currency")).toHaveTextContent("(R$)");
    expect(screen.queryByRole("button", { name: "Trocar moeda base" })).toBeNull();
    rerender(<BaseCurrencySetting organizationId={ORG} baseCurrency="BRL" membershipRole="owner" />);
    expect(screen.getByRole("button", { name: "Trocar moeda base" })).toBeInTheDocument();
    rerender(<BaseCurrencySetting organizationId={ORG} baseCurrency="BRL" membershipRole="consultant" />);
    expect(screen.getByRole("button", { name: "Trocar moeda base" })).toBeInTheDocument();
  });
  it("unknown base currency is a dash, never a guessed R$", () => {
    render(<BaseCurrencySetting organizationId={ORG} baseCurrency={null} membershipRole="owner" />);
    expect(screen.getByTestId("org-base-currency")).toHaveTextContent("—");
    expect(screen.queryByRole("button", { name: "Trocar moeda base" })).toBeNull();
  });
});
