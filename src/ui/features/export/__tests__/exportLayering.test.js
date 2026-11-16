import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * G3-1-11 — a dependência aponta para o lado certo: o `SideDrawer` é um componente compartilhado e o painel de
 * exportação é compartilhado por Transações, cartão, fatura e Relatórios. Nenhum dos dois pode depender de uma
 * feature de tela (`features/transactions`, `features/cardTransactions`), senão o "compartilhado" carrega a tela.
 */
const read = (path) => readFileSync(resolve(__dirname, path), "utf8");
const imports = (source) => [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

describe("camadas do painel de exportação", () => {
  it("SideDrawer não importa nenhuma feature", () => {
    expect(imports(read("../../../components/SideDrawer.jsx")).filter((path) => path.includes("features/"))).toEqual([]);
  });

  it("features/export não importa outra feature", () => {
    const dir = resolve(__dirname, "..");
    const files = readdirSync(dir).filter((name) => /\.(jsx?|tsx?)$/.test(name));
    const offenders = files.flatMap((name) =>
      imports(read(`../${name}`))
        // `../x/…` from features/export is a sibling feature; `…/features/<other>` too.
        .filter((path) => /^\.\.\/(?!\.\.\/)/.test(path) || /features\/(?!export\/)/.test(path))
        .map((path) => `${name} -> ${path}`),
    );
    expect(offenders).toEqual([]);
  });
});
