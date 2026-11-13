/**
 * Em que moeda escrever um número da área do consultor (fincla-frontend#314).
 *
 * O consultor lê clientes de moedas diferentes, e três tipos de número passam pela
 * tela dele:
 *
 * 1. **Um valor DE UM cliente** (patrimônio, saldo, gastos dele): na moeda base do
 *    cliente, `client.currency`, extraída do rótulo na fronteira da API.
 * 2. **Um agregado que o backend CONVERTE** (`/summary`, `/financial-health-index`,
 *    o relatório de gastos da carteira): na moeda de leitura que veio com ele.
 * 3. **`/total-credit-card-debt`, `/cash-flow`, `/expenses-by-category`**: desde a
 *    fincla-api#505 o backend CONVERTE estes também, e manda o recibo
 *    `consolidation` — viram o caso 2 (`aggregateCurrency`). Uma API anterior à #505
 *    (sem recibo) só ROTULA uma soma que empilha clientes de moedas diferentes: o
 *    rótulo só diz a verdade quando TODOS os clientes estão nele — é o que
 *    `trustedPortfolioLabel` confere. Fora disso a moeda é desconhecida e o valor sai
 *    "—": um número em várias moedas escrito com um símbolo só é o número certo com
 *    a unidade errada, que engana mais do que não mostrar nada.
 */

// Sem importar de `consultantFormat`: ele importa `consultantClientsView`, que importa
// este módulo — o ciclo deixaria a constante indefinida na carga.
const DASH = "—";

/**
 * Soma por moeda: `[{ currency, amount }]` em ordem de código, ou `null` quando
 * algum item não tem valor ou não tem moeda.
 *
 * `null` e não "soma do que deu": um total parcial é o que o backend se recusa a
 * mostrar (fincla-api#144), e um item sem moeda não pode ser posto em pilha
 * nenhuma sem chutar a unidade dele.
 */
export function sumByCurrency(items, valueOf, currencyOf) {
  const list = Array.isArray(items) ? items : [];
  const pilhas = new Map();
  for (const item of list) {
    const bruto = valueOf(item);
    const valor = bruto === null || bruto === undefined || bruto === "" ? Number.NaN : Number(bruto);
    const moeda = currencyOf(item);
    if (!Number.isFinite(valor) || !moeda) return null;
    pilhas.set(moeda, (pilhas.get(moeda) ?? 0) + valor);
  }
  return [...pilhas.keys()].sort().map((currency) => ({ currency, amount: pilhas.get(currency) }));
}

/**
 * Escreve uma soma por moeda: uma moeda → o valor nela; várias → a quebra, unida
 * por " + " (e não convertida: não há cotação aqui, e somar sob um símbolo só é o
 * defeito). `[]` (nada a somar) → zero em `emptyCurrency`, quando se sabe qual é;
 * senão "—". `null` → "—".
 */
export function fmtTotals(totals, fmt, emptyCurrency = null) {
  if (!Array.isArray(totals)) return DASH;
  if (totals.length === 0) return emptyCurrency ? fmt(0, emptyCurrency) : DASH;
  return totals.map((t) => fmt(t.amount, t.currency)).join(" + ");
}

/**
 * A moeda comum a TODOS os clientes, ou `null` (carteira vazia, mista, ou algum
 * cliente sem moeda conhecida).
 *
 * Para números da carteira que não vêm com rótulo nenhum — os gráficos da IA, cuja
 * spec não diz moeda: eles só podem ser escritos numa moeda quando a carteira
 * inteira está nela.
 */
export function portfolioCurrency(clients) {
  const list = Array.isArray(clients) ? clients : [];
  if (list.length === 0) return null;
  const primeira = list[0]?.currency;
  if (!primeira) return null;
  return list.every((c) => c?.currency === primeira) ? primeira : null;
}

/**
 * O rótulo de um agregado NÃO convertido, se ele merece confiança; senão `null`.
 *
 * Merece quando a carteira já carregou e todo cliente está na moeda do rótulo: aí a
 * soma não misturou nada. Carteira vazia também — não há o que misturar. Antes de a
 * carteira carregar, `null`: escrever o rótulo e trocá-lo por "—" um instante
 * depois seria mostrar, por um instante, a unidade errada.
 */
export function trustedPortfolioLabel(label, clients, loaded = true) {
  if (!label || !loaded) return null;
  const list = Array.isArray(clients) ? clients : [];
  return list.every((c) => c?.currency === label) ? label : null;
}

/**
 * A moeda em que escrever um dos três agregados da carteira (`{ currency, converted }`,
 * como os hooks do consultor os devolvem), ou `null`.
 *
 * Convertido pelo backend (fincla-api#505): a moeda de leitura vale para a carteira
 * inteira, mista ou não — e um total ausente (faltou cotação) continua ausente, sai
 * "—" pelo próprio `null`. Não convertido (API anterior): só o rótulo confiável.
 */
export function aggregateCurrency(aggregate, clients, loaded = true) {
  if (aggregate?.converted) return aggregate.currency ?? null;
  return trustedPortfolioLabel(aggregate?.currency, clients, loaded);
}
