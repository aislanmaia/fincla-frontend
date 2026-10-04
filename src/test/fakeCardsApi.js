import { AxiosError } from "axios";
import apiClient from "../api/client";

const money = (n) => ({ amount: Number(n).toFixed(2), currency: "BRL" });

export function fakeItem({ id, description = "Compra", amount = 100, year, month, installment = 1, total = 1 }) {
  return {
    id,
    series_id: `s-${id}`,
    description,
    amount: money(amount),
    modality: total > 1 ? "installment" : "cash",
    transaction_date: `${year}-${String(month).padStart(2, "0")}-05`,
    installment_number: installment,
    total_installments: total,
    tags: {},
    purchase_info: {
      purchase_date: `${year}-${String(month).padStart(2, "0")}-01`,
      total_value: money(amount * total),
      last_installment_date: `${year}-${String(month).padStart(2, "0")}-20`,
      remaining_after_this: total - installment,
    },
  };
}

export function fakeInvoice({ year, month, status = "open", closingDate, total = 100, items = [] }) {
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  return {
    month: ym,
    due_date: `${ym}-20`,
    total_amount: money(total),
    status,
    items,
    closing_date: closingDate ?? `${ym}-20`,
    days_until_due: 0,
    is_overdue: false,
    paid_date: status === "paid" ? `${ym}-21` : null,
    previous_month_total: null,
    month_over_month_change: null,
    limit_usage_percent: 5,
    items_count: items.length,
    category_breakdown: [],
  };
}

export function fakeCard(overrides = {}) {
  return {
    id: 1,
    organization_id: "org-1",
    last4: "1111",
    brand: "Visa",
    due_day: 20,
    description: "Cartão 1",
    credit_limit: money(5000),
    closing_day: 20,
    color: "#2563EB",
    available_limit: money(4000),
    used_limit: money(1000),
    limit_usage_percent: 20,
    ...overrides,
  };
}

const key = (y, m) => `${y}-${m}`;

/**
 * Backend falso na camada HTTP (o `apiClient` real, com interceptores, roda por
 * cima). `invoices` mapeia cartão -> lista de faturas (o mês vem de `invoice.month`). Histórico e
 * future-commitments são derivados das faturas para ficarem coerentes entre si,
 * como no backend; `breakdownTotals` força o total de um mês no
 * future-commitments mesmo sem fatura; `historyStatus` faz o histórico dizer
 * outro status que o detalhe (dado dessincronizado).
 *
 * `today` ancora as janelas (histórico: 6 meses até o mês corrente; future: 6
 * meses a partir do mês corrente).
 */
export function installFakeCardsApi({ cards, invoices = {}, breakdownTotals = {}, historyStatus = {}, today }) {
  const calls = [];
  const original = apiClient.defaults.adapter;

  const respond = (config, status, data) => {
    const response = { status, statusText: "", data, headers: {}, config };
    if (status >= 200 && status < 300) return response;
    throw new AxiosError(`Request failed with status code ${status}`, undefined, config, undefined, response);
  };

  const monthsFrom = (start, count) => {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return out;
  };

  apiClient.defaults.adapter = async (config) => {
    const url = String(config.url).replace(/^https?:\/\/[^/]+/, "").replace(/^\/v1/, "");
    calls.push({ method: (config.method || "get").toUpperCase(), path: url, status: null });
    const record = calls[calls.length - 1];
    const done = (status, data) => {
      record.status = status;
      return respond(config, status, data);
    };

    if (url === "/credit-cards") return done(200, cards);
    if (url === "/credit-cards/consolidated-commitments") {
      return done(200, { summary: {}, monthly_breakdown: [], cards: [] });
    }
    const m = /^\/credit-cards\/(\d+)(\/.*)?$/.exec(url);
    if (!m) return done(404, {});
    const cardId = Number(m[1]);
    const rest = m[2] || "";
    const card = cards.find((c) => c.id === cardId);
    if (!card) return done(404, {});
    const byMonth = {};
    for (const i of invoices[cardId] || []) {
      const [y, mo] = i.month.split("-").map(Number);
      byMonth[key(y, mo)] = i;
    }

    if (rest === "/invoices/history") {
      const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const monthly_data = monthsFrom(start, 6)
        .filter(({ year, month }) => byMonth[key(year, month)])
        .map(({ year, month }) => {
          const inv = byMonth[key(year, month)];
          return {
            year,
            month,
            month_name: `${month}/${year}`,
            total_amount: inv.total_amount,
            status: historyStatus[key(year, month)] ?? inv.status,
            items_count: inv.items_count,
            top_category: null,
          };
        });
      return done(200, {
        card_id: cardId,
        card_name: card.description,
        period_start: "",
        period_end: "",
        summary: { total_spent: money(0), average_monthly: money(0), highest_month: null, lowest_month: null },
        monthly_data,
      });
    }
    if (rest === "/future-commitments") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthly_breakdown = monthsFrom(start, 6).map(({ year, month }) => {
        const inv = byMonth[key(year, month)];
        const forced = breakdownTotals[key(year, month)];
        const total = forced != null ? forced : inv ? Number(inv.total_amount.amount) : 0;
        return {
          year,
          month,
          month_name: `${month}/${year}`,
          total_amount: money(total),
          installments_count: inv ? inv.items_count || 1 : forced != null ? 1 : 0,
          limit_usage_percent: 7,
          top_installments: [],
        };
      });
      return done(200, {
        card_id: cardId,
        card_name: card.description,
        card_last4: card.last4,
        credit_limit: card.credit_limit,
        current_available_limit: card.available_limit,
        summary: { total_committed: money(0), average_monthly: money(0), lowest_month: null, highest_month: null },
        monthly_breakdown,
        ending_soon: [],
        insights: [],
      });
    }
    const inv = /^\/invoices\/(\d{4})\/(\d{1,2})$/.exec(rest);
    if (inv) {
      const found = byMonth[key(Number(inv[1]), Number(inv[2]))];
      return found ? done(200, found) : done(404, { detail: "Invoice not found" });
    }
    const pay = /^\/invoices\/(\d{4})\/(\d{1,2})\/mark-paid$/.exec(rest);
    if (pay && (config.method || "get").toLowerCase() === "patch") {
      const found = byMonth[key(Number(pay[1]), Number(pay[2]))];
      if (!found) return done(404, {});
      found.status = "paid";
      found.paid_date = `${found.month}-21`;
      return done(200, { message: "ok" });
    }
    if (rest === "/invoices/current") {
      return done(404, { detail: "Invoice not found" });
    }
    return done(404, {});
  };

  return {
    calls,
    uninstall: () => {
      apiClient.defaults.adapter = original;
    },
  };
}
