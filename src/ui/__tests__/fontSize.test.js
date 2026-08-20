import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Trava o piso de tamanho de fonte da UI (issue #86 — WCAG).
 *
 * A WCAG não fixa um mínimo em px: 1.4.4 exige que o texto redimensione até
 * 200% sem perda, e 1.4.3 exige contraste (4.5:1 para texto normal, 3:1 para
 * texto grande ≥18.66px em negrito ou ≥24px). Na prática, corpo abaixo de
 * ~11px em produto denso já compromete legibilidade — e piora exatamente
 * onde o contraste é mais fraco (rótulo cinza-claro pequeno é o pior caso).
 *
 * Piso adotado: 11px para texto de interface (rótulos, legendas, chips,
 * valores). Abaixo disso, ou aumenta o tamanho, ou — quando o tamanho já
 * está correto e o problema é cor — escurece o token (ver `T.inkGhost` em
 * `tokens.js`, #646E7C — 4.7:1+ nas 3 superfícies onde aparece como texto;
 * uso decorativo/inativo — não-texto — foi para `T.inkFaint`, que mantém o
 * tom claro original porque WCAG 1.4.3 não cobre não-texto e 1.4.11 isenta
 * componentes inativos).
 *
 * Exceções em duas categorias: `PERMANENT_EXCEPTIONS` (o piso em px não se
 * aplica ao domínio do arquivo — ex.: pt de PDF) e `SECOND_PASS_EXCEPTIONS`
 * (colisão real com outro trabalho em voo no momento desta análise; devem
 * ser corrigidos assim que a colisão acabar).
 */
const FLOOR = 11;

const SRC = path.resolve(__dirname, "..", "..");
const UI = path.join(SRC, "ui");

const toRel = (p) => p.split("/").join(path.sep);

const PERMANENT_EXCEPTIONS = new Map(
  [
    [
      "ui/features/consultant/ConsultantReportPdf.jsx",
      "StyleSheet do @react-pdf/renderer: fontSize é pt de PDF em layout A4 " +
        "fixo (várias <Section wrap={false}>), não px de tela — o piso de " +
        "11px chegou a quebrar linha nos 4 KPIs e desalinhar o layout. " +
        "Contraste tratado à parte: C.light saiu de #9CA3AF (~2.5:1) para " +
        "#6B7280 (~4.8:1 sobre a página branca), sem mexer em tamanho.",
    ],
  ].map(([k, v]) => [toRel(k), v]),
);

// issue #104: Topbar.jsx e ConsultantClientOverviewTab.jsx saíram daqui —
// a colisão relatada na PR #99 não se confirmou (nenhum commit novo nos
// dois arquivos desde a divergência de fix/wcag-font-sizes) e as violações
// reais foram corrigidas nos próprios arquivos.
const SECOND_PASS_EXCEPTIONS = new Map();

/** Arquivos de código sob `src/ui`, exceto testes. */
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
 * Remove comentários sem destruir código (mesmo princípio de
 * appShell.test.js). Sem isso, "fontSize:9" dentro de um COMENTÁRIO —
 * aconteceu neste próprio arquivo, numa explicação em prosa sobre o piso —
 * virava um falso match: o texto capturado seguia até a próxima `,`/`}` do
 * CÓDIGO real, atravessando linhas de comentário no meio do caminho.
 */
const stripComments = (code) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\w"'`])\/\/[^\n]*$/gm, "$1");

/**
 * A partir de `src[startIndex]` (logo após "fontSize:" ou o `{` de abertura
 * de "fontSize={"), devolve o texto do valor respeitando profundidade de
 * `()`, `[]` e `{}` — não só um nível, como uma regex simples faria (que
 * truncava `Math.max(11, Math.round(x))` em "Math.max(11" no primeiro `,`
 * dentro dos parênteses internos).
 *
 * `stopChars`: caracteres (fora de `stopChars`, um `}` de profundidade 0
 * SEMPRE fecha — é o que fecha o objeto de estilo ou o atributo JSX que
 * envolve o valor). No objeto de estilo o valor termina em `,` ou `}`
 * (`stopChars = ","`); no atributo JSX só o `}` fecha (`stopChars = ""`);
 * numa declaração `const X = <rhs>;` o `<rhs>` termina em `;`
 * (`stopChars = ";"`) — usar vírgula ali cortaria `Math.max(11, x)` de novo.
 */
function captureBalanced(src, startIndex, stopChars) {
  let depth = 0;
  let i = startIndex;
  while (i < src.length) {
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") {
      depth++;
    } else if (c === ")" || c === "]") {
      depth--;
    } else if (c === "}") {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0 && stopChars.includes(c)) {
      break;
    }
    i++;
  }
  return src.slice(startIndex, i);
}

/** Separa os argumentos de uma chamada tipo `Math.max(a, b, c)` respeitando parênteses aninhados. */
function splitTopLevelArgs(argsStr) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const c of argsStr) {
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    if (c === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  if (current.trim() !== "") parts.push(current);
  return parts;
}

/**
 * A partir do valor bruto de um `fontSize` (ex.: `isMobile?i===3?13:17:...`,
 * `Math.max(11, categoryNumSize - 1)`, `"9px"`), devolve só os números que
 * são efetivamente um TAMANHO — ou `null` quando o valor não é verificável
 * estaticamente (identificador puro não resolvido, fórmula aritmética,
 * indexação de array).
 */
function leafSizes(rawExpr) {
  const expr = rawExpr.trim();
  if (expr === "") return null;

  // Indexação de array (`dims[isMobile ? 0 : 1]`): o `?`/`:` ali seleciona
  // um ÍNDICE, não um tamanho — viraria falso-positivo `fontSize: 0` se
  // caísse no scan de ternário abaixo. Não verificável por regex; audita
  // à mão.
  if (expr.includes("[")) return null;

  // Math.max(a, b, …) garante o piso em runtime: o resultado é sempre >= a
  // CADA argumento literal presente, não só o primeiro — por isso o piso
  // real é o MAIOR literal entre os argumentos, e `Math.max(size * 0.3, 8)`
  // (piso no 2º argumento) é pego do mesmo jeito que `Math.max(8, size*0.3)`.
  const mathMax = expr.match(/^Math\.max\((.*)\)$/s);
  if (mathMax) {
    const literals = splitTopLevelArgs(mathMax[1])
      .map((a) => a.trim())
      .filter((a) => /^\d+(?:\.\d+)?$/.test(a))
      .map(Number);
    return literals.length > 0 ? [Math.max(...literals)] : null;
  }

  // Math.min(a, b, …) é o padrão ERRADO para impor um piso — nunca GARANTE
  // um mínimo (o resultado pode ser menor que qualquer literal presente).
  // Só conseguimos PROVAR violação quando o menor literal já reprova (o
  // resultado real não pode superá-lo); se todos os literais passam, o
  // argumento desconhecido ainda pode puxar para baixo — não verificável,
  // não reprova por engano.
  const mathMin = expr.match(/^Math\.min\((.*)\)$/s);
  if (mathMin) {
    const literals = splitTopLevelArgs(mathMin[1])
      .map((a) => a.trim())
      .filter((a) => /^\d+(?:\.\d+)?$/.test(a))
      .map(Number);
    if (literals.length === 0) return null;
    const smallest = Math.min(...literals);
    return smallest < FLOOR ? [smallest] : null;
  }

  // String com número + unidade px: `"9px"` (style object) ou, sem unidade,
  // `"9"` (comum em atributo SVG `fontSize="9"`).
  const pxString = expr.match(/^["'`](\d+(?:\.\d+)?)(?:px)?["'`]$/);
  if (pxString) return [Number(pxString[1])];

  // Outras strings (`"1.6rem"`, `"2rem"`) usam unidade relativa ao root —
  // fora do escopo deste piso em px; documentado, não verificado aqui.
  if (/^["'`].*["'`]$/.test(expr)) return null;

  // Fórmula aritmética não coberta por Math.max/Math.min — mesma limitação
  // de regex (não-parser) do scan de `vh` em appShell.test.js. Auditar à mão.
  if (expr.includes("*") || expr.includes("/")) return null;

  // Número puro.
  if (/^\d+(?:\.\d+)?$/.test(expr)) return [Number(expr)];

  // Ternário, possivelmente aninhado: só valores em posição de resultado
  // (imediatamente após `?` ou `:`) contam — números dentro da CONDIÇÃO
  // (`i===3?`) nunca ficam colados a um `?`/`:` À ESQUERDA.
  const leaves = [...expr.matchAll(/[?:]\s*(\d+(?:\.\d+)?)\b/g)].map((m) => Number(m[1]));
  if (leaves.length > 0) return leaves;

  return null; // identificador puro não resolvido (ver resolveSizes)
}

/**
 * Como `leafSizes`, mas quando o valor é um identificador simples
 * (`fontSize={valSize}`), procura `const/let/var valSize = <expr>;` no
 * mesmo arquivo e resolve recursivamente — inclusive quando o RHS é, por
 * sua vez, outro identificador. Limitação consciente: só identificador
 * simples; `dims.fontSize` (caminho com ponto) exigiria achar a definição
 * de `dims` e navegar a chave — fora do escopo desta heurística por regex.
 */
function resolveSizes(expr, src, seen = new Set()) {
  const direct = leafSizes(expr);
  if (direct) return direct;

  const ident = expr.trim();
  if (!/^[A-Za-z_$][\w$]*$/.test(ident) || seen.has(ident)) return null;
  seen.add(ident);

  const declRe = new RegExp(`\\b(?:const|let|var)\\s+${ident}\\s*=\\s*`, "g");
  const collected = [];
  let m;
  while ((m = declRe.exec(src))) {
    const rhs = captureBalanced(src, declRe.lastIndex, ";");
    const sizes = resolveSizes(rhs.trim(), src, seen);
    if (sizes) collected.push(...sizes);
  }
  return collected.length > 0 ? collected : null;
}

/**
 * Varre três formas de declarar fontSize:
 *  - objeto de estilo: `fontSize: <expr>`, valor capturado com profundidade
 *    balanceada (cobre `Math.max(11, x)`, que tem vírgula interna);
 *  - atributo JSX/SVG com chaves: `fontSize={<expr>}`;
 *  - atributo JSX/SVG com string simples: `fontSize="9"`.
 */
function findOffenders(file) {
  const rawSrc = fs.readFileSync(file, "utf8");
  const src = stripComments(rawSrc);
  const offenders = [];

  const report = (matchIndex, value) => {
    const sizes = resolveSizes(value, src);
    if (!sizes) return;
    const bad = sizes.filter((n) => n < FLOOR);
    if (bad.length > 0) {
      const line = src.slice(0, matchIndex).split("\n").length;
      offenders.push(`${path.relative(SRC, file)}:${line} fontSize: ${value.trim()}`);
    }
  };

  for (const m of src.matchAll(/fontSize:\s*/g)) {
    const start = m.index + m[0].length;
    report(m.index, captureBalanced(src, start, ","));
  }
  for (const m of src.matchAll(/fontSize=\{/g)) {
    const start = m.index + m[0].length;
    report(m.index, captureBalanced(src, start, ""));
  }
  for (const m of src.matchAll(/fontSize=(["'])([^"']*)\1/g)) {
    report(m.index, `"${m[2]}"`);
  }

  return offenders;
}

describe("piso de fontSize da UI (WCAG — issue #86)", () => {
  it("nenhum arquivo fora das exceções tem fontSize abaixo de 11px (estilo, atributo JSX/SVG ou identificador local resolvível)", () => {
    const files = collect(UI, /\.jsx?$/);
    const offenders = [];
    for (const file of files) {
      const rel = path.relative(SRC, file);
      if (PERMANENT_EXCEPTIONS.has(rel) || SECOND_PASS_EXCEPTIONS.has(rel)) continue;
      offenders.push(...findOffenders(file));
    }
    expect(offenders).toEqual([]);
  });

  it("a lista de segunda passada não cresce silenciosamente — cada item ainda tem violação real", () => {
    // Se um arquivo da lista for corrigido e não for removido daqui, este
    // teste falha lembrando de tirá-lo — a exceção some sozinha do valor de
    // proteção do teste acima. Não se aplica a PERMANENT_EXCEPTIONS: aqueles
    // são exclusão de domínio (PDF), não um TODO — não faz sentido exigir
    // que "ainda tenham violação".
    const stale = [];
    for (const rel of SECOND_PASS_EXCEPTIONS.keys()) {
      const file = path.join(SRC, rel);
      if (!fs.existsSync(file)) {
        stale.push(`${rel} (arquivo não existe mais)`);
        continue;
      }
      if (findOffenders(file).length === 0) {
        stale.push(`${rel} (sem violação — remover da lista de exceções)`);
      }
    }
    expect(stale).toEqual([]);
  });

  it("toda exceção tem uma justificativa não-vazia", () => {
    for (const [rel, reason] of [...PERMANENT_EXCEPTIONS, ...SECOND_PASS_EXCEPTIONS]) {
      expect(reason, rel).toBeTruthy();
      expect(reason.length, rel).toBeGreaterThan(20);
    }
  });

  describe("provas por mutação (o scanner tem que reprovar cada uma destas)", () => {
    const mutationCases = [
      ["objeto de estilo, número puro", "fontSize: 8,", true],
      ["objeto de estilo, número no piso", "fontSize: 11,", false],
      ["ternário simples", "fontSize: compact ? 9 : 10,", true],
      ["ternário aninhado com condição numérica — não é falso-positivo", "fontSize: isMobile?i===3?13:17:i===3?15:20,", false],
      ["Math.max com piso no 1º argumento, abaixo do piso", "fontSize: Math.max(8, size * 0.3),", true],
      ["Math.max com piso no 2º argumento, abaixo do piso", "fontSize: Math.max(size * 0.3, 8),", true],
      ["Math.max garantindo o piso", "fontSize: Math.max(11, size * 0.3),", false],
      ["Math.min com literal abaixo do piso", "fontSize: Math.min(9, size),", true],
      ["Math.min sem literal abaixo do piso — não verificável, não reprova à toa", "fontSize: Math.min(20, size),", false],
      ["string com px", 'fontSize: "9px",', true],
      ["indexação de array não vira falso-positivo pelo índice", "fontSize: dims[isMobile ? 0 : 1],", false],
      ["atributo JSX com chaves, número puro", "<text fontSize={8} />", true],
      ["atributo JSX com chaves, ternário", "<text fontSize={compact ? 9 : 10} />", true],
      ["atributo JSX com string simples", '<text fontSize="9" />', true],
      // A regressão que motivou a reescrita: identificador local resolvido
      // até a declaração `const`, não só o padrão `fontSize={9}` literal.
      ["identificador JSX resolvido até `const valSize = 8`", "const valSize = 8;\n<text fontSize={valSize} />", true],
      ["identificador JSX resolvido, no piso", "const valSize = 11;\n<text fontSize={valSize} />", false],
      [
        "comentário mencionando 'fontSize:N' não é confundido com código",
        "// nota: era fontSize:9 antes\nfontSize: 11,",
        false,
      ],
    ];

    for (const [label, snippet, shouldFlag] of mutationCases) {
      it(`${shouldFlag ? "REPROVA" : "aprova"}: ${label}`, () => {
        const src = stripComments(snippet);
        const offenders = [];
        const report = (idx, value) => {
          const sizes = resolveSizes(value, src);
          if (sizes?.some((n) => n < FLOOR)) offenders.push(value);
        };
        for (const m of src.matchAll(/fontSize:\s*/g)) {
          report(m.index, captureBalanced(src, m.index + m[0].length, ","));
        }
        for (const m of src.matchAll(/fontSize=\{/g)) {
          report(m.index, captureBalanced(src, m.index + m[0].length, ""));
        }
        for (const m of src.matchAll(/fontSize=(["'])([^"']*)\1/g)) {
          report(m.index, `"${m[2]}"`);
        }
        expect(offenders.length > 0).toBe(shouldFlag);
      });
    }
  });
});
