import { FC, isRealYmd } from "../../routing/searchContract.js";

/**
 * Deep link `/transactions?fc_from&fc_to&fc_type&fc_status` (assistente do WhatsApp).
 * Contrato: docs/FRONTEND_TRANSACTIONS_DEEP_LINK.md.
 *
 * Devolve só o que é seguro aplicar, já no vocabulário interno do filtro:
 *  - período: só com AMBAS as datas reais e `from <= to` (par inválido é descartado inteiro,
 *    nunca meio período — mostraria dados de um intervalo que ninguém pediu);
 *  - `type`: "despesa" | "receita"; `settlement`: "pagas" | "a-pagar".
 * Qualquer valor fora do contrato é ignorado (a chave some do resultado).
 *
 * @param {Record<string, unknown> | null | undefined} search
 * @returns {{ period?: "custom", customFrom?: string, customTo?: string, type?: string, settlement?: string }}
 */
export function resolveTransactionsDeepLink(search) {
  const out = {};
  if (!search || typeof search !== "object") return out;

  const from = typeof search[FC.TX_FROM] === "string" ? search[FC.TX_FROM].trim() : "";
  const to = typeof search[FC.TX_TO] === "string" ? search[FC.TX_TO].trim() : "";
  // YYYY-MM-DD compara certo como string.
  if (isRealYmd(from) && isRealYmd(to) && from <= to) {
    out.period = "custom";
    out.customFrom = from;
    out.customTo = to;
  }

  const type = search[FC.TX_TYPE];
  if (type === "expense") out.type = "despesa";
  else if (type === "income") out.type = "receita";

  const status = search[FC.TX_STATUS];
  if (status === "paid") out.settlement = "pagas";
  else if (status === "to_pay") out.settlement = "a-pagar";

  return out;
}
