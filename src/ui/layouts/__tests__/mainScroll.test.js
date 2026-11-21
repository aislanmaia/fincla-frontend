import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { mainScrollStyle } from "../mainScroll.js";

/**
 * A área de conteúdo do shell (a região que rola). Na tela que ocupa a altura que sobra (a tela
 * inicial do Conciliar extrato, no computador), ela vira coluna flex: o aviso de acesso (AccessNotice)
 * fica em cima e a página ocupa só o que sobra DEPOIS dele, sem a tela passar a rolar por causa do
 * aviso (G3 achado 9). Com conteúdo maior, a região continua rolando.
 */
describe("mainScrollStyle", () => {
  it("tela que ocupa a altura que sobra: coluna flex que continua rolando", () => {
    const s = mainScrollStyle({ selfScrolling: false, ledger: false, fillsHeight: true, isMobile: false });
    expect(s.display).toBe("flex");
    expect(s.flexDirection).toBe("column");
    expect(s.overflowY).toBe("auto");
    expect(s.padding).toBe("20px 28px 40px");
  });

  it("demais telas do computador: como sempre (bloco que rola, sem flex)", () => {
    const s = mainScrollStyle({ selfScrolling: false, ledger: false, fillsHeight: false, isMobile: false });
    expect(s.display).toBeUndefined();
    expect(s.overflowY).toBe("auto");
    expect(s.overflowX).toBe("hidden");
    expect(s.flex).toBe(1);
    expect(s.minHeight).toBe(0);
  });

  it("Transações no celular (rola por conta própria): coluna flex sem rolagem, como antes", () => {
    const s = mainScrollStyle({ selfScrolling: true, ledger: false, fillsHeight: false, isMobile: true });
    expect(s).toMatchObject({ display: "flex", flexDirection: "column", overflowY: "hidden", overflowX: "clip", padding: "14px 14px 0" });
    expect(mainScrollStyle({ selfScrolling: true, ledger: true, fillsHeight: false, isMobile: true }).padding).toBe(0);
    expect(mainScrollStyle({ selfScrolling: false, ledger: false, fillsHeight: false, isMobile: true }).padding).toBe("14px 14px 40px");
  });

  it("o App usa este estilo e liga a tela à página que estica (fillMin)", () => {
    const app = fs.readFileSync(path.resolve(__dirname, "..", "..", "App.jsx"), "utf8");
    expect(app).toMatch(/style=\{mainScrollStyle\(\{[^}]*fillsHeight[^}]*\}\)\}/);
    expect(app).toMatch(/const fillsHeight = !selfScrollingScreen && fillsAvailableHeight\(pathname, isMobile\)/);
    expect(app).toMatch(/<PageEnter [^>]*fillMin=\{fillsHeight\}/);
  });
});
