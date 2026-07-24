import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Trava a experiência de app nativo. Cada bloco aqui corresponde a um defeito
 * real que já aconteceu neste repositório:
 *
 * - a barra de rolagem global, causada pela ausência de reset (o `margin: 8px`
 *   padrão do user-agent no `<body>` + shells em `100vh`);
 * - conteúdo INALCANÇÁVEL num container de rolagem centralizado, descoberto
 *   pela revisão adversarial da própria correção acima.
 */

const SRC = path.resolve(__dirname, "..", "..");
const UI = path.join(SRC, "ui");
const CSS = fs.readFileSync(path.join(UI, "app-shell.css"), "utf8");

const norm = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");

/** Arquivos de código/estilo sob `src`, exceto testes. */
function collect(dir, re, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") collect(full, re, out);
    } else if (re.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Remove comentários sem destruir código. A versão ingênua (`/\/\/.*$/gm`)
 * apagava de `xmlns='http://…'` em diante — 200 caracteres de um objeto de
 * estilo real em SimulacaoPage — e criava falso-verde.
 */
const stripComments = (code) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\w"'`])\/\/[^\n]*$/gm, "$1");

/** Luminância relativa (WCAG 2.x) de uma cor `#rrggbb`. */
function luminance(hex) {
  const ch = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("app-shell.css — invariantes do shell", () => {
  const css = norm(CSS);

  it("zera margin/padding do body (a origem da barra de rolagem global)", () => {
    expect(css).toMatch(/html,\s*body\s*\{[^}]*margin:\s*0/);
    expect(css).toMatch(/html,\s*body\s*\{[^}]*padding:\s*0/);
    expect(css).toMatch(/html,\s*body\s*\{[^}]*overscroll-behavior:\s*none/);
  });

  it("trava a viewport pelo html", () => {
    expect(css).toMatch(/(^|\})\s*html\s*\{[^}]*overflow:\s*hidden/);
  });

  it("usa `clip` no body, não `hidden`", () => {
    /**
     * Com o overflow do html propagado para a viewport, o valor usado do html
     * vira `visible` — e um `body { overflow: hidden }` faria do BODY um
     * container de rolagem sem barra, sem roda e sem teclado. Um
     * `scrollIntoView()` empurrava o app inteiro para fora da tela sem volta
     * (medido: body.scrollTop 0 → 2030). Caixa `clip` não rola.
     */
    expect(css).toMatch(/(^|\})\s*body\s*\{[^}]*overflow:\s*clip/);
    expect(css).not.toMatch(/(^|\})\s*body\s*\{[^}]*overflow:\s*hidden/);
  });

  it("dá altura total ao #root para os shells ancorarem em height:100%", () => {
    expect(css).toMatch(/#root\s*\{[^}]*height:\s*100%/);
  });

  it("não cria contexto de empilhamento no #root", () => {
    // `isolation: isolate` fazia portais em document.body pintarem por cima
    // de modais dentro do #root, invertendo o z-index.
    expect(css).not.toMatch(/#root\s*\{[^}]*isolation/);
  });

  it("mantém a barra invisível em repouso e a revela ao apontar", () => {
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    expect(css).toMatch(/scrollbar-color:\s*transparent transparent/);
    expect(css).toMatch(/:hover[^{]*\{[^}]*scrollbar-color:\s*#[0-9a-f]{6}/i);
  });

  it("o thumb revelado passa no contraste 3:1 da WCAG 1.4.11", () => {
    const thumb = css.match(/scrollbar-color:\s*(#[0-9a-f]{6})/i)?.[1];
    expect(thumb).toBeTruthy();
    // Sobre o fundo do app (T.bg) e sobre a superfície dos cards.
    expect(contrast(thumb, "#f8f7f5")).toBeGreaterThanOrEqual(3);
    expect(contrast(thumb, "#ffffff")).toBeGreaterThanOrEqual(3);
  });

  it("é carregado uma única vez, pelo entrypoint", () => {
    const main = fs.readFileSync(path.join(SRC, "main.jsx"), "utf8");
    expect(main).toContain("app-shell.css");
  });
});

describe("nenhuma tela dimensiona conteúdo em vh", () => {
  /**
   * `vh` ignora a barra do browser no mobile e estoura o shell. A altura vem
   * do pai (`height: 100%` / `flex: 1`); quando a viewport é mesmo a
   * referência (shell raiz, elemento `position: fixed`), usa-se `dvh`.
   */
  it("varre src (código e CSS) e não encontra nenhum uso", () => {
    const files = collect(SRC, /\.(jsx?|tsx?|css)$/);
    const offenders = files
      .filter((f) => !f.endsWith("app-shell.css"))
      .filter((f) => /\b\d+(?:\.\d+)?vh\b/i.test(stripComments(fs.readFileSync(f, "utf8"))))
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it("index.html também está limpo", () => {
    const html = fs.readFileSync(path.resolve(SRC, "..", "index.html"), "utf8");
    expect(html).not.toMatch(/\b\d+(?:\.\d+)?vh\b/i);
  });
});

describe("nenhum container de rolagem centralizado no eixo do scroll", () => {
  /**
   * `align-items: center` (linha) ou `justify-content: center` (coluna) num
   * elemento que rola torna INALCANÇÁVEL tudo que passa da borda inicial:
   * `scrollTop` não vai abaixo de zero. Medido nas telas de auth: 32px a
   * 1280×300 e 44px a 200% de zoom — sumia o título do login, e não há mais
   * scroll de documento para servir de escape. Use `safe center`, que degrada
   * para `start` quando o conteúdo não cabe.
   */
  it("varre src/ui", () => {
    const offenders = [];
    for (const file of collect(UI, /\.jsx?$/)) {
      const src = fs.readFileSync(file, "utf8");
      const re = /style=\{\{/g;
      let m;
      while ((m = re.exec(src))) {
        let i = m.index + 8;
        let depth = 2;
        let body = "";
        while (i < src.length && depth > 0) {
          const c = src[i];
          if (c === "{") depth++;
          else if (c === "}") depth--;
          if (depth > 0) body += c;
          i++;
        }
        if (!/overflow(Y)?:\s*["'](auto|scroll)/.test(body)) continue;
        // Eixo do scroll é o vertical: alinhado por `alignItems` em `row`
        // (padrão) e por `justifyContent` em `column`.
        const axis = /flexDirection:\s*["']column/.test(body) ? "justifyContent" : "alignItems";
        if (new RegExp(`${axis}:\\s*["']center["']`).test(body)) {
          const line = src.slice(0, m.index).split("\n").length;
          offenders.push(`${path.relative(SRC, file)}:${line} (${axis})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("nenhum <style> injetado disputa o shell com app-shell.css", () => {
  /**
   * Um `<style>` montado em runtime vence a folha empacotada (mesma
   * especificidade, vem depois no documento). Reintroduzir `body{margin:8px}`
   * por ali ressuscitaria exatamente o bug original, e nada acusaria.
   */
  it("nenhuma regra de html/body mexe em margin/padding/overflow/height", () => {
    const offenders = [];
    for (const file of collect(UI, /\.jsx?$/)) {
      const code = fs.readFileSync(file, "utf8");
      for (const block of code.match(/<style>\{`[\s\S]*?`\}<\/style>/g) || []) {
        const rules = block.match(/(^|[;}\s])(html|body)\s*(,\s*(html|body)\s*)?\{[^}]*\}/g) || [];
        for (const rule of rules) {
          if (/(margin|padding|overflow|height)\s*:/.test(rule)) {
            offenders.push(`${path.relative(SRC, file)}: ${rule.trim().slice(0, 60)}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
