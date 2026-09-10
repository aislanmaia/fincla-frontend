/** Formatação monetária pt-BR — hoje um repasse para o formatador único.
 *
 * As três funções existiam com `"R$ "` colado na string, e é por isso que o app
 * só sabia desenhar real. Elas continuam aqui, com a mesma assinatura e a mesma
 * saída para real, porque são importadas por dezenas de arquivos — o que mudou é
 * que a moeda passou a ser um ARGUMENTO, e o símbolo e as casas passaram a vir do
 * registro (fincla-frontend#136).
 *
 * Quem não passa moeda continua escrevendo em real, como antes. Quem passa,
 * escreve na moeda certa — e é isso que as telas multi-moeda precisavam.
 */
import { formatMoneyCompact, formatMoneyPlainSpace } from "./money/formatMoney.js";
import { MOEDA_PADRAO } from "./money/currencyRegistry.js";

/**
 * `formatMoneyPlainSpace` e não `formatMoney`: estas três funções sempre montaram
 * `"R$ " + número` com o espaço COMUM, enquanto `accountMeta.formatMoney` sempre
 * usou o `Intl`, que separa com o inquebrável. Trocar a convenção aqui mudaria o
 * texto de metade das telas de uma vez — invisível ao olho, visível a todo
 * `getByText`. O que muda é só de onde vêm o símbolo e as casas.
 */
export const fmtAbs = (v, moeda = MOEDA_PADRAO) =>
  formatMoneyPlainSpace(Math.abs(Number(v) || 0), moeda) ?? "";
export const fmtSgn = (v, moeda = MOEDA_PADRAO) => {
  const n = Number(v) || 0;
  return (n >= 0 ? "+" : "−") + (formatMoneyPlainSpace(Math.abs(n), moeda) ?? "");
};
// Abaixo de mil não corta em "k", mas arredonda: sem o Math.round, um valor
// fracionário (ex.: média de uma divisão) sai como "R$466.6666666666667" —
// ponto decimal en-US solto numa UI pt-BR.
export const fmtK = (v, moeda = MOEDA_PADRAO) => formatMoneyCompact(v, moeda) ?? "";
