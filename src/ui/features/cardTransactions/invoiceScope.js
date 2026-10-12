/**
 * Recorte de tempo do ledger do cartão: ou FATURAS (uma ou mais) ou um PERÍODO livre.
 *
 * O histórico de faturas da API dá `year`, `month` e `invoice_id`; o `invoice_id` é o
 * que a lista, o resumo e as facetas aceitam. Meses sem linha de fatura chegam com
 * `invoice_id: null` e não são selecionáveis: não há o que filtrar.
 */

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
/** Acima disso o rótulo vira contagem ("5 faturas"): a lista de meses não cabe no chip. */
const MAX_NAMED = 3;

export const invoiceKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

export function invoiceOptions(history) {
  return (history?.monthly_data ?? [])
    .map((row) => ({
      key: invoiceKey(row.year, row.month),
      year: row.year,
      month: row.month,
      invoiceId: row.invoice_id ?? null,
      status: row.status,
      total: row.total_amount,
      itemsCount: row.items_count ?? 0,
    }))
    .sort((a, b) => (b.year - a.year) || (b.month - a.month));
}

/**
 * Junta a fatura ATUAL (a que o backend diz estar aberta) às opções do histórico. O
 * histórico termina no mês corrente; depois do fechamento a fatura aberta é a do mês
 * seguinte e só esta chamada a enxerga.
 */
export function withCurrentInvoice(options, current) {
  const match = /^(\d{4})-(\d{2})$/.exec(current?.month ?? "");
  if (!match || current.invoice_id == null) return options;
  const [year, month] = [Number(match[1]), Number(match[2])];
  const key = invoiceKey(year, month);
  const known = options.find((option) => option.key === key);
  if (known) return options.map((option) => option === known ? { ...option, invoiceId: option.invoiceId ?? current.invoice_id } : option);
  return [{ key, year, month, invoiceId: current.invoice_id, status: current.status, total: current.total_amount, itemsCount: current.items_count ?? 0 }, ...options]
    .sort((a, b) => (b.year - a.year) || (b.month - a.month));
}

/** A fatura atual; sem ela, a aberta mais recente, depois a mais recente com id; sem nenhuma, nada. */
export function defaultInvoiceKeys(options, currentKey = null) {
  const selectable = options.filter((option) => option.invoiceId != null);
  const current = currentKey && selectable.find((option) => option.key === currentKey);
  const open = selectable.find((option) => option.status === "open");
  const pick = current || open || selectable[0];
  return pick ? [pick.key] : [];
}

/** Só as faturas que a lista ainda mostra: remove chaves que sumiram do histórico. */
export function selectedInvoices(options, keys) {
  const wanted = new Set(keys);
  return options.filter((option) => wanted.has(option.key) && option.invoiceId != null);
}

const monthLabel = (option, currentYear) =>
  option.year === currentYear ? MONTHS[option.month - 1] : `${MONTHS[option.month - 1]}/${option.year}`;

/**
 * Legenda do chip temporal no modo Fatura. O ano aparece só nas faturas que NÃO são
 * do ano corrente ("Faturas: Ago, Set, Jan/2027"); com muitas faturas vira contagem.
 */
export function invoiceChipLabel(options, keys, now = new Date()) {
  const chosen = selectedInvoices(options, keys).sort((a, b) => (a.year - b.year) || (a.month - b.month));
  if (chosen.length === 0) return "Nenhuma fatura";
  const currentYear = now.getFullYear();
  if (chosen.length === 1) return `Fatura: ${monthLabel(chosen[0], currentYear)}`;
  if (chosen.length > MAX_NAMED) return `${chosen.length} faturas`;
  return `Faturas: ${chosen.map((option) => monthLabel(option, currentYear)).join(", ")}`;
}

/** Ids para a API. `undefined` = sem filtro de fatura (modo Período). */
export function invoiceIdsForQuery(mode, options, keys) {
  if (mode !== "invoice") return undefined;
  return selectedInvoices(options, keys).map((option) => option.invoiceId);
}

const PRESET_LABELS = {
  tudo: "Todo o período",
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  "mes-ant": "Mês anterior",
  "3m": "Últimos 3 meses",
  ano: "Este ano",
};

const shortDate = (ymd, withYear) => {
  const [year, month, day] = ymd.split("-").map(Number);
  const base = `${day} ${MONTHS[month - 1].toLocaleLowerCase("pt-BR")}`;
  return withYear ? `${base} ${year}` : base;
};

/**
 * Legenda do chip temporal no modo Período. Intervalo próprio (personalizado ou janela
 * relativa) mostra o ano das pontas que NÃO são do ano corrente, como a de faturas.
 */
export function periodChipLabel({ period, customFrom, customTo, customLabel }, now = new Date()) {
  if (period === "custom" || period === "rel") {
    const currentYear = String(now.getFullYear());
    const ends = [customFrom, customTo].filter(Boolean);
    const foreign = ends.some((ymd) => !ymd.startsWith(currentYear));
    if (customFrom && customTo && foreign) return `Período: ${shortDate(customFrom, true)} – ${shortDate(customTo, true)}`;
    return `Período: ${customLabel}`;
  }
  const label = PRESET_LABELS[period] ?? PRESET_LABELS.tudo;
  return period === "tudo" ? label : `Período: ${label}`;
}
