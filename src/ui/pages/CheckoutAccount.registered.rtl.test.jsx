// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RegisteredCheckoutAccount } from "./CheckoutAccount.jsx";

afterEach(cleanup);

describe("<RegisteredCheckoutAccount> (#344)", () => {
  it("conta logada: nome vem da conta e campos que ela não tem não aparecem vazios", () => {
    render(<RegisteredCheckoutAccount details={null} email="lara@example.com" user={{ first_name: "Lara", last_name: "Souza", email: "lara@example.com" }} />);
    expect(screen.getByDisplayValue("Lara Souza")).toBeInTheDocument();
    expect(screen.getByDisplayValue("lara@example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("CPF/CNPJ")).toBeNull();
    expect(screen.queryByLabelText("Celular com DDD")).toBeNull();
    expect(screen.getByText("Você está entrando como lara@example.com")).toBeInTheDocument();
    expect(screen.queryByText(/Conta criada/)).toBeNull();
    expect(screen.queryByLabelText("Senha")).toBeNull();
  });

  it("cadastro feito no próprio checkout mostra o que a pessoa digitou", () => {
    render(<RegisteredCheckoutAccount details={{ name: "Ana", email: "ana@example.com", cpfCnpj: "123.456.789-09", phone: "(11) 91234-5678" }} email="ana@example.com" />);
    expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
    expect(screen.getByDisplayValue("123.456.789-09")).toBeInTheDocument();
    expect(screen.getByDisplayValue("(11) 91234-5678")).toBeInTheDocument();
    expect(screen.getByText("Conta criada para ana@example.com")).toBeInTheDocument();
  });
});
