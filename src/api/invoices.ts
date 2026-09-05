// api/invoices.ts
//
// Fatura e histórico chegam na forma canônica (fincla-api#133).
// `unwrapMoney` desembrulha em qualquer profundidade — enumerar campo a campo é
// onde se esquece um, e um esquecido vira "R$ NaN" na tela.
import apiClient from './client';
import { unwrapMoney } from './money';
import { Invoice, ListInvoicesResponse } from './types';

export interface ListInvoicesParams {
  limit?: number;
  offset?: number;
}

/**
 * Lista as faturas do usuário autenticado (mais recentes primeiro).
 * Endpoint paginado; default é o do backend (limit 20).
 */
export const listInvoices = async (
  params: ListInvoicesParams = {}
): Promise<ListInvoicesResponse> => {
  const response = await apiClient.get<ListInvoicesResponse>('/invoices', {
    params,
  });
  return unwrapMoney(response.data);
};

/**
 * Detalhe de uma fatura. Retorna 404 quando a fatura pertence a outro
 * usuário (decisão de não vazar existência entre contas).
 */
export const getInvoice = async (invoiceId: string): Promise<Invoice> => {
  const response = await apiClient.get<Invoice>(`/invoices/${invoiceId}`);
  return unwrapMoney(response.data);
};
