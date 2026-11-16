import { filePrefixOf } from "./exportRequest.js";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** O nome do cartão como o usuário o chamou; sem nome, a bandeira e o final. */
export const cardExportName = (card) => card?.description?.trim() || [card?.brand, card?.last4].filter(Boolean).join(" ") || "Cartão";

/**
 * Como a exportação de UMA fatura se identifica (fincla-api#525): o título de origem, o prefixo do arquivo
 * (`cartao-nubank-fatura-2026-11`: nome do cartão e mês da fatura) e a linha "Fatura: Nov/2026" dos filtros —
 * sempre com ano, porque o arquivo é lido fora da tela (mesmo formato de `invoiceExportLabel`).
 */
export function invoiceExportNames(card, year, month) {
  const name = cardExportName(card);
  const label = `${MONTHS[month - 1]}/${year}`;
  const last4 = card?.last4 && card?.description?.trim() ? ` •${card.last4}` : "";
  return {
    title: `${name}${last4} · Fatura de ${label}`,
    filePrefix: filePrefixOf("cartao", `${name} fatura ${year}-${String(month).padStart(2, "0")}`),
    invoiceLine: `Fatura: ${label}`,
  };
}
