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
 * `tokens.js`, corrigido de #9CA3AF/~2.5:1 para #6B7280/~4.5:1+ na mesma PR).
 */
const FLOOR = 11;

const SRC = path.resolve(__dirname, "..", "..");
const UI = path.join(SRC, "ui");

/**
 * Arquivos ainda NÃO cobertos por esta varredura — todos têm ocorrências de
 * `fontSize` abaixo do piso que ficaram para uma segunda passada porque,
 * no momento desta PR (issue #86), outras correções estavam em voo tocando
 * exatamente estes arquivos. Remover da lista à medida que forem corrigidos;
 * a lista NUNCA deve crescer sem justificativa.
 */
const KNOWN_EXCEPTIONS = new Set(
  [
    "ui/pages/DashboardPage.jsx",
    "ui/pages/CalendarPage.jsx",
    "ui/features/novaTransacao/NovaTransacaoModal.jsx",
    "ui/pages/TransacoesPage.jsx",
    "ui/pages/OrcamentosPage.jsx",
    "ui/layouts/Topbar.jsx",
    "ui/features/consultant/ConsultantClientOverviewTab.jsx",
  ].map((p) => p.split("/").join(path.sep)),
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
 * Extrai o valor de cada `fontSize:` (até a próxima vírgula/chave de
 * fechamento) e checa os números literais dentro dele — cobre tanto
 * `fontSize: 10` quanto `fontSize: isMobile ? 9 : 10`.
 *
 * Limitação consciente (mesmo princípio do scan de `vh` em appShell.test.js:
 * regex, não parser): valores computados via identificador
 * (`fontSize: dims.fontSize`, `fontSize: f.hintText`) ou expressão aritmética
 * (`fontSize: size * 0.3`) não são resolvidos estaticamente. Esses casos
 * foram auditados manualmente nesta PR (definição rastreada até a origem) e,
 * onde havia risco de cair abaixo do piso, ganharam `Math.max(11, …)` no
 * próprio valor — por isso `Math.max` é tratado como "já garantido" aqui.
 */
function findOffenders(file) {
  const src = fs.readFileSync(file, "utf8");
  const offenders = [];
  const valueRe = /fontSize:\s*([^,}]+?)(?=[,}])/g;
  let m;
  while ((m = valueRe.exec(src))) {
    const value = m[1];
    if (value.includes("Math.max")) continue; // piso já garantido em runtime
    if (value.includes("*") || value.includes("/")) continue; // fórmula, auditada à mão
    const numbers = value.match(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g) || [];
    const bad = numbers.map(Number).filter((n) => n < FLOOR);
    if (bad.length > 0) {
      const line = src.slice(0, m.index).split("\n").length;
      offenders.push(`${path.relative(SRC, file)}:${line} fontSize: ${value.trim()}`);
    }
  }
  return offenders;
}

describe("piso de fontSize da UI (WCAG — issue #86)", () => {
  it("nenhum arquivo fora da lista de exceções tem fontSize literal abaixo de 11px", () => {
    const files = collect(UI, /\.jsx?$/);
    const offenders = [];
    for (const file of files) {
      const rel = path.relative(SRC, file);
      if (KNOWN_EXCEPTIONS.has(rel)) continue;
      offenders.push(...findOffenders(file));
    }
    expect(offenders).toEqual([]);
  });

  it("a lista de exceções não cresce silenciosamente — cada item ainda tem violação real", () => {
    // Se um arquivo da lista for corrigido numa segunda passada e não for
    // removido daqui, este teste falha lembrando de tirá-lo — a exceção some
    // sozinha do valor de proteção do teste acima.
    const stale = [];
    for (const rel of KNOWN_EXCEPTIONS) {
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
});
