/** @vitest-environment jsdom */
/* fincla-api#534 — as contagens da tela das Transações levam o separador de milhar do idioma: "1.235 transações ·
   1.234 a pagar", não "1235 transações · 1234 a pagar". Os componentes são reais; o teste lê o texto que se vê e o
   que o leitor de tela anuncia. */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { TransactionsListHeader } from "../TransactionsListHeader.jsx";
import { TransactionsStats } from "../TransactionsStats.jsx";
import { FacetCount } from "../filters/shared/FacetCount.jsx";
import { SelectionCount } from "../../selection/BulkSelection.jsx";
import { fmtCount } from "../../../formatters.js";
import { BulkMoveDialog } from "../bulkMove/BulkMoveDialog.jsx";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const text = () => document.body.textContent.replace(/\s+/g, " ");

describe("fmtCount", () => {
  it("agrupa o milhar no idioma e não inventa casas", () => {
    expect(fmtCount(1235)).toBe("1.235");
    expect(fmtCount(1234567)).toBe("1.234.567");
    expect(fmtCount(999)).toBe("999");
    expect(fmtCount(0)).toBe("0");
  });

  // G3-P-09: ausência nunca vira zero. Uma contagem que ainda não chegou
  // (ou não é número) sai como o marcador de ausência, não "0 transações".
  it("null, undefined, vazio e não-número viram '—', nunca '0'", () => {
    expect(fmtCount(null)).toBe("—");
    expect(fmtCount(undefined)).toBe("—");
    expect(fmtCount("")).toBe("—");
    expect(fmtCount(Number.NaN)).toBe("—");
    expect(fmtCount(Number.POSITIVE_INFINITY)).toBe("—");
    expect(fmtCount("abc")).toBe("—");
    expect(fmtCount("1235")).toBe("1.235");
  });
});

describe("contagens com milhar (fincla-api#534)", () => {
  it("cabeçalho da lista: '1.235 transações · 1.234 a pagar', também no 'de N' e nas transferências", () => {
    render(
      <TransactionsListHeader total={1235} totalUnfiltered={25000} transfers={1500} pending={1234} sum={null}
        fmt={(v) => String(v)} onPendingClick={vi.fn()} />,
    );
    expect(text()).toMatch(/1\.235\s*de 25\.000 transações/);
    expect(text()).toMatch(/1\.500 transferências/);
    expect(text()).toMatch(/1\.234 a pagar/);
    expect(text()).not.toMatch(/1235|1234|25000|1500/);
    expect(screen.getByRole("button", { name: /^1\.234 a pagar/ })).toBeTruthy();
  });

  it("o anúncio do leitor de tela também agrupa o milhar", () => {
    vi.useFakeTimers();
    render(<TransactionsListHeader total={1235} pending={1234} sum={null} fmt={(v) => String(v)} />);
    act(() => vi.advanceTimersByTime(400));
    expect(text()).toContain("1.235 transações, 1.234 a pagar");
  });

  it("estatísticas: lançamentos, a pagar e total no filtro", () => {
    render(
      <TransactionsStats receita={10} despesa={5} resultado={5} countReceita={1500} countDespesa={2300}
        countEstorno={0} totalEstorno={0} filteredCount={3800} aPagarCount={1234} expanded fmt={(v) => String(v)}
        currency="BRL" />,
    );
    expect(text()).toMatch(/1\.500 lançamentos/);
    expect(text()).toMatch(/2\.300 lançamentos/);
    expect(text()).toMatch(/1\.234 a pagar/);
  });

  it("estatísticas sem nada a pagar: total no filtro", () => {
    render(
      <TransactionsStats receita={10} despesa={5} resultado={5} countReceita={1500} countDespesa={2300}
        countEstorno={0} totalEstorno={0} filteredCount={3800} aPagarCount={0} expanded fmt={(v) => String(v)}
        currency="BRL" />,
    );
    expect(text()).toMatch(/3\.800 transações no filtro/);
  });

  it("contagem das opções do filtro e da seleção em lote", () => {
    render(
      <div>
        <FacetCount n={4321} />
        <SelectionCount count={1200} />
      </div>,
    );
    expect(screen.getByLabelText("4.321 transações").textContent).toBe("4.321");
    expect(text()).toMatch(/1\.200 selecionados/);
  });
});

// G3-P-08: o título do diálogo já dizia "Mover 1.235"; o botão dizia "Mover 1235".
describe("Mover para a conta… — contagem com milhar no botão", () => {
  it("1.235 lançamentos elegíveis: título e botão com '1.235'", () => {
    const transactions = Array.from({ length: 1235 }, (_, i) => ({
      id: i + 1, desc: `Compra ${i}`, val: -1, type: "expense", accountId: "acc-a", currency: "BRL", settleable: true, seriesId: null,
    }));
    render(
      <BulkMoveDialog organizationId="org" transactions={transactions} baseCurrency="BRL" onClose={() => {}}
        accounts={[{ id: "acc-a", label: "Conta A", currency: "BRL" }, { id: "acc-b", label: "Conta B", currency: "BRL" }]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Conta B/ }));
    expect(screen.getByRole("button", { name: "Mover 1.235 lançamentos" })).toBeTruthy();
    expect(text()).not.toMatch(/Mover 1235/);
  });
});
