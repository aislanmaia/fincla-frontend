import { formatYmdToBrDisplay, pickCategoryTagFromApiTransaction } from "../../data/transactionsAdapter.js";
import { formatMoneyAbs } from "../../money/formatMoney.js";
import { statusLabel } from "./ledgerModel.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

/** HTML imprimível do extrato filtrado (vira PDF pelo "Salvar como PDF" do navegador). */
export function buildPrintHtml({ title, subtitle, header, lines, summary }) {
  const head = header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("");
  const body = lines.map((line) => `<tr>${line.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  const summaryHtml = summary?.lines.length ? `<h2>Resumo por categoria</h2><table class="summary"><thead><tr>${summary.header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${summary.lines.map((line) => `<tr>${line.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table><h2>Lançamentos</h2>` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:12px system-ui,sans-serif;color:#0f0f0d;margin:24px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px;color:#4b5563}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #e2e5ea;padding:6px 8px;text-align:left}th{font-size:10px;text-transform:uppercase;color:#4b5563}tr{break-inside:avoid}h2{font-size:13px;margin:16px 0 6px}table.summary{width:auto;min-width:50%}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p>${summaryHtml}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
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

/** A API manda "2026-10-27T00:00:00"; a hora zerada não diz nada num extrato. */
const dateOnly = (value) => String(value ?? "").slice(0, 10);
const TYPE_LABELS = { expense: "Despesa", refund: "Estorno", income: "Receita" };
const isCredit = (row) => row.type === "refund" || row.type === "income";
/** Valor como a tela mostra: despesa negativa, estorno/receita positivos. Somar a coluna dá o líquido. */
const signedValue = (row) => `${isCredit(row) ? "" : "-"}${Math.abs(Number(row.value) || 0).toFixed(2)}`;

/** Colunas do extrato: `text` marca o que vem de texto livre e precisa de proteção contra fórmula. */
const COLUMNS = [
  { header: "Data", text: false, cell: (row) => dateOnly(row.date), pdf: (row) => { const br = formatYmdToBrDisplay(dateOnly(row.date)); return br && br !== "—" ? br : dateOnly(row.date); } },
  { header: "Descrição", text: true, cell: (row) => row.description },
  { header: "Categoria", text: true, cell: (row) => pickCategoryTagFromApiTransaction(row)?.label || row.category || "" },
  { header: "Tipo", text: true, cell: (row) => TYPE_LABELS[row.type] ?? row.type ?? "" },
  { header: "Valor", text: false, cell: (row) => signedValue(row) },
  { header: "Moeda", text: true, cell: (row, cardCurrency) => row.value_currency || cardCurrency || "" },
  { header: "Situação", text: true, cell: (row) => statusLabel(row) },
];

export function buildCsv(rows, cardCurrency) {
  const lines = rows.map((row) => COLUMNS.map((column) => csvCell(column.cell(row, cardCurrency), column.text)).join(","));
  return `\uFEFF${[COLUMNS.map((column) => csvCell(column.header)).join(","), ...lines].join("\r\n")}`;
}

/** Nome do arquivo exportado: `lancamentos-AAAA-MM-DD.csv`, com a extensão sempre presente. */
export const exportFileName = (extension, now = new Date()) => `lancamentos-${now.toISOString().slice(0, 10)}.${extension}`;

export function downloadCsv(rows, cardCurrency, filename = exportFileName("csv")) {
  const url = URL.createObjectURL(new Blob([buildCsv(rows, cardCurrency)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  // No DOM durante o clique e URL viva por um tempo: revogar na hora faz alguns navegadores salvarem o arquivo sem nome nem extensão.
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 30000);
}

const categoryOf = (row) => pickCategoryTagFromApiTransaction(row)?.label || row.category || "Sem categoria";

/** Total líquido por categoria e moeda (compra soma, estorno abate); cada moeda em bloco próprio, do maior para o menor. */
export function buildCategorySummary(rows, cardCurrency) {
  const groups = new Map();
  for (const row of rows) {
    const currency = row.value_currency || cardCurrency || "";
    const key = `${categoryOf(row)}\u0000${currency}`;
    const group = groups.get(key) ?? { category: categoryOf(row), currency, count: 0, amount: 0 };
    group.count += 1;
    group.amount = Math.round((group.amount + (isCredit(row) ? -1 : 1) * Math.abs(Number(row.value) || 0)) * 100) / 100;
    groups.set(key, group);
  }
  const money = (group) => (group.currency ? formatMoneyAbs(group.amount, group.currency) : null) ?? group.amount.toFixed(2);
  return {
    header: ["Categoria", "Lançamentos", "Total"],
    lines: [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency) || b.amount - a.amount).map((group) => [group.category, String(group.count), `${group.amount < 0 ? "−" : ""}${money({ ...group, amount: Math.abs(group.amount) })}`]),
  };
}

export function buildPdfParts(rows, cardCurrency) {
  const show = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "Situação"];
  const columns = COLUMNS.filter((column) => show.includes(column.header));
  return {
    summary: buildCategorySummary(rows, cardCurrency),
    header: columns.map((column) => column.header),
    lines: rows.map((row) => columns.map((column) => {
      const code = row.value_currency || cardCurrency;
      return column.header === "Valor" && code ? `${isCredit(row) ? "+" : "−"}${formatMoneyAbs(row.value, code)}` : (column.pdf ?? column.cell)(row, cardCurrency);
    })),
  };
}
