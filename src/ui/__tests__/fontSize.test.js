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
 * `tokens.js`, corrigido de #9CA3AF/~2.5:1 para #646E7C/~4.7:1+ na mesma PR;
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

const SECOND_PASS_EXCEPTIONS = new Map(
  [
    [
      "ui/layouts/Topbar.jsx",
      "Não verificado nesta rodada se a colisão relatada (outro trabalho em " +
        "voo) já mergeou — DashboardPage.jsx/CalendarPage.jsx/" +
        "NovaTransacaoModal.jsx/TransacoesPage.jsx/OrcamentosPage.jsx, que " +
        "tinham a mesma justificativa original, já tinham mergeado e foram " +
        "corrigidos nesta PR após rebase; reavaliar Topbar.jsx do mesmo jeito.",
    ],
    [
      "ui/features/consultant/ConsultantClientOverviewTab.jsx",
      "Mesma ressalva de Topbar.jsx: sem confirmação de que o trabalho " +
        "concorrente relatado já mergeou. Reavaliar via `git log origin/main " +
        "-- <arquivo>` antes de excluir de novo.",
    ],
  ].map(([k, v]) => [toRel(k), v]),
);

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
 * A partir do valor bruto de um `fontSize` (ex.: `isMobile?i===3?13:17:...`,
 * `Math.max(11, categoryNumSize - 1)`, `"9px"`), devolve só os números que
 * são efetivamente um TAMANHO — ou `null` quando o valor não é verificável
 * estaticamente (identificador puro, fórmula aritmética não coberta por
 * Math.max).
 *
 * Ponto central: números dentro da CONDIÇÃO de um ternário (o `3` em
 * `i===3?`) nunca ficam colados a um `?`/`:` À ESQUERDA — só valores em
 * posição de resultado ficam. `i===3?13:17` só captura `13` e `17`.
 */
function leafSizes(rawExpr) {
  const expr = rawExpr.trim();

  // Math.max(N, ...) garante o piso em runtime — normaliza para o primeiro
  // argumento. Cobre `Math.max(11, size * 0.36)` sem precisar entender a
  // fórmula do segundo argumento, e reprova `Math.max(8, x)` porque 8 < 11.
  const mathMax = expr.match(/Math\.max\(\s*(\d+(?:\.\d+)?)/);
  if (mathMax) return [Number(mathMax[1])];

  // String com número + unidade px: `"9px"` (style object) ou, sem unidade,
  // `"9"` (comum em atributo SVG `fontSize="9"`).
  const pxString = expr.match(/^["'`](\d+(?:\.\d+)?)(?:px)?["'`]$/);
  if (pxString) return [Number(pxString[1])];

  // Outras strings (`"1.6rem"`, `"2rem"`) usam unidade relativa ao root —
  // fora do escopo deste piso em px; documentado, não verificado aqui.
  if (/^["'`].*["'`]$/.test(expr)) return null;

  // Fórmula aritmética não coberta por Math.max — mesma limitação de regex
  // (não-parser) do scan de `vh` em appShell.test.js. Auditar à mão.
  if (expr.includes("*") || expr.includes("/")) return null;

  // Número puro.
  if (/^\d+(?:\.\d+)?$/.test(expr)) return [Number(expr)];

  // Ternário, possivelmente aninhado: só valores em posição de resultado
  // (imediatamente após `?` ou `:`) contam.
  const leaves = [...expr.matchAll(/[?:]\s*(\d+(?:\.\d+)?)\b/g)].map((m) => Number(m[1]));
  if (leaves.length > 0) return leaves;

  // Identificador puro (`dims.fontSize`, `fsLg`, `kpiValSize`) — não
  // verificável estaticamente; auditado manualmente nesta PR.
  return null;
}

/**
 * Varre duas formas de declarar fontSize:
 *  - objeto de estilo: `fontSize: <expr>` (inclui `Math.max(...)`, que tem
 *    vírgula interna — por isso o valor é capturado respeitando um nível de
 *    parênteses balanceado, não só "até a próxima vírgula");
 *  - atributo JSX/SVG: `fontSize={<expr>}` (ex.: `<text fontSize={valSize}>`).
 */
function findOffenders(file) {
  const src = fs.readFileSync(file, "utf8");
  const offenders = [];

  const patterns = [
    /fontSize:\s*((?:\([^()]*\)|[^,}])+)/g,
    /fontSize=\{((?:\([^()]*\)|[^{}])+)\}/g,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) {
      const value = m[1];
      const sizes = leafSizes(value);
      if (!sizes) continue;
      const bad = sizes.filter((n) => n < FLOOR);
      if (bad.length > 0) {
        const line = src.slice(0, m.index).split("\n").length;
        offenders.push(`${path.relative(SRC, file)}:${line} fontSize: ${value.trim()}`);
      }
    }
  }
  return offenders;
}

describe("piso de fontSize da UI (WCAG — issue #86)", () => {
  it("nenhum arquivo fora das exceções tem fontSize abaixo de 11px (estilo ou atributo SVG)", () => {
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
});
