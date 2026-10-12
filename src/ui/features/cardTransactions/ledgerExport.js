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
  document.body.appendChild(frame);
  frame.contentDocument.open();
  frame.contentDocument.write(html);
  frame.contentDocument.close();
  frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 1000); };
}
