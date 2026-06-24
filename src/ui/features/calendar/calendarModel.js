// M6 — modelo puro do Calendário Financeiro (testável; sem I/O).
// Agrega transações do mês em eventos por dia (parcelas de cartão por due_date).

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DOW_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function pad2(n) {
  return String(n).padStart(2, "0");
}
export function ymd(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}
export function monthLabel(year, month) {
  return `${MONTHS_PT[month - 1]} ${year}`;
}
export function monthPrefix(year, month) {
  return `${year}-${pad2(month)}`;
}
export const WEEKDAYS = DOW_PT;

/** Matriz do mês: semanas (arrays de 7) de células {day, ymd} ou null (fora do mês). */
export function monthMatrix(year, month) {
  const startDow = new Date(year, month - 1, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, ymd: ymd(year, month, d) });
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Nome da categoria de uma transação (a partir das tags; fallback "Sem categoria"). */
export function txCategoryName(tx) {
  const tags = tx && tx.tags;
  if (tags && typeof tags === "object") {
    for (const [groupKey, list] of Object.entries(tags)) {
      const gk = String(groupKey).toLowerCase();
      const typeName = Array.isArray(list) && list[0]?.tag_type?.name ? String(list[0].tag_type.name) : "";
      const isCat = gk.includes("categoria") || gk.includes("category") || /categor/i.test(typeName);
      if (isCat && Array.isArray(list) && list.length) return list[0].name;
    }
    for (const list of Object.values(tags)) {
      if (Array.isArray(list) && list.length) return list[0].name;
    }
  }
  return (tx && tx.category) || "Sem categoria";
}

/** Agrupa transações do mês em eventos por dia (chave "YYYY-MM-DD"). */
export function buildCalendarEvents(transactions, year, month) {
  const prefix = monthPrefix(year, month);
  const inMonth = (s) => typeof s === "string" && s.slice(0, 7) === prefix;
  const byDay = {};
  const add = (key, ev) => {
    (byDay[key] ||= []).push(ev);
  };
  for (const tx of transactions || []) {
    // Cartão: cada parcela com vencimento no mês vira um evento de fatura.
    if (Array.isArray(tx.installment_info) && tx.installment_info.length) {
      for (const inst of tx.installment_info) {
        if (inMonth(inst.due_date)) {
          add(inst.due_date, { id: null, kind: "invoice", type: "expense", desc: tx.description, value: -Math.abs(Number(inst.amount) || 0), paid: false, paymentMethod: "credit", category: "Fatura de cartão" });
        }
      }
      continue;
    }
    const day = (tx.paid_at || tx.date || "").slice(0, 10);
    if (!inMonth(day)) continue;
    const paid = Boolean(tx.paid_at) || tx.status === "paid" || tx.status === "completed";
    const kind = tx.type === "income" ? "income" : tx.type === "refund" ? "refund" : "expense";
    const sign = kind === "expense" ? -1 : 1;
    add(day, { id: tx.id ?? null, kind, type: kind, desc: tx.description, value: sign * Math.abs(Number(tx.value) || 0), paid, paymentMethod: tx.payment_method || null, category: txCategoryName(tx) });
  }
  return byDay;
}

/** Semana (7 células {day, ymd, inMonth}) que contém `refYmd`, começando no domingo. */
export function weekMatrix(refYmd, refYear, refMonth) {
  const base = new Date(`${refYmd}T00:00:00`);
  const start = new Date(base);
  start.setDate(base.getDate() - base.getDay()); // volta ao domingo
  const cells = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    cells.push({ day: d.getDate(), ymd: ymd(y, m, d.getDate()), inMonth: y === refYear && m === refMonth });
  }
  return [cells];
}

/** Totais do mês para os KPIs (entradas/saídas/saldo + contagens). */
export function monthTotals(byDay) {
  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  for (const evs of Object.values(byDay)) {
    for (const e of evs) {
      if (e.value >= 0) {
        income += e.value;
        incomeCount += 1;
      } else {
        expense += -e.value;
        expenseCount += 1;
      }
    }
  }
  return { income, expense, net: income - expense, incomeCount, expenseCount };
}

/** Resumo do mês: recebido (realizado), gasto (realizado), a pagar (previsto), saldo. */
export function monthSummary(byDay) {
  let received = 0;
  let spent = 0;
  let toPay = 0;
  for (const evs of Object.values(byDay)) {
    for (const e of evs) {
      if (e.value >= 0 && e.paid) received += e.value;
      else if (e.value < 0 && e.paid) spent += -e.value;
      else if (e.value < 0 && !e.paid) toPay += -e.value;
    }
  }
  return { received, spent, toPay, net: received - spent - toPay };
}

export function dayLongLabel(ymdStr) {
  if (!ymdStr) return "";
  const d = new Date(`${ymdStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return `${DOW_PT[d.getDay()]}, ${d.getDate()} de ${MONTHS_PT[d.getMonth()].toLowerCase()}`;
}

export function todayParts() {
  const n = new Date();
  return { year: n.getFullYear(), month: n.getMonth() + 1, ymd: ymd(n.getFullYear(), n.getMonth() + 1, n.getDate()) };
}
