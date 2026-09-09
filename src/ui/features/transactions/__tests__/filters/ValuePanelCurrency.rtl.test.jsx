// @vitest-environment jsdom
/**
 * O histograma de valor é segmentado por moeda, e o clique leva a moeda junto (#170).
 *
 * Sem isto, uma organização com conta em euro veria as barras das duas moedas lado a
 * lado — "de R$ 100 a R$ 249,99" descrevendo dois conjuntos ao mesmo tempo — e clicar
 * numa delas traria as linhas da outra também: a faceta prometeria uma seleção que a
 * lista não entrega.
 */
import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);
import { ValuePanel } from "../../filters/facetBar/panels/ValuePanel.jsx";

const BARRAS = (moeda) => [
  { currency: moeda, from: null, to: 49.99, count: 3 },
  { currency: moeda, from: 100, to: 249.99, count: moeda === "EUR" ? 2 : 7 },
];

function Harness({ buckets }) {
  const [vmin, setVmin] = useState("");
  const [vmax, setVmax] = useState("");
  const [moeda, setMoeda] = useState("");
  return (
    <>
      <ValuePanel
        valueMin={vmin}
        valueMax={vmax}
        setValueMin={setVmin}
        setValueMax={setVmax}
        valueCurrency={moeda}
        setValueCurrency={setMoeda}
        counts={{ buckets }}
        onClose={() => {}}
      />
      <output data-testid="estado">{`${vmin}|${vmax}|${moeda}`}</output>
    </>
  );
}

describe("<ValuePanel> com mais de uma moeda", () => {
  const duas = [...BARRAS("BRL"), ...BARRAS("EUR")];

  it("mostra as abas de moeda e só as barras da moeda ativa", () => {
    render(<Harness buckets={duas} />);

    expect(screen.getByRole("tab", { name: "BRL" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "EUR" })).toBeInTheDocument();
    // A barra de 100–249,99 do real conta 7; a do euro conta 2. Se as duas
    // estivessem no mesmo histograma, apareceriam as duas.
    expect(screen.getByRole("button", { name: /R\$ 100,00 a 250,00: 7/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /: 2 transações/ })).not.toBeInTheDocument();
  });

  it("trocar de aba troca o histograma e o cifrão dos rótulos", async () => {
    render(<Harness buckets={duas} />);

    await userEvent.click(screen.getByRole("tab", { name: "EUR" }));

    expect(screen.getByRole("button", { name: /€ 100,00 a 250,00: 2/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /R\$ 100,00 a 250,00/ })).not.toBeInTheDocument();
  });

  it("clicar numa barra grava a faixa E a moeda dela", async () => {
    /* SEM trocar de aba antes, de propósito: a primeira versão deste teste
       clicava em "EUR" e só depois na barra, então o `EUR` no estado vinha da
       ABA — o clique na barra podia não gravar moeda nenhuma que ele passava
       igual. Aqui a aba ativa é a padrão e ninguém a tocou, então o `BRL` só
       pode ter vindo do clique na barra. */
    render(<Harness buckets={duas} />);

    await userEvent.click(screen.getByRole("button", { name: /R\$ 100,00 a 250,00: 7/ }));

    expect(screen.getByTestId("estado")).toHaveTextContent("100,00|250,00|BRL");
  });

  it("depois de trocar de aba, a barra clicada grava a moeda da aba", async () => {
    render(<Harness buckets={duas} />);

    await userEvent.click(screen.getByRole("tab", { name: "EUR" }));
    await userEvent.click(screen.getByRole("button", { name: /€ 100,00 a 250,00: 2/ }));

    expect(screen.getByTestId("estado")).toHaveTextContent("100,00|250,00|EUR");
  });

  it("desmarcar a barra limpa a moeda junto com a faixa", async () => {
    render(<Harness buckets={duas} />);

    const barra = () => screen.getByRole("button", { name: /R\$ 100,00 a 250,00: 7/ });
    await userEvent.click(barra());
    await userEvent.click(barra());

    expect(screen.getByTestId("estado")).toHaveTextContent("||");
  });
});

describe("<ValuePanel> com uma moeda só", () => {
  it("não mostra aba nenhuma e NÃO manda moeda no filtro", async () => {
    render(<Harness buckets={BARRAS("BRL")} />);

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /R\$ 100,00 a 250,00: 7/ }));

    // Moeda vazia: numa organização de moeda única a faixa já é inequívoca, e
    // mandar a moeda estreitaria o conjunto sem ninguém ter pedido.
    expect(screen.getByTestId("estado")).toHaveTextContent("100,00|250,00|");
  });
});
