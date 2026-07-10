// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ConsultantClientReportHeader } from "../ConsultantClientReportHeader.jsx";

/**
 * `health == null` = "nunca calculado", não zero.
 *
 * O cabeçalho fazia `Number(client.health) || 0` e mostrava "Frágil · 0" em
 * vermelho para um cliente sem uma única transação — o mesmo cast que a Carteira
 * já tinha corrigido. `HealthRing` e `RiskBadge` sempre souberam tratar `null`;
 * era o cabeçalho que destruía a informação antes de entregá-la a eles.
 */
const client = (health) => ({
  organization_id: "org-1",
  organization_name: "Finanças do João",
  client_name: "João da Silva",
  health,
  last_active: null,
});

afterEach(cleanup);

describe("ConsultantClientReportHeader: saúde nula", () => {
  it("não mostra 'Frágil' nem 0 para um cliente sem score", () => {
    render(<ConsultantClientReportHeader client={client(null)} />);

    expect(screen.queryByText("Frágil")).toBeNull();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByText("Sem score")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("um zero de verdade continua sendo Frágil", () => {
    render(<ConsultantClientReportHeader client={client(0)} />);

    expect(screen.getByText("Frágil")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });
});
