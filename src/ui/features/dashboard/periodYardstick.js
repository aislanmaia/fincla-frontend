/**
 * Régua do período: o valor contra o qual a Visão Geral mede o gasto.
 *
 * Fonte única para o humor, o Insight, o "R$ X à frente / acima do ritmo" e a
 * linha de projeção do gráfico (que a página redesenha com esta régua) — cada um
 * calculando a sua foi o que fez o selo e o gráfico se contradizerem.
 *
 * A régua é `max(base, despesa)`, e a base é a receita do período. Antes de o
 * salário cair a receita é zero (ou um Pix solto), a régua virava a própria
 * despesa e qualquer gasto no dia 2 contava como 100% do período: "Situação
 * crítica" com R$ 27 mil em conta.
 *
 * Por isso, NO PERÍODO QUE CONTÉM HOJE, a base é o maior entre a receita que já
 * entrou e a renda mensal DECLARADA da organização, proporcional ao período.
 * Fora dele (mês fechado, período futuro) só vale o que aconteceu: um mês
 * passado sem receita foi mesmo um mês sem receita. Sem renda declarada, ou sem
 * os totais do período (multi-moeda sem cotação manda `null`), nada muda —
 * ausência não pode virar um "Sereno" confiante.
 *
 * Por que não o saldo em conta: ele é de HOJE (não serve para julgar outro
 * período), não enxerga a fatura de cartão ainda aberta e absolveria quem gasta
 * mais do que ganha só por ter reserva.
 *
 * Limitação conhecida: a renda declarada é mantida pelo usuário. Declarada acima
 * da real, o humor fica mais brando até a receita do mês alcançá-la.
 */
import { daysInclusive, parseLocalYmd, startOfLocalDay } from "./dashboardDateRange.js";

/**
 * Renda declarada proporcional ao período: cada mês tocado contribui com a fração
 * dos SEUS dias que cai no período. Um mês civil inteiro vale a renda inteira,
 * qualquer que seja o número de dias dele, e o resultado não depende de em que
 * mês o período começa.
 */
function declaredForRange(monthly, start, end) {
  let total = 0;
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const monthStart = cursor;
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const from = monthStart < start ? start : monthStart;
    const to = monthEnd > end ? end : monthEnd;
    total += monthly * (daysInclusive(from, to) / monthEnd.getDate());
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return total;
}

/**
 * @param {{
 *   income: number | null | undefined,
 *   expenses: number | null | undefined,
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
  const totalsKnown = income != null && expenses != null;
  const inc = Number(income) || 0;
  const exp = Number(expenses) || 0;
  const start = parseLocalYmd(rangeStartYmd);
  const end = parseLocalYmd(rangeEndYmd);
  const todayMs = startOfLocalDay(today);

  let declared = null;
  if (
    totalsKnown &&
    typeof declaredMonthlyIncome === "number" &&
    declaredMonthlyIncome > 0 &&
    start &&
    end &&
    startOfLocalDay(start) <= todayMs &&
    todayMs <= startOfLocalDay(end)
  ) {
    declared = declaredForRange(declaredMonthlyIncome, start, end);
  }

  const useDeclared = declared !== null && declared > inc;
  const base = useDeclared ? declared : inc;
  return {
    envelope: Math.max(base, exp, 1),
    base,
    basis: useDeclared ? "declared" : "income",
  };
}
