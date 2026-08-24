// @vitest-environment jsdom
/**
 * A célula do dia, conforme o §14 do artefato de Transações.
 *
 * O que estes testes guardam não é aparência por gosto: cada número saiu de uma
 * medição. 44 px é o alvo do dedo (26 serve para o cursor e não para a mão);
 * o rótulo na célula é o ÚNICO marcador que sobra no toque, onde não há hover
 * nem balão; e o anel verde é o que torna visível a ponta "pega", que sem ele
 * seria a única mudança de estado invisível da tela.
 */
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { RangeCalendarGrid } from "../RangeCalendarGrid.jsx";

afterEach(cleanup);

const base = {
  cursorYear: 2026,
  cursorMonth: 7, // agosto
  monthCount: 1,
  fromYmd: "2026-08-10",
  toYmd: "2026-08-20",
  onDayClick: () => {},
  onDayHover: () => {},
  onPrevMonth: () => {},
  onNextMonth: () => {},
};

const dia = (ymd) => screen.getByRole("button", { name: new RegExp(`^${ymd}`) });

describe("<RangeCalendarGrid>", () => {
  it("as pontas carregam o rótulo que diz qual é qual", () => {
    render(<RangeCalendarGrid {...base} />);
    expect(dia("2026-08-10")).toHaveTextContent("de");
    expect(dia("2026-08-20")).toHaveTextContent("até");
    // Um dia do meio não carrega rótulo nenhum.
    expect(dia("2026-08-15").querySelector("em")).toBeNull();
  });

  it("intervalo de um dia só diz 'só', não 'de' e 'até' no mesmo lugar", () => {
    render(<RangeCalendarGrid {...base} fromYmd="2026-08-12" toYmd="2026-08-12" />);
    expect(dia("2026-08-12")).toHaveTextContent("só");
  });

  it("célula de 44 px no toque e 30 no mouse", () => {
    const { rerender } = render(<RangeCalendarGrid {...base} />);
    expect(dia("2026-08-15").firstChild).toHaveStyle({ height: "30px" });
    rerender(<RangeCalendarGrid {...base} touch />);
    // Trinta serve para o cursor e não para o dedo.
    expect(dia("2026-08-15").firstChild).toHaveStyle({ height: "44px" });
  });

  it("a ponta pega ganha anel verde — no toque é a única pista que existe", () => {
    const { rerender } = render(<RangeCalendarGrid {...base} />);
    expect(dia("2026-08-10").firstChild).not.toHaveStyle({
      boxShadow: "inset 0 0 0 1.5px #0F8A5F",
    });
    rerender(<RangeCalendarGrid {...base} grabbedEdge="from" />);
    expect(dia("2026-08-10").firstChild).toHaveStyle({
      boxShadow: "inset 0 0 0 1.5px #0F8A5F",
    });
    // E só a ponta pega: a outra continua limpa.
    expect(dia("2026-08-20").firstChild).not.toHaveStyle({
      boxShadow: "inset 0 0 0 1.5px #0F8A5F",
    });
  });

  it("duplo clique reporta o dia — é o caminho para 'só aquele dia'", () => {
    const onDayDoubleClick = vi.fn();
    render(<RangeCalendarGrid {...base} onDayDoubleClick={onDayDoubleClick} />);
    fireEvent.doubleClick(dia("2026-08-14"));
    expect(onDayDoubleClick).toHaveBeenCalledWith("2026-08-14");
  });

  it("o miolo do intervalo pinta a célula inteira, sem raio", () => {
    // Sem isto a faixa aparecia furada: o fundo ficava numa bolinha de 28 px
    // dentro de uma célula bem mais larga.
    render(<RangeCalendarGrid {...base} />);
    expect(dia("2026-08-15")).toHaveStyle({ background: "#EFF6FF", borderRadius: "0" });
  });

  it("o rótulo é de ponta COMMITADA, não de prévia sob o cursor", () => {
    // Com o intervalo aberto, `isTo` cai no dia sob o cursor: sem a guarda, cada
    // dia por onde o mouse passava ganhava um "até" com cara de definitivo, e o
    // próprio dia inicial virava "só" sem nada ter sido escolhido.
    render(<RangeCalendarGrid {...base} toYmd="" hoverYmd="2026-08-18" />);
    // O dia sob o cursor ganha BALÃO (a data por extenso), mas não o rótulo de
    // ponta: um é "estou apontando aqui", o outro é "esta ponta é esta".
    expect(dia("2026-08-18").querySelector("em")).toBeNull();
    expect(dia("2026-08-10")).toHaveTextContent("de");
    expect(dia("2026-08-10")).not.toHaveTextContent("só");
  });

  it("o papel do dia existe para leitor de tela, não só na cor", () => {
    // `aria-label` substitui o conteúdo no cálculo do nome: sem isto o rótulo
    // na célula e o anel verde seriam puramente visuais.
    render(<RangeCalendarGrid {...base} grabbedEdge="to" />);
    expect(screen.getByRole("button", { name: /2026-08-10 — início/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /2026-08-20 — ponta selecionada/ }),
    ).toBeInTheDocument();
    // Estar dentro do intervalo é o que a faixa azul diz a quem enxerga.
    expect(dia("2026-08-15")).toHaveAttribute("aria-pressed", "true");
    expect(dia("2026-08-25")).toHaveAttribute("aria-pressed", "false");
  });


  it("o balão só existe no mouse, e some no toque", () => {
    // Sem cursor o balão ficaria na tela até o toque seguinte, cobrindo
    // justamente os dias que a pessoa pode querer tocar.
    const { rerender } = render(<RangeCalendarGrid {...base} hoverYmd="2026-08-18" />);
    expect(dia("2026-08-18").textContent).toMatch(/novo início/i);
    rerender(<RangeCalendarGrid {...base} hoverYmd="2026-08-18" touch />);
    expect(dia("2026-08-18").textContent).not.toMatch(/novo/i);
  });


  it("o balão diz a AÇÃO, não a data — a data já está na célula e no campo", () => {
    // Repetir a data seria gastar um balão para não informar nada. O que falta
    // saber é o que o clique VAI FAZER.
    const { rerender } = render(<RangeCalendarGrid {...base} hoverYmd="2026-08-15" />);
    // Dia comum com intervalo fechado: o clique recomeça.
    expect(dia("2026-08-15")).toHaveTextContent("novo início");

    // Sobre uma PONTA: o clique move aquela ponta, e o balão nomeia qual.
    rerender(<RangeCalendarGrid {...base} hoverYmd="2026-08-10" />);
    expect(dia("2026-08-10")).toHaveTextContent("mover o de");
    rerender(<RangeCalendarGrid {...base} hoverYmd="2026-08-20" />);
    expect(dia("2026-08-20")).toHaveTextContent("mover o até");

    // Com a ponta já pega, o próximo clique SOLTA.
    rerender(<RangeCalendarGrid {...base} hoverYmd="2026-08-20" grabbedEdge="to" />);
    expect(dia("2026-08-20")).toHaveTextContent("soltar o até");
  });

  it("a ponta sob o cursor mostra a mão de pegar", () => {
    const { rerender } = render(<RangeCalendarGrid {...base} hoverYmd="2026-08-10" />);
    expect(dia("2026-08-10")).toHaveStyle({ cursor: "grab" });
    expect(dia("2026-08-15")).toHaveStyle({ cursor: "pointer" });
    rerender(<RangeCalendarGrid {...base} hoverYmd="2026-08-10" grabbedEdge="from" />);
    expect(dia("2026-08-10")).toHaveStyle({ cursor: "grabbing" });
  });

});
