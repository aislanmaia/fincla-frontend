import { pickCategoryTagFromApiTransaction } from "../../data/transactionsAdapter.js";
import { formatMoneyAbs } from "../../money/formatMoney.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

/** HTML imprimível do extrato filtrado (vira PDF pelo "Salvar como PDF" do navegador). */
export function buildPrintHtml({ title, subtitle, header, lines }) {
  const head = header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("");
  const body = lines.map((line) => `<tr>${line.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:12px system-ui,sans-serif;color:#0f0f0d;margin:24px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px;color:#4b5563}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #e2e5ea;padding:6px 8px;text-align:left}th{font-size:10px;text-transform:uppercase;color:#4b5563}tr{break-inside:avoid}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

export function printHtml(html) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  // `srcdoc` + onload atribuído ANTES de inserir: o load só dispara depois do handler existir.
  frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 1000); };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}

export function csvCell(value, textField = false) {
  const raw = String(value ?? "");
  const safe = textField && /^[\s\u0000-\u001f]*[=+\-@]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

const TYPE_LABELS = { expense: "Despesa", refund: "Estorno", income: "Receita" };
const isCredit = (row) => row.type === "refund" || row.type === "income";
/** Valor como a tela mostra: despesa negativa, estorno/receita positivos. Somar a coluna dá o líquido. */
const signedValue = (row) => `${isCredit(row) ? "" : "-"}${Math.abs(Number(row.value) || 0).toFixed(2)}`;

/** Colunas do extrato: `text` marca o que vem de texto livre e precisa de proteção contra fórmula. */
const COLUMNS = [
  { header: "Data", text: false, cell: (row) => row.date },
  { header: "Descrição", text: true, cell: (row) => row.description },
  { header: "Categoria", text: true, cell: (row) => pickCategoryTagFromApiTransaction(row)?.label || row.category || "" },
  { header: "Tipo", text: true, cell: (row) => TYPE_LABELS[row.type] ?? row.type ?? "" },
  { header: "Valor", text: false, cell: (row) => signedValue(row) },
  { header: "Moeda", text: true, cell: (row, cardCurrency) => row.value_currency || cardCurrency || "" },
  { header: "Situação", text: true, cell: (row) => row.status },
];

export function buildCsv(rows, cardCurrency) {
  const lines = rows.map((row) => COLUMNS.map((column) => csvCell(column.cell(row, cardCurrency), column.text)).join(","));
  return `\uFEFF${[COLUMNS.map((column) => csvCell(column.header)).join(","), ...lines].join("\r\n")}`;
}

export function downloadCsv(rows, cardCurrency) {
  const url = URL.createObjectURL(new Blob([buildCsv(rows, cardCurrency)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "card-transactions.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function buildPdfParts(rows, cardCurrency) {
  const show = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Situação"];
  const columns = COLUMNS.filter((column) => show.includes(column.header));
  return {
    header: columns.map((column) => column.header),
    lines: rows.map((row) => columns.map((column) => {
      const code = row.value_currency || cardCurrency;
      return column.header === "Valor" && code ? `${isCredit(row) ? "+" : "−"}${formatMoneyAbs(row.value, code)}` : column.cell(row, cardCurrency);
    })),
  };
}
