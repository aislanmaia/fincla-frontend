// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FacetPanelContent } from "../../filters/facetBar/FacetPanelContent.jsx";

afterEach(cleanup);

const CATEGORIES = [
  { id: "alim", label: "Alimentação", color: "#059669", icon: "🍽" },
  { id: "trans", label: "Transporte", color: "#2563EB", icon: "🚗" },
  { id: "moradia", label: "Moradia", color: "#6B7280", icon: "🏠" },
];

const CARDS = [
  { id: "nub", label: "Nubank", last4: "1177", color: "#7C3AED", subtitle: "Fatura dia 5" },
  { id: "itau", label: "Itaú", last4: "4421", color: "#FF7A00" },
];

describe("<PeriodPanel>", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 8, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function Harness() {
    const [period, setPeriod] = useState("mes");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    return (
      <FacetPanelContent
        facetKey="periodo"
        period={period}
        setPeriod={setPeriod}
        customFrom={from}
        setCustomFrom={setFrom}
        customTo={to}
        setCustomTo={setTo}
        onClose={() => {}}
      />
    );
  }
  it("preset ativo reflete datas nos inputs e no intervalo", () => {
    render(<Harness />);
    expect(screen.getByLabelText(/^De$/i)).toHaveValue("01/06/2026");
    expect(screen.getByLabelText(/^Até$/i)).toHaveValue("30/06/2026");
    expect(screen.getByText("1–30 jun")).toBeInTheDocument();
  });
  it("trocar para Últimos 3m atualiza De/Até e intervalo", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Preset: Últimos 3m/i }));
    expect(screen.getByLabelText(/^De$/i)).toHaveValue("08/03/2026");
    expect(screen.getByLabelText(/^Até$/i)).toHaveValue("08/06/2026");
    expect(screen.getByText(/8 mar.*8 jun/i)).toBeInTheDocument();
  });
  it("preset ativo tem aria-pressed=true", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: /Preset: Este mês/i })).toHaveAttribute("aria-pressed", "true");
  });
  it("trocar preset atualiza aria-pressed", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Preset: Hoje/i }));
    expect(screen.getByRole("button", { name: /Preset: Hoje/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Preset: Este mês/i })).toHaveAttribute("aria-pressed", "false");
  });
  it("inserir data muda para período custom", () => {
    render(<Harness />);
    const fromInput = screen.getByLabelText(/^De$/i);
    fireEvent.change(fromInput, { target: { value: "01/05/2026" } });
    fireEvent.blur(fromInput);
    expect(screen.getByRole("button", { name: /Preset: Este mês/i })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("<TypePanel>", () => {
  function Harness() {
    const [type, setType] = useState("todos");
    return <FacetPanelContent facetKey="tipo" type={type} setType={setType} onClose={() => {}} />;
  }
  it("seleciona Despesa", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Despesa" }));
    expect(screen.getByRole("button", { name: "Despesa" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("<PaymentMethodPanel>", () => {
  function Harness({ type = "todos", initial = [] } = {}) {
    const [method, setMethod] = useState(initial);
    return (
      <FacetPanelContent
        facetKey="forma"
        type={type}
        method={method}
        setMethod={setMethod}
        onClose={() => {}}
      />
    );
  }

  it("lista opcoes de despesa quando o tipo e despesa", () => {
    render(<Harness type="despesa" />);
    expect(screen.getByRole("button", { name: "Crédito" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Boleto" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transferência" })).not.toBeInTheDocument();
  });

  it("lista opcoes de receita quando o tipo e receita", () => {
    render(<Harness type="receita" />);
    expect(screen.getByRole("button", { name: "Transferência" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crédito" })).not.toBeInTheDocument();
  });

  it("seleciona mais de uma forma de pagamento sem fechar automaticamente", async () => {
    render(<Harness type="despesa" />);
    await userEvent.click(screen.getByRole("button", { name: "Crédito" }));
    expect(screen.getByRole("button", { name: "Crédito" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Pix" }));
    expect(screen.getByRole("button", { name: "Pix" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("<CategoryPanel>", () => {
  function Harness({ initial = [] }) {
    const [cats, setCats] = useState(initial);
    return (
      <FacetPanelContent
        facetKey="categoria"
        cats={cats}
        setCats={setCats}
        categories={CATEGORIES}
        onClose={() => {}}
      />
    );
  }
  it("renderiza todas e permite toggle múltiplo", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Alimentação" }));
    expect(screen.getByRole("button", { name: "Alimentação" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Transporte" }));
    expect(screen.getByRole("button", { name: "Transporte" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Alimentação" })).toHaveAttribute("aria-pressed", "true");
  });
  it("Limpar zera seleção", async () => {
    render(<Harness initial={["alim"]} />);
    await userEvent.click(screen.getByRole("button", { name: /Limpar/i }));
    expect(screen.getByRole("button", { name: "Alimentação" })).toHaveAttribute("aria-pressed", "false");
  });
  it("Todas seleciona todas", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Todas/i }));
    for (const c of CATEGORIES) {
      expect(screen.getByRole("button", { name: c.label })).toHaveAttribute("aria-pressed", "true");
    }
  });
  it("busca filtra a grade", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText(/Buscar categoria/i), "alim");
    expect(screen.getByRole("button", { name: "Alimentação" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transporte" })).not.toBeInTheDocument();
  });
  it("mostra estado vazio quando não há categorias", () => {
    render(
      <FacetPanelContent
        facetKey="categoria"
        cats={[]}
        setCats={() => {}}
        categories={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Nenhuma categoria disponível/i)).toBeInTheDocument();
  });
});

describe("<TagPanel>", () => {
  function Harness({ initial = [] }) {
    const [tags, setTags] = useState(initial);
    return (
      <FacetPanelContent
        facetKey="tag"
        tags={tags}
        setTags={setTags}
        allTags={["trabalho", "casa", "viagem"]}
        onClose={() => {}}
      />
    );
  }
  it("toggle de tag", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Tag trabalho/i }));
    expect(screen.getByRole("button", { name: /Tag trabalho/i })).toHaveAttribute("aria-pressed", "true");
  });
  it("busca por substring", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText(/Buscar tag/i), "via");
    expect(screen.getByRole("button", { name: /Tag viagem/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tag casa/i })).not.toBeInTheDocument();
  });
});

describe("<CardPanel>", () => {
  function Harness({ initial = [] }) {
    const [cardSel, setCardSel] = useState(initial);
    return (
      <FacetPanelContent
        facetKey="cartao"
        cardSel={cardSel}
        setCardSel={setCardSel}
        cards={CARDS}
        onClose={() => {}}
      />
    );
  }
  it("toggle de cartão", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Nubank" }));
    expect(screen.getByRole("button", { name: "Nubank" })).toHaveAttribute("aria-pressed", "true");
  });
  it("estado vazio quando não há cartões", () => {
    render(
      <FacetPanelContent
        facetKey="cartao"
        cardSel={[]}
        setCardSel={() => {}}
        cards={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Nenhum cartão cadastrado/i)).toBeInTheDocument();
  });
});

describe("<ValuePanel>", () => {
  function Harness() {
    const [vmin, setVmin] = useState("");
    const [vmax, setVmax] = useState("");
    return (
      <FacetPanelContent
        facetKey="valor"
        valueMin={vmin}
        valueMax={vmax}
        setValueMin={setVmin}
        setValueMax={setVmax}
        onClose={() => {}}
      />
    );
  }
  it("inputs disparam setters", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText(/Valor mínimo/i), "200,00");
    expect(screen.getByLabelText(/Valor mínimo/i)).toHaveValue("200,00");
  });
});

describe("<RecPanel>", () => {
  function Harness() {
    const [rec, setRec] = useState("any");
    return <FacetPanelContent facetKey="recorrencia" rec={rec} setRec={setRec} onClose={() => {}} />;
  }
  it("seleciona Apenas recorrentes", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: /Apenas recorrentes/i }));
    expect(screen.getByRole("button", { name: /Apenas recorrentes/i })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("PanelHeader (close button)", () => {
  it("Fechar chama onClose", async () => {
    const onClose = vi.fn();
    render(
      <FacetPanelContent
        facetKey="tipo"
        type="todos"
        setType={() => {}}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Fechar painel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("FacetPanelContent (mux)", () => {
  it("key desconhecida não renderiza nada", () => {
    const { container } = render(<FacetPanelContent facetKey="lol" onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
