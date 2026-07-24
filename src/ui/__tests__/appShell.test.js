import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Trava a experiência de app nativo: o documento não rola e nenhuma tela
 * pede altura da viewport para o próprio conteúdo.
 *
 * Regressão que motivou o teste: o projeto não tinha reset algum, então o
 * `margin: 8px` padrão do user-agent no `<body>` somado aos shells em `100vh`
 * deixava o documento 16px mais alto que a viewport — uma barra de rolagem
 * global envolvendo o app inteiro, em TODAS as telas.
 */

const SRC = path.resolve(__dirname, "..", "..");
const CSS = fs.readFileSync(path.join(SRC, "ui", "app-shell.css"), "utf8");

const norm = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");

describe("app-shell.css — invariantes do shell", () => {
  const css = norm(CSS);

  it("zera margin/padding do body (a origem da barra de rolagem global)", () => {
    expect(css).toMatch(/html,\s*body\s*\{[^}]*margin:\s*0/);
    expect(css).toMatch(/html,\s*body\s*\{[^}]*padding:\s*0/);
  });

  it("trava o documento: html/body não rolam", () => {
    expect(css).toMatch(/html,\s*body\s*\{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/html,\s*body\s*\{[^}]*overscroll-behavior:\s*none/);
  });

  it("dá altura total ao #root para os shells ancorarem em height:100%", () => {
    expect(css).toMatch(/#root\s*\{[^}]*height:\s*100%/);
  });

  it("oculta a barra de rolagem por padrão em todo elemento", () => {
    expect(css).toMatch(/\*\s*\{[^}]*scrollbar-width:\s*none/);
    expect(css).toMatch(/\*::-webkit-scrollbar\s*\{[^}]*width:\s*0/);
  });

  it("é carregado uma única vez, pelo entrypoint", () => {
    const main = fs.readFileSync(path.join(SRC, "main.jsx"), "utf8");
    expect(main).toContain("app-shell.css");
  });
});

describe("nenhuma tela dimensiona conteúdo em 100vh", () => {
  /**
   * `100vh` ignora a barra do browser no mobile e volta a estourar o shell.
   * A altura vem do pai (`height: 100%` / `flex: 1` + `min-height: 0`); quando
   * a viewport é mesmo a referência (shell raiz, elemento `position: fixed`),
   * usa-se `100dvh`.
   */
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") walk(full);
      } else if (/\.(jsx?|tsx?)$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(path.join(SRC, "ui"));

  it("varre src/ui e não encontra nenhum uso", () => {
    const offenders = files.filter((file) => {
      const code = fs
        .readFileSync(file, "utf8")
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      return /\b100vh\b/.test(code);
    });
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
