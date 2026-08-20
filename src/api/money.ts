/**
 * Coerção de dinheiro na fronteira da API.
 *
 * O backend serializa `Decimal` como STRING — `Decimal("315.57")` vira `"315.57"`
 * em JSON, nunca `315.57`. Nem todos os schemas usam `Decimal`: alguns usam `float`
 * e mandam número (inconsistência registrada em fincla-api#112). Ou seja, o mesmo
 * campo pode chegar das duas formas dependendo do endpoint.
 *
 * Consequências reais já vistas em produção, ambas com a API respondendo 200:
 *  - o saldo em conta sumiu da Visão Geral quando o código passou a checar
 *    `typeof === "number"` para distinguir "não sei" de "zero" (fincla-frontend#76);
 *  - o total de "Próximos Débitos" virou NaN, porque `reduce((s, d) => s + d.value, 0)`
 *    concatena strings: `0 + "120.00"` → `"0120.00"` (fincla-frontend#88).
 *
 * O segundo é pior que o primeiro: some sem erro nenhum, e os itens individuais
 * continuam aparecendo certos porque `Math.abs("120.00")` funciona por coerção. Só
 * a soma denuncia.
 *
 * A conversão vive AQUI, na fronteira, e não nos consumidores: assim `typeof` volta
 * a significar o que promete em qualquer lugar do app que leia esse dado.
 */

/** Valor monetário como chega no fio, antes da normalização. */
export type WireMoney = string | number | null | undefined;

/**
 * Converte para número finito, ou `null`.
 *
 * `null` — e nunca `0` — para o que não for número: em saldo, zero inventado é pior
 * que ausência, porque afirma que a pessoa não tem dinheiro. String vazia, espaços,
 * booleano, array e `NaN`/`Infinity` caem todos em `null`.
 */
export const toFiniteNumber = (value: WireMoney | unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Mesma conversão, com piso em zero — para somatórios onde ausência não deve propagar NaN. */
export const toAmount = (value: WireMoney | unknown): number => toFiniteNumber(value) ?? 0;
