// api/transfers.ts
import apiClient from './client';
import { toCurrency, toFiniteNumber } from './money';
import type { CreateTransferRequest, Quotation, RawTransfer, Transfer } from './types';

/**
 * Este módulo devolvia `response.data` cru. Os valores agora chegam na forma
 * canônica `{amount, currency}` (fincla-api#140), e o extrato SOMA transferências:
 * `0 + {…}` em JavaScript vira a string `"0[object Object]"`, sem erro nenhum.
 *
 * As moedas são extraídas dos próprios valores, porque entre moedas diferentes as
 * duas pontas têm unidades distintas e mostrar as duas com o mesmo símbolo é o
 * erro que este ticket inteiro existe para eliminar.
 */
const normalizeTransfer = (raw: RawTransfer): Transfer => ({
  ...raw,
  amount: toFiniteNumber(raw?.amount),
  to_amount: toFiniteNumber(raw?.to_amount),
  from_currency: toCurrency(raw?.amount) ?? 'BRL',
  to_currency: toCurrency(raw?.to_amount) ?? 'BRL',
});

/** Cria uma transferência entre contas próprias da org. */
export const createTransfer = async (
  organizationId: string,
  body: CreateTransferRequest,
): Promise<Transfer> => {
  const response = await apiClient.post<RawTransfer>('/transfers', body, {
    params: { organization_id: organizationId },
  });
  return normalizeTransfer(response.data);
};

/** Lista transferências da org (opcionalmente filtradas por conta). */
export const listTransfers = async (
  organizationId: string,
  accountId?: string,
): Promise<Transfer[]> => {
  const response = await apiClient.get<RawTransfer[]>('/transfers', {
    params: { organization_id: organizationId, account_id: accountId },
  });
  return Array.isArray(response.data) ? response.data.map(normalizeTransfer) : [];
};

/** Remove uma transferência. */
export const deleteTransfer = async (
  transferId: string,
  organizationId: string,
): Promise<void> => {
  await apiClient.delete(`/transfers/${transferId}`, {
    params: { organization_id: organizationId },
  });
};

/**
 * A taxa do par, para PRÉ-PREENCHER o valor de destino na tela.
 *
 * Só sugere. O que vai para o backend é o que o usuário confirmar — o banco cobra
 * spread e IOF, e a taxa de mercado não é o que caiu na conta. Mostre sempre a
 * `quoted_on` junto: uma taxa de sexta apresentada como de hoje é um número
 * inventado.
 */
export const getQuotation = async (
  organizationId: string,
  base: string,
  quote: string,
): Promise<Quotation> => {
  const response = await apiClient.get<Quotation>(`/quotations/${base}/${quote}`, {
    params: { organization_id: organizationId },
  });
  return response.data;
};
