import { invoiceItemTagNames, mapInvoiceItemToUi } from "../../data/creditCardsAdapter.js";
import { matchesValueRange } from "../transactions/filters/filtersToLegacyParams.js";

const amountOf = (value) => {
  if (value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

const transactionDateKey = (value) => /^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(value ?? "")?.[1] ?? "";

export function invoiceRows(items, { search = "", cats = [], tags = [], tagMode = "any", modality = "all", from = "", to = "", valueMin = "", valueMax = "" } = {}) {
  const query = search.trim().toLocaleLowerCase("pt-BR");
  return (items ?? [])
    .map((item) => {
      const row = mapInvoiceItemToUi(item);
      const date = transactionDateKey(item.transaction_date);
      return {
        ...row,
        data: /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : "—",
        dataKey: date,
        purchaseDate: item.purchase_info?.purchase_date ?? null,
        categoryId: item.tags?.categoria?.[0]?.id ?? "uncategorized",
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : "",
        transactionDate: date,
      };
    })
    .filter((row) => (
      (!query || `${row.desc} ${row.cat ?? ""}`.toLocaleLowerCase("pt-BR").includes(query)) &&
      (cats.length === 0 || cats.includes(row.categoryId)) &&
      (tags.length === 0 || (tagMode === "all" ? tags.every((tag) => row.tags.includes(tag)) : tags.some((tag) => row.tags.includes(tag)))) &&
      (modality === "all" || row.modality === modality) &&
      (!from || row.transactionDate >= from) && (!to || row.transactionDate <= to) &&
      (row.val == null ? !valueMin && !valueMax : matchesValueRange(Math.abs(row.val), valueMin, valueMax))
    ));
}

export function categoryOptions(breakdown) {
  return (breakdown ?? []).filter((row) => row.category_name)
    .map((row) => ({ id: row.category_id == null ? "uncategorized" : String(row.category_id), name: row.category_name, color: row.category_color }));
}

export function tagOptions(items) {
  return [...new Set((items ?? []).flatMap(invoiceItemTagNames))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function weeklySpending(items) {
  const dates = (items ?? []).map((item) => transactionDateKey(item.transaction_date)).filter(Boolean).sort();
  if (dates.length === 0) return [];
  const start = new Date(`${dates[0]}T12:00:00`);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(`${dates.at(-1)}T12:00:00`);
  const buckets = [];
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 7)) {
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    buckets.push({ key, label: day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), amount: 0, hasData: false });
  }
  for (const item of items ?? []) {
    const dateKey = transactionDateKey(item.transaction_date);
    if (!dateKey) continue;
    const date = new Date(`${dateKey}T12:00:00`);
    date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const bucket = buckets.find((row) => row.key === key);
    const amount = amountOf(item.amount);
    if (!bucket || amount === null) continue;
    bucket.hasData = true;
    bucket.amount += item.modality === "refund" ? -amount : amount;
  }
  return buckets;
}
