// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsultantExportModal } from "../ConsultantExportModal.jsx";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("<ConsultantExportModal>", () => {
  it("não renderiza quando fechado", () => {
    const { container } = render(<ConsultantExportModal open={false} onExport={() => {}} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("PDF é o default e exporta no formato selecionado", () => {
    const onExport = vi.fn();
    render(<ConsultantExportModal open onExport={onExport} onClose={() => {}} />);

    // Default = PDF → o botão de ação diz "Exportar PDF"
    expect(screen.getByRole("button", { name: /Exportar PDF/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Exportar PDF/ }));
    expect(onExport).toHaveBeenCalledWith("pdf");
  });

  it("trocar para CSV muda o botão e o formato exportado", () => {
    const onExport = vi.fn();
    render(<ConsultantExportModal open onExport={onExport} onClose={() => {}} />);

    fireEvent.click(screen.getByText("CSV"));
    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));
    expect(onExport).toHaveBeenCalledWith("csv");
  });

  it("o botão fica desabilitado durante o export", () => {
    render(<ConsultantExportModal open exporting onExport={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /Exportando/ })).toBeDisabled();
  });
});
