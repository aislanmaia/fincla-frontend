import { describe, expect, it } from "vitest";

import { fmtComputedAt } from "../consultantFormat";

const NOW = new Date("2026-07-11T18:00:00Z").getTime();
const iso = (isoString) => fmtComputedAt(isoString, NOW);

describe("fmtComputedAt", () => {
  it("diz 'agora mesmo' abaixo de um minuto", () => {
    expect(iso("2026-07-11T17:59:30Z")).toBe("agora mesmo");
  });

  it("singular e plural em minutos", () => {
    expect(iso("2026-07-11T17:59:00Z")).toBe("há 1 minuto");
    expect(iso("2026-07-11T17:57:00Z")).toBe("há 3 minutos");
  });

  it("passa para horas e dias", () => {
    expect(iso("2026-07-11T17:00:00Z")).toBe("há 1 hora");
    expect(iso("2026-07-11T13:00:00Z")).toBe("há 5 horas");
    expect(iso("2026-07-09T18:00:00Z")).toBe("há 2 dias");
  });

  it("respeita o offset em vez de ler como hora local", () => {
    // O MESMO instante das 18:00Z, escrito com offset de Brasília. Se o parser
    // ignorasse o offset, isto viraria "há 3 horas" — a mentira que o campo
    // `computed_at` existe para impedir.
    expect(iso("2026-07-11T15:00:00-03:00")).toBe("agora mesmo");
  });

  it("um timestamp no futuro não vira 'há -2 minutos'", () => {
    // Relógio do cliente atrasado em relação ao servidor: acontece, e um número
    // negativo na tela seria absurdo.
    expect(iso("2026-07-11T18:05:00Z")).toBe("agora mesmo");
  });

  it("devolve null quando não há o que dizer", () => {
    expect(iso(null)).toBeNull();
    expect(iso(undefined)).toBeNull();
    expect(iso("")).toBeNull();
    expect(iso("nao-e-uma-data")).toBeNull();
  });
});
