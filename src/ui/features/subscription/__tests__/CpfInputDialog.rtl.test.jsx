// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CpfInputDialog } from "../CpfInputDialog.jsx";

afterEach(cleanup);

describe("<CpfInputDialog>", () => {
  it("keeps the submit button disabled until a valid CPF (11 digits) is entered", async () => {
    const onSubmit = vi.fn();
    render(<CpfInputDialog onSubmit={onSubmit} onClose={vi.fn()} />);

    const submit = screen.getByTestId("cpf-dialog-submit");
    expect(submit).toBeDisabled();

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "12345678");
    expect(submit).toBeDisabled();

    await userEvent.type(input, "909"); // total 11 digits
    expect(submit).not.toBeDisabled();
  });

  it("formats the input with the CPF mask while typing", async () => {
    render(<CpfInputDialog onSubmit={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "12345678909");
    expect(input).toHaveValue("123.456.789-09");
  });

  it("switches to CNPJ mask when more than 11 digits are entered", async () => {
    render(<CpfInputDialog onSubmit={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "12345678000199");
    expect(input).toHaveValue("12.345.678/0001-99");
  });

  it("submits only the digit-stripped document on click", async () => {
    const onSubmit = vi.fn();
    render(<CpfInputDialog onSubmit={onSubmit} onClose={vi.fn()} />);

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "123.456.789-09");
    await userEvent.click(screen.getByTestId("cpf-dialog-submit"));

    expect(onSubmit).toHaveBeenCalledWith("12345678909");
  });

  it("shows an inline validation error after blur with partial digits", async () => {
    render(<CpfInputDialog onSubmit={vi.fn()} onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    await userEvent.type(input, "1234567");
    await userEvent.tab(); // triggers blur
    expect(
      screen.getByText(/informe 11 dígitos.*ou 14 dígitos/i),
    ).toBeInTheDocument();
  });

  it("renders the backend error message when provided", () => {
    render(
      <CpfInputDialog
        onSubmit={vi.fn()}
        onClose={vi.fn()}
        errorMessage="CPF inválido segundo o gateway."
      />,
    );
    expect(
      screen.getByText(/CPF inválido segundo o gateway/i),
    ).toBeInTheDocument();
  });

  it("disables the close button while submitting", () => {
    render(
      <CpfInputDialog
        onSubmit={vi.fn()}
        onClose={vi.fn()}
        isSubmitting
      />,
    );
    expect(screen.getByLabelText("Fechar")).toBeDisabled();
    expect(screen.getByTestId("cpf-dialog-submit")).toBeDisabled();
  });
});
