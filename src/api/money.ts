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

/**
 * A forma canônica do backend (fincla-api ADR-0002): o valor e a moeda viajam juntos,
 * `amount` sempre string. A família de saldo já responde assim; os demais endpoints
 * migram em fincla-api#131-#133, então as duas formas coexistem no fio por enquanto.
 *
 * A fixture canônica é `src/api/__fixtures__/money.example.json`, cópia byte a byte de
 * `fincla-api/docs/contracts/money.example.json` — um teste do backend prende esse
 * arquivo aos modelos Pydantic, então mudar o contrato quebra os dois lados juntos.
 */
export interface CanonicalMoney {
  amount: string;
  currency: string;
}

/** Valor monetário como chega no fio, antes da normalização. */
export type WireMoney = string | number | CanonicalMoney | null | undefined;

/** `true` para o objeto canônico `{amount, currency}`, e só para ele. */
export const isCanonicalMoney = (value: unknown): value is CanonicalMoney =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as CanonicalMoney).amount === 'string' &&
  typeof (value as CanonicalMoney).currency === 'string';

/**
 * A moeda de um valor no fio, ou `null` quando ele ainda vem na forma antiga.
 *
 * Devolve `null` — e nunca `"BRL"` — para o que não declara moeda: inventar a moeda é
 * a mesma classe de erro que somar sem olhar a unidade, só que silenciosa.
 */
export const toCurrency = (value: WireMoney | unknown): string | null =>
  isCanonicalMoney(value) ? value.currency : null;

/**
 * Converte para número finito, ou `null`.
 *
 * `null` — e nunca `0` — para o que não for número: em saldo, zero inventado é pior
 * que ausência, porque afirma que a pessoa não tem dinheiro. String vazia, espaços,
 * booleano, array e `NaN`/`Infinity` caem todos em `null`.
 */
export const toFiniteNumber = (value: WireMoney | unknown): number | null => {
  // A forma canônica primeiro: sem isto, `typeof value === 'object'` cai no `null` do
  // fim e o saldo some da tela sem erro nenhum — foi o fincla-frontend#76 de novo.
  if (isCanonicalMoney(value)) return toFiniteNumber(value.amount);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Mesma conversão, com piso em zero — para somatórios onde ausência não deve propagar NaN. */
export const toAmount = (value: WireMoney | unknown): number => toFiniteNumber(value) ?? 0;

/**
 * Desembrulha TODO valor canônico de uma resposta, em qualquer profundidade.
 *
 * Os lotes de contrato (fincla-api#131-#133) migraram ~95 campos de uma vez, em
 * respostas aninhadas — `summary.by_category[].total`, `months[].projection.balance`,
 * `breakdown[].items[].amount`. Enumerar campo a campo é onde se esquece um, e um
 * campo esquecido vira `Number({…})` → `NaN` na tela, ou `0 + {…}` →
 * `"0[object Object]"` numa soma. Este caminhar não pode falhar por omissão.
 *
 * Continua sendo EXPLÍCITO na fronteira — cada módulo chama esta função de
 * propósito, e `return response.data` cru segue sendo o erro que os tipos `Raw*`
 * pegam. O que ele dispensa é a enumeração, não a intenção.
 *
 * **O que ele descarta de propósito:** o rótulo da moeda. As telas destas famílias
 * ainda formatam tudo em real, e os agregados delas somam moedas sem converter
 * (fincla-api#170) — então exibir a moeda hoje daria ao número uma autoridade que
 * ele não tem. Quando o #170 decidir converter ou omitir, a moeda volta por aqui.
 * Onde a tela JÁ usa a moeda (conta, saldo, transferência, ajuste), a conversão
 * é explícita campo a campo e não passa por esta função.
 */
export const unwrapMoney = <T,>(node: T): T => {
  if (isCanonicalMoney(node)) return toFiniteNumber(node) as T;
  if (Array.isArray(node)) return node.map((item) => unwrapMoney(item)) as T;
  if (node !== null && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = unwrapMoney(v);
    return out as T;
  }
  return node;
};
