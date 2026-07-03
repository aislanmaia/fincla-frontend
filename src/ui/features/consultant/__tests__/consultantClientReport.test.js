import { describe, expect, it } from "vitest";

import { findClientByOrg, resolveClientReportState } from "../consultantClientReport";

const ana = { organization_id: "a", client_name: "Ana", health: 90, patrimonio: "50000.00" };
const beto = { organization_id: "b", client_name: "Beto", health: 30, patrimonio: "1000.00" };
const clients = [ana, beto];

describe("findClientByOrg", () => {
  it("acha o cliente pelo organization_id", () => {
    expect(findClientByOrg(clients, "b")).toBe(beto);
  });

  it("retorna null quando não acha, sem id, ou lista inválida", () => {
    expect(findClientByOrg(clients, "z")).toBeNull();
    expect(findClientByOrg(clients, "")).toBeNull();
    expect(findClientByOrg(clients, undefined)).toBeNull();
    expect(findClientByOrg(null, "a")).toBeNull();
  });
});

describe("resolveClientReportState", () => {
  it("ready quando o cliente está na carteira", () => {
    const s = resolveClientReportState({ clients, id: "a", hasLoaded: true });
    expect(s.status).toBe("ready");
    expect(s.client).toBe(ana);
  });

  it("ready mesmo com erro presente, se o cliente já está na lista (preserva último bom)", () => {
    const s = resolveClientReportState({ clients, id: "a", hasLoaded: true, error: "boom" });
    expect(s.status).toBe("ready");
    expect(s.client).toBe(ana);
  });

  it("loading enquanto não carregou ou está buscando", () => {
    expect(resolveClientReportState({ clients: [], id: "a", hasLoaded: false }).status).toBe("loading");
    expect(resolveClientReportState({ clients: [], id: "a", hasLoaded: true, isLoading: true }).status).toBe("loading");
  });

  it("error quando carregou, sem lista e com erro", () => {
    const s = resolveClientReportState({ clients: [], id: "a", hasLoaded: true, error: "boom" });
    expect(s.status).toBe("error");
    expect(s.client).toBeNull();
  });

  it("not_found quando carregou sem erro e o id não é cliente do consultor", () => {
    const s = resolveClientReportState({ clients, id: "z", hasLoaded: true });
    expect(s.status).toBe("not_found");
    expect(s.client).toBeNull();
  });

  it("é seguro sem argumentos (default → loading)", () => {
    expect(resolveClientReportState().status).toBe("loading");
  });
});
