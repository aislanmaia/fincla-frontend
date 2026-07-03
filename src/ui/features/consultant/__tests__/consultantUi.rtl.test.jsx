// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  Avatar,
  Donut,
  HealthRing,
  Icon,
  RiskBadge,
  Sparkline,
  avatarGradient,
  avatarInitials,
} from "../consultantUi.jsx";

afterEach(() => cleanup());

describe("avatarInitials", () => {
  it("deriva até 2 letras (primeiro+último nome)", () => {
    expect(avatarInitials("Mariana Costa")).toBe("MC");
    expect(avatarInitials("Ana Paula Souza")).toBe("AS");
  });
  it("nome único → 2 primeiras letras; vazio → '?'", () => {
    expect(avatarInitials("Beto")).toBe("BE");
    expect(avatarInitials("")).toBe("?");
    expect(avatarInitials(null)).toBe("?");
  });
});

describe("avatarGradient", () => {
  it("é determinístico para a mesma seed", () => {
    expect(avatarGradient("org-1")).toEqual(avatarGradient("org-1"));
  });
  it("retorna um par de cores", () => {
    const g = avatarGradient("x");
    expect(Array.isArray(g)).toBe(true);
    expect(g).toHaveLength(2);
  });
});

describe("Icon", () => {
  it("renderiza um svg para um nome conhecido", () => {
    const { container } = render(<Icon name="sparkles" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
  it("renderiza nada para um nome desconhecido", () => {
    const { container } = render(<Icon name="não-existe" />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });
});

describe("Avatar", () => {
  it("mostra as iniciais do nome", () => {
    render(<Avatar name="Mariana Costa" />);
    expect(screen.getByText("MC")).toBeInTheDocument();
  });
});

describe("RiskBadge", () => {
  it("rotula pela faixa de saúde", () => {
    const { rerender } = render(<RiskBadge health={90} />);
    expect(screen.getByText("Em dia")).toBeInTheDocument();
    rerender(<RiskBadge health={50} />);
    expect(screen.getByText("Atenção")).toBeInTheDocument();
    rerender(<RiskBadge health={20} />);
    expect(screen.getByText("Em risco")).toBeInTheDocument();
  });
});

describe("HealthRing", () => {
  it("mostra o número do score (arredondado e clampado)", () => {
    const { rerender } = render(<HealthRing health={72.4} />);
    expect(screen.getByText("72")).toBeInTheDocument();
    rerender(<HealthRing health={140} />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });
});

describe("Donut", () => {
  it("renderiza um círculo por segmento (+ trilho de fundo)", () => {
    const { container } = render(
      <Donut segments={[{ value: 3, color: "#000" }, { value: 1, color: "#f00" }]} />,
    );
    // 1 trilho de fundo + 2 segmentos = 3 círculos
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });
});

describe("Sparkline", () => {
  it("desenha um path com ≥2 pontos", () => {
    const { container } = render(<Sparkline data={[1, 3, 2, 5]} />);
    expect(container.querySelector("path")).toBeInTheDocument();
  });
  it("não quebra com dados insuficientes", () => {
    const { container } = render(<Sparkline data={[1]} />);
    expect(container.querySelector("path")).not.toBeInTheDocument();
  });
});
