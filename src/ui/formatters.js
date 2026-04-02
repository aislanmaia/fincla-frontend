/** Formatação monetária pt-BR (UI espelhada do protótipo em docs/) */
export const fmtAbs = (v) =>
  "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtSgn = (v) =>
  (v >= 0 ? "+" : "−") +
  "R$ " +
  Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtK = (v) => (v >= 1000 ? "R$" + (v / 1000).toFixed(1) + "k" : "R$" + v);
