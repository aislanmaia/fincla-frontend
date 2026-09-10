/**
 * O registro de moedas em memória, e a resposta para "como se escreve esta moeda?".
 *
 * **Por que um módulo e não um contexto React.** Formatar dinheiro acontece em
 * centenas de lugares, e boa parte deles não é componente: adapters, seletores de
 * dado, funções puras de teste. Um hook obrigaria a reescrever todos eles e a
 * tornar assíncrono o que hoje é uma expressão. O registro é um catálogo pequeno,
 * global e que não muda durante a sessão — cabe num módulo.
 *
 * **A ausência tem resposta.** Antes de o registro carregar, e para uma moeda que
 * ele não conhece, `currencyInfo` devolve o que o `Intl` sabe daquele código. A
 * tela nunca fica sem desenhar um valor por causa de uma requisição que ainda não
 * voltou — e como o `Intl` acerta símbolo e casas das moedas do registro de hoje,
 * o fallback é indistinguível do caminho feliz para BRL, EUR e USD.
 */

/** @type {Map<string, {code:string,name:string,symbol:string,decimalPlaces:number,isActive:boolean}>} */
const registro = new Map();

/** A moeda usada quando ninguém disse qual é. Um código, não um símbolo. */
export const MOEDA_PADRAO = "BRL";

/**
 * Guarda o registro vindo da API. Chamar de novo substitui — não acumula.
 *
 * Substituir e não mesclar é deliberado: uma moeda REMOVIDA do registro tem de
 * sumir daqui também, senão ela continuaria sendo oferecida numa tela de escolha
 * até alguém recarregar a página.
 */
export function setCurrencyRegistry(moedas) {
  registro.clear();
  for (const m of moedas ?? []) {
    const code = String(m?.code ?? "").toUpperCase();
    if (!code) continue;
    registro.set(code, {
      code,
      name: m.name ?? code,
      symbol: m.symbol ?? code,
      decimalPlaces: Number.isInteger(m.decimal_places) ? m.decimal_places : 2,
      isActive: m.is_active !== false,
    });
  }
}

/** Esvazia o registro. Existe para o teste — e para o logout não vazar catálogo. */
export function clearCurrencyRegistry() {
  registro.clear();
}

/** `true` quando o registro já chegou. Quem precisa saber se está no fallback. */
export function currencyRegistryLoaded() {
  return registro.size > 0;
}

/**
 * As moedas que uma tela pode OFERECER: só as ativas, em ordem de código.
 *
 * Vazio enquanto o registro não chegou — e vazio é a resposta certa: oferecer uma
 * lista chapada seria voltar a decidir no cliente o que é decisão do backend.
 */
export function offeredCurrencies() {
  return [...registro.values()].filter((m) => m.isActive).sort((a, b) => a.code.localeCompare(b.code));
}

const intlFallback = new Map();

/**
 * Como escrever `code`: símbolo, casas decimais e nome.
 *
 * Do registro quando ele conhece a moeda; do `Intl` quando não. O `Intl` é o
 * fallback certo porque ele já traz o símbolo localizado e o número de casas de
 * toda moeda ISO — o que ele NÃO sabe é quais delas o Fincla oferece, e é
 * exatamente isso que o registro responde.
 */
export function currencyInfo(code) {
  const limpo = String(code ?? "").trim().toUpperCase() || MOEDA_PADRAO;
  const doRegistro = registro.get(limpo);
  if (doRegistro) return doRegistro;

  if (!intlFallback.has(limpo)) {
    intlFallback.set(limpo, {
      code: limpo,
      name: limpo,
      symbol: simboloPeloIntl(limpo),
      decimalPlaces: casasPeloIntl(limpo),
      isActive: true,
    });
  }
  return intlFallback.get(limpo);
}

function formatadorIntl(code, opcoes) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: code, ...opcoes });
  } catch {
    // Código que não é ISO 4217 faz o `Intl` lançar. Nem por isso a tela pode
    // parar: cai no formatador sem moeda e o chamador carimba o código cru.
    return null;
  }
}

function simboloPeloIntl(code) {
  const partes = formatadorIntl(code)?.formatToParts(0) ?? [];
  return partes.find((p) => p.type === "currency")?.value ?? code;
}

function casasPeloIntl(code) {
  const resolvido = formatadorIntl(code)?.resolvedOptions();
  return resolvido ? resolvido.minimumFractionDigits : 2;
}
