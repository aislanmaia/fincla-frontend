/** Formatação monetária pt-BR — hoje um repasse para o formatador único.
 *
 * As três funções existiam com `"R$ "` colado na string, e é por isso que o app
 * só sabia desenhar real. A moeda passou a ser um ARGUMENTO, e o símbolo e as casas
 * vêm do registro (fincla-frontend#136).
 *
 * **A moeda é obrigatória (#310).** Havia um padrão silencioso — "sem moeda, real" —
 * e foi por ele que a Visão Geral de uma organização em dólar escrevia "R$ 5.092,19":
 * dezenas de chamadas sem moeda, todas compilando, todas erradas fora do real. Agora:
 * - moeda `null`/`undefined` explícita = "não sabemos a moeda" → travessão;
 * - moeda ESQUECIDA (chamada com um argumento, ou o índice do recharts no lugar) é
 *   defeito de quem chama: no teste ela LANÇA, para a suíte pegar; fora dele, loga
 *   e escreve travessão — nunca "R$".
 * Telas cujos valores são todos na base da organização usam `useBaseCurrencyMoney`.
 */
import { formatMoneyCompact, formatMoneyPlainSpace } from "./money/formatMoney.js";

const SEM_MOEDA = "—";

/** `true` quando a chamada esqueceu a moeda (não confundir com `null` explícito). */
function moedaEsquecida(nome, args) {
  const moeda = args[1];
  const esquecida = args.length < 2 || (moeda != null && typeof moeda !== "string");
  if (!esquecida) return false;
  const msg = `${nome}: moeda ausente — passe a moeda dos valores (ver #310)`;
  if (import.meta.env?.MODE === "test") throw new Error(msg);
  console.error(msg);
  return true;
}

/**
 * `formatMoneyPlainSpace` e não `formatMoney`: estas três funções sempre montaram
 * `"R$ " + número` com o espaço COMUM, enquanto `accountMeta.formatMoney` sempre
 * usou o `Intl`, que separa com o inquebrável. Trocar a convenção aqui mudaria o
 * texto de metade das telas de uma vez — invisível ao olho, visível a todo
 * `getByText`. O que muda é só de onde vêm o símbolo e as casas.
 */
export function fmtAbs(v, moeda) {
  if (moedaEsquecida("fmtAbs", arguments) || !moeda) return SEM_MOEDA;
  return formatMoneyPlainSpace(Math.abs(Number(v) || 0), moeda) ?? "";
}
export function fmtSgn(v, moeda) {
  if (moedaEsquecida("fmtSgn", arguments) || !moeda) return SEM_MOEDA;
  const n = Number(v) || 0;
  return (n >= 0 ? "+" : "−") + (formatMoneyPlainSpace(Math.abs(n), moeda) ?? "");
}
// Abaixo de mil não corta em "k", mas arredonda: sem o Math.round, um valor
// fracionário (ex.: média de uma divisão) sai como "R$466.6666666666667" —
// ponto decimal en-US solto numa UI pt-BR.
//
// Não pode ir direto como `tickFormatter`: o recharts o chama com (valor, índice),
// e o índice no lugar da moeda é tratado como moeda esquecida. Use
// `(v) => fmtK(v, moeda)` — ou o `fmtK` de `useBaseCurrencyMoney`, que já é assim.
export function fmtK(v, moeda) {
  if (moedaEsquecida("fmtK", arguments) || !moeda) return "";
  return formatMoneyCompact(v, moeda) ?? "";
}
