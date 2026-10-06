/**
 * Mês da fatura que recebe uma compra feita hoje: espelho exato de
 * `CreditCardScheduleService._next_due_date` do backend (a mesma regra que o
 * `GET /invoices/current` usa). Existe para a tela não precisar chamar
 * `/invoices/current` só para saber qual fatura é a aberta.
 *
 * Com `closing_day`: compra ANTES do fechamento cai no mês corrente; NO dia ou depois,
 * no mês seguinte. Sem `closing_day`: vale o vencimento — se o vencimento deste mês
 * já chegou (<= hoje), é o mês seguinte.
 */
const daysIn = (year, month) => new Date(year, month, 0).getDate();

function nextMonth(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function openInvoiceRef(card, today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const closing = card?.closing_day != null ? Number(card.closing_day) : null;
  const due = Number(card?.due_day);

  if (closing !== null && Number.isFinite(closing)) {
    return day < Math.min(closing, daysIn(year, month)) ? { year, month } : nextMonth(year, month);
  }
  if (!Number.isFinite(due)) return { year, month };
  return Math.min(due, daysIn(year, month)) <= day ? nextMonth(year, month) : { year, month };
}
