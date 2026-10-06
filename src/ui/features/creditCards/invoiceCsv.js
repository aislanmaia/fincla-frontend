const HEADER = "Descrição,Categoria,Valor,Data,Parcela,Recorrente";

const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

/** CSV da fatura a partir dos itens já mapeados para a UI (`mapInvoiceItemToUi`). */
export function buildInvoiceCsv(items) {
  const rows = items.map((i) => [
    quote(i.desc),
    quote(i.cat),
    quote(i.val.toFixed(2).replace(".", ",")),
    quote(i.data),
    quote(i.parcela ? `${i.parcela.n}/${i.parcela.t}` : "-"),
    quote(i.rec ? "Sim" : "Não"),
  ].join(","));
  return [HEADER, ...rows].join("\n");
}

/** Baixa o texto como arquivo `.csv` pelo navegador. */
export function downloadCsv(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
