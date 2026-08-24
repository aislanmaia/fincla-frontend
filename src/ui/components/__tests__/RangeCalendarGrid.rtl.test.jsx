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

const dia = (ymd) => screen.getByRole("button", { name: ymd });

describe("<RangeCalendarGrid>", () => {
  it("as pontas carregam o rótulo que diz qual é qual", () => {
    render(<RangeCalendarGrid {...base} />);
    expect(dia("2026-08-10")).toHaveTextContent("de");
    expect(dia("2026-08-20")).toHaveTextContent("até");
    // Um dia do meio não carrega rótulo nenhum.
    expect(dia("2026-08-15").textContent).toBe("15");
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
});
