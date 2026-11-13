import { useMemo } from "react";

import { fmtAbs as fmtAbsIn, fmtK as fmtKIn, fmtSgn as fmtSgnIn } from "../formatters.js";
import { MOEDA_PADRAO, currencyInfo } from "./currencyRegistry.js";
import { formatMoney } from "./formatMoney.js";
import { useOrganizationBaseCurrency } from "./useOrganizationBaseCurrency.js";

/** O que a tela escreve no lugar de um valor cuja MOEDA ainda não se sabe. */
export const UNKNOWN_MONEY = "—";

/**
 * `fmtAbs`/`fmtSgn`/`fmtK` já presos a uma moeda — para as telas cujos números são
 * TODOS na moeda base da organização (os agregados que a API já converte).
 *
 * `currency` nulo = a moeda ainda não chegou (ou a leitura falhou). Aí cada valor sai
 * como travessão, e não como "R$": um valor em dólar escrito em real é o número certo
 * com a unidade errada — pior que número nenhum, porque parece correto (#310).
 * `fmtK` (rótulo de eixo) sai vazio: um eixo cheio de travessões é ruído.
 *
 * `fmtIntl` é a outra convenção de espaço do app — a do `Intl` (U+00A0 entre símbolo
 * e número, sinal `-` do próprio `Intl`) —, para as telas que sempre escreveram com
 * `Intl.NumberFormat(..., { style: "currency" })`. Valor ausente (`null`/`undefined`)
 * também é travessão: zero inventado afirma o que ninguém afirmou.
 */
export function baseMoneyFormatters(currency) {
  if (!currency) {
    return {
      currency: null,
      symbol: null,
      fmtAbs: () => UNKNOWN_MONEY,
      fmtSgn: () => UNKNOWN_MONEY,
      fmtK: () => "",
      fmtIntl: () => UNKNOWN_MONEY,
    };
  }
  return {
    currency,
    symbol: currencyInfo(currency).symbol,
    fmtAbs: (v) => fmtAbsIn(v, currency),
    fmtSgn: (v) => fmtSgnIn(v, currency),
    // Só o valor: o recharts chama `tickFormatter(valor, índice)`.
    fmtK: (v) => fmtKIn(v, currency),
    fmtIntl: (v) => formatMoney(v, currency) ?? UNKNOWN_MONEY,
  };
}

/**
 * Os formatadores na moeda base da organização ativa (#310).
 *
 * `live` falso = a tela desenha dados de demonstração, que são em real; aí a moeda é
 * BRL de propósito, não por omissão. Com `live`, a moeda é a base lida da API —
 * enquanto ela não chega, travessão (ver `baseMoneyFormatters`).
 */
export function useBaseCurrencyMoney(organizationId, { live = true } = {}) {
  const base = useOrganizationBaseCurrency(organizationId, { enabled: live });
  const currency = live ? base.currency : MOEDA_PADRAO;
  return useMemo(() => baseMoneyFormatters(currency), [currency]);
}
