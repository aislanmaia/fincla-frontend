/**
 * Régua do período: o valor contra o qual a Visão Geral mede o gasto.
 *
 * Fonte única para o humor, o Insight, o "R$ X à frente / acima do ritmo" e a
 * linha de projeção do gráfico — cada um calculando a sua régua foi o que fez o
 * selo e o gráfico se contradizerem.
 *
 * A régua é `max(base, despesa)`, e a base é a receita do período. Antes de o
 * salário cair a receita é zero (ou um Pix solto), a régua virava a própria
 * despesa e qualquer gasto no dia 2 contava como 100% do período: "Situação
 * crítica" com R$ 27 mil em conta.
 *
 * Por isso, NO PERÍODO QUE CONTÉM HOJE, a base é o maior entre a receita que já
 * entrou e a renda mensal DECLARADA da organização, proporcional aos dias do
 * período. Fora dele (mês fechado, período futuro) só vale o que aconteceu: um
 * mês passado sem receita foi mesmo um mês sem receita. Sem renda declarada,
 * nada muda.
 *
 * Por que não o saldo em conta: ele é de HOJE (não serve para julgar outro
 * período), não enxerga a fatura de cartão ainda aberta e absolveria quem gasta
 * mais do que ganha só por ter reserva.
 */

function parseYmd(ymd) {
  if (typeof ymd !== "string") return null;
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{
 *   income: number,
 *   expenses: number,
 *   declaredMonthlyIncome?: number | null,
 *   rangeStartYmd?: string,
 *   rangeEndYmd?: string,
 *   today?: Date,
 * }} input
 * @returns {{ envelope: number, base: number, basis: "income" | "declared" }}
 */
export function periodYardstick({
  income,
  expenses,
  declaredMonthlyIncome = null,
  rangeStartYmd,
  rangeEndYmd,
  today = new Date(),
}) {
  const inc = Number(income) || 0;
  const exp = Number(expenses) || 0;
  const start = parseYmd(rangeStartYmd);
  const end = parseYmd(rangeEndYmd);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let declared = null;
  if (
    typeof declaredMonthlyIncome === "number" &&
    declaredMonthlyIncome > 0 &&
    start &&
    end &&
    start <= todayStart &&
    todayStart <= end
  ) {
    const days = Math.round((end - start) / DAY_MS) + 1;
    const daysInStartMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    declared = (declaredMonthlyIncome * days) / daysInStartMonth;
  }

  const useDeclared = declared !== null && declared > inc;
  const base = useDeclared ? declared : inc;
  return {
    envelope: Math.max(base, exp, 1),
    base,
    basis: useDeclared ? "declared" : "income",
  };
}
