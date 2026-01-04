// api/creditCards.ts
import apiClient from './client';
import { 
  CreateCreditCardRequest, 
  UpdateCreditCardRequest, 
  CreditCard, 
  InvoiceResponse,
  InvoiceHistoryResponse,
  InvoiceMarkPaidResponse,
  MarkInvoicePaidRequest
} from '../types/api';

/**
 * Lista todos os cartões de crédito de uma organização
 */
export const listCreditCards = async (
  organizationId: string
): Promise<CreditCard[]> => {
  const response = await apiClient.get<CreditCard[]>(
    '/credit-cards',
    {
      params: { organization_id: organizationId },
    }
  );
  return response.data;
};

/**
 * Obtém um cartão de crédito específico
 */
export const getCreditCard = async (
  cardId: number,
  organizationId: string
): Promise<CreditCard> => {
  const response = await apiClient.get<CreditCard>(
    `/credit-cards/${cardId}`,
    {
      params: { organization_id: organizationId },
    }
  );
  return response.data;
};

/**
 * Cria um novo cartão de crédito
 */
export const createCreditCard = async (
  card: CreateCreditCardRequest
): Promise<CreditCard> => {
  const response = await apiClient.post<CreditCard>(
    '/credit-cards',
    card
  );
  return response.data;
};

/**
 * Atualiza um cartão de crédito existente
 */
export const updateCreditCard = async (
  cardId: number,
  data: UpdateCreditCardRequest
): Promise<CreditCard> => {
  const response = await apiClient.put<CreditCard>(
    `/credit-cards/${cardId}`,
    data
  );
  return response.data;
};

/**
 * Deleta um cartão de crédito
 */
export const deleteCreditCard = async (
  cardId: number,
  organizationId: string
): Promise<void> => {
  await apiClient.delete(`/credit-cards/${cardId}`, {
    params: { organization_id: organizationId },
  });
};

/**
 * Obtém a fatura de um cartão de crédito para um mês específico
 */
export const getCreditCardInvoice = async (
  cardId: number,
  year: number,
  month: number,
  organizationId: string
): Promise<InvoiceResponse> => {
  const response = await apiClient.get<InvoiceResponse>(
    `/credit-cards/${cardId}/invoices/${year}/${month}`,
    {
      params: { organization_id: organizationId },
    }
  );
  return response.data;
};

/**
 * Obtém o histórico de faturas de um cartão
 */
export const getInvoiceHistory = async (
  cardId: number,
  organizationId: string,
  months: number = 6
): Promise<InvoiceHistoryResponse> => {
  const response = await apiClient.get<InvoiceHistoryResponse>(
    `/credit-cards/${cardId}/invoices/history`,
    {
      params: { organization_id: organizationId, months },
    }
  );
  return response.data;
};

/**
 * Marca uma fatura como paga
 */
export const markInvoicePaid = async (
  cardId: number,
  year: number,
  month: number,
  organizationId: string,
  paidDate?: string
): Promise<InvoiceMarkPaidResponse> => {
  const body: MarkInvoicePaidRequest = paidDate ? { paid_date: paidDate } : {};
  const response = await apiClient.patch<InvoiceMarkPaidResponse>(
    `/credit-cards/${cardId}/invoices/${year}/${month}/mark-paid`,
    body,
    { params: { organization_id: organizationId } }
  );
  return response.data;
};

/**
 * Desfaz a marcação de pagamento de uma fatura
 */
export const unmarkInvoicePaid = async (
  cardId: number,
  year: number,
  month: number,
  organizationId: string
): Promise<InvoiceMarkPaidResponse> => {
  const response = await apiClient.patch<InvoiceMarkPaidResponse>(
    `/credit-cards/${cardId}/invoices/${year}/${month}/unmark-paid`,
    {},
    { params: { organization_id: organizationId } }
  );
  return response.data;
};

