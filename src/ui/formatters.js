/** Formatação monetária pt-BR (UI espelhada do protótipo em docs/) */
export const fmtAbs = (v) =>
  "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtSgn = (v) =>
  (v >= 0 ? "+" : "−") +
  "R$ " +
  Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Abaixo de mil não corta em "k", mas arredonda: sem o Math.round, um valor
// fracionário (ex.: média de uma divisão) sai como "R$466.6666666666667" —
// ponto decimal en-US solto numa UI pt-BR.
export const fmtK = (v) => (v >= 1000 ? "R$" + (v / 1000).toFixed(1) + "k" : "R$" + Math.round(v));
