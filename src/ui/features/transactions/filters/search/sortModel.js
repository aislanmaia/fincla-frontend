/**
 * Modelo da ordenação multi-nível usada pela Variação C.
 * Lê o handoff `design_handoff_filtros_transacoes/variation-c.jsx` (SORT_FIELDS, DEFAULT_DIR,
 * sortItems) — aqui virou modelo puro, sem dependência de React.
 *
 * Estado de ordenação = array de regras `{ field, dir }`. A comparação é em cascata:
 * empate na regra 1 cai para a regra 2, e assim por diante.
 */

export const SORT_FIELDS = {
  date: {
    label: "Data",
    icon: "calendar",
    dirLabels: { desc: "Mais recente primeiro", asc: "Mais antiga primeiro" },
  },
  val: {
    label: "Valor",
    icon: "trending",
    dirLabels: { desc: "Maior valor primeiro", asc: "Menor valor primeiro" },
  },
  tipo: {
    label: "Tipo",
    icon: "filter",
    dirLabels: { desc: "Receitas primeiro", asc: "Despesas primeiro" },
  },
  desc: {
    label: "Descrição",
    icon: "arrow-up-down",
    dirLabels: { asc: "A → Z", desc: "Z → A" },
  },
  cat: {
    label: "Categoria",
    icon: "circle",
    dirLabels: { asc: "A → Z", desc: "Z → A" },
  },
};

export const DEFAULT_DIR = {
  date: "desc",
  val: "desc",
  tipo: "desc",
  desc: "asc",
  cat: "asc",
};

export const DEFAULT_SORT = [{ field: "date", dir: "desc" }];

export function isDefaultSort(sort) {
  return (
    sort.length === 1 &&
    sort[0].field === DEFAULT_SORT[0].field &&
    sort[0].dir === DEFAULT_SORT[0].dir
  );
}

/** Parse de `dd/mm` (ano implícito) — devolve número monotônico para comparação. */
function parseTxDate(raw) {
  if (!raw) return 0;
  const parts = String(raw).split("/").map(Number);
  if (parts.length === 2) {
    const [day, month] = parts;
    return month * 100 + day;
  }
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return year * 10000 + month * 100 + day;
  }
  return 0;
}

export function compareByField(x, y, field) {
  switch (field) {
    case "date":
      return parseTxDate(x.date) - parseTxDate(y.date);
    case "val":
      return (x.val ?? 0) - (y.val ?? 0);
    case "desc":
      return (x.desc || "").localeCompare(y.desc || "", "pt-BR");
    case "cat":
      return (x.cat || "").localeCompare(y.cat || "");
    case "tipo":
      return Math.sign(x.val ?? 0) - Math.sign(y.val ?? 0);
    default:
      return 0;
  }
}

/** Ordena `items` aplicando as regras em cascata. Imutável. */
export function sortItems(items, rules) {
  if (!Array.isArray(items)) return [];
  if (!Array.isArray(rules) || rules.length === 0) return items.slice();
  return items.slice().sort((x, y) => {
    for (const rule of rules) {
      const cmp = compareByField(x, y, rule.field);
      if (cmp !== 0) return rule.dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

/** Serializa para uso em URL/API: `date:desc,val:asc` */
export function encodeSort(rules) {
  return rules.map((r) => `${r.field}:${r.dir}`).join(",");
}

export function decodeSort(encoded) {
  if (!encoded) return [];
  return encoded
    .split(",")
    .map((token) => {
      const [field, dir] = token.split(":");
      if (!SORT_FIELDS[field]) return null;
      return { field, dir: dir === "asc" ? "asc" : "desc" };
    })
    .filter(Boolean);
}

/** Helpers de manipulação imutável usados pelo SortMenu. */
export function addRule(sort, field) {
  if (!SORT_FIELDS[field]) return sort;
  if (sort.some((r) => r.field === field)) return sort;
  return [...sort, { field, dir: DEFAULT_DIR[field] }];
}

export function removeRule(sort, index) {
  return sort.filter((_, i) => i !== index);
}

export function toggleDir(sort, index) {
  return sort.map((rule, i) =>
    i === index ? { ...rule, dir: rule.dir === "asc" ? "desc" : "asc" } : rule,
  );
}

export function moveRule(sort, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= sort.length) return sort;
  const next = sort.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function availableFields(sort) {
  const used = new Set(sort.map((r) => r.field));
  return Object.keys(SORT_FIELDS).filter((f) => !used.has(f));
}
