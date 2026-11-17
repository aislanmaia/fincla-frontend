/** @vitest-environment jsdom */
/* fincla-api#534 — o nome da categoria na linha é o nome exato que a API entrega (o da organização ou o do
   catálogo em pt-BR), o mesmo que vai no arquivo exportado. A tela só traduz quando a API manda o nome cru do
   sistema em inglês. O adaptador e a linha são reais: a resposta da API entra crua e o teste lê o que se vê. */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { mapApiTransactionToUi } from "../../../data/transactionsAdapter.js";
import { TxRow } from "../../../pages/TransacoesPage.jsx";

afterEach(cleanup);

function apiTransaction(categoryTag) {
  return {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    organization_id: "org-1",
    type: "expense",
    description: "Compra",
    value: 42.5,
    amount: 42.5,
    currency: "BRL",
    date: "2026-11-10",
    payment_method: "pix",
    settled: true,
    tags: { categoria: [{ tag_type: { name: "categoria" }, is_active: true, ...categoryTag }] },
  };
}

function renderRow(categoryTag) {
  const tx = mapApiTransactionToUi(apiTransaction(categoryTag));
  render(
    <TxRow tx={tx} isMobile={false} isSelected={false} onSelect={vi.fn()} coveringAnchor={null}
      dateLabel={{ top: "10 nov", sub: "ter" }} />,
  );
  return tx;
}

describe("nome da categoria na linha (fincla-api#534)", () => {
  it.each([
    ["Personal Shopping", "personal_shopping", "shopping-bag", "Compras pessoais"],
    ["Subscriptions & Software", "subscriptions_software", "smartphone", "Assinaturas e software"],
    ["Leisure & Entertainment", "leisure_entertainment", "party-popper", "Lazer e entretenimento"],
    ["Taxes & Fees", "taxes_fees", "receipt", "Impostos e taxas"],
  ])("rótulo pt-BR da API para %s aparece idêntico ao do arquivo", (name, systemKey, iconKey, label) => {
    const tx = renderRow({ id: "cat-1", name, label, system_key: systemKey, icon_key: iconKey, is_default: true });
    expect(tx.cat).toBe(label);
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it("categoria renomeada pela organização aparece com o nome da organização", () => {
    const tx = renderRow({
      id: "cat-1",
      name: "Personal Shopping",
      label: "Minhas compras",
      custom_name: "Minhas compras",
      system_key: "personal_shopping",
      icon_key: "shopping-bag",
      is_default: true,
    });
    expect(tx.cat).toBe("Minhas compras");
    expect(screen.getAllByText("Minhas compras").length).toBeGreaterThan(0);
    expect(screen.queryByText("Compras pessoais")).toBeNull();
  });

  it("resposta sem localização (nome cru em inglês) continua traduzida pelo catálogo", () => {
    const tx = renderRow({ id: "cat-1", name: "Personal Shopping", icon_key: "shopping-bag", is_default: true });
    expect(tx.cat).toBe("Compras pessoais");
    expect(screen.getAllByText("Compras pessoais").length).toBeGreaterThan(0);
    expect(screen.queryByText("Personal Shopping")).toBeNull();
  });
});
