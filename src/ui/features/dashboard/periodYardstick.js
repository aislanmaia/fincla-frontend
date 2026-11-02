/**
 * Régua do período: o valor contra o qual a Visão Geral mede o gasto.
 *
 * Fonte única para o humor, o Insight, o chip "x% da receita", o "R$ X à frente
 * / acima do ritmo", o teto por dia e — quando a régua muda — a linha de
 * projeção do gráfico.
 *
 * A régua é `max(base, despesa)`, e a base é a receita do período. Antes de o
 * salário cair a receita é zero (ou um Pix solto), a régua virava a própria
 * despesa e qualquer gasto no dia 2 contava como 100% do período: "Situação
 * crítica" com R$ 27 mil em conta.
 *
 * Por isso, num período DENTRO DO MÊS CORRENTE (o "Este mês" padrão, ou um
 * recorte dele que contenha hoje), a base é o maior entre a receita que já
 * entrou e a renda mensal DECLARADA da organização, proporcional aos dias do
 * recorte. Em qualquer outro período só vale o que aconteceu: mês fechado sem
 * receita foi mesmo sem receita, e um "últimos 12 meses" não pode trocar a
 * receita real de meses já fechados pela declarada. Sem renda declarada, ou sem
 * os totais do período (multi-moeda sem cotação manda `null`), nada muda —
 * ausência não pode virar um "Sereno" confiante.
 *
 * "Contém hoje" vem do mesmo relógio do gráfico (`rhythmMeta`), para o selo e a
 * linha nunca decidirem com relógios diferentes.
 *
 * Por que não o saldo em conta: ele é de HOJE (não serve para julgar outro
 * período), não enxerga a fatura de cartão ainda aberta e absolveria quem gasta
 * mais do que ganha só por ter reserva.
 *
 * Limitação conhecida: um recorte personalizado que cruza a virada do mês (ex.:
 * 27/10–09/11) não usa a renda declarada — "Últimos 30 dias" quase sempre já
 * contém um salário, e repartir a declarada entre meses fechados e o corrente
 * reabriria o problema de trocar receita real por declarada.
 *
 * Limitação conhecida: a renda declarada é mantida pelo usuário e a régua não
 * tenta adivinhar se o que já entrou é o salário inteiro ou um Pix solto.
 * Declarada acima da real, o humor fica mais brando até a receita do mês
 * alcançá-la.
 */
import { toFiniteNumber } from "../../../api/money";
import { daysInclusive, parseLocalYmd } from "./dashboardDateRange.js";

/**
 * @param {{
 *   income: number | null | undefined,
 *   expenses: number | null | undefined,
 *   declaredMonthlyIncome?: number | null,
 *   rangeStartYmd?: string,
 *   rangeEndYmd?: string,
 *   periodContainsToday?: boolean,
 * }} input
 * @returns {{ envelope: number, base: number, basis: "income" | "declared" }}
 */
export function periodYardstick({
  income,
  expenses,
  declaredMonthlyIncome = null,
  rangeStartYmd,
  rangeEndYmd,
  periodContainsToday = false,
}) {
  const totalsKnown = income != null && expenses != null;
  const inc = Number(income) || 0;
  const exp = Number(expenses) || 0;
  const start = parseLocalYmd(rangeStartYmd);
  const end = parseLocalYmd(rangeEndYmd);
  // A regra única de coerção do projeto: aceita número, string numérica e a forma
  // canônica {amount, currency}. Um "9200.00" legado não pode desligar a régua.
  const monthly = toFiniteNumber(declaredMonthlyIncome);

  let declared = null;
  if (
    totalsKnown &&
    periodContainsToday &&
    monthly !== null &&
    monthly > 0 &&
    start &&
    end &&
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    declared = monthly * (daysInclusive(start, end) / daysInMonth);
  }

  const useDeclared = declared !== null && declared > inc;
  const base = useDeclared ? declared : inc;
  return {
    envelope: Math.max(base, exp, 1),
    base,
    basis: useDeclared ? "declared" : "income",
  };
}

/**
 * Projeção linear do gráfico de ritmo: o ponto `i` (0-based) de `count` pontos
 * chega a `envelope` no último. Usada pelo hook e pela página — uma fórmula só.
 */
export function linearProjection(envelope, count, i) {
  return Math.round((Math.max(envelope, 1) / Math.max(count, 1)) * (i + 1));
}
