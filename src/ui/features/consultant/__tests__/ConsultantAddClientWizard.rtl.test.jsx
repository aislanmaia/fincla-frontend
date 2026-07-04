// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsultantAddClientWizard } from "../ConsultantAddClientWizard.jsx";

afterEach(cleanup);

function fillStep1() {
  fireEvent.change(screen.getByPlaceholderText("Ex.: Mariana Torres"), { target: { value: "Mariana Torres" } });
  fireEvent.change(screen.getByPlaceholderText("mariana@email.com"), { target: { value: "mariana@email.com" } });
}

describe("<ConsultantAddClientWizard>", () => {
  it("não renderiza quando fechado", () => {
    render(<ConsultantAddClientWizard open={false} onClose={() => {}} />);
    expect(screen.queryByPlaceholderText("Ex.: Mariana Torres")).not.toBeInTheDocument();
  });

  it("passo 1: 'Continuar' só habilita com nome + e-mail válidos", () => {
    render(<ConsultantAddClientWizard open onClose={() => {}} />);
    expect(screen.getByPlaceholderText("Ex.: Mariana Torres")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeDisabled();

    fillStep1();
    expect(screen.getByRole("button", { name: /Continuar/ })).not.toBeDisabled();
  });

  it("percorre até a revisão e o 'Criar cliente' leva ao estado honesto 'em breve' (sem forjar sucesso)", () => {
    render(<ConsultantAddClientWizard open onClose={() => {}} />);
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → org
    fireEvent.change(screen.getByPlaceholderText("Ex.: Finanças de Mariana"), { target: { value: "Finanças de Mariana" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → início
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → cartão
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → receita
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → perfil
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ })); // → revisar

    const criar = screen.getByRole("button", { name: /Criar cliente/ });
    fireEvent.click(criar);

    expect(screen.getByText("Provisionamento em breve")).toBeInTheDocument();
    expect(screen.queryByText("Cliente adicionado!")).not.toBeInTheDocument();
  }, 15000); // modal pesado + 6 re-renders: folga p/ contenção no full-suite paralelo
});
