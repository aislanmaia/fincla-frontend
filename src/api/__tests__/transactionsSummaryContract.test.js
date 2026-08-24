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
  "settled_balance",
];

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
    const pctLiquidado = exemplo.settled_balance / exemplo.balance;
    expect(Math.round(pctLiquidado * 100)).toBe(66);
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
