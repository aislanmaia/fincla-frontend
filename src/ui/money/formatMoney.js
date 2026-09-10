/**
 * A ÚNICA função que escreve dinheiro na tela.
 *
 * **O que ela conserta.** O app tinha dez arquivos com o seu próprio
 * `Intl.NumberFormat("pt-BR", { currency: "BRL" })` e 176 ocorrências de `"R$"`
 * escrito à mão. Cada um desses pontos é um lugar onde uma conta em euro sairia
 * como "R$ 250,50" — o número certo com a unidade errada, que é pior que número
 * nenhum porque parece correto.
 *
 * **Por que não monta a string à mão.** `Intl` separa símbolo e número com um
 * ESPAÇO INQUEBRÁVEL (U+00A0), não com o espaço comum. Montar
 * `` `${simbolo} ${numero}` `` mudaria, invisivelmente, todo valor já desenhado no
 * app — e faria um `getByText("R$ 1.234,50")` deixar de casar sem ninguém entender
 * por quê. Então o formato vem do `Intl`, em partes, e só a PARTE da moeda é
 * trocada pelo símbolo do registro. Para BRL, EUR e USD os dois coincidem e a
 * saída é byte a byte a de hoje; para uma moeda cujo símbolo o registro escreva
 * diferente, o registro vence — que é o que a issue #136 pede.
 *
 * As casas decimais vêm do REGISTRO e não do `Intl`: o registro é a autoridade
 * contra a qual o backend valida, e ele recusa mais de duas casas (ADR-0003).
 */

import { MOEDA_PADRAO, currencyInfo } from "./currencyRegistry.js";

const cache = new Map();

function formatadorDe(code, casas) {
  const chave = `${code}:${casas}`;
  if (!cache.has(chave)) {
    let f;
    try {
      f = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: code,
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      });
    } catch {
      f = null;
    }
    cache.set(chave, f);
  }
  return cache.get(chave);
}

const numeroSimples = new Map();
function numeroDe(casas) {
  if (!numeroSimples.has(casas)) {
    numeroSimples.set(
      casas,
      new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      }),
    );
  }
  return numeroSimples.get(casas);
}

/**
 * O valor escrito na moeda dele, ou `null` quando não há valor.
 *
 * `null` e nunca "R$ 0,00": zero inventado num saldo AFIRMA que a pessoa não tem
 * dinheiro, e é o oposto de "nós é que não sabemos ler". Quem chama decide como
 * mostrar a ausência — no app, um travessão.
 */
export function formatMoney(value, currency = MOEDA_PADRAO) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;

  const info = currencyInfo(currency);
  const formatador = formatadorDe(info.code, info.decimalPlaces);
  if (!formatador) {
    // Código fora da ISO 4217: o `Intl` recusa a moeda, mas o número ainda é
    // desenhável. Melhor "XYZ 1.234,50" do que a tela em branco.
    return `${info.symbol} ${numeroDe(info.decimalPlaces).format(n)}`;
  }

  return formatador
    .formatToParts(n)
    .map((parte) => (parte.type === "currency" ? info.symbol : parte.value))
    .join("");
}

/** O valor ABSOLUTO na moeda dele — para onde o sinal já é dito pelo rótulo. */
export function formatMoneyAbs(value, currency = MOEDA_PADRAO) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return formatMoney(Math.abs(n), currency);
}

/**
 * Com sinal explícito — para saldos, onde o sinal É a informação.
 *
 * O sinal é `+`/`−` (U+2212, o menos matemático) na frente do valor absoluto, e
 * não o `-` que o `Intl` colocaria: é o formato que o app usa desde sempre, e
 * trocá-lo mudaria toda tela de saldo.
 */
export function formatMoneySigned(value, currency = MOEDA_PADRAO) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return (n >= 0 ? "+" : "−") + formatMoney(Math.abs(n), currency);
}

/**
 * O mesmo valor, com ESPAÇO COMUM entre símbolo e número.
 *
 * Existe porque o app tem duas convenções de espaçamento, e elas são anteriores a
 * esta função: `accountMeta.formatMoney` sempre usou o `Intl` com estilo de moeda,
 * que separa com U+00A0; `formatters.fmtAbs` sempre montou `"R$ " + número`, com o
 * espaço comum. Unificar as duas mudaria o texto de metade das telas de uma vez —
 * invisível ao olho, visível a todo `getByText` da suíte e a todo seletor de e2e.
 *
 * A issue #136 é sobre a MOEDA deixar de ser chapada, não sobre espaçamento. A
 * unificação, se for desejada, é uma decisão própria e visível; aqui as duas
 * convenções seguem, cada uma escrevendo o que já escrevia — só que agora com o
 * símbolo e as casas vindos do registro.
 */
export function formatMoneyPlainSpace(value, currency = MOEDA_PADRAO) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const info = currencyInfo(currency);
  return `${info.symbol} ${numeroDe(info.decimalPlaces).format(n)}`;
}

/**
 * Compacto para eixo de gráfico — "R$1,2k".
 *
 * Sem espaço e sem centavos de propósito: é rótulo de eixo, onde a largura é de
 * coluna e não de tela. Abaixo de mil ele ARREDONDA (sem isso, uma média sai como
 * "R$466.6666666666667" — ponto decimal en-US solto numa UI pt-BR).
 */
export function formatMoneyCompact(value, currency = MOEDA_PADRAO) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const { symbol } = currencyInfo(currency);
  return n >= 1000 ? `${symbol}${(n / 1000).toFixed(1)}k` : `${symbol}${Math.round(n)}`;
}
