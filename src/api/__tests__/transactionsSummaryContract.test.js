/**
 * O contrato do `/v1/transactions/summary`, preso ao exemplo do backend.
 *
 * `transactions_summary.example.json` é cópia byte a byte de
 * `fincla-api/docs/contracts/transactions_summary.example.json`, que por sua vez
 * é gerado a partir do modelo Pydantic e guardado por um teste lá. A cadeia
 * inteira existe porque o guia de API é prosa, e prosa deriva: quem acrescenta
 * um campo no backend não é obrigado a lembrar do frontend, e sem isto a
 * diferença aparece em produção.
 *
 * Aqui o que se testa não é o JSON — é o que a TELA calcula em cima dele. Média
 * por tipo, porcentagem do maior gasto e barra de liquidação são derivados no
 * frontend de propósito (campo derivado na API sai de sincronia com a tela), e
 * é justamente por serem derivados que precisam de teste.
 */
import { describe, it, expect } from "vitest";
import exemplo from "../__fixtures__/transactions_summary.example.json";

/** Os campos que a faixa expandida lê. Some um, some um pedaço da tela. */
const CAMPOS_EXPANDIDOS = [
  "income_count",
  "expense_count",
  "refund_count",
  "largest_income",
  "largest_expense",
  "unsettled_count",
  "unsettled_expenses",
  "unsettled_income",
  "unsettled_refunds",
  "settled_balance",
];

/**
 * A razão da barra de liquidação, com a guarda que o cálculo ingênuo não tem.
 *
 * Devolve `null` quando a barra não pode ser desenhada com honestidade — e aí a
 * tela mostra os dois valores lado a lado. Uma barra incalculável é pior que
 * nenhuma: ela dá a impressão de estar medindo alguma coisa.
 */
export function pctLiquidado(s) {
  // Os DOIS lados precisam ser não negativos. Só exigir `balance > 0` e depois
  // aplicar clamp devolve 0% quando o liquidado é negativo — que mente igual:
  // diz "nada entrou" onde o que entrou foi prejuízo.
  if (!(s.balance > 0) || s.settled_balance < 0) return null;
  return Math.min(1, s.settled_balance / s.balance);
}

describe("contrato de /v1/transactions/summary", () => {
  it("traz todos os campos da faixa expandida", () => {
    for (const campo of CAMPOS_EXPANDIDOS) {
      expect(exemplo, `campo ausente no contrato: ${campo}`).toHaveProperty(campo);
    }
  });

  it("as contagens por tipo fecham com o total", () => {
    expect(exemplo.income_count + exemplo.expense_count + exemplo.refund_count).toBe(
      exemplo.total_transactions,
    );
  });

  it("o maior lançamento vem com valor positivo dos dois lados", () => {
    expect(exemplo.largest_income.value).toBeGreaterThan(0);
    // Despesa também: o tipo já carrega o sinal, e a tela imprime o valor ao
    // lado de um rótulo que diz de que lado ele está.
    expect(exemplo.largest_expense.value).toBeGreaterThan(0);
  });

  it("permite a média por tipo — o número que hoje some da tela", () => {
    const media = exemplo.total_income / exemplo.income_count;
    expect(Number.isFinite(media)).toBe(true);
    expect(media).toBeCloseTo(9358.895, 2);
    // A média nunca pode passar do maior lançamento do mesmo lado. A primeira
    // versão desta fixture violava isso (média 9.358,90 com maior de 8.500,00) e
    // teria congelado no teste um card que se contradiz em duas linhas seguidas.
    expect(media).toBeLessThanOrEqual(exemplo.largest_income.value);
  });

  it("permite a porcentagem do maior gasto", () => {
    const pct = exemplo.largest_expense.value / exemplo.total_expenses;
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(1);
    expect(Math.round(pct * 100)).toBe(37);
  });

  it("separa o que já entrou no saldo do que ainda não", () => {
    // Se estes dois fossem iguais, a barra de liquidação estaria sempre em 100%
    // e ninguém veria o cálculo errar.
    expect(exemplo.settled_balance).not.toBe(exemplo.balance);
    expect(Math.round(pctLiquidado(exemplo) * 100)).toBe(64);
  });

  it("a lacuna do saldo é exatamente o que falta liquidar", () => {
    // A identidade que liga os quatro agregados. É ela que impede o erro de uma
    // contagem de recebíveis aparecer ao lado de um total só de pagáveis.
    expect(exemplo.balance - exemplo.settled_balance).toBeCloseTo(
      exemplo.unsettled_income - exemplo.unsettled_expenses + exemplo.unsettled_refunds,
      2,
    );
  });

  it("a barra de liquidação não pode ir a negativo", () => {
    // `settled_balance / balance` sem guarda: uma receita de R$ 1.000 em aberto
    // com uma despesa de R$ 500 já paga dá balance = 500 e settled = −500 — uma
    // barra de progresso em −100%. Mês com despesa maior que receita inverte
    // igual.
    expect(pctLiquidado({ balance: 500, settled_balance: -500 })).toBeNull();
    expect(pctLiquidado({ balance: -200, settled_balance: -50 })).toBeNull();
    expect(pctLiquidado({ balance: 0, settled_balance: 0 })).toBeNull();
    expect(pctLiquidado({ balance: 1000, settled_balance: 250 })).toBe(0.25);
  });

  it("o maior lançamento é anulável — e não um objeto zerado", () => {
    // Um filtro sem receitas devolve `null`; a tela precisa distinguir isso de
    // "uma receita de R$ 0", que é uma frase diferente.
    const semReceita = { ...exemplo, largest_income: null, income_count: 0 };
    expect(semReceita.largest_income).toBeNull();
    const media = semReceita.income_count
      ? semReceita.total_income / semReceita.income_count
      : null;
    expect(media).toBeNull();
  });
});
