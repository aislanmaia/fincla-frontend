import { formatMoneyPlainSpace } from "../../money/formatMoney.js";

/**
 * Transferências como linhas do extrato de UMA conta (#268, decisão do Owner).
 *
 * Com o filtro de exatamente uma conta, a lista passa a explicar o saldo dela:
 * as transferências que entraram e saíram aparecem como linhas próprias. Elas
 * ficam FORA dos totais de receitas e despesas (o resumo vem do servidor e não as
 * conta), não são editáveis como transação e não existem sem o filtro de conta.
 */

const ymdOf = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};

/** "DD/MM/YYYY" (rótulo de data da lista) → "YYYY-MM-DD". */
export function listDateLabelToYmd(label) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(label ?? ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/**
 * Transferências → linhas da lista, do ponto de vista de `accountId`.
 * Valor na moeda da conta filtrada: `amount` quando ela é a origem (saída),
 * `to_amount` quando é o destino (entrada).
 *
 * @param {Array<import("../../../api/types").Transfer>} transfers
 * @param {string} accountId
 * @param {Record<string, { label: string }>} accountsById
 * @param {{ dateStart?: string, dateEnd?: string }} range  limites do período (YYYY-MM-DD, inclusivos)
 */
export function transfersToRows(transfers, accountId, accountsById = {}, { dateStart, dateEnd } = {}) {
  const id = String(accountId);
  const nameOf = (acc) => accountsById[String(acc)]?.label || "outra conta";
  const rows = [];
  for (const t of Array.isArray(transfers) ? transfers : []) {
    const ymd = ymdOf(t.date);
    if (!ymd) continue;
    if (dateStart && ymd < dateStart) continue;
    if (dateEnd && ymd > dateEnd) continue;
    const isOrigin = String(t.from_account_id) === id;
    const isDestination = String(t.to_account_id) === id;
    if (!isOrigin && !isDestination) continue;
    const amount = isOrigin ? t.amount : t.to_amount;
    if (typeof amount !== "number") continue;
    // Entre moedas, o OUTRO lado em letra pequena: "saiu R$ 549,14" numa entrada,
    // "entrou US$ 100,00" numa saída.
    const crossCurrency = t.from_currency && t.to_currency && t.from_currency !== t.to_currency;
    const otherAmount = isOrigin ? t.to_amount : t.amount;
    const counterpartLabel = crossCurrency && typeof otherAmount === "number"
      ? `${isOrigin ? "entrou" : "saiu"} ${formatMoneyPlainSpace(Math.abs(otherAmount), isOrigin ? t.to_currency : t.from_currency)}`
      : null;
    const [y, m, d] = ymd.split("-");
    rows.push({
      id: `transfer:${t.id}`,
      kind: "transfer",
      transfer: t,
      desc: isOrigin ? `Transferência para ${nameOf(t.to_account_id)}` : `Transferência de ${nameOf(t.from_account_id)}`,
      cat: "Transferência",
      type: "transfer",
      val: isOrigin ? -Math.abs(amount) : Math.abs(amount),
      currency: isOrigin ? t.from_currency : t.to_currency,
      date: `${d}/${m}/${y}`,
      listDateYmd: ymd,
      // A categoria já diz "Transferência"; a linha de baixo traz só a nota (se
      // houver) e o outro lado da conversão — nada de "Transferência · Transferência".
      method: [t.note, counterpartLabel].filter(Boolean).join(" · "),
      counterpartLabel,
      icon: "⇄",
      tags: [],
      detailTagIds: [],
      rec: false,
      settled: true,
      settleable: false,
      status: "confirmado",
      accountId: id,
      note: t.note ?? null,
    });
  }
  return rows;
}

/**
 * Intercala as transferências nas linhas de transação, por data.
 *
 * A lista é paginada: com mais páginas por vir, uma transferência mais antiga que
 * a última linha carregada ainda não "chegou" — entraria no fim da lista antes das
 * transações do mesmo período. Só entram as que caem dentro da janela carregada.
 */
export function mergeTransferRows(rows, transferRows, { hasMore = false, ascending = false } = {}) {
  if (!transferRows?.length) return rows;
  const keyOf = (r) => r.listDateYmd || listDateLabelToYmd(r.date);
  const loadedKeys = rows.map(keyOf).filter(Boolean);
  let window = transferRows;
  if (hasMore && loadedKeys.length) {
    const edge = ascending ? loadedKeys.reduce((a, b) => (a > b ? a : b)) : loadedKeys.reduce((a, b) => (a < b ? a : b));
    window = transferRows.filter((t) => (ascending ? t.listDateYmd <= edge : t.listDateYmd >= edge));
  } else if (hasMore) {
    window = [];
  }
  const out = [...rows];
  for (const t of window) {
    const at = out.findIndex((r) => {
      const k = keyOf(r);
      return k && (ascending ? k > t.listDateYmd : k < t.listDateYmd);
    });
    if (at === -1) out.push(t);
    else out.splice(at, 0, t);
  }
  return out;
}
