import { describe, expect, it } from "vitest";

import {
  RISK_FILTERS,
  SORT_OPTIONS,
  clientHealthBand,
  selectConsultantClients,
} from "../consultantClientsView.js";

/** Fábrica enxuta — só os campos que o modelo de filtro/ordenação usa. */
function client(over = {}) {
  return {
    organization_id: over.organization_id ?? "org-x",
    organization_name: over.organization_name ?? "Org X",
    client_name: over.client_name ?? "Cliente X",
    health: over.health ?? 80,
    patrimonio: over.patrimonio ?? "1000.00",
    balance: over.balance ?? "0.00",
    ...over,
  };
}

const ana = client({ organization_id: "a", client_name: "Ana Beatriz", health: 92, patrimonio: "50000.00" });
const bruno = client({ organization_id: "b", client_name: "Bruno Álvares", health: 55, patrimonio: "-2000.00" });
const carla = client({ organization_id: "c", client_name: "Carla Dias", health: 30, patrimonio: "12000.00" });

const all = [ana, bruno, carla];

describe("clientHealthBand", () => {
  it("classifica saudável / atenção / em risco pelas faixas", () => {
    expect(clientHealthBand(92)).toBe("healthy");
    expect(clientHealthBand(70)).toBe("healthy");
    expect(clientHealthBand(69.9)).toBe("attention");
    expect(clientHealthBand(40)).toBe("attention");
    expect(clientHealthBand(39.9)).toBe("risk");
    expect(clientHealthBand(0)).toBe("risk");
  });
});

describe("catálogos (ids em inglês, labels PT-BR)", () => {
  it("expõe os filtros de risco começando por 'all'", () => {
    expect(RISK_FILTERS.map((f) => f.id)).toEqual(["all", "risk", "attention", "healthy"]);
    expect(RISK_FILTERS.every((f) => typeof f.label === "string" && f.label.length > 0)).toBe(true);
  });
  it("expõe as chaves de ordenação saúde/patrimônio/nome", () => {
    expect(SORT_OPTIONS.map((o) => o.id)).toEqual(["health", "patrimonio", "name"]);
  });
});

describe("selectConsultantClients — busca", () => {
  it("filtra por nome (case-insensitive e ignorando acentos)", () => {
    expect(selectConsultantClients(all, { query: "alvares" }).map((c) => c.organization_id)).toEqual(["b"]);
    expect(selectConsultantClients(all, { query: "ANA" }).map((c) => c.organization_id)).toEqual(["a"]);
  });
  it("também casa pelo nome da organização", () => {
    const withOrg = client({ organization_id: "z", client_name: "Sem Dono", organization_name: "Família Souza" });
    expect(selectConsultantClients([...all, withOrg], { query: "souza" }).map((c) => c.organization_id)).toEqual(["z"]);
  });
  it("query vazia/espaços não filtra nada", () => {
    expect(selectConsultantClients(all, { query: "   " })).toHaveLength(3);
    expect(selectConsultantClients(all, {})).toHaveLength(3);
  });
  it("sem correspondência devolve lista vazia", () => {
    expect(selectConsultantClients(all, { query: "zzz" })).toEqual([]);
  });
});

describe("selectConsultantClients — filtro de risco", () => {
  it("'all' devolve todos", () => {
    expect(selectConsultantClients(all, { riskFilter: "all" })).toHaveLength(3);
  });
  it("filtra por faixa de saúde", () => {
    expect(selectConsultantClients(all, { riskFilter: "healthy" }).map((c) => c.organization_id)).toEqual(["a"]);
    expect(selectConsultantClients(all, { riskFilter: "attention" }).map((c) => c.organization_id)).toEqual(["b"]);
    expect(selectConsultantClients(all, { riskFilter: "risk" }).map((c) => c.organization_id)).toEqual(["c"]);
  });
});

describe("selectConsultantClients — ordenação", () => {
  it("por saúde ascendente (piores primeiro) — default", () => {
    expect(selectConsultantClients(all, {}).map((c) => c.organization_id)).toEqual(["c", "b", "a"]);
  });
  it("por saúde descendente", () => {
    expect(
      selectConsultantClients(all, { sortKey: "health", sortDir: "desc" }).map((c) => c.organization_id),
    ).toEqual(["a", "b", "c"]);
  });
  it("por patrimônio (parseia string decimal, negativo por último no desc)", () => {
    expect(
      selectConsultantClients(all, { sortKey: "patrimonio", sortDir: "desc" }).map((c) => c.organization_id),
    ).toEqual(["a", "c", "b"]);
  });
  it("por nome (localeCompare PT-BR, ignora acento)", () => {
    expect(
      selectConsultantClients(all, { sortKey: "name", sortDir: "asc" }).map((c) => c.organization_id),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("selectConsultantClients — pureza e combinação", () => {
  it("não muta a lista de entrada", () => {
    const input = [...all];
    const snapshot = input.map((c) => c.organization_id);
    selectConsultantClients(input, { sortKey: "health", sortDir: "desc" });
    expect(input.map((c) => c.organization_id)).toEqual(snapshot);
  });
  it("combina busca + filtro + ordenação", () => {
    const extra = client({ organization_id: "d", client_name: "Ana Paula", health: 20, patrimonio: "300.00" });
    const out = selectConsultantClients([...all, extra], {
      query: "ana",
      riskFilter: "risk",
      sortKey: "name",
      sortDir: "asc",
    });
    expect(out.map((c) => c.organization_id)).toEqual(["d"]);
  });
  it("entrada não-array devolve []", () => {
    expect(selectConsultantClients(null, {})).toEqual([]);
    expect(selectConsultantClients(undefined, {})).toEqual([]);
  });
});
